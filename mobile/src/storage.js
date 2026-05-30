import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEY = 'impuls-local-json-v3';

export const emptyExercise = {
  id: 'exercise_draft',
  movement_type: 'plyometric',
  exercise_name: 'Approach jumps',
  contacts: 18,
  reps: 6,
  duration_minutes: 20,
  intensity_value: 60,
  intensity_unit: '%',
  intent_percent: 90,
  rom: 'full',
};

const sampleSessions = [
  {
    id: 'sample_session_1',
    session_name: 'Jump Reintroduction',
    session_datetime: '2026-05-16T10:00:00.000Z',
    exercises: [
      { id: 'sample_ex_1', movement_type: 'plyometric', exercise_name: 'Approach jumps', contacts: 12, intent_percent: 78 },
      { id: 'sample_ex_2', movement_type: 'strength', exercise_name: 'Half squat', reps: 5, intensity_value: 110, intensity_unit: 'kg', rom: 'half' },
    ],
  },
  {
    id: 'sample_session_2',
    session_name: 'Acceleration Exposure',
    session_datetime: '2026-05-18T10:00:00.000Z',
    exercises: [
      { id: 'sample_ex_3', movement_type: 'skill', exercise_name: 'Acceleration runs', duration_minutes: 22, intent_percent: 80 },
    ],
  },
  {
    id: 'sample_session_3',
    session_name: 'Reactive Plyo Day',
    session_datetime: '2026-05-20T10:00:00.000Z',
    exercises: [
      { id: 'sample_ex_4', movement_type: 'plyometric', exercise_name: 'Depth jumps', contacts: 16, intent_percent: 92 },
      { id: 'sample_ex_5', movement_type: 'power_ballistic', exercise_name: 'Jump squat', reps: 8, intensity_value: 30, intensity_unit: 'kg', intent_percent: 88 },
    ],
  },
  {
    id: 'sample_session_4',
    session_name: 'Lower Body Power',
    session_datetime: '2026-05-21T10:00:00.000Z',
    exercises: [
      { id: 'sample_ex_6', movement_type: 'plyometric', exercise_name: 'Approach jumps', contacts: 18, intent_percent: 100 },
      { id: 'sample_ex_7', movement_type: 'strength', exercise_name: 'Quarter squat', reps: 4, intensity_value: 145, intensity_unit: 'kg', rom: 'partial' },
    ],
  },
];

const sampleCheckIns = [
  {
    id: 'sample_checkin_1',
    check_in_datetime: '2026-05-16T10:00:00.000Z',
    linked_session_id: 'sample_session_1',
    pain_score: 4,
    pain_location: 'Left Achilles',
    freshness_score: 5,
    soreness_score: 5,
    performance_score: 5.4,
    performance_type: 'jumping',
    gct: 0.34,
    ft: 0.71,
    height_or_distance: 30,
    unit: 'in',
  },
  {
    id: 'sample_checkin_2',
    check_in_datetime: '2026-05-18T10:00:00.000Z',
    linked_session_id: 'sample_session_2',
    pain_score: 3,
    pain_location: 'Left Achilles',
    freshness_score: 6,
    soreness_score: 4,
    performance_score: 6.2,
    performance_type: 'running_sprinting',
    sprint_time: 4.12,
    distance: 30,
    unit: 'm',
  },
  {
    id: 'sample_checkin_3',
    check_in_datetime: '2026-05-20T10:00:00.000Z',
    linked_session_id: 'sample_session_3',
    pain_score: 2,
    pain_location: 'Left Achilles',
    freshness_score: 8,
    soreness_score: 3,
    performance_score: 8.1,
    performance_type: 'jumping',
    gct: 0.28,
    ft: 0.82,
    height_or_distance: 38,
    unit: 'in',
  },
  {
    id: 'sample_checkin_4',
    check_in_datetime: '2026-05-21T10:00:00.000Z',
    linked_session_id: 'sample_session_4',
    pain_score: 3,
    pain_location: 'Left Achilles',
    freshness_score: 7,
    soreness_score: 4,
    performance_score: 7.2,
    performance_type: 'jumping',
    gct: 0.3,
    ft: 0.78,
    height_or_distance: 36,
    unit: 'in',
  },
];

export const defaultData = {
  version: 3,
  profile: {
    name: 'Alex',
  },
  programme: {
    calendar_name: 'Off-Season 2024',
    selected_macro_id: 'macro_1',
    selected_block_id: 'block_1',
    selected_week_id: 'week_1',
    copied_session: null,
    day_notes: {},
    macro_blocks: [
      {
        id: 'macro_1',
        macro_block_name: 'Off-Season 2024',
        start_date: '2026-05-20',
        end_date: '2026-08-20',
        blocks: [
          {
            id: 'block_1',
            block_name: 'Strength Phase 1',
            start_date: '2026-05-20',
            end_date: '2026-06-16',
            weeks: [
              {
                id: 'week_1',
                week_name: '20 - 26 May',
                start_date: '2026-05-20',
                end_date: '2026-05-26',
                sessions: [
                  {
                    id: 'planned_1',
                    date: '2026-05-21',
                    session_name: 'Lower Body Power',
                    focus: 'Plyometrics + Strength',
                    duration: '60-75 min',
                    completed: true,
                    exercises: [
                      {
                        id: 'planned_exercise_1',
                        movement_type: 'plyometric',
                        exercise_name: 'Approach jumps',
                        contacts: 18,
                        intent_percent: 100,
                      },
                    ],
                  },
                  {
                    id: 'planned_2',
                    date: '2026-05-22',
                    session_name: 'Upper Body Strength',
                    focus: 'Strength',
                    duration: '45-60 min',
                    completed: false,
                    exercises: [],
                  },
                  {
                    id: 'planned_3',
                    date: '2026-05-23',
                    session_name: 'Speed',
                    focus: 'Sprints + Skills',
                    duration: '40-55 min',
                    completed: false,
                    exercises: [],
                  },
                  {
                    id: 'planned_4',
                    date: '2026-05-24',
                    session_name: 'Lower Body Strength',
                    focus: 'Strength',
                    duration: '60 min',
                    completed: false,
                    exercises: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  activeSession: {
    id: 'session_draft',
    session_name: 'Lower Body Power',
    session_datetime: new Date().toISOString(),
    exercises: [
      {
        id: 'exercise_1',
        movement_type: 'plyometric',
        exercise_name: 'Approach jumps',
        contacts: 18,
        intent_percent: 100,
      },
    ],
  },
  checkInDraft: {
    pain_score: 3,
    pain_location: 'Left Achilles',
    freshness_score: 7,
    soreness_score: 4,
    performance_score: 6,
    performance_type: 'jumping',
    gct: 0.3,
    ft: 0.78,
    height_or_distance: 36,
    unit: 'in',
  },
  sessions: sampleSessions,
  checkIns: sampleCheckIns,
  checkInInsightHistory: [],
};

export function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

function migrateProgramme(programme = {}) {
  const fallback = cloneData(defaultData.programme);
  if (Array.isArray(programme.macro_blocks) && programme.macro_blocks.length > 0) {
    const selectedMacro = programme.selected_macro_id || programme.macro_blocks[0].id;
    const macro = programme.macro_blocks.find((item) => item.id === selectedMacro) || programme.macro_blocks[0];
    const selectedBlock = programme.selected_block_id || macro.blocks?.[0]?.id;
    const block = macro.blocks?.find((item) => item.id === selectedBlock) || macro.blocks?.[0];
    const selectedWeek = programme.selected_week_id || block?.weeks?.[0]?.id;
    return {
      ...fallback,
      ...programme,
      selected_macro_id: selectedMacro,
      selected_block_id: selectedBlock,
      selected_week_id: selectedWeek,
      copied_session: programme.copied_session || null,
      day_notes: programme.day_notes || {},
    };
  }

  const legacySessions = Array.isArray(programme.planned_sessions) ? programme.planned_sessions : fallback.macro_blocks[0].blocks[0].weeks[0].sessions;
  const migrated = cloneData(fallback);
  migrated.calendar_name = programme.calendar_name || fallback.calendar_name;
  migrated.macro_blocks[0].macro_block_name = programme.macro_block_name || fallback.macro_blocks[0].macro_block_name;
  migrated.macro_blocks[0].blocks[0].block_name = programme.block_name || fallback.macro_blocks[0].blocks[0].block_name;
  migrated.macro_blocks[0].blocks[0].weeks[0].week_name = programme.week_name || fallback.macro_blocks[0].blocks[0].weeks[0].week_name;
  migrated.macro_blocks[0].blocks[0].weeks[0].sessions = legacySessions.map((session) => ({
    ...session,
    exercises: Array.isArray(session.exercises) ? session.exercises : [],
  }));
  return migrated;
}

export async function loadAppData() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return cloneData(defaultData);
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      ...cloneData(defaultData),
      ...parsed,
      programme: migrateProgramme(parsed.programme),
      activeSession: { ...defaultData.activeSession, ...(parsed.activeSession || {}) },
      checkInDraft: { ...defaultData.checkInDraft, ...(parsed.checkInDraft || {}) },
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      checkIns: Array.isArray(parsed.checkIns) ? parsed.checkIns : [],
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
