// Impuls exercise library + Force-Velocity coverage taxonomy.
//
// This is the single domain asset that powers both effortless planning (a searchable,
// pre-tagged picker) and analysis (every exercise carries a quality tag, so the engine
// can read programme coverage). See "Exercise Library & Coverage" design doc.
//
// Each exercise carries:
//   - type        drives the load formula + default quality + which fields show
//   - quality     FV quality tag (defaulted from type, user-overridable)
//   - specificity general | intermediate | specific (law of specificity to the jump)
//   - laterality  bilateral | unilateral

// FV qualities, ordered high-force/low-velocity -> low-force/high-velocity, plus two
// off-curve buckets (work capacity, rehab). `fv` is the curve index used by the radar.
export const QUALITY_META = {
  max_strength: { label: 'Max strength', fv: 0 },
  strength_speed: { label: 'Strength-speed', fv: 1 },
  speed_strength: { label: 'Speed-strength', fv: 2 },
  reactive_strength: { label: 'Reactive strength', fv: 3 },
  max_speed: { label: 'Max speed', fv: 4 },
  work_capacity: { label: 'Work capacity', fv: null },
  rehab: { label: 'Rehab / tendon', fv: null },
};

export const QUALITY_OPTIONS = Object.entries(QUALITY_META).map(([id, meta]) => [id, meta.label]);

export const SPECIFICITY_OPTIONS = [
  ['general', 'General'],
  ['intermediate', 'Intermediate'],
  ['specific', 'Specific'],
];

export const LATERALITY_OPTIONS = [
  ['bilateral', 'Bilateral'],
  ['unilateral', 'Unilateral'],
];

// Range of motion = depth only. Setup modifiers like deficit/heels-elevated belong in
// the free-text `variation` field, not here, so the choices stay self-explanatory.
export const ROM_OPTIONS = [
  ['full', 'Full'],
  ['parallel', 'Parallel'],
  ['quarter', 'Quarter'],
  ['partial', 'Partial'],
];

// Type metadata. `fields` is which load inputs show; `quality` is the default FV tag.
export const TYPE_META = {
  strength: { label: 'Strength', quality: 'max_strength', fields: ['sets', 'reps', 'intensity', 'rom', 'tempo'] },
  power_ballistic: { label: 'Ballistic / Power', quality: 'speed_strength', fields: ['sets', 'reps', 'intensity', 'intent'] },
  plyometric: { label: 'Plyometric', quality: 'reactive_strength', fields: ['sets', 'contacts', 'intent'] },
  sprint: { label: 'Sprint / Speed', quality: 'max_speed', fields: ['reps', 'distance', 'intent'] },
  general: { label: 'General / Work cap.', quality: 'work_capacity', fields: ['sets', 'reps', 'intensity', 'rom', 'tempo'] },
  endurance: { label: 'Endurance', quality: 'work_capacity', fields: ['duration', 'intent'] },
  rehab: { label: 'Rehab / Isometric', quality: 'rehab', fields: ['sets', 'reps', 'duration', 'intensity', 'rom', 'tempo'] },
  skill: { label: 'Skill', quality: '', fields: ['sets', 'duration', 'intent'] },
};

export const TYPE_OPTIONS = Object.entries(TYPE_META).map(([id, meta]) => [id, meta.label]);

export function defaultQualityForType(type) {
  return (TYPE_META[type] || {}).quality || '';
}

// Smart per-type default fields applied when an exercise is first chosen.
export function defaultFieldsForType(type) {
  const base = {
    sets: '', reps: '', contacts: '', duration_minutes: '', distance: '',
    intensity_value: '', intensity_unit: '%', intent_percent: '', rom: '', tempo: '', variation: '',
  };
  if (type === 'strength' || type === 'general') return { ...base, rom: 'full' };
  if (type === 'rehab') return { ...base, rom: 'full', tempo: '3-1-3-0' };
  return base;
}

// Build a library entry, filling quality/specificity/laterality defaults from the type.
function ex(name, type, specificity = 'general', laterality = 'bilateral', quality) {
  return { name, type, specificity, laterality, quality: quality || defaultQualityForType(type) };
}

// Tag a run of entries with an umbrella sub-group (e.g. "Back squat", "Pogos") so the
// picker can show a family -> sub-group -> exercise hierarchy for the big families.
function withGroup(group, entries) {
  return entries.map((entry) => ({ ...entry, group }));
}

export const FAMILY_ORDER = [
  'Squat derivatives',
  'Olympic derivatives',
  'Hinge variations',
  'Unilateral strength',
  'Plyometrics',
  'Sprints & speed',
  'Ballistic / power',
  'General / work capacity',
  'Endurance',
  'Rehab / tendon',
];

const FAMILIES = {
  'Squat derivatives': [
    ...withGroup('Back squat', [
      ex('Back squat (high-bar)', 'strength', 'general'),
      ex('Back squat (low-bar)', 'strength', 'general'),
      ex('Paused squat', 'strength', 'general'),
      ex('Tempo squat', 'strength', 'general'),
      ex('Pin / Anderson squat', 'strength', 'general'),
      ex('1.5-rep squat', 'strength', 'general'),
      ex('Box squat', 'strength', 'general'),
      ex('Safety-bar squat', 'strength', 'general'),
    ]),
    ...withGroup('Front & specialty', [
      ex('Front squat', 'strength', 'intermediate'),
      ex('Heels-elevated / cyclist squat', 'strength', 'intermediate'),
      ex('Goblet squat', 'general', 'general'),
      ex('Overhead squat', 'skill', 'general'),
    ]),
    ...withGroup('Partial-range & machine', [
      ex('Quarter squat', 'strength', 'specific', 'bilateral', 'strength_speed'),
      ex('Partial squat', 'strength', 'specific', 'bilateral', 'strength_speed'),
      ex('Belt squat', 'strength', 'general'),
      ex('Hack squat (machine)', 'general', 'general'),
    ]),
  ],
  'Olympic derivatives': [
    ex('Power clean', 'power_ballistic', 'specific', 'bilateral', 'strength_speed'),
    ex('Hang power clean (high)', 'power_ballistic', 'specific', 'bilateral', 'speed_strength'),
    ex('Hang power clean (mid)', 'power_ballistic', 'specific', 'bilateral', 'speed_strength'),
    ex('Hang power clean (low)', 'power_ballistic', 'specific', 'bilateral', 'strength_speed'),
    ex('Clean pull', 'power_ballistic', 'intermediate', 'bilateral', 'strength_speed'),
    ex('Clean high pull', 'power_ballistic', 'intermediate', 'bilateral', 'strength_speed'),
    ex('Mid-thigh pull (clean grip)', 'power_ballistic', 'intermediate', 'bilateral', 'strength_speed'),
    ex('Muscle clean', 'power_ballistic', 'intermediate'),
    ex('Power snatch', 'power_ballistic', 'specific', 'bilateral', 'speed_strength'),
    ex('Hang power snatch', 'power_ballistic', 'specific', 'bilateral', 'speed_strength'),
    ex('Snatch pull', 'power_ballistic', 'intermediate', 'bilateral', 'strength_speed'),
    ex('Snatch high pull', 'power_ballistic', 'intermediate', 'bilateral', 'strength_speed'),
    ex('Mid-thigh pull (snatch grip)', 'power_ballistic', 'intermediate', 'bilateral', 'strength_speed'),
    ex('Push press', 'power_ballistic', 'intermediate'),
    ex('Push jerk', 'power_ballistic', 'intermediate'),
    ex('Split jerk', 'power_ballistic', 'intermediate'),
    ex('Jump shrug', 'power_ballistic', 'specific', 'bilateral', 'speed_strength'),
    ex('DB snatch', 'power_ballistic', 'specific', 'unilateral'),
    ex('DB clean', 'power_ballistic', 'specific', 'unilateral'),
  ],
  'Hinge variations': [
    ex('Conventional deadlift', 'strength', 'general', 'bilateral', 'max_strength'),
    ex('Sumo deadlift', 'strength', 'general'),
    ex('Trap-bar / hex-bar deadlift', 'strength', 'intermediate'),
    ex('Deficit deadlift', 'strength', 'general'),
    ex('Block / rack pull', 'strength', 'general'),
    ex('Romanian deadlift', 'strength', 'general'),
    ex('Stiff-leg deadlift', 'strength', 'general'),
    ex('Good morning', 'strength', 'general'),
    ex('Hip thrust / glute bridge', 'strength', 'intermediate'),
    ex('Pull-through', 'general', 'general'),
    ex('Back extension', 'general', 'general'),
    ex('Kettlebell swing', 'power_ballistic', 'intermediate', 'bilateral', 'speed_strength'),
    ex('Trap-bar jump', 'power_ballistic', 'specific', 'bilateral', 'speed_strength'),
    ex('Single-leg RDL', 'strength', 'intermediate', 'unilateral'),
  ],
  'Unilateral strength': [
    ex('Heavy step-up', 'strength', 'specific', 'unilateral', 'strength_speed'),
    ex('Reverse lunge', 'strength', 'intermediate', 'unilateral'),
    ex('Lateral lunge', 'strength', 'intermediate', 'unilateral'),
    ex('Walking lunge', 'strength', 'intermediate', 'unilateral'),
    ex('Split squat', 'strength', 'intermediate', 'unilateral'),
    ex('Bulgarian split squat', 'strength', 'specific', 'unilateral'),
    ex('Single-leg press', 'strength', 'intermediate', 'unilateral'),
    ex('Pistol squat', 'general', 'specific', 'unilateral'),
    ex('Skater squat', 'general', 'intermediate', 'unilateral'),
    ex('B-stance squat', 'strength', 'intermediate', 'unilateral'),
    ex('B-stance RDL', 'strength', 'intermediate', 'unilateral'),
    ex('Single-leg hip thrust', 'strength', 'intermediate', 'unilateral'),
    ex('Step-down', 'general', 'intermediate', 'unilateral'),
  ],
  Plyometrics: [
    ...withGroup('Pogos', [
      ex('Double-leg pogo', 'plyometric', 'specific'),
      ex('Single-leg pogo', 'plyometric', 'specific', 'unilateral'),
      ex('Ankle / stiffness hops', 'plyometric', 'specific'),
      ex('Lateral pogo', 'plyometric', 'specific'),
      ex('Pogo-to-broad', 'plyometric', 'specific'),
    ]),
    ...withGroup('Bounds', [
      ex('Alternate-leg bounds', 'plyometric', 'specific', 'unilateral'),
      ex('Single-leg bounds', 'plyometric', 'specific', 'unilateral'),
      ex('Speed bounds', 'plyometric', 'specific'),
      ex('A-bounds', 'plyometric', 'specific'),
      ex('Lateral bounds', 'plyometric', 'specific', 'unilateral'),
      ex('Combination bounds', 'plyometric', 'specific'),
    ]),
    ...withGroup('Shock & depth', [
      ex('Depth jump', 'plyometric', 'specific'),
      ex('Drop jump', 'plyometric', 'specific'),
      ex('Depth jump to box', 'plyometric', 'specific'),
      ex('Depth jump to broad', 'plyometric', 'specific'),
      ex('Altitude / landing drops', 'plyometric', 'specific'),
      ex('Depth-to-hurdle', 'plyometric', 'specific'),
    ]),
    ...withGroup('Jumps', [
      ex('Countermovement jump', 'plyometric', 'specific'),
      ex('Squat jump', 'plyometric', 'specific'),
      ex('Box jump', 'plyometric', 'intermediate'),
      ex('Broad / standing long jump', 'plyometric', 'specific'),
      ex('Vertical jump to target', 'plyometric', 'specific'),
      ex('Tuck jump', 'plyometric', 'intermediate'),
      ex('Hurdle hops', 'plyometric', 'specific'),
      ex('Banded jumps', 'plyometric', 'specific'),
      ex('Approach jump', 'plyometric', 'specific'),
      ex('Repeated / continuous jumps', 'plyometric', 'specific'),
      ex('Single-leg box jump', 'plyometric', 'specific', 'unilateral'),
    ]),
  ],
  'Sprints & speed': [
    ...withGroup('Sprint runs', [
      ex('Acceleration (10-30m)', 'sprint', 'specific'),
      ex('Flying / max-velocity sprint', 'sprint', 'specific'),
      ex('Resisted sprint (sled / band)', 'sprint', 'intermediate'),
      ex('Assisted / overspeed sprint', 'sprint', 'specific'),
      ex('Hill sprint', 'sprint', 'intermediate'),
      ex('Repeated sprints', 'sprint', 'intermediate'),
    ]),
    ...withGroup('Drills', [
      ex('A-skip', 'sprint', 'general'),
      ex('B-skip', 'sprint', 'general'),
      ex('Dribble / ankling', 'sprint', 'general'),
      ex('Wicket runs', 'sprint', 'intermediate'),
      ex('Wall drives', 'sprint', 'general'),
      ex('Falling / 3-point start', 'sprint', 'intermediate'),
      ex('Straight-leg bounds', 'sprint', 'general'),
    ]),
  ],
  'Ballistic / power': [
    ex('Loaded jump squat (barbell)', 'power_ballistic', 'specific', 'bilateral', 'speed_strength'),
    ex('Loaded jump squat (DB)', 'power_ballistic', 'specific', 'bilateral', 'speed_strength'),
    ex('Loaded jump squat (trap-bar)', 'power_ballistic', 'specific', 'bilateral', 'speed_strength'),
    ex('Banded jump squat', 'power_ballistic', 'specific', 'bilateral', 'speed_strength'),
    ex('Hang jump shrug', 'power_ballistic', 'specific'),
    ex('Accommodating-resistance jumps', 'power_ballistic', 'specific'),
    ex('Med-ball chest pass', 'power_ballistic', 'intermediate'),
    ex('Med-ball overhead / backward throw', 'power_ballistic', 'intermediate'),
    ex('Med-ball rotational throw', 'power_ballistic', 'intermediate'),
    ex('Med-ball scoop / broad throw', 'power_ballistic', 'specific'),
    ex('Med-ball slam', 'power_ballistic', 'intermediate'),
    ex('Med-ball single-arm throw', 'power_ballistic', 'intermediate', 'unilateral'),
    ex('Ballistic / plyo push-up', 'power_ballistic', 'intermediate'),
    ex('Jump-to-box with load', 'power_ballistic', 'specific'),
    ex('French contrast (complex)', 'power_ballistic', 'specific', 'bilateral', 'speed_strength'),
  ],
  'General / work capacity': [
    ex('Leg press', 'general', 'general'),
    ex('Leg extension', 'general', 'general'),
    ex('Leg curl (lying)', 'general', 'general'),
    ex('Leg curl (seated)', 'general', 'general'),
    ex('Calf raise (straight knee)', 'general', 'general'),
    ex('Calf raise (bent knee)', 'general', 'general'),
    ex('Tibialis raise', 'general', 'general'),
    ex('Adductor', 'general', 'general'),
    ex('Abductor', 'general', 'general'),
    ex('Glute-ham raise', 'general', 'general'),
    ex('Barbell row', 'general', 'general'),
    ex('Overhead press', 'general', 'general'),
    ex('Bench press', 'general', 'general'),
    ex('Pull-up', 'general', 'general'),
    ex('Anti-extension core', 'general', 'general'),
    ex('Anti-rotation core', 'general', 'general'),
    ex('Loaded carry', 'general', 'general'),
  ],
  Endurance: [
    ex('Extensive tempo run', 'endurance', 'general'),
    ex('Tempo intervals', 'endurance', 'general'),
    ex('Sled march / push', 'endurance', 'general'),
    ex('Bike intervals', 'endurance', 'general'),
    ex('Row intervals', 'endurance', 'general'),
    ex('Jump rope', 'endurance', 'general'),
    ex('Extensive (low-intensity) plyos', 'endurance', 'general'),
    ex('Hill walk', 'endurance', 'general'),
    ex('Aerobic / conditioning circuit', 'endurance', 'general'),
  ],
  'Rehab / tendon': [
    ex('Spanish squat hold', 'rehab', 'general'),
    ex('Wall sit', 'rehab', 'general'),
    ex('Isometric leg-extension hold', 'rehab', 'general'),
    ex('Isometric split squat', 'rehab', 'intermediate', 'unilateral'),
    ex('Single-leg wall sit', 'rehab', 'intermediate', 'unilateral'),
    ex('Slow tempo squat (HSR)', 'rehab', 'general'),
    ex('Slow leg extension (HSR)', 'rehab', 'general'),
    ex('Slow leg press (HSR)', 'rehab', 'general'),
    ex('Decline (Spanish) squat', 'rehab', 'intermediate'),
    ex('Bulgarian decline squat', 'rehab', 'intermediate', 'unilateral'),
    ex('Tempo step-down', 'rehab', 'intermediate', 'unilateral'),
    ex('Slow eccentric squat', 'rehab', 'general'),
    ex('Nordic curl', 'rehab', 'general'),
    ex('Heel / calf drop (straight knee)', 'rehab', 'general'),
    ex('Heel / calf drop (bent knee)', 'rehab', 'general'),
    ex('Tibialis raise (rehab)', 'rehab', 'general'),
    ex('Low-level pogo progression', 'rehab', 'general'),
    ex('Isometric calf hold', 'rehab', 'general'),
  ],
};

// Flat library with family tags, used by the picker.
export const EXERCISE_LIBRARY = FAMILY_ORDER.flatMap((family) =>
  (FAMILIES[family] || []).map((entry) => ({ ...entry, family }))
);

// Curated session templates (effort-killer for planning). Each item references a
// library exercise by name so it inherits the right type + FV coverage tags.
export const SESSION_TEMPLATES = [
  {
    name: 'Max strength (lower)',
    focus: 'Strength',
    items: [
      { name: 'Back squat (high-bar)', sets: 4, reps: 4, intensity_value: 85 },
      { name: 'Romanian deadlift', sets: 3, reps: 6, intensity_value: 70 },
      { name: 'Heavy step-up', sets: 3, reps: 5, intensity_value: 70 },
    ],
  },
  {
    name: 'Plyometric + sprint',
    focus: 'Reactive / speed',
    items: [
      { name: 'Depth jump', sets: 4, contacts: 10, intent_percent: 100 },
      { name: 'Double-leg pogo', sets: 3, contacts: 20, intent_percent: 90 },
      { name: 'Acceleration (10-30m)', reps: 6, distance: 20, intent_percent: 100 },
    ],
  },
  {
    name: 'Power / ballistic',
    focus: 'Speed-strength',
    items: [
      { name: 'Hang power clean (mid)', sets: 5, reps: 3, intensity_value: 70, intent_percent: 95 },
      { name: 'Loaded jump squat (barbell)', sets: 4, reps: 3, intensity_value: 30, intent_percent: 100 },
      { name: 'Med-ball scoop / broad throw', sets: 4, reps: 5, intent_percent: 100 },
    ],
  },
  {
    name: 'Tendon / rehab',
    focus: 'Patellar resilience',
    items: [
      { name: 'Spanish squat hold', sets: 4, duration_minutes: 1 },
      { name: 'Slow tempo squat (HSR)', sets: 3, reps: 6, intensity_value: 70 },
      { name: 'Heel / calf drop (straight knee)', sets: 3, reps: 12 },
    ],
  },
];

// Build a tagged exercise object from a template item (library lookup + overrides).
export function templateItemToExercise(item) {
  const entry = EXERCISE_LIBRARY.find((libEntry) => libEntry.name === item.name);
  const { name, ...fields } = item;
  const base = entry
    ? {
        movement_type: entry.type,
        exercise_name: entry.name,
        quality: entry.quality,
        specificity: entry.specificity,
        laterality: entry.laterality,
        ...defaultFieldsForType(entry.type),
      }
    : { movement_type: 'skill', exercise_name: name, ...defaultFieldsForType('skill') };
  return { ...base, ...fields };
}

// Case-insensitive search across name + family, optionally filtered by type.
export function searchLibrary(query, type) {
  const q = String(query || '').trim().toLowerCase();
  return EXERCISE_LIBRARY.filter((entry) => {
    if (type && entry.type !== type) return false;
    if (!q) return true;
    return entry.name.toLowerCase().includes(q) || entry.family.toLowerCase().includes(q);
  });
}
