import { supabase } from './supabaseClient';
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

function exerciseRow(userId, parentKey, parentId, exercise, position = 0) {
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
    intensity_unit: exercise.intensity_unit || null,
    intent_percent: numberOrNull(exercise.intent_percent),
    rom: exercise.rom || null,
    set_metrics: exercise.set_metrics || [],
    position: exercise.position ?? exercise.order ?? position,
  });
}

function exerciseFromRow(row) {
  return {
    id: row.id,
    exercise_name: row.exercise_name || '',
    movement_type: row.movement_type || 'skill',
    sets: row.sets ?? '',
    reps: row.reps ?? '',
    contacts: row.contacts ?? '',
    duration_minutes: row.duration_minutes ?? '',
    intensity_value: row.intensity_value ?? '',
    intensity_unit: row.intensity_unit || '',
    intent_percent: row.intent_percent ?? '',
    rom: row.rom || '',
    set_metrics: row.set_metrics || [],
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

function checkInFromRow(row) {
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
    ft: row.ft ?? '',
    height_or_distance: row.height_or_distance ?? '',
    unit: row.unit || '',
    sprint_time: row.sprint_time ?? '',
    distance: row.distance ?? '',
    lift_name: row.lift_name || '',
    weight: row.weight ?? '',
    sets: row.sets ?? '',
    reps: row.reps ?? '',
    bar_velocity: row.bar_velocity ?? '',
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
    completed: !!row.completed,
    position: row.position ?? 0,
    exercises: exercises.sort((a, b) => (a.order || 0) - (b.order || 0)),
  };
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
    calendar_name: programmeRow.calendar_name || defaultData.programme.calendar_name,
    selected_macro_id: programmeRow.selected_macro_id,
    selected_block_id: programmeRow.selected_block_id,
    selected_week_id: programmeRow.selected_week_id,
    day_notes: programmeRow.day_notes || {},
    copied_session: programmeRow.copied_session || null,
    macro_blocks: macroBlocks
      .filter((macro) => macro.programme_id === programmeRow.id)
      .map((macro) => ({
        id: macro.id,
        macro_block_name: macro.macro_block_name || '',
        start_date: macro.start_date || '',
        end_date: macro.end_date || '',
        position: macro.position ?? 0,
        blocks: (blocksByMacro[macro.id] || []).map((block) => ({
          id: block.id,
          block_name: block.block_name || '',
          start_date: block.start_date || '',
          end_date: block.end_date || '',
          position: block.position ?? 0,
          weeks: (weeksByBlock[block.id] || []).map((week) => ({
            id: week.id,
            week_name: week.week_name || '',
            start_date: week.start_date || '',
            end_date: week.end_date || '',
            position: week.position ?? 0,
            sessions: (plannedSessionsByWeek[week.id] || []).map((session) => plannedSessionFromRow(
              session,
              (plannedExercisesBySession[session.id] || []).map(exerciseFromRow)
            )),
          })),
        })),
      })),
  };

  return {
    ...cloneData(defaultData),
    profile: { name: profiles[0]?.name || defaultData.profile.name },
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
  return singleOrThrow(
    supabase.from('profiles').upsert(stripUndefined({
      user_id: userId,
      name: profile?.name || defaultData.profile.name,
    }), { onConflict: 'user_id' })
  );
}

export async function saveProgramme(userId, programme) {
  requireUserId(userId);
  const programmeRow = await singleOrThrow(
    upsertRow('programmes', stripUndefined({
      id: uuidOrUndefined(programme.id),
      user_id: userId,
      calendar_name: programme.calendar_name || defaultData.programme.calendar_name,
      selected_macro_id: uuidOrNull(programme.selected_macro_id),
      selected_block_id: uuidOrNull(programme.selected_block_id),
      selected_week_id: uuidOrNull(programme.selected_week_id),
      day_notes: programme.day_notes || {},
      copied_session: programme.copied_session || null,
    }), 'user_id')
  );

  const macroIdMap = {};
  const blockIdMap = {};
  const weekIdMap = {};

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

        for (const [sessionIndex, session] of (week.sessions || []).entries()) {
          await savePlannedSession(userId, weekRow.id, { ...session, position: session.position ?? sessionIndex });
        }
      }
    }
  }

  await supabase.from('programmes').update({
    selected_macro_id: macroIdMap[programme.selected_macro_id] || uuidOrNull(programme.selected_macro_id),
    selected_block_id: blockIdMap[programme.selected_block_id] || uuidOrNull(programme.selected_block_id),
    selected_week_id: weekIdMap[programme.selected_week_id] || uuidOrNull(programme.selected_week_id),
  }).eq('id', programmeRow.id).eq('user_id', userId);

  return programmeRow;
}

export async function savePlannedSession(userId, weekId, session) {
  requireUserId(userId);
  const sessionRow = await singleOrThrow(
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

  for (const [index, exercise] of (session.exercises || []).entries()) {
    await singleOrThrow(
      upsertRow('planned_exercises', exerciseRow(userId, 'planned_session_id', sessionRow.id, exercise, index), 'planned_session_id,position')
    );
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
    await singleOrThrow(
      upsertRow('session_exercises', exerciseRow(userId, 'session_id', sessionRow.id, exercise, index), 'session_id,position')
    );
  }

  return sessionRow;
}

export async function saveCheckIn(userId, checkIn) {
  requireUserId(userId);
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
