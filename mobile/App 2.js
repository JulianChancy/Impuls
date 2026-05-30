import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const STORAGE_KEY = 'impuls-local-v1';

const movementTypes = [
  { id: 'plyometric', label: 'Plyometric' },
  { id: 'power_ballistic', label: 'Power' },
  { id: 'strength', label: 'Strength' },
  { id: 'endurance', label: 'Endurance' },
  { id: 'skill', label: 'Skill' },
];

const performanceTypes = [
  { id: 'jumping', label: 'Jump' },
  { id: 'running_sprinting', label: 'Sprint' },
  { id: 'lift', label: 'Lift' },
];

const blankExercise = {
  exercise_name: 'Approach jumps',
  movement_type: 'plyometric',
  contacts: '12',
  reps: '',
  duration_minutes: '',
  intensity_value: '',
  intensity_unit: 'kg',
  intent_percent: '85',
  rom: 'full',
};

const initialProgramme = {
  calendar_name: 'Performance rebuild',
  macro_block_name: 'Elastic development',
  block_name: 'Accumulation',
  week_name: 'Week 1',
  planned_sessions: [
    { id: 'plan_1', name: 'Reactive plyo day', date: new Date().toISOString(), focus: 'Jump contacts + freshness' },
  ],
};

const initialSession = {
  session_name: 'Reactive plyo day',
  session_datetime: new Date().toISOString(),
  exercises: [
    {
      id: 'ex_1',
      exercise_name: 'Approach jumps',
      movement_type: 'plyometric',
      contacts: 12,
      intent_percent: 85,
    },
  ],
};

const initialCheckIn = {
  pain_score: '2',
  pain_location: 'Achilles',
  freshness_score: '7',
  soreness_score: '4',
  performance_type: 'jumping',
  performance_score: '7.5',
  gct: '0.30',
  ft: '0.78',
  height_or_distance: '36',
  sprint_time: '',
  distance: '',
  lift_name: '',
  weight: '',
  sets: '',
  reps: '',
  bar_velocity: '',
  unit: 'in',
};

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function maybeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampScore(value) {
  return Math.max(0, Math.min(10, number(value)));
}

function formatDate(value) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getVolume(exercise) {
  if (exercise.movement_type === 'plyometric') return number(exercise.contacts);
  if (exercise.movement_type === 'power_ballistic' || exercise.movement_type === 'strength') return number(exercise.reps);
  return number(exercise.duration_minutes);
}

function getIntentScore(exercise) {
  return number(exercise.intent_percent) / 100;
}

function getIntensityScore(exercise) {
  const value = number(exercise.intensity_value, 1);
  if (exercise.intensity_unit === '%') return value / 100;
  if (exercise.intensity_unit === 'kg' || exercise.intensity_unit === 'lbs') return value;
  return 1;
}

function exerciseLoad(exercise) {
  const volume = getVolume(exercise);
  const intent = getIntentScore(exercise);
  const intensity = getIntensityScore(exercise);

  if (exercise.movement_type === 'plyometric') return volume * intent;
  if (exercise.movement_type === 'power_ballistic') return volume * intent * intensity;
  if (exercise.movement_type === 'strength') return volume * intensity;
  return volume * intent;
}

function sessionLoad(session) {
  return session.exercises.reduce((total, exercise) => total + exerciseLoad(exercise), 0);
}

function sessionContacts(session) {
  return session.exercises.reduce((total, exercise) => total + number(exercise.contacts), 0);
}

function sessionReps(session) {
  return session.exercises.reduce((total, exercise) => total + number(exercise.reps), 0);
}

function sessionDuration(session) {
  return session.exercises.reduce((total, exercise) => total + number(exercise.duration_minutes), 0);
}

function fatigue(freshness, soreness) {
  return ((10 - freshness) + soreness) / 2;
}

function readiness(freshness, soreness, pain) {
  return freshness - (soreness + pain) / 2;
}

function rsi(ft, gct) {
  return gct > 0 ? ft / gct : null;
}

function slope(values) {
  const clean = values.filter((value) => value !== null && value !== undefined && Number.isFinite(value));
  if (clean.length < 2) return null;
  const xMean = (clean.length - 1) / 2;
  const yMean = clean.reduce((sum, value) => sum + value, 0) / clean.length;
  const numerator = clean.reduce((sum, value, index) => sum + (index - xMean) * (value - yMean), 0);
  const denominator = clean.reduce((sum, value, index) => sum + (index - xMean) ** 2, 0);
  return denominator === 0 ? null : numerator / denominator;
}

function pearson(xValues, yValues) {
  const pairs = xValues
    .map((x, index) => [x, yValues[index]])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < 3) return null;
  const xMean = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length;
  const yMean = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length;
  const numerator = pairs.reduce((sum, [x, y]) => sum + (x - xMean) * (y - yMean), 0);
  const xDenominator = Math.sqrt(pairs.reduce((sum, [x]) => sum + (x - xMean) ** 2, 0));
  const yDenominator = Math.sqrt(pairs.reduce((sum, [, y]) => sum + (y - yMean) ** 2, 0));
  if (xDenominator === 0 || yDenominator === 0) return null;
  return numerator / (xDenominator * yDenominator);
}

function trendText(value) {
  if (value === null || value === undefined) return 'Collecting';
  if (value > 0.05) return 'Rising';
  if (value < -0.05) return 'Falling';
  return 'Stable';
}

function enhanceEntry(entry) {
  const pain = number(entry.check_in.pain_score);
  const fresh = number(entry.check_in.freshness_score);
  const sore = number(entry.check_in.soreness_score);
  const ft = maybeNumber(entry.check_in.ft);
  const gct = maybeNumber(entry.check_in.gct);
  return {
    ...entry,
    derived: {
      load: sessionLoad(entry.session),
      contacts: sessionContacts(entry.session),
      reps: sessionReps(entry.session),
      duration: sessionDuration(entry.session),
      fatigue: fatigue(fresh, sore),
      readiness: readiness(fresh, sore, pain),
      rsi: rsi(ft, gct),
      pain,
      freshness: fresh,
      soreness: sore,
      performance: number(entry.check_in.performance_score),
    },
  };
}

function getInsights(entries) {
  const enhanced = entries.map(enhanceEntry).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const latest = enhanced[enhanced.length - 1];
  const now = Date.now();
  const last7 = enhanced.filter((entry) => now - new Date(entry.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const previous7 = enhanced.filter((entry) => {
    const age = now - new Date(entry.created_at).getTime();
    return age > 7 * 24 * 60 * 60 * 1000 && age <= 14 * 24 * 60 * 60 * 1000;
  });
  const weeklyLoad = last7.reduce((sum, entry) => sum + entry.derived.load, 0);
  const previousLoad = previous7.reduce((sum, entry) => sum + entry.derived.load, 0);
  const loadChange = previousLoad > 0 ? ((weeklyLoad - previousLoad) / previousLoad) * 100 : null;
  const performanceTrend = slope(enhanced.map((entry) => entry.derived.performance));
  const painTrend = slope(enhanced.map((entry) => entry.derived.pain));
  const fatigueTrend = slope(enhanced.map((entry) => entry.derived.fatigue));
  const loadPerformance = pearson(
    enhanced.map((entry) => entry.derived.load),
    enhanced.map((entry) => entry.derived.performance)
  );
  const fatiguePerformance = pearson(
    enhanced.map((entry) => entry.derived.fatigue),
    enhanced.map((entry) => entry.derived.performance)
  );
  const loadPain = pearson(
    enhanced.map((entry) => entry.derived.load),
    enhanced.map((entry) => entry.derived.pain)
  );
  const best = [...enhanced].sort((a, b) => b.derived.performance - a.derived.performance)[0];

  const strongest = [
    { label: 'Load / performance', value: loadPerformance },
    { label: 'Fatigue / performance', value: fatiguePerformance },
    { label: 'Load / pain', value: loadPain },
  ]
    .filter((item) => item.value !== null)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];

  return {
    latest,
    count: enhanced.length,
    weeklyLoad,
    loadChange,
    performanceTrend,
    painTrend,
    fatigueTrend,
    loadPerformance,
    fatiguePerformance,
    loadPain,
    strongest,
    best,
  };
}

export default function App() {
  const [tab, setTab] = useState('today');
  const [entries, setEntries] = useState([]);
  const [programme, setProgramme] = useState(initialProgramme);
  const [session, setSession] = useState(initialSession);
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [exerciseDraft, setExerciseDraft] = useState(blankExercise);
  const [planDraft, setPlanDraft] = useState({ name: 'Acceleration exposure', focus: 'Low pain, high intent' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setEntries(parsed.entries || []);
        setProgramme(parsed.programme || initialProgramme);
        setSession(parsed.session || initialSession);
        setCheckIn(parsed.checkIn || initialCheckIn);
      }
      setLoaded(true);
    }
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ entries, programme, session, checkIn }));
  }, [entries, programme, session, checkIn, loaded]);

  const currentDerived = useMemo(() => {
    return enhanceEntry({ created_at: new Date().toISOString(), session, check_in: checkIn }).derived;
  }, [session, checkIn]);

  const insights = useMemo(() => getInsights(entries), [entries]);

  function updateCheckIn(key, value) {
    setCheckIn((current) => ({ ...current, [key]: value }));
  }

  function updateProgramme(key, value) {
    setProgramme((current) => ({ ...current, [key]: value }));
  }

  function addExercise() {
    const draft = {
      id: id('exercise'),
      exercise_name: exerciseDraft.exercise_name.trim() || 'Untitled exercise',
      movement_type: exerciseDraft.movement_type,
      contacts: maybeNumber(exerciseDraft.contacts),
      reps: maybeNumber(exerciseDraft.reps),
      duration_minutes: maybeNumber(exerciseDraft.duration_minutes),
      intensity_value: maybeNumber(exerciseDraft.intensity_value),
      intensity_unit: exerciseDraft.intensity_unit,
      intent_percent: maybeNumber(exerciseDraft.intent_percent),
      rom: exerciseDraft.rom,
    };
    setSession((current) => ({ ...current, exercises: [...current.exercises, draft] }));
    setExerciseDraft({ ...blankExercise, movement_type: exerciseDraft.movement_type });
  }

  function removeExercise(exerciseId) {
    setSession((current) => ({
      ...current,
      exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId),
    }));
  }

  function saveEntry() {
    const entry = {
      id: id('entry'),
      created_at: new Date().toISOString(),
      programme: { ...programme },
      session: { ...session, session_datetime: new Date().toISOString() },
      check_in: { ...checkIn },
    };
    setEntries((current) => [entry, ...current]);
    Alert.alert('Logged', 'Session and check-in saved locally.');
  }

  function addPlan() {
    const name = planDraft.name.trim();
    if (!name) return;
    setProgramme((current) => ({
      ...current,
      planned_sessions: [
        { id: id('plan'), name, focus: planDraft.focus.trim(), date: new Date().toISOString() },
        ...current.planned_sessions,
      ],
    }));
    setPlanDraft({ name: '', focus: '' });
  }

  function resetLocalData() {
    Alert.alert('Reset local data?', 'This clears entries stored on this simulator.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(STORAGE_KEY);
          setEntries([]);
          setProgramme(initialProgramme);
          setSession(initialSession);
          setCheckIn(initialCheckIn);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.topbar}>
            <View>
              <Text style={styles.brand}>Impuls</Text>
              <Text style={styles.subhead}>{programme.block_name} / {programme.week_name}</Text>
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreValue}>{currentDerived.readiness.toFixed(1)}</Text>
              <Text style={styles.scoreLabel}>ready</Text>
            </View>
          </View>

          <View style={styles.metricStrip}>
            <Metric label="Load" value={currentDerived.load.toFixed(0)} />
            <Metric label="Fatigue" value={currentDerived.fatigue.toFixed(1)} />
            <Metric label="Pain" value={currentDerived.pain.toFixed(0)} />
            <Metric label="RSI" value={currentDerived.rsi ? currentDerived.rsi.toFixed(2) : '-'} />
          </View>

          <Tabs active={tab} onChange={setTab} />

          {tab === 'today' && (
            <TodayScreen
              session={session}
              setSession={setSession}
              checkIn={checkIn}
              updateCheckIn={updateCheckIn}
              exerciseDraft={exerciseDraft}
              setExerciseDraft={setExerciseDraft}
              addExercise={addExercise}
              removeExercise={removeExercise}
              saveEntry={saveEntry}
              derived={currentDerived}
            />
          )}

          {tab === 'programme' && (
            <ProgrammeScreen
              programme={programme}
              updateProgramme={updateProgramme}
              planDraft={planDraft}
              setPlanDraft={setPlanDraft}
              addPlan={addPlan}
            />
          )}

          {tab === 'insights' && <InsightsScreen insights={insights} entries={entries} />}

          {tab === 'history' && <HistoryScreen entries={entries} setEntries={setEntries} resetLocalData={resetLocalData} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Tabs({ active, onChange }) {
  return (
    <View style={styles.tabs}>
      {[
        ['today', 'Today'],
        ['programme', 'Plan'],
        ['insights', 'Insights'],
        ['history', 'History'],
      ].map(([idValue, label]) => (
        <Pressable key={idValue} style={[styles.tab, active === idValue && styles.activeTab]} onPress={() => onChange(idValue)}>
          <Text style={[styles.tabText, active === idValue && styles.activeTabText]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function TodayScreen({
  session,
  setSession,
  checkIn,
  updateCheckIn,
  exerciseDraft,
  setExerciseDraft,
  addExercise,
  removeExercise,
  saveEntry,
  derived,
}) {
  return (
    <View style={styles.stack}>
      <Section title="Check-in">
        <View style={styles.fieldGrid}>
          <Field label="Pain" value={checkIn.pain_score} onChangeText={(value) => updateCheckIn('pain_score', value)} keyboardType="decimal-pad" />
          <Field label="Freshness" value={checkIn.freshness_score} onChangeText={(value) => updateCheckIn('freshness_score', value)} keyboardType="decimal-pad" />
          <Field label="Soreness" value={checkIn.soreness_score} onChangeText={(value) => updateCheckIn('soreness_score', value)} keyboardType="decimal-pad" />
          <Field label="Performance" value={checkIn.performance_score} onChangeText={(value) => updateCheckIn('performance_score', value)} keyboardType="decimal-pad" />
        </View>
        <Field label="Pain location" value={checkIn.pain_location} onChangeText={(value) => updateCheckIn('pain_location', value)} />
        <Segmented options={performanceTypes} value={checkIn.performance_type} onChange={(value) => updateCheckIn('performance_type', value)} />
        {checkIn.performance_type === 'jumping' && (
          <View style={styles.fieldGrid}>
            <Field label="GCT" value={checkIn.gct} onChangeText={(value) => updateCheckIn('gct', value)} keyboardType="decimal-pad" />
            <Field label="FT" value={checkIn.ft} onChangeText={(value) => updateCheckIn('ft', value)} keyboardType="decimal-pad" />
            <Field label="Height / distance" value={checkIn.height_or_distance} onChangeText={(value) => updateCheckIn('height_or_distance', value)} keyboardType="decimal-pad" />
            <Field label="Unit" value={checkIn.unit} onChangeText={(value) => updateCheckIn('unit', value)} />
          </View>
        )}
        {checkIn.performance_type === 'running_sprinting' && (
          <View style={styles.fieldGrid}>
            <Field label="Time" value={checkIn.sprint_time} onChangeText={(value) => updateCheckIn('sprint_time', value)} keyboardType="decimal-pad" />
            <Field label="Distance" value={checkIn.distance} onChangeText={(value) => updateCheckIn('distance', value)} keyboardType="decimal-pad" />
          </View>
        )}
        {checkIn.performance_type === 'lift' && (
          <View style={styles.fieldGrid}>
            <Field label="Lift" value={checkIn.lift_name} onChangeText={(value) => updateCheckIn('lift_name', value)} />
            <Field label="Weight" value={checkIn.weight} onChangeText={(value) => updateCheckIn('weight', value)} keyboardType="decimal-pad" />
            <Field label="Sets" value={checkIn.sets} onChangeText={(value) => updateCheckIn('sets', value)} keyboardType="decimal-pad" />
            <Field label="Velocity" value={checkIn.bar_velocity} onChangeText={(value) => updateCheckIn('bar_velocity', value)} keyboardType="decimal-pad" />
          </View>
        )}
      </Section>

      <Section title="Training session">
        <Field
          label="Session name"
          value={session.session_name}
          onChangeText={(value) => setSession((current) => ({ ...current, session_name: value }))}
        />
        {session.exercises.map((exercise) => (
          <View key={exercise.id} style={styles.exerciseRow}>
            <View style={styles.exerciseMain}>
              <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
              <Text style={styles.exerciseMeta}>
                {exercise.movement_type.replace('_', ' ')} / load {exerciseLoad(exercise).toFixed(0)}
              </Text>
            </View>
            <Pressable style={styles.iconButton} onPress={() => removeExercise(exercise.id)}>
              <Text style={styles.iconButtonText}>x</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.divider} />
        <Field
          label="Exercise"
          value={exerciseDraft.exercise_name}
          onChangeText={(value) => setExerciseDraft((current) => ({ ...current, exercise_name: value }))}
        />
        <Segmented
          options={movementTypes}
          value={exerciseDraft.movement_type}
          onChange={(value) => setExerciseDraft((current) => ({ ...current, movement_type: value }))}
        />
        <ExerciseFields exercise={exerciseDraft} setExercise={setExerciseDraft} />
        <Pressable style={styles.secondaryButton} onPress={addExercise}>
          <Text style={styles.secondaryButtonText}>Add exercise</Text>
        </Pressable>
      </Section>

      <View style={styles.summaryBand}>
        <Metric label="Contacts" value={derived.contacts.toFixed(0)} />
        <Metric label="Reps" value={derived.reps.toFixed(0)} />
        <Metric label="Minutes" value={derived.duration.toFixed(0)} />
      </View>

      <Pressable style={styles.primaryButton} onPress={saveEntry}>
        <Text style={styles.primaryButtonText}>Save daily log</Text>
      </Pressable>
    </View>
  );
}

function ExerciseFields({ exercise, setExercise }) {
  const update = (key, value) => setExercise((current) => ({ ...current, [key]: value }));

  if (exercise.movement_type === 'plyometric') {
    return (
      <View style={styles.fieldGrid}>
        <Field label="Contacts" value={exercise.contacts} onChangeText={(value) => update('contacts', value)} keyboardType="decimal-pad" />
        <Field label="Intent %" value={exercise.intent_percent} onChangeText={(value) => update('intent_percent', value)} keyboardType="decimal-pad" />
      </View>
    );
  }

  if (exercise.movement_type === 'power_ballistic') {
    return (
      <View style={styles.fieldGrid}>
        <Field label="Reps" value={exercise.reps} onChangeText={(value) => update('reps', value)} keyboardType="decimal-pad" />
        <Field label="Intensity" value={exercise.intensity_value} onChangeText={(value) => update('intensity_value', value)} keyboardType="decimal-pad" />
        <Field label="Unit" value={exercise.intensity_unit} onChangeText={(value) => update('intensity_unit', value)} />
        <Field label="Intent %" value={exercise.intent_percent} onChangeText={(value) => update('intent_percent', value)} keyboardType="decimal-pad" />
      </View>
    );
  }

  if (exercise.movement_type === 'strength') {
    return (
      <View style={styles.fieldGrid}>
        <Field label="Reps" value={exercise.reps} onChangeText={(value) => update('reps', value)} keyboardType="decimal-pad" />
        <Field label="Intensity" value={exercise.intensity_value} onChangeText={(value) => update('intensity_value', value)} keyboardType="decimal-pad" />
        <Field label="Unit" value={exercise.intensity_unit} onChangeText={(value) => update('intensity_unit', value)} />
        <Field label="ROM" value={exercise.rom} onChangeText={(value) => update('rom', value)} />
      </View>
    );
  }

  return (
    <View style={styles.fieldGrid}>
      <Field label="Duration" value={exercise.duration_minutes} onChangeText={(value) => update('duration_minutes', value)} keyboardType="decimal-pad" />
      <Field label="Intent %" value={exercise.intent_percent} onChangeText={(value) => update('intent_percent', value)} keyboardType="decimal-pad" />
    </View>
  );
}

function ProgrammeScreen({ programme, updateProgramme, planDraft, setPlanDraft, addPlan }) {
  return (
    <View style={styles.stack}>
      <Section title="Periodisation">
        <Field label="Calendar" value={programme.calendar_name} onChangeText={(value) => updateProgramme('calendar_name', value)} />
        <Field label="Macro block" value={programme.macro_block_name} onChangeText={(value) => updateProgramme('macro_block_name', value)} />
        <Field label="Block" value={programme.block_name} onChangeText={(value) => updateProgramme('block_name', value)} />
        <Field label="Week" value={programme.week_name} onChangeText={(value) => updateProgramme('week_name', value)} />
      </Section>

      <Section title="Planned sessions">
        {programme.planned_sessions.map((session) => (
          <View key={session.id} style={styles.planRow}>
            <Text style={styles.exerciseName}>{session.name}</Text>
            <Text style={styles.exerciseMeta}>{session.focus || 'Open focus'} / {formatDate(session.date)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <Field label="Session" value={planDraft.name} onChangeText={(value) => setPlanDraft((current) => ({ ...current, name: value }))} />
        <Field label="Focus" value={planDraft.focus} onChangeText={(value) => setPlanDraft((current) => ({ ...current, focus: value }))} />
        <Pressable style={styles.secondaryButton} onPress={addPlan}>
          <Text style={styles.secondaryButtonText}>Add planned session</Text>
        </Pressable>
      </Section>
    </View>
  );
}

function InsightsScreen({ insights, entries }) {
  const performanceValues = entries.map((entry) => enhanceEntry(entry).derived.performance).reverse();
  const loadValues = entries.map((entry) => enhanceEntry(entry).derived.load).reverse();
  return (
    <View style={styles.stack}>
      <View style={styles.insightHero}>
        <Text style={styles.insightKicker}>{insights.count} logs</Text>
        <Text style={styles.insightHeadline}>{trendText(insights.performanceTrend)} performance</Text>
        <Text style={styles.insightBody}>
          {insights.strongest
            ? `${insights.strongest.label} is the strongest current relationship (${insights.strongest.value.toFixed(2)}).`
            : 'Save at least three logs to unlock relationship signals.'}
        </Text>
      </View>

      <View style={styles.metricStrip}>
        <Metric label="7d load" value={insights.weeklyLoad.toFixed(0)} />
        <Metric label="Load change" value={insights.loadChange === null ? '-' : `${insights.loadChange.toFixed(0)}%`} />
        <Metric label="Pain trend" value={trendText(insights.painTrend)} />
      </View>

      <Section title="Monitoring">
        <Sparkline label="Performance" values={performanceValues} />
        <Sparkline label="Load" values={loadValues} />
      </Section>

      <Section title="Insight summary">
        <InsightLine label="Best day" value={insights.best ? `${formatDate(insights.best.created_at)} / ${insights.best.derived.performance.toFixed(1)}` : '-'} />
        <InsightLine label="Load to performance" value={insights.loadPerformance === null ? '-' : insights.loadPerformance.toFixed(2)} />
        <InsightLine label="Fatigue to performance" value={insights.fatiguePerformance === null ? '-' : insights.fatiguePerformance.toFixed(2)} />
        <InsightLine label="Load to pain" value={insights.loadPain === null ? '-' : insights.loadPain.toFixed(2)} />
      </Section>
    </View>
  );
}

function HistoryScreen({ entries, setEntries, resetLocalData }) {
  return (
    <View style={styles.stack}>
      <View style={styles.historyHeader}>
        <Text style={styles.sectionTitle}>Saved logs</Text>
        <Pressable style={styles.ghostButton} onPress={resetLocalData}>
          <Text style={styles.ghostButtonText}>Reset</Text>
        </Pressable>
      </View>
      {entries.length === 0 ? (
        <Text style={styles.empty}>No local logs yet.</Text>
      ) : (
        entries.map((entry) => {
          const derived = enhanceEntry(entry).derived;
          return (
            <View key={entry.id} style={styles.historyRow}>
              <View style={styles.historyDate}>
                <Text style={styles.historyDay}>{formatDate(entry.created_at)}</Text>
                <Text style={styles.historyTime}>{formatTime(entry.created_at)}</Text>
              </View>
              <View style={styles.historyMain}>
                <Text style={styles.exerciseName}>{entry.session.session_name}</Text>
                <Text style={styles.exerciseMeta}>
                  Load {derived.load.toFixed(0)} / Pain {derived.pain.toFixed(0)} / Performance {derived.performance.toFixed(1)}
                </Text>
              </View>
              <Pressable
                style={styles.iconButton}
                onPress={() => setEntries((current) => current.filter((item) => item.id !== entry.id))}
              >
                <Text style={styles.iconButtonText}>x</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value, onChangeText, keyboardType = 'default' }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={String(value ?? '')}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Pressable key={option.id} style={[styles.segment, value === option.id && styles.activeSegment]} onPress={() => onChange(option.id)}>
          <Text style={[styles.segmentText, value === option.id && styles.activeSegmentText]} numberOfLines={1}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Metric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Sparkline({ label, values }) {
  const clean = values.filter((value) => Number.isFinite(value)).slice(-12);
  const max = Math.max(...clean, 1);
  return (
    <View style={styles.sparkWrap}>
      <Text style={styles.sparkLabel}>{label}</Text>
      <View style={styles.sparkBars}>
        {clean.length === 0 ? (
          <Text style={styles.empty}>No data</Text>
        ) : (
          clean.map((value, index) => (
            <View key={`${label}_${index}`} style={[styles.sparkBar, { height: Math.max(8, (value / max) * 56) }]} />
          ))
        )}
      </View>
    </View>
  );
}

function InsightLine({ label, value }) {
  return (
    <View style={styles.insightLine}>
      <Text style={styles.insightLineLabel}>{label}</Text>
      <Text style={styles.insightLineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#EEF1EA',
  },
  container: {
    padding: 16,
    gap: 14,
  },
  topbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  brand: {
    color: '#101510',
    fontSize: 36,
    fontWeight: '900',
  },
  subhead: {
    color: '#687064',
    fontSize: 14,
    marginTop: 2,
  },
  scoreBadge: {
    alignItems: 'center',
    backgroundColor: '#172116',
    borderRadius: 8,
    minWidth: 76,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scoreValue: {
    color: '#F8FAF3',
    fontSize: 22,
    fontWeight: '900',
  },
  scoreLabel: {
    color: '#B9C7B1',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  metric: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CFD6CA',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 72,
    padding: 10,
    justifyContent: 'space-between',
  },
  metricValue: {
    color: '#111610',
    fontSize: 18,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#667160',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  tabs: {
    backgroundColor: '#DDE3D7',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 3,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    paddingVertical: 10,
  },
  activeTab: {
    backgroundColor: '#151C14',
  },
  tabText: {
    color: '#596455',
    fontSize: 12,
    fontWeight: '900',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  stack: {
    gap: 14,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CFD6CA',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  sectionTitle: {
    color: '#151A14',
    fontSize: 19,
    fontWeight: '900',
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  field: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 6,
  },
  fieldLabel: {
    color: '#535D50',
    fontSize: 12,
    fontWeight: '900',
  },
  input: {
    backgroundColor: '#F8FAF6',
    borderColor: '#CDD5C8',
    borderRadius: 8,
    borderWidth: 1,
    color: '#141914',
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  segmented: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    alignItems: 'center',
    backgroundColor: '#F8FAF6',
    borderColor: '#CDD5C8',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 6,
  },
  activeSegment: {
    backgroundColor: '#2A3628',
    borderColor: '#2A3628',
  },
  segmentText: {
    color: '#4B5548',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  activeSegmentText: {
    color: '#FFFFFF',
  },
  exerciseRow: {
    alignItems: 'center',
    backgroundColor: '#F8FAF6',
    borderColor: '#D8DED4',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 10,
  },
  exerciseMain: {
    flex: 1,
  },
  exerciseName: {
    color: '#171C16',
    fontSize: 15,
    fontWeight: '900',
  },
  exerciseMeta: {
    color: '#657060',
    fontSize: 12,
    marginTop: 3,
    textTransform: 'capitalize',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#E8EDE4',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  iconButtonText: {
    color: '#2B3329',
    fontSize: 16,
    fontWeight: '900',
  },
  divider: {
    backgroundColor: '#DCE2D8',
    height: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#E0E7DA',
    borderRadius: 8,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#172116',
    fontSize: 14,
    fontWeight: '900',
  },
  summaryBand: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#151C14',
    borderRadius: 8,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  planRow: {
    backgroundColor: '#F8FAF6',
    borderColor: '#D8DED4',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  insightHero: {
    backgroundColor: '#152015',
    borderRadius: 8,
    padding: 16,
  },
  insightKicker: {
    color: '#B9C8B1',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  insightHeadline: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
  },
  insightBody: {
    color: '#DDE8D6',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  sparkWrap: {
    gap: 8,
  },
  sparkLabel: {
    color: '#535D50',
    fontSize: 12,
    fontWeight: '900',
  },
  sparkBars: {
    alignItems: 'flex-end',
    backgroundColor: '#F4F7F1',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 5,
    height: 72,
    padding: 8,
  },
  sparkBar: {
    backgroundColor: '#344730',
    borderRadius: 3,
    flex: 1,
    maxWidth: 18,
  },
  insightLine: {
    alignItems: 'center',
    borderBottomColor: '#E3E8DF',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  insightLineLabel: {
    color: '#5B6656',
    fontWeight: '800',
  },
  insightLineValue: {
    color: '#151A14',
    fontWeight: '900',
  },
  historyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ghostButton: {
    borderColor: '#C9D2C5',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ghostButtonText: {
    color: '#303A2E',
    fontWeight: '900',
  },
  empty: {
    color: '#667160',
    fontSize: 14,
  },
  historyRow: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#CFD6CA',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  historyDate: {
    alignItems: 'center',
    backgroundColor: '#E9EFE4',
    borderRadius: 8,
    minWidth: 66,
    padding: 8,
  },
  historyDay: {
    color: '#151A14',
    fontSize: 13,
    fontWeight: '900',
  },
  historyTime: {
    color: '#657060',
    fontSize: 11,
    marginTop: 2,
  },
  historyMain: {
    flex: 1,
  },
});
