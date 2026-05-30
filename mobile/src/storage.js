import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEY = 'impuls-local-json-v3';

export const emptyExercise = {
  id: 'exercise_draft',
  movement_type: 'plyometric',
  exercise_name: '',
  contacts: '',
  reps: '',
  sets: '',
  duration_minutes: '',
  intensity_value: '',
  intensity_unit: '%',
  intent_percent: '',
  rom: '',
};

export const defaultData = {
  version: 4,
  profile: {
    name: '',
  },
  programme: {
    calendar_name: '',
    selected_macro_id: null,
    selected_block_id: null,
    selected_week_id: null,
    copied_session: null,
    day_notes: {},
    macro_blocks: [],
  },
  activeSession: {
    id: 'session_draft',
    session_name: '',
    session_datetime: new Date().toISOString(),
    exercises: [],
  },
  checkInDraft: {
    pain_score: 0,
    pain_location: '',
    freshness_score: 0,
    soreness_score: 0,
    performance_score: 0,
    performance_type: 'jumping',
    gct: '',
    ft: '',
    height_or_distance: '',
    unit: '',
  },
  sessions: [],
  checkIns: [],
  checkInInsightHistory: [],
};

export function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function cleanOldProgrammeName(value, oldValue) {
  return value === oldValue ? '' : (value || '');
}

function migrateProgramme(programme = {}) {
  const fallback = cloneData(defaultData.programme);
  if (Array.isArray(programme.macro_blocks) && programme.macro_blocks.length > 0) {
    const macroBlocks = programme.macro_blocks.map((macro) => ({
      ...macro,
      macro_block_name: cleanOldProgrammeName(macro.macro_block_name, 'Off-Season 2024'),
      blocks: (macro.blocks || []).map((block) => ({
        ...block,
        block_name: cleanOldProgrammeName(block.block_name, 'Strength Phase 1'),
        weeks: (block.weeks || []).map((week) => ({
          ...week,
          week_name: cleanOldProgrammeName(week.week_name, '20 - 26 May'),
          sessions: (week.sessions || [])
            .filter((session) => !['planned_1', 'planned_2', 'planned_3', 'planned_4'].includes(String(session.id || '')))
            .map((session) => ({
              ...session,
              exercises: Array.isArray(session.exercises) ? session.exercises : [],
            })),
        })),
      })),
    }));
    const selectedMacro = programme.selected_macro_id || macroBlocks[0].id;
    const macro = macroBlocks.find((item) => item.id === selectedMacro) || macroBlocks[0];
    const selectedBlock = programme.selected_block_id || macro.blocks?.[0]?.id || null;
    const block = macro.blocks?.find((item) => item.id === selectedBlock) || macro.blocks?.[0];
    const selectedWeek = programme.selected_week_id || block?.weeks?.[0]?.id || null;
    return {
      ...fallback,
      ...programme,
      calendar_name: cleanOldProgrammeName(programme.calendar_name, 'Off-Season 2024'),
      macro_blocks: macroBlocks,
      selected_macro_id: selectedMacro,
      selected_block_id: selectedBlock,
      selected_week_id: selectedWeek,
      copied_session: programme.copied_session || null,
      day_notes: programme.day_notes || {},
    };
  }

  return {
    ...fallback,
    calendar_name: cleanOldProgrammeName(programme.calendar_name, 'Off-Season 2024'),
    copied_session: programme.copied_session || null,
    day_notes: programme.day_notes || {},
  };
}

function migrateProfile(profile = {}, version) {
  if (version < 4 && profile.name === 'Alex') return { name: '' };
  return { ...defaultData.profile, ...profile };
}

function migrateActiveSession(activeSession = {}, version) {
  if (version < 4 && activeSession.session_name === 'Lower Body Power') {
    return cloneData(defaultData.activeSession);
  }
  return {
    ...defaultData.activeSession,
    ...activeSession,
    exercises: Array.isArray(activeSession.exercises)
      ? activeSession.exercises.filter((exercise) => exercise.exercise_name !== 'Approach jumps' || exercise.id !== 'exercise_1')
      : [],
  };
}

function migrateCheckInDraft(checkInDraft = {}, version) {
  if (version < 4 && checkInDraft.pain_location === 'Left Achilles') {
    return cloneData(defaultData.checkInDraft);
  }
  return { ...defaultData.checkInDraft, ...checkInDraft };
}

export async function loadAppData() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return cloneData(defaultData);
  }

  try {
    const parsed = JSON.parse(raw);
    const version = Number(parsed.version || 0);
    return {
      ...cloneData(defaultData),
      ...parsed,
      version: defaultData.version,
      profile: migrateProfile(parsed.profile, version),
      programme: migrateProgramme(parsed.programme),
      activeSession: migrateActiveSession(parsed.activeSession, version),
      checkInDraft: migrateCheckInDraft(parsed.checkInDraft, version),
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.filter((session) => !String(session.id || '').startsWith('sample_session_')) : [],
      checkIns: Array.isArray(parsed.checkIns) ? parsed.checkIns.filter((checkIn) => !String(checkIn.id || '').startsWith('sample_checkin_')) : [],
      checkInInsightHistory: Array.isArray(parsed.checkInInsightHistory) ? parsed.checkInInsightHistory : [],
    };
  } catch {
    return cloneData(defaultData);
  }
}

export async function saveAppData(data) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function resetAppData() {
  const fresh = cloneData(defaultData);
  await saveAppData(fresh);
  return fresh;
}

export function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
