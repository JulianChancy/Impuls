import { requireSupabase, supabase } from './supabaseClient';
import { cloneData, defaultData } from './storage';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuidOrUndefined(value) {
  return UUID_RE.test(String(value || '')) ? value : undefined;
}

function uuidOrNull(value) {
  return UUID_RE.test(String(value || '')) ? value : null;
}

function stripUndefined(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

function requireUserId(userId) {
  requireSupabase();
  if (!userId) throw new Error('Supabase database calls require a userId.');
}

async function singleOrThrow(query) {
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

function upsertRow(table, row, onConflict) {
  return supabase.from(table).upsert(row, row.id ? undefined : { onConflict });
}

async function manyOrThrow(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function deleteUserRowsNotIn(table, userId, ids) {
  let query = supabase.from(table).delete().eq('user_id', userId);
  if (ids.length) query = query.not('id', 'in', `(${ids.join(',')})`);
  const { error } = await query;
  if (error) throw error;
}

function exerciseRow(userId, parentKey, parentId, exercise, position = 0) {
  const actualMetrics = Array.isArray(exercise.actual_metrics) ? exercise.actual_metrics : null;
  return stripUndefined({
    id: uuidOrUndefined(exercise.id),
    user_id: userId,
    [parentKey]: parentId,
    exercise_name: exercise.exercise_name || '',
    movement_type: exercise.movement_type || 'skill',
    sets: numberOrNull(exercise.sets),
    reps: numberOrNull(exercise.reps),
    contacts: numberOrNull(exercise.contacts),
    duration_minutes: numberOrNull(exercise.duration_minutes),
    intensity_value: numberOrNull(exercise.intensity_value),
    intensity_unit: exercise.intensity_unit || '%',
    intent_percent: numberOrNull(exercise.intent_percent),
    distance: numberOrNull(exercise.distance),
    rom: exercise.rom || null,
    tempo: exercise.tempo || null,
    // Force-Velocity coverage tags used by the analysis engine.
    quality: exercise.quality || null,
    specificity: exercise.specificity || null,
    laterality: exercise.laterality || null,
    variation: exercise.variation || null,
    // Store attempt-level metrics in the existing JSON column too, so older Supabase schemas still round-trip them.
    set_metrics: actualMetrics || exercise.set_metrics || [],
    position: exercise.position ?? exercise.order ?? position,
  });
}

// Columns added by the FV-coverage migration. If a project has not run it yet,
// retry the upsert without these so planning still saves.
const EXERCISE_TAG_COLUMNS = ['distance', 'tempo', 'quality', 'specificity', 'laterality', 'variation'];

function missingColumnFrom(error) {
  const msg = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
  // PostgREST: "Could not find the 'tempo' column ..."; Postgres 42703: column "tempo" ... does not exist
  const match = msg.match(/'([a-z0-9_]+)' column|column "([a-z0-9_]+)"|the '([a-z0-9_]+)' column/i);
  return (match && (match[1] || match[2] || match[3])) || null;
}

async function upsertExerciseRow(table, row, onConflict) {
  // Resilient to a Supabase schema that hasn't run every migration yet: if a column
  // doesn't exist, drop just that field and retry, so planning still saves.
  const attempt = { ...row };
  for (let i = 0; i < 12; i += 1) {
    try {
      return await singleOrThrow(upsertRow(table, attempt, onConflict));
    } catch (error) {
      const col = missingColumnFrom(error);
      if (!col || !(col in attempt) || col === 'id' || col === 'user_id') throw error;
      console.warn(`[SUPABASE SAVE] '${table}.${col}' column missing — saving without it. Run the migration in supabase/schema.sql.`, error);
      delete attempt[col];
    }
  }
  return singleOrThrow(upsertRow(table, attempt, onConflict));
}

function exerciseFromRow(row) {
  const movementType = row.movement_type || 'skill';
  const storedMetrics = Array.isArray(row.actual_metrics)
    ? row.actual_metrics
    : Array.isArray(row.set_metrics)
      ? row.set_metrics
      : [];
  return {
    id: row.id,
    exercise_name: row.exercise_name || '',
    movement_type: movementType,
    sets: row.sets ?? '',
    reps: row.reps ?? '',
    contacts: row.contacts ?? '',
    duration_minutes: row.duration_minutes ?? '',
    intensity_value: row.intensity_value ?? '',
    intensity_unit: row.intensity_unit || '%',
    intent_percent: row.intent_percent ?? '',
    distance: row.distance ?? '',
    rom: row.rom || (movementType === 'strength' ? 'full' : ''),
    tempo: row.tempo || '',
    quality: row.quality || '',
    specificity: row.specificity || '',
    laterality: row.laterality || '',
    variation: row.variation || '',
    set_metrics: row.set_metrics || [],
    actual_metrics: storedMetrics,
    order: row.position ?? 0,
  };
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sessionFromRow(row, exercises = []) {
  return {
    id: row.id,
    session_name: row.session_name || '',
    session_datetime: row.session_datetime,
    notes: row.notes || '',
    metric_type: row.metric_type || '',
    metrics: row.metrics || {},
    planned_session_id: row.planned_session_id || null,
    exercises: exercises.sort((a, b) => (a.order || 0) - (b.order || 0)),
  };
}

function cleanOldDefaultText(value, oldValue) {
  return value === oldValue ? '' : (value || '');
}

function isOldDefaultPlannedSession(row) {
  return [
    ['Lower Body Power', '2026-05-21'],
    ['Upper Body Strength', '2026-05-22'],
    ['Speed', '2026-05-23'],
    ['Lower Body Strength', '2026-05-24'],
  ].some(([name, date]) => row.session_name === name && row.date === date);
}

function checkInFromRow(row) {
  const legacyUnit = row.unit || '';
  return {
    id: row.id,
    check_in_datetime: row.check_in_datetime,
    linked_session_id: row.linked_session_id,
    pain_score: row.pain_score ?? 0,
    pain_location: row.pain_location || '',
    freshness_score: row.freshness_score ?? 0,
    soreness_score: row.soreness_score ?? 0,
    performance_score: row.performance_score ?? 0,
    performance_type: row.performance_type || 'jumping',
    gct: row.gct ?? '',
    gct_unit: row.gct_unit || 'seconds',
    ft: row.ft ?? '',
    ft_unit: row.ft_unit || 'seconds',
    height_or_distance: row.height_or_distance ?? '',
    height_or_distance_unit: row.height_or_distance_unit || legacyUnit || 'cm',
    sprint_time: row.sprint_time ?? '',
    sprint_time_unit: row.sprint_time_unit || 'seconds',
    distance: row.distance ?? '',
    distance_unit: row.distance_unit || legacyUnit || 'metres',
    lift_name: row.lift_name || '',
    weight: row.weight ?? '',
    weight_unit: row.weight_unit || 'kg',
    sets: row.sets ?? '',
    reps: row.reps ?? '',
    bar_velocity: row.bar_velocity ?? '',
    bar_velocity_unit: row.bar_velocity_unit || 'm/s',
    unit: legacyUnit,
  };
}

function profileFromRow(row) {
  return {
    ...defaultData.profile,
    name: cleanOldDefaultText(row?.name, 'Alex') || defaultData.profile.name,
    onboarding_completed: row?.onboarding_completed ?? defaultData.profile.onboarding_completed,
    tutorialFlags: {
      ...defaultData.profile.tutorialFlags,
      ...(row?.tutorial_flags || row?.tutorialFlags || {}),
    },
    pbs: {
      ...defaultData.profile.pbs,
      ...(row?.pbs || {}),
    },
  };
}

function plannedSessionFromRow(row, exercises = []) {
  return {
    id: row.id,
    date: row.date,
    session_name: row.session_name || '',
    focus: row.focus || '',
    duration: row.duration || '',
    notes: row.notes || '',
    performance_score: row.performance_score ?? '',
    performance_notes: row.performance_notes || '',
    performance_logged_at: row.performance_logged_at || null,
    completed: !!row.completed,
    position: row.position ?? 0,
    exercises: exercises.sort((a, b) => (a.order || 0) - (b.order || 0)),
  };
}

async function upsertPlannedSessionRow(userId, weekId, session) {
  const fullPayload = stripUndefined({
    id: uuidOrUndefined(session.id),
    user_id: userId,
    week_id: weekId,
    date: session.date || null,
    session_name: session.session_name || '',
    focus: session.focus || '',
    duration: session.duration || '',
    notes: session.notes || '',
    performance_score: numberOrNull(session.performance_score),
    performance_notes: session.performance_notes || null,
    performance_logged_at: session.performance_logged_at || null,
    completed: !!session.completed,
    position: session.position ?? 0,
  });

  try {
    return await singleOrThrow(upsertRow('planned_sessions', fullPayload, 'week_id,position'));
  } catch (error) {
    const schemaMessage = `${error?.message || ''} ${error?.details || ''}`;
    if (!/performance_score|performance_notes|performance_logged_at/i.test(schemaMessage)) throw error;
    console.warn('[SUPABASE SAVE] Planned session performance columns missing. Run the planned-session performance migration in supabase/schema.sql.', error);
    return singleOrThrow(
      upsertRow('planned_sessions', stripUndefined({
        id: uuidOrUndefined(session.id),
        user_id: userId,
        week_id: weekId,
        date: session.date || null,
        session_name: session.session_name || '',
        focus: session.focus || '',
        duration: session.duration || '',
        notes: session.notes || '',
        completed: !!session.completed,
        position: session.position ?? 0,
      }), 'week_id,position')
    );
  }
}

async function createDefaultProgrammeForUser(userId) {
  await saveProfile(userId, defaultData.profile);
  await saveProgramme(userId, defaultData.programme);
}

export async function loadAppDataFromSupabase(userId) {
  requireUserId(userId);

  const [profiles, programmes, macroBlocks, blocks, weeks, plannedSessions, plannedExercises, sessions, sessionExercises, checkIns, insightRows] = await Promise.all([
    manyOrThrow(supabase.from('profiles').select('*').eq('user_id', userId).order('created_at', { ascending: true })),
    manyOrThrow(supabase.from('programmes').select('*').eq('user_id', userId).order('created_at', { ascending: true })),
    manyOrThrow(supabase.from('macro_blocks').select('*').eq('user_id', userId).order('position', { ascending: true })),
    manyOrThrow(supabase.from('training_blocks').select('*').eq('user_id', userId).order('position', { ascending: true })),
    manyOrThrow(supabase.from('training_weeks').select('*').eq('user_id', userId).order('position', { ascending: true })),
    manyOrThrow(supabase.from('planned_sessions').select('*').eq('user_id', userId).order('date', { ascending: true }).order('position', { ascending: true })),
    manyOrThrow(supabase.from('planned_exercises').select('*').eq('user_id', userId).order('position', { ascending: true })),
    manyOrThrow(supabase.from('sessions').select('*').eq('user_id', userId).order('session_datetime', { ascending: false })),
    manyOrThrow(supabase.from('session_exercises').select('*').eq('user_id', userId).order('position', { ascending: true })),
    manyOrThrow(supabase.from('check_ins').select('*').eq('user_id', userId).order('check_in_datetime', { ascending: false })),
    manyOrThrow(supabase.from('check_in_insight_history').select('*').eq('user_id', userId).order('saved_at', { ascending: false })),
  ]);

  if (!programmes.length) {
    await createDefaultProgrammeForUser(userId);
    return loadAppDataFromSupabase(userId);
  }

  const programmeRow = programmes[0];
  const plannedExercisesBySession = groupBy(plannedExercises, 'planned_session_id');
  const plannedSessionsByWeek = groupBy(plannedSessions, 'week_id');
  const weeksByBlock = groupBy(weeks, 'block_id');
  const blocksByMacro = groupBy(blocks, 'macro_block_id');
  const sessionExercisesBySession = groupBy(sessionExercises, 'session_id');

  const programme = {
    id: programmeRow.id,
    calendar_name: cleanOldDefaultText(programmeRow.calendar_name, 'Off-Season 2024') || defaultData.programme.calendar_name,
    selected_macro_id: programmeRow.selected_macro_id,
    selected_block_id: programmeRow.selected_block_id,
    selected_week_id: programmeRow.selected_week_id,
    day_notes: programmeRow.day_notes || {},
    copied_session: programmeRow.copied_session || null,
    session_templates: Array.isArray(programmeRow.session_templates) ? programmeRow.session_templates : [],
    macro_blocks: macroBlocks
      .filter((macro) => macro.programme_id === programmeRow.id)
      .map((macro) => ({
        id: macro.id,
        macro_block_name: cleanOldDefaultText(macro.macro_block_name, 'Off-Season 2024'),
        start_date: macro.start_date || '',
        end_date: macro.end_date || '',
        position: macro.position ?? 0,
        blocks: (blocksByMacro[macro.id] || []).map((block) => ({
          id: block.id,
          block_name: cleanOldDefaultText(block.block_name, 'Strength Phase 1'),
          start_date: block.start_date || '',
          end_date: block.end_date || '',
          position: block.position ?? 0,
          weeks: (weeksByBlock[block.id] || []).map((week) => ({
            id: week.id,
            week_name: cleanOldDefaultText(week.week_name, '20 - 26 May'),
            start_date: week.start_date || '',
            end_date: week.end_date || '',
            position: week.position ?? 0,
            sessions: (plannedSessionsByWeek[week.id] || [])
              .filter((session) => !isOldDefaultPlannedSession(session))
              .map((session) => plannedSessionFromRow(
                session,
                (plannedExercisesBySession[session.id] || []).map(exerciseFromRow)
              )),
          })),
        })),
      })),
  };

  return {
    ...cloneData(defaultData),
    profile: profileFromRow(profiles[0]),
    programme,
    activeSession: cloneData(defaultData.activeSession),
    sessions: sessions.map((session) => sessionFromRow(session, (sessionExercisesBySession[session.id] || []).map(exerciseFromRow))),
    checkIns: checkIns.map(checkInFromRow),
    checkInInsightHistory: insightRows.map((row) => ({
      ...(row.review || {}),
      id: row.id,
      checkInId: row.check_in_id || row.review?.checkInId,
      savedAt: row.saved_at,
    })),
  };
}

function groupBy(rows, key) {
  return rows.reduce((groups, row) => {
    const value = row[key];
    if (!groups[value]) groups[value] = [];
    groups[value].push(row);
    return groups;
  }, {});
}

export async function saveProfile(userId, profile) {
  requireUserId(userId);
  const fullPayload = stripUndefined({
    user_id: userId,
    name: profile?.name || defaultData.profile.name,
    onboarding_completed: Boolean(profile?.onboarding_completed),
    tutorial_flags: profile?.tutorialFlags || defaultData.profile.tutorialFlags,
    pbs: profile?.pbs || defaultData.profile.pbs,
  });

  try {
    return await singleOrThrow(
      supabase.from('profiles').upsert(fullPayload, { onConflict: 'user_id' })
    );
  } catch (error) {
    const schemaMessage = `${error?.message || ''} ${error?.details || ''}`;
    if (!/onboarding_completed|tutorial_flags|pbs/i.test(schemaMessage)) throw error;
    console.warn('[SUPABASE SAVE] Profile extended columns missing. Saving name only. Run the profile migration in supabase/schema.sql.', error);
    return singleOrThrow(
      supabase.from('profiles').upsert(stripUndefined({
        user_id: userId,
        name: profile?.name || defaultData.profile.name,
      }), { onConflict: 'user_id' })
    );
  }
}

export async function saveProgramme(userId, programme) {
  requireUserId(userId);
  const programmeBase = {
    id: uuidOrUndefined(programme.id),
    user_id: userId,
    calendar_name: programme.calendar_name || defaultData.programme.calendar_name,
    selected_macro_id: uuidOrNull(programme.selected_macro_id),
    selected_block_id: uuidOrNull(programme.selected_block_id),
    selected_week_id: uuidOrNull(programme.selected_week_id),
    day_notes: programme.day_notes || {},
    copied_session: programme.copied_session || null,
  };
  let programmeRow;
  try {
    programmeRow = await singleOrThrow(
      upsertRow('programmes', stripUndefined({ ...programmeBase, session_templates: programme.session_templates || [] }), 'user_id')
    );
  } catch (error) {
    const schemaMessage = `${error?.message || ''} ${error?.details || ''}`;
    if (!/session_templates/i.test(schemaMessage)) throw error;
    console.warn('[SUPABASE SAVE] programmes.session_templates column missing. Saving without custom templates. Run the session_templates migration in supabase/schema.sql.', error);
    programmeRow = await singleOrThrow(upsertRow('programmes', stripUndefined(programmeBase), 'user_id'));
  }

  const macroIdMap = {};
  const blockIdMap = {};
  const weekIdMap = {};
  const savedIds = {
    macroBlocks: [],
    trainingBlocks: [],
    trainingWeeks: [],
    plannedSessions: [],
    plannedExercises: [],
  };

  for (const [macroIndex, macro] of (programme.macro_blocks || []).entries()) {
    const macroRow = await singleOrThrow(
      upsertRow('macro_blocks', stripUndefined({
        id: uuidOrUndefined(macro.id),
        user_id: userId,
        programme_id: programmeRow.id,
        macro_block_name: macro.macro_block_name || '',
        start_date: macro.start_date || null,
        end_date: macro.end_date || null,
        position: macro.position ?? macroIndex,
      }), 'programme_id,position')
    );
    macroIdMap[macro.id] = macroRow.id;
    savedIds.macroBlocks.push(macroRow.id);

    for (const [blockIndex, block] of (macro.blocks || []).entries()) {
      const blockRow = await singleOrThrow(
        upsertRow('training_blocks', stripUndefined({
          id: uuidOrUndefined(block.id),
          user_id: userId,
          macro_block_id: macroRow.id,
          block_name: block.block_name || '',
          start_date: block.start_date || null,
          end_date: block.end_date || null,
          position: block.position ?? blockIndex,
        }), 'macro_block_id,position')
      );
      blockIdMap[block.id] = blockRow.id;
      savedIds.trainingBlocks.push(blockRow.id);

      for (const [weekIndex, week] of (block.weeks || []).entries()) {
        const weekRow = await singleOrThrow(
          upsertRow('training_weeks', stripUndefined({
            id: uuidOrUndefined(week.id),
            user_id: userId,
            block_id: blockRow.id,
            week_name: week.week_name || '',
            start_date: week.start_date || null,
            end_date: week.end_date || null,
            position: week.position ?? weekIndex,
          }), 'block_id,position')
        );
        weekIdMap[week.id] = weekRow.id;
        savedIds.trainingWeeks.push(weekRow.id);

        for (const [sessionIndex, session] of (week.sessions || []).entries()) {
          await savePlannedSession(userId, weekRow.id, { ...session, position: session.position ?? sessionIndex }, savedIds);
        }
      }
    }
  }

  await supabase.from('programmes').update({
    selected_macro_id: macroIdMap[programme.selected_macro_id] || uuidOrNull(programme.selected_macro_id),
    selected_block_id: blockIdMap[programme.selected_block_id] || uuidOrNull(programme.selected_block_id),
    selected_week_id: weekIdMap[programme.selected_week_id] || uuidOrNull(programme.selected_week_id),
  }).eq('id', programmeRow.id).eq('user_id', userId);

  await deleteUserRowsNotIn('planned_exercises', userId, savedIds.plannedExercises);
  await deleteUserRowsNotIn('planned_sessions', userId, savedIds.plannedSessions);
  await deleteUserRowsNotIn('training_weeks', userId, savedIds.trainingWeeks);
  await deleteUserRowsNotIn('training_blocks', userId, savedIds.trainingBlocks);
  await deleteUserRowsNotIn('macro_blocks', userId, savedIds.macroBlocks);

  return programmeRow;
}

export async function savePlannedSession(userId, weekId, session, savedIds) {
  requireUserId(userId);
  const sessionRow = await upsertPlannedSessionRow(userId, weekId, session);
  savedIds?.plannedSessions?.push(sessionRow.id);

  for (const [index, exercise] of (session.exercises || []).entries()) {
    const exerciseRowResult = await upsertExerciseRow(
      'planned_exercises', exerciseRow(userId, 'planned_session_id', sessionRow.id, exercise, index), 'planned_session_id,position'
    );
    savedIds?.plannedExercises?.push(exerciseRowResult.id);
  }

  return sessionRow;
}

export async function saveSession(userId, session) {
  requireUserId(userId);
  const sessionRow = await singleOrThrow(
    supabase.from('sessions').upsert(stripUndefined({
      id: uuidOrUndefined(session.id),
      user_id: userId,
      session_name: session.session_name || '',
      session_datetime: session.session_datetime || new Date().toISOString(),
      notes: session.notes || '',
      metric_type: session.metric_type || null,
      metrics: session.metrics || {},
      planned_session_id: uuidOrNull(session.planned_session_id),
    }))
  );

  for (const [index, exercise] of (session.exercises || []).entries()) {
    await upsertExerciseRow(
      'session_exercises', exerciseRow(userId, 'session_id', sessionRow.id, exercise, index), 'session_id,position'
    );
  }

  return sessionRow;
}

export async function saveCheckIn(userId, checkIn) {
  requireUserId(userId);
  const fullPayload = stripUndefined({
    id: uuidOrUndefined(checkIn.id),
    user_id: userId,
    check_in_datetime: checkIn.check_in_datetime || new Date().toISOString(),
    linked_session_id: uuidOrNull(checkIn.linked_session_id),
    pain_score: numberOrNull(checkIn.pain_score),
    pain_location: checkIn.pain_location || null,
    freshness_score: numberOrNull(checkIn.freshness_score),
    soreness_score: numberOrNull(checkIn.soreness_score),
    performance_score: numberOrNull(checkIn.performance_score),
    performance_type: checkIn.performance_type || null,
    gct: numberOrNull(checkIn.gct),
    gct_unit: checkIn.gct_unit || 'seconds',
    ft: numberOrNull(checkIn.ft),
    ft_unit: checkIn.ft_unit || 'seconds',
    height_or_distance: numberOrNull(checkIn.height_or_distance),
    height_or_distance_unit: checkIn.height_or_distance_unit || checkIn.unit || 'cm',
    sprint_time: numberOrNull(checkIn.sprint_time),
    sprint_time_unit: checkIn.sprint_time_unit || 'seconds',
    distance: numberOrNull(checkIn.distance),
    distance_unit: checkIn.distance_unit || checkIn.unit || 'metres',
    lift_name: checkIn.lift_name || null,
    weight: numberOrNull(checkIn.weight),
    weight_unit: checkIn.weight_unit || 'kg',
    sets: numberOrNull(checkIn.sets),
    reps: numberOrNull(checkIn.reps),
    bar_velocity: numberOrNull(checkIn.bar_velocity),
    bar_velocity_unit: checkIn.bar_velocity_unit || 'm/s',
    unit: checkIn.unit || null,
  });

  try {
    return await singleOrThrow(supabase.from('check_ins').upsert(fullPayload));
  } catch (error) {
    const schemaMessage = `${error?.message || ''} ${error?.details || ''}`;
    if (!/gct_unit|ft_unit|height_or_distance_unit|distance_unit|sprint_time_unit|weight_unit|bar_velocity_unit/i.test(schemaMessage)) throw error;
    console.warn('[SUPABASE SAVE] Check-in unit columns missing. Saving legacy fields only.', error);
    return singleOrThrow(
      supabase.from('check_ins').upsert(stripUndefined({
        id: uuidOrUndefined(checkIn.id),
        user_id: userId,
        check_in_datetime: checkIn.check_in_datetime || new Date().toISOString(),
        linked_session_id: uuidOrNull(checkIn.linked_session_id),
        pain_score: numberOrNull(checkIn.pain_score),
        pain_location: checkIn.pain_location || null,
        freshness_score: numberOrNull(checkIn.freshness_score),
        soreness_score: numberOrNull(checkIn.soreness_score),
        performance_score: numberOrNull(checkIn.performance_score),
        performance_type: checkIn.performance_type || null,
        gct: numberOrNull(checkIn.gct),
        ft: numberOrNull(checkIn.ft),
        height_or_distance: numberOrNull(checkIn.height_or_distance),
        unit: checkIn.unit || null,
        sprint_time: numberOrNull(checkIn.sprint_time),
        distance: numberOrNull(checkIn.distance),
        lift_name: checkIn.lift_name || null,
        weight: numberOrNull(checkIn.weight),
        sets: numberOrNull(checkIn.sets),
        reps: numberOrNull(checkIn.reps),
        bar_velocity: numberOrNull(checkIn.bar_velocity),
      }))
    );
  }
}

export async function saveCheckInInsight(userId, review) {
  requireUserId(userId);
  return singleOrThrow(
    supabase.from('check_in_insight_history').upsert(stripUndefined({
      id: uuidOrUndefined(review.id),
      user_id: userId,
      check_in_id: uuidOrNull(review.checkInId),
      saved_at: review.savedAt || new Date().toISOString(),
      review,
    }))
  );
}

export async function deletePlannedSession(userId, sessionId) {
  requireUserId(userId);
  const { error } = await supabase.from('planned_sessions').delete().eq('user_id', userId).eq('id', sessionId);
  if (error) throw error;
}

export async function deleteSession(userId, sessionId) {
  requireUserId(userId);
  const { error } = await supabase.from('sessions').delete().eq('user_id', userId).eq('id', sessionId);
  if (error) throw error;
}

export async function deleteCheckIn(userId, checkInId) {
  requireUserId(userId);
  const { error } = await supabase.from('check_ins').delete().eq('user_id', userId).eq('id', checkInId);
  if (error) throw error;
}
