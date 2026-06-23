import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  emptyExercise,
  loadAppData,
  saveAppData,
  resetAppData,
  createId,
} from './src/storage';
import {
  getCurrentUser,
  onAuthStateChange,
  signIn,
  signOut,
  signUp,
  updatePassword,
} from './src/auth';
import {
  loadAppDataFromSupabase,
  saveCheckIn as saveCheckInToSupabase,
  saveCheckInInsight as saveCheckInInsightToSupabase,
  saveProfile as saveProfileToSupabase,
  saveProgramme as saveProgrammeToSupabase,
  saveSession as saveSessionToSupabase,
} from './src/database';
import {
  EXERCISE_LIBRARY,
  FAMILY_ORDER,
  LATERALITY_OPTIONS,
  QUALITY_META,
  QUALITY_OPTIONS,
  ROM_OPTIONS,
  SESSION_TEMPLATES,
  SPECIFICITY_OPTIONS,
  TYPE_META,
  TYPE_OPTIONS,
  defaultFieldsForType,
  defaultQualityForType,
  searchLibrary,
  templateItemToExercise,
} from './src/exerciseLibrary';
import { Circle, G, Line, Path, Rect, Svg, Text as SvgText } from 'react-native-svg';

function analysisUrlsFromEnv() {
  const fallbackUrl = 'https://impuls-chl1.onrender.com';
  const isHttpsPage = typeof window !== 'undefined' && window.location?.protocol === 'https:';
  const candidates = [
    process.env.EXPO_PUBLIC_ANALYSIS_API_URL,
    process.env.EXPO_PUBLIC_ANALYSIS_API_BASE_URL,
    'http://127.0.0.1:8000',
    fallbackUrl,
  ].filter(Boolean);
  const urls = [];

  for (const candidate of candidates) {
    const cleanedUrl = String(candidate).trim().replace(/\/+$/, '');
    if (!cleanedUrl) continue;
    if (isHttpsPage && cleanedUrl.startsWith('http://')) {
      console.warn('[LOCAL FALLBACK] Ignoring insecure analysis API URL on HTTPS page.', cleanedUrl);
      continue;
    }
    const url = cleanedUrl.endsWith('/analyze') ? cleanedUrl : `${cleanedUrl}/analyze`;
    if (!urls.includes(url)) urls.push(url);
  }

  return urls.length ? urls : [`${fallbackUrl}/analyze`];
}

const ANALYSIS_API_URLS = analysisUrlsFromEnv();
const ANALYSIS_API_URL = ANALYSIS_API_URLS[0];

async function fetchAnalysisWithFallback(data) {
  const errors = [];
  for (const url of ANALYSIS_API_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Analysis request failed (${response.status})`);
      }
      if (url !== ANALYSIS_API_URL) console.log('[ANALYSIS] Fallback backend used', url);
      return response.json();
    } catch (error) {
      errors.push(`${url}: ${error.message || 'Failed to fetch'}`);
      console.warn('[ANALYSIS] Backend unavailable, trying next candidate.', url, error);
    }
  }
  throw new Error(errors.join('\n'));
}

function programmeSignature(programme) {
  return JSON.stringify(programme || {});
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(String(value || ''));
}

function createPersistentSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

// Movement types are sourced from the exercise library so the picker, the per-type
// fields, and the load engine all agree on the same taxonomy.
const movementOptions = TYPE_OPTIONS;

const performanceMetricOptions = [
  ['jumping', 'Plyometrics'],
  ['sprinting', 'Sprinting'],
  ['lift', 'Lift'],
];

const sprintTimeUnitOptions = [
  ['seconds', 'seconds'],
  ['milliseconds', 'milliseconds'],
];
const jumpDistanceUnitOptions = [
  ['cm', 'cm'],
  ['inches', 'inches'],
];
const sprintDistanceUnitOptions = [
  ['metres', 'metres'],
  ['yards', 'yards'],
];
const weightUnitOptions = [
  ['kg', 'kg'],
  ['lbs', 'lbs'],
];
const barVelocityUnitOptions = [
  ['m/s', 'm/s'],
  ['ft/s', 'ft/s'],
];
const intensityUnitOptions = [
  ['%', '%'],
  ['kg', 'kg'],
  ['lbs', 'lbs'],
];
const romOptions = [
  ['full', 'Full'],
  ['half', 'Half'],
  ['partial', 'Partial'],
];

// Fast single-output capture for the daily check-in. Each maps to a check-in
// field the engine + Supabase already read (see analyze_app_data / saveCheckIn).
const quickOutputOptions = [
  ['performance_score', 'Effort / score'],
  ['height_or_distance', 'Jump height'],
  ['sprint_time', 'Sprint time'],
  ['ft', 'Flight time'],
];
const quickOutputUnitOptions = {
  height_or_distance: jumpDistanceUnitOptions,
  sprint_time: sprintTimeUnitOptions,
  ft: sprintTimeUnitOptions,
};
const quickOutputDefaultUnit = {
  height_or_distance: 'cm',
  sprint_time: 'seconds',
  ft: 'seconds',
};

const insightSections = [
  { id: 'overview', title: 'Overview', color: '#111111' },
  { id: 'performance', title: 'Performance', color: '#24883B' },
  { id: 'irritation', title: 'Pain', color: '#E13F32' },
  { id: 'recovery', title: 'Recovery', color: '#6656E8' },
  { id: 'load', title: 'Load', color: '#1F7A40' },
  { id: 'adaptation', title: 'Adaptation', color: '#2F8F6B' },
  { id: 'likely_response', title: 'What Usually Happens', color: '#B86B18' },
  { id: 'metric_explorer', title: 'Evidence', color: '#3A6EA5' },
];

const dashboardMetrics = [
  { key: 'performance', label: 'Performance Score', category: 'Performance', color: '#24883B' },
  { key: 'height_or_distance', label: 'Height / Distance', category: 'Performance', color: '#24924A' },
  { key: 'rsi', label: 'RSI', category: 'Performance', color: '#1F7A40' },
  { key: 'ft', label: 'Flight Time', category: 'Performance', color: '#2E8B57' },
  { key: 'gct', label: 'Ground Contact', category: 'Performance', color: '#6AA84F' },
  { key: 'sprint_time', label: 'Sprint Time', category: 'Performance', color: '#B86B18' },
  { key: 'bar_velocity', label: 'Bar Velocity', category: 'Performance', color: '#2F8F6B' },
  { key: 'weight', label: 'Weight', category: 'Performance', color: '#33332F' },
  { key: 'load', label: 'Session Load', category: 'Load', color: '#1F7A40' },
  { key: 'volume', label: 'Volume', category: 'Load', color: '#387D45' },
  { key: 'contacts', label: 'Contacts', category: 'Load', color: '#4E8F58' },
  { key: 'reps', label: 'Reps', category: 'Load', color: '#679D6F' },
  { key: 'duration', label: 'Duration', category: 'Load', color: '#7CAA83' },
  { key: 'average_intent', label: 'Average Intent', category: 'Load', color: '#98B893' },
  { key: 'freshness', label: 'Freshness', category: 'Recovery', color: '#4D67E8' },
  { key: 'soreness', label: 'Soreness', category: 'Recovery', color: '#7C63E6' },
  { key: 'fatigue', label: 'Fatigue', category: 'Recovery', color: '#6656E8' },
  { key: 'readiness', label: 'Readiness', category: 'Recovery', color: '#2D9A68' },
  { key: 'pain', label: 'Pain', category: 'Pain', color: '#E13F32' },
  { key: 'pain_delta', label: 'Pain Change', category: 'Pain', color: '#C73A2E' },
];

const performanceMetricKeys = ['performance', 'height_or_distance', 'ft', 'gct', 'rsi', 'sprint_time', 'bar_velocity', 'weight'];
const jumpMetricKeys = ['height_or_distance', 'ft', 'gct', 'rsi'];
const liftMetricKeys = ['weight', 'bar_velocity'];
const emptyTutorialFlags = {
  checkin_seen: false,
  programme_seen: false,
  insights_seen: false,
  dashboard_seen: false,
};
const pbFields = [
  ['jump_height', 'Jump height / distance'],
  ['approach_jump', 'Approach jump'],
  ['standing_jump', 'Standing jump'],
  ['rsi', 'RSI'],
  ['ft', 'FT'],
  ['gct', 'GCT'],
  ['sprint_time', 'Sprint time'],
  ['sprint_distance', 'Sprint distance'],
  ['bar_velocity', 'Bar velocity'],
  ['lift_name', 'Main lift name'],
  ['lift_weight', 'Main lift weight'],
];
const derivedPbFields = [
  { key: 'performance', label: 'Performance score', mode: 'max', manualKey: null },
  { key: 'height_or_distance', label: 'Jump height / distance', mode: 'max', manualKey: 'jump_height' },
  { key: 'ft', label: 'FT', mode: 'max', manualKey: 'ft' },
  { key: 'gct', label: 'GCT', mode: 'min', manualKey: 'gct' },
  { key: 'rsi', label: 'RSI', mode: 'max', manualKey: 'rsi' },
  { key: 'sprint_time', label: 'Sprint time', mode: 'min', manualKey: 'sprint_time' },
  { key: 'bar_velocity', label: 'Bar velocity', mode: 'max', manualKey: 'bar_velocity' },
  { key: 'weight', label: 'Lift weight', mode: 'max', manualKey: 'lift_weight' },
];

function mergeProfileForAuthLoad(remoteProfile = {}, localProfile = {}) {
  const localFlags = localProfile.tutorialFlags || {};
  const remoteFlags = remoteProfile.tutorialFlags || {};
  const localPbs = localProfile.pbs || {};
  const remotePbs = remoteProfile.pbs || {};
  const pbs = { ...localPbs };

  Object.entries(remotePbs).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      pbs[key] = value;
    }
  });

  return {
    ...remoteProfile,
    name: String(remoteProfile.name || '').trim() || localProfile.name || '',
    onboarding_completed: Boolean(remoteProfile.onboarding_completed || localProfile.onboarding_completed),
    tutorialFlags: Object.fromEntries(
      Object.keys(emptyTutorialFlags).map((key) => [key, Boolean(localFlags[key] || remoteFlags[key])])
    ),
    pbs,
  };
}

function todayLabel() {
  return new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
}

function shortDate(value) {
  return new Date(value).toLocaleDateString([], { weekday: 'short', day: 'numeric' });
}

function isoDate(value = new Date()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateValue, amount) {
  const date = new Date(`${dateValue || isoDate()}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return isoDate(date);
}

function dateFromIso(dateValue) {
  return new Date(`${dateValue || isoDate()}T00:00:00`);
}

// Turn a chosen check-in day (YYYY-MM-DD) into a timestamp. Today keeps the real
// clock time so same-day logs stay ordered; past/future days anchor to local noon
// so they never slip across a timezone boundary.
function checkInTimestamp(dateValue) {
  const today = isoDate();
  if (!dateValue || dateValue === today) return new Date().toISOString();
  return new Date(`${dateValue}T12:00:00`).toISOString();
}

function friendlyDateLabel(dateValue) {
  const today = isoDate();
  if (!dateValue || dateValue === today) return 'Today';
  if (dateValue === addDays(today, -1)) return 'Yesterday';
  if (dateValue === addDays(today, 1)) return 'Tomorrow';
  return dateFromIso(dateValue).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

function dayOffset(dateA, dateB) {
  if (!dateA || !dateB) return 0;
  const a = new Date(`${dateA}T00:00:00`).getTime();
  const b = new Date(`${dateB}T00:00:00`).getTime();
  return Math.max(0, Math.round((a - b) / 86400000));
}

// Client-side mirror of the engine load formula (backend/logic.py app_exercise_load),
// used for the live load-shape preview and repeat-week progression. Keep in sync with the engine.
function jsNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function jsExerciseVolume(ex) {
  const t = ex.movement_type;
  if (t === 'plyometric') return jsNum(ex.contacts);
  if (t === 'power_ballistic' || t === 'strength' || t === 'general') {
    const sets = jsNum(ex.sets) || 1;
    const reps = jsNum(ex.reps);
    return reps ? sets * reps : reps;
  }
  if (t === 'sprint') {
    const reps = jsNum(ex.reps) || 1;
    const distance = jsNum(ex.distance);
    return distance ? reps * distance : reps;
  }
  if (t === 'rehab') {
    const dur = jsNum(ex.duration_minutes);
    if (dur) return dur;
    const sets = jsNum(ex.sets) || 1;
    const reps = jsNum(ex.reps);
    return reps ? sets * reps : reps;
  }
  return jsNum(ex.duration_minutes);
}
function jsExerciseLoad(ex) {
  const volume = jsExerciseVolume(ex);
  const intent = jsNum(ex.intent_percent) / 100;
  const unit = ex.intensity_unit || '%';
  const intensityValue = jsNum(ex.intensity_value);
  const intensity = unit === '%' ? (intensityValue ? intensityValue / 100 : 1) : (intensityValue || 1);
  const t = ex.movement_type;
  if (t === 'power_ballistic') return volume * intent * intensity;
  if (t === 'strength' || t === 'general' || t === 'rehab') return volume * intensity;
  return volume * intent;
}
function jsSessionLoad(session) {
  return (session.exercises || []).reduce((sum, ex) => sum + jsExerciseLoad(ex), 0);
}
function jsWeekLoad(week) {
  return (week.sessions || []).reduce((sum, session) => sum + jsSessionLoad(session), 0);
}

// Weekly progression factors for repeat-week. weekIndex is 1-based from the source week.
const PROGRESSION_OPTIONS = [
  ['flat', 'Flat'],
  ['p5', '+5%/wk'],
  ['p10', '+10%/wk'],
  ['deload', 'Build + deload'],
];
function progressionFactor(mode, weekIndex, total) {
  if (mode === 'p5') return 1 + 0.05 * weekIndex;
  if (mode === 'p10') return 1 + 0.1 * weekIndex;
  if (mode === 'deload') return weekIndex === total ? 0.6 : 1 + 0.08 * weekIndex;
  return 1;
}
// What dimension progressive overload scales each week.
const OVERLOAD_OPTIONS = [
  ['volume', 'Volume'],
  ['intensity', 'Intensity'],
  ['both', 'Both'],
];

// Apply progressive overload by scaling an exercise's volume driver, intensity driver, or both.
function applyOverload(ex, factor, dim = 'volume') {
  if (!factor || factor === 1) return { ...ex };
  const clone = { ...ex };
  // Round so a scale-up always lands at least +1 and a scale-down at least -1. Otherwise a
  // small % on a small number (e.g. +5% of 5 reps = 5.25 -> 5) rounds to no visible change.
  const step = (value, cap = Infinity) => {
    const base = jsNum(value);
    if (!base) return base;
    let next = Math.round(base * factor);
    if (factor > 1 && next <= base) next = base + 1;
    if (factor < 1 && next >= base) next = base - 1;
    return Math.max(0, Math.min(cap, next));
  };
  const t = ex.movement_type;
  const bumpVolume = () => {
    if (t === 'plyometric') clone.contacts = step(ex.contacts) || ex.contacts;
    else if (t === 'sprint') clone.reps = step(ex.reps) || ex.reps;
    else if (t === 'endurance' || t === 'skill') clone.duration_minutes = step(ex.duration_minutes) || ex.duration_minutes;
    else clone.reps = step(ex.reps) || ex.reps; // strength / general / power_ballistic / rehab
  };
  const bumpIntensity = () => {
    if (t === 'strength' || t === 'general' || t === 'power_ballistic' || t === 'rehab') {
      const cap = (ex.intensity_unit || '%') === '%' ? 100 : Infinity;
      clone.intensity_value = step(ex.intensity_value, cap) || ex.intensity_value;
    } else {
      clone.intent_percent = step(ex.intent_percent, 100) || ex.intent_percent;
    }
  };
  if (dim === 'volume' || dim === 'both') bumpVolume();
  if (dim === 'intensity' || dim === 'both') bumpIntensity();
  return clone;
}

// Shared no-dependency day picker: ‹ steps back, › steps forward, the centre label
// taps back to today. Used by quick check-in and Log Performance (retrospective/forward logging).
function DateStepper({ value, onChange }) {
  const selected = value || isoDate();
  const isToday = selected === isoDate();
  return (
    <View style={styles.dateRow}>
      <Pressable style={styles.dateNav} onPress={() => onChange(addDays(selected, -1))}>
        <Text style={styles.dateNavText}>‹</Text>
      </Pressable>
      <Pressable style={styles.dateCenter} onPress={() => onChange(isoDate())}>
        <Text style={styles.dateCenterText}>{friendlyDateLabel(selected)}</Text>
        {isToday ? null : <Text style={styles.dateReset}>Tap for today</Text>}
      </Pressable>
      <Pressable style={styles.dateNav} onPress={() => onChange(addDays(selected, 1))}>
        <Text style={styles.dateNavText}>›</Text>
      </Pressable>
    </View>
  );
}

// Tap-to-open single-date picker: shows the chosen day, expands a month calendar to pick
// any date directly (no day-by-day stepping). Reuses the month-grid helpers + styles.
function DateField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(value || isoDate());
  const selected = value || isoDate();
  const days = monthCalendarDays(visibleMonth);
  return (
    <View>
      <Pressable style={styles.dateFieldBtn} onPress={() => { setVisibleMonth(selected); setOpen((current) => !current); }}>
        <Text style={styles.dateFieldValue}>{friendlyDateLabel(selected)}</Text>
        <Text style={styles.dateFieldHint}>{open ? 'Close' : 'Change'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.dateRangePickerCard}>
          <View style={styles.miniCalendarHeader}>
            <Pressable style={styles.miniCalendarArrow} onPress={() => setVisibleMonth((current) => addMonths(current, -1))}><Text style={styles.chevron}>‹</Text></Pressable>
            <Text style={styles.miniCalendarTitle}>{monthLabel(visibleMonth)}</Text>
            <Pressable style={styles.miniCalendarArrow} onPress={() => setVisibleMonth((current) => addMonths(current, 1))}><Text style={styles.chevron}>›</Text></Pressable>
          </View>
          <View style={styles.monthWeekHeader}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
              <Text key={label} style={styles.monthWeekHeaderText}>{label}</Text>
            ))}
          </View>
          <View style={styles.rangeCalendarGrid}>
            {days.map((day) => {
              const isSelected = day.iso === selected;
              return (
                <Pressable
                  key={day.iso}
                  style={[styles.rangeDayCell, day.outsideMonth && styles.rangeDayOutside, isSelected && styles.rangeDaySelected]}
                  onPress={() => { onChange(day.iso); setOpen(false); }}
                >
                  <Text style={[styles.rangeDayText, day.outsideMonth && styles.rangeDayTextOutside, isSelected && styles.rangeDayTextSelected]}>{day.day}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.dateTodayLink} onPress={() => { onChange(isoDate()); setOpen(false); }}>
            <Text style={styles.dateTodayText}>Jump to today</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function addMonths(dateValue, amount) {
  const date = dateFromIso(dateValue);
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDay));
  return isoDate(date);
}

function addYears(dateValue, amount) {
  const date = dateFromIso(dateValue);
  date.setFullYear(date.getFullYear() + amount);
  return isoDate(date);
}

function startOfWeekIso(dateValue) {
  const date = dateFromIso(dateValue);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return isoDate(date);
}

function monthStartIso(dateValue) {
  const date = dateFromIso(dateValue);
  date.setDate(1);
  return isoDate(date);
}

function monthLabel(dateValue) {
  return dateFromIso(dateValue).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function yearLabel(dateValue) {
  return String(dateFromIso(dateValue).getFullYear());
}

function monthCalendarDays(dateValue) {
  const firstOfMonth = dateFromIso(monthStartIso(dateValue));
  const firstDay = firstOfMonth.getDay();
  const mondayOffset = firstDay === 0 ? -6 : 1 - firstDay;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() + mondayOffset);
  const currentMonth = firstOfMonth.getMonth();
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      iso: isoDate(date),
      day: date.getDate(),
      outsideMonth: date.getMonth() !== currentMonth,
    };
  });
}

function monthsInYear(dateValue) {
  const year = dateFromIso(dateValue).getFullYear();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, index, 1);
    return {
      iso: isoDate(date),
      label: date.toLocaleDateString([], { month: 'short' }),
    };
  });
}

function isValidDateText(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && isoDate(parsed) === value;
}

function isDateRangeValid(startDate, endDate) {
  if (!startDate || !endDate) return true;
  return new Date(`${endDate}T00:00:00`).getTime() >= new Date(`${startDate}T00:00:00`).getTime();
}

function formatRangeDate(value) {
  if (!isValidDateText(value) || !value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString([], { month: 'short', day: '2-digit' });
}

function dateRangeSummary(startDate, endDate, prefix = '') {
  if (!startDate && !endDate) return `${prefix}${formatRangeDate(isoDate())}`;
  const start = formatRangeDate(startDate);
  const end = formatRangeDate(endDate);
  if (start && end) return `${prefix}${start} – ${end}`;
  if (start) return `${prefix}Starts ${start}`;
  if (end) return `${prefix}Ends ${end}`;
  return `${prefix}${formatRangeDate(isoDate())}`;
}

function weekDayLabels(startDate) {
  const start = new Date(`${startDate || isoDate()}T00:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      iso: isoDate(date),
      label: date.toLocaleDateString([], { weekday: 'short' }),
      day: date.getDate(),
    };
  });
}

function visibleWeekStart(week, selectedDate) {
  const selected = selectedDate || isoDate();
  if (!week?.start_date) return selected;
  const endDate = week.end_date || addDays(week.start_date, 6);
  return dateInBounds(selected, { start: week.start_date, end: endDate }) ? week.start_date : selected;
}

function defaultNextWeekRange(block) {
  const weeks = [...(block?.weeks || [])].sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
  const lastWeek = weeks[weeks.length - 1];
  const start = lastWeek ? addDays(lastWeek.end_date || addDays(lastWeek.start_date || isoDate(), 6), 1) : block?.start_date || isoDate();
  return { start, end: addDays(start, 6) };
}

function pretty(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '-';
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function storedNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function exercisePrescription(exercise) {
  const parts = [];
  if (exercise.sets) parts.push(`${exercise.sets} sets`);
  if (exercise.reps) parts.push(`${exercise.reps} reps`);
  if (exercise.contacts) parts.push(`${exercise.contacts} contacts`);
  if (exercise.duration_minutes) parts.push(`${exercise.duration_minutes} min`);
  if (exercise.intensity_value) parts.push(`${exercise.intensity_value}${exercise.intensity_unit || ''} intensity`);
  if (exercise.intent_percent) parts.push(`${exercise.intent_percent}% intent`);
  return parts.length ? parts.join(' / ') : 'No prescription set';
}

function exercisePrescriptionSummary(session = {}) {
  const exercises = session.exercises || [];
  if (!exercises.length) return 'No exercises added yet.';
  return `${exercises.length} exercise${exercises.length === 1 ? '' : 's'} planned`;
}

function currentMacro(programme) {
  const macros = programme?.macro_blocks || [];
  return macros.find((macro) => macro.id === programme?.selected_macro_id) || macros[0] || null;
}

function currentBlock(programme) {
  const macro = currentMacro(programme);
  return macro?.blocks?.find((block) => block.id === programme?.selected_block_id) || macro?.blocks?.[0] || null;
}

function currentWeek(programme) {
  const block = currentBlock(programme);
  return block?.weeks?.find((week) => week.id === programme?.selected_week_id) || block?.weeks?.[0] || null;
}

function currentPlannedSessions(programme) {
  return currentWeek(programme)?.sessions || [];
}

// Place a session on its day, replacing any existing session(s) on that date — one session
// per day. Used by paste / template apply / repeat so applying never stacks duplicates.
function placeSessionInWeek(week, session) {
  week.sessions = (week.sessions || []).filter((existing) => existing.date !== session.date);
  week.sessions.push(session);
}

function ensureProgrammeWeek(programme, dateValue = isoDate()) {
  programme.macro_blocks = programme.macro_blocks || [];
  let macro = currentMacro(programme);
  if (!macro) {
    macro = {
      id: createId('macro'),
      macro_block_name: '',
      start_date: dateValue,
      end_date: '',
      blocks: [],
    };
    programme.macro_blocks.push(macro);
    programme.selected_macro_id = macro.id;
  }

  macro.blocks = macro.blocks || [];
  let block = currentBlock(programme);
  if (!block || !macro.blocks.some((item) => item.id === block.id)) {
    block = {
      id: createId('block'),
      block_name: '',
      start_date: dateValue,
      end_date: '',
      weeks: [],
    };
    macro.blocks.push(block);
    programme.selected_block_id = block.id;
  }

  block.weeks = block.weeks || [];
  let week = currentWeek(programme);
  if (!week || !block.weeks.some((item) => item.id === week.id)) {
    week = {
      id: createId('week'),
      week_name: '',
      start_date: dateValue,
      end_date: '',
      sessions: [],
    };
    block.weeks.push(week);
    programme.selected_week_id = week.id;
  }

  week.sessions = week.sessions || [];
  return week;
}

function plannedSessionsInCurrentBlock(programme) {
  const block = currentBlock(programme);
  return (block?.weeks || []).flatMap((week) =>
    (week.sessions || []).map((session) => ({
      ...session,
      week_id: week.id,
      week_name: week.week_name,
    }))
  );
}

function allPlannedSessions(programme) {
  return (programme?.macro_blocks || []).flatMap((macro) =>
    (macro.blocks || []).flatMap((block) =>
      (block.weeks || []).flatMap((week) =>
        (week.sessions || []).map((session) => ({
          ...session,
          macro_id: macro.id,
          macro_name: macro.macro_block_name,
          block_id: block.id,
          block_name: block.block_name,
          week_id: week.id,
          week_name: week.week_name,
        }))
      )
    )
  );
}

function plannedSessionsOnDate(programme, date) {
  return plannedSessionsInCurrentBlock(programme).filter((session) => session.date === date);
}

function programmeBlocks(programme, macroId = 'all') {
  return (programme.macro_blocks || [])
    .filter((macro) => macroId === 'all' || macro.id === macroId)
    .flatMap((macro) => (macro.blocks || []).map((block) => ({ ...block, macro_id: macro.id, macro_name: macro.macro_block_name })));
}

function periodBounds(item = {}) {
  const weekDates = (item.weeks || []).flatMap((week) => [week.start_date, week.end_date]).filter(Boolean);
  const start = item.start_date || weekDates.sort()[0] || null;
  const end = item.end_date || weekDates.sort().slice(-1)[0] || null;
  return { start, end };
}

function dateInBounds(dateValue, bounds) {
  if (!dateValue || (!bounds.start && !bounds.end)) return true;
  const time = new Date(dateValue).getTime();
  if (bounds.start && time < new Date(`${bounds.start}T00:00:00`).getTime()) return false;
  if (bounds.end && time > new Date(`${bounds.end}T23:59:59`).getTime()) return false;
  return true;
}

function filterMetricPoints(points, { range, macroId, blockId }, programme) {
  const clean = [...points].filter((point) => point.date).sort((a, b) => new Date(a.date) - new Date(b.date));
  const latestDate = clean.length ? new Date(clean[clean.length - 1].date) : new Date();
  const rangeDays = { week: 7, month: 31, year: 365, all: null }[range];
  const rangeStart = rangeDays ? new Date(latestDate.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000) : null;
  const macro = (programme.macro_blocks || []).find((item) => item.id === macroId);
  const block = programmeBlocks(programme, macroId).find((item) => item.id === blockId);
  const macroBounds = macroId === 'all' ? {} : periodBounds(macro);
  const blockBounds = blockId === 'all' ? {} : periodBounds(block);

  return clean.filter((point) => {
    const date = new Date(point.date);
    if (rangeStart && date < rangeStart) return false;
    if (!dateInBounds(point.date, macroBounds)) return false;
    if (!dateInBounds(point.date, blockBounds)) return false;
    return true;
  });
}

function numberExercises(exercises = []) {
  return exercises.map((exercise, index) => ({ ...exercise, order: index + 1 }));
}

function exerciseSetCount(exercise) {
  const count = Math.round(toNumber(exercise.sets, 0));
  return Math.max(1, count || 1);
}

function todayPlannedSession(programme) {
  const today = isoDate();
  const blockSessions = plannedSessionsInCurrentBlock(programme);
  return blockSessions.find((session) => session.date === today) || {
    id: 'empty_plan',
    session_name: 'No session planned',
    focus: 'No planned session today. Create one in Programme.',
    duration: '',
    exercises: [],
  };
}

function mapPlannedToActiveSession(planned) {
  return {
    id: createPersistentSessionId(),
    planned_session_id: planned.id,
    session_name: planned.session_name,
    session_datetime: new Date().toISOString(),
    notes: planned.performance_notes || planned.notes || '',
    performance_score: planned.performance_score ?? 0,
    metric_type: planned.metric_type || 'jump_output',
    metrics: planned.metrics || {},
    exercises: numberExercises(
      (planned.exercises || []).map((exercise) => ({
        ...exercise,
        id: createId('exercise'),
        planned_exercise_id: exercise.id,
      }))
    ),
  };
}

function findPlannedSession(programme, sessionId) {
  for (const macro of programme.macro_blocks || []) {
    for (const block of macro.blocks || []) {
      for (const week of block.weeks || []) {
        const session = (week.sessions || []).find((item) => item.id === sessionId);
        if (session) return { macro, block, week, session };
      }
    }
  }
  return null;
}

function findPlannedSessionOnDate(programme, dateValue) {
  const block = currentBlock(programme);
  for (const week of block?.weeks || []) {
    const session = (week.sessions || []).find((item) => item.date === dateValue);
    if (session) return { block, week, session };
  }

  for (const macro of programme.macro_blocks || []) {
    for (const block of macro.blocks || []) {
      for (const week of block.weeks || []) {
        const session = (week.sessions || []).find((item) => item.date === dateValue);
        if (session) return { macro, block, week, session };
      }
    }
  }
  return null;
}

function matchLoggedExercise(plannedExercise, loggedExercises = [], index = 0, usedIds = new Set()) {
  const candidates = [
    (exercise) => exercise.planned_exercise_id && exercise.planned_exercise_id === plannedExercise.id,
    (exercise) => exercise.id && exercise.id === plannedExercise.id,
    (exercise) => Number(exercise.order) === Number(plannedExercise.order || index + 1),
    (exercise) => String(exercise.exercise_name || '').trim()
      && String(exercise.exercise_name || '').trim() === String(plannedExercise.exercise_name || '').trim(),
  ];

  for (const predicate of candidates) {
    const match = loggedExercises.find((exercise) => !usedIds.has(exercise) && predicate(exercise));
    if (match) {
      usedIds.add(match);
      return match;
    }
  }
  return null;
}

function mergePerformanceSessionIntoProgramme(programme, performanceSession) {
  const plannedSessionId = performanceSession?.planned_session_id;
  if (!plannedSessionId) return programme;

  const target = findPlannedSession(programme, plannedSessionId)?.session;
  if (!target) return programme;

  const loggedExercises = performanceSession.exercises || [];
  const usedLoggedIds = new Set();
  target.performance_score = performanceSession.performance_score ?? target.performance_score ?? 0;
  target.performance_notes = performanceSession.notes || target.performance_notes || '';
  target.performance_logged_at = new Date().toISOString();
  target.exercises = (target.exercises || []).map((plannedExercise, index) => {
    const loggedExercise = matchLoggedExercise(plannedExercise, loggedExercises, index, usedLoggedIds);
    if (!loggedExercise) return plannedExercise;
    return {
      ...plannedExercise,
      actual_metrics: loggedExercise.actual_metrics || plannedExercise.actual_metrics || [],
    };
  });
  const appendedExercises = loggedExercises
    .filter((exercise) => !usedLoggedIds.has(exercise))
    .map((exercise, index) => ({
      ...exercise,
      id: exercise.planned_exercise_id || createId('planned_exercise'),
      planned_exercise_id: undefined,
      actual_metrics: exercise.actual_metrics || [],
      order: (target.exercises || []).length + index + 1,
    }));
  if (appendedExercises.length) {
    target.exercises = [...(target.exercises || []), ...appendedExercises];
  }

  return programme;
}

function attachPerformanceSessionToCalendar(programme, performanceSession) {
  const sessionDate = isoDate(performanceSession.session_datetime || new Date());
  let target = performanceSession.planned_session_id
    ? findPlannedSession(programme, performanceSession.planned_session_id)?.session
    : findPlannedSessionOnDate(programme, sessionDate)?.session;

  if (!target) {
    const week = ensureProgrammeWeek(programme, sessionDate);
    target = {
      id: createId('planned_session'),
      date: sessionDate,
      session_name: performanceSession.session_name || 'Performance Log',
      focus: 'Logged performance',
      duration: '',
      notes: '',
      performance_score: performanceSession.performance_score ?? 0,
      performance_notes: performanceSession.notes || '',
      performance_logged_at: new Date().toISOString(),
      exercises: [],
      position: (week.sessions || []).length,
    };
    week.sessions = [...(week.sessions || []), target];
  }

  const targetExercises = target.exercises || [];
  const baseExerciseCount = targetExercises.length;
  const linkedExercises = (performanceSession.exercises || []).map((exercise, index) => {
    const existing = exercise.planned_exercise_id
      ? targetExercises.find((plannedExercise) => plannedExercise.id === exercise.planned_exercise_id)
      : null;
    const matched = existing
      || targetExercises.find((plannedExercise) => Number(plannedExercise.order) === Number(exercise.order || index + 1))
      || targetExercises.find((plannedExercise) => String(plannedExercise.exercise_name || '').trim()
        && String(plannedExercise.exercise_name || '').trim() === String(exercise.exercise_name || '').trim());
    if (matched) return { ...exercise, planned_exercise_id: matched.id };

    const plannedExercise = {
      ...exercise,
      id: createId('planned_exercise'),
      planned_exercise_id: undefined,
      actual_metrics: exercise.actual_metrics || [],
      order: baseExerciseCount + index + 1,
    };
    targetExercises.push(plannedExercise);
    return { ...exercise, planned_exercise_id: plannedExercise.id };
  });
  target.exercises = targetExercises;

  return {
    programme: mergePerformanceSessionIntoProgramme(programme, {
      ...performanceSession,
      planned_session_id: target.id,
      exercises: linkedExercises,
    }),
    session: {
      ...performanceSession,
      planned_session_id: target.id,
      exercises: linkedExercises,
    },
  };
}

function defaultMetricTypeForExercise(exercise = {}) {
  if (exercise.movement_type === 'strength' || exercise.movement_type === 'power_ballistic') return 'lift';
  if (exercise.movement_type === 'endurance' || exercise.movement_type === 'skill') return 'sprinting';
  return 'jumping';
}

function timeMetricToMilliseconds(value, unit) {
  const numeric = storedNumber(value);
  if (!Number.isFinite(numeric)) return value || '';
  return ['seconds', 'second', 'sec', 's'].includes(String(unit || '').toLowerCase()) ? String(numeric * 1000) : String(numeric);
}

function emptyActualMetrics(metricType = 'jumping', metrics = {}) {
  return {
    ft: timeMetricToMilliseconds(metrics.ft, metrics.ft_unit),
    ft_unit: 'milliseconds',
    gct: timeMetricToMilliseconds(metrics.gct, metrics.gct_unit),
    gct_unit: 'milliseconds',
    height_or_distance: metrics.height_or_distance || '',
    height_or_distance_unit: metrics.height_or_distance_unit || metrics.unit || 'cm',
    sprint_time: metrics.sprint_time || metrics.time || '',
    sprint_time_unit: metrics.sprint_time_unit || 'seconds',
    distance: metrics.distance || '',
    distance_unit: metrics.distance_unit || metrics.unit || 'metres',
    weight: metrics.weight || '',
    weight_unit: metrics.weight_unit || 'kg',
    bar_velocity: metrics.bar_velocity || '',
    bar_velocity_unit: metrics.bar_velocity_unit || 'm/s',
  };
}

function plannedRepCount(exercise = {}) {
  const reps = Math.round(toNumber(exercise.reps, 0));
  if (reps) return Math.max(1, reps);
  return 1;
}

function plannedAttemptsForSet(exercise = {}, setNumber = 1) {
  const contacts = Math.round(toNumber(exercise.contacts, 0));
  if (contacts > 0) return Math.max(1, contacts);
  return plannedRepCount(exercise);
}

function actualMetricRowKey(attempt = {}) {
  return `${Number(attempt.set_number) || 1}:${Number(attempt.rep_number) || 1}`;
}

function plannedAttemptRows(exercise = {}) {
  const sets = exerciseSetCount(exercise);
  const existing = exercise.actual_metrics || [];
  const defaultType = defaultMetricTypeForExercise(exercise);
  const rows = [];

  for (let setNumber = 1; setNumber <= sets; setNumber += 1) {
    const attemptCount = plannedAttemptsForSet(exercise, setNumber);
    for (let repNumber = 1; repNumber <= attemptCount; repNumber += 1) {
      const saved = existing.find((attempt) => Number(attempt.set_number) === setNumber && Number(attempt.rep_number) === repNumber);
      rows.push({
        id: saved?.id || `${exercise.id || 'exercise'}-set-${setNumber}-attempt-${repNumber}`,
        set_number: setNumber,
        rep_number: repNumber,
        metric_type: saved?.metric_type || defaultType,
        metrics: emptyActualMetrics(saved?.metric_type || defaultType, saved?.metrics || {}),
      });
    }
  }

  return rows;
}

function attemptHasLoggedMetrics(attempt = {}) {
  return Object.entries(attempt.metrics || {}).some(([key, value]) =>
    !String(key).endsWith('_unit') && value !== null && value !== undefined && value !== ''
  );
}

function normaliseTimeClient(value, unit) {
  const numeric = storedNumber(value);
  if (!Number.isFinite(numeric)) return null;
  return ['milliseconds', 'millisecond', 'ms'].includes(String(unit || '').toLowerCase()) ? numeric / 1000 : numeric;
}

function normaliseDistanceClient(value, unit) {
  const numeric = storedNumber(value);
  if (!Number.isFinite(numeric)) return null;
  const baseUnit = String(unit || 'cm').toLowerCase();
  if (['inches', 'inch', 'in'].includes(baseUnit)) return numeric * 2.54;
  if (['metres', 'metre', 'meters', 'meter', 'm'].includes(baseUnit)) return numeric * 100;
  return numeric;
}

function actualMetricValue(attempt = {}, metric) {
  const metrics = attempt.metrics || {};
  if (metric === 'rsi') {
    const ft = normaliseTimeClient(metrics.ft, metrics.ft_unit);
    const gct = normaliseTimeClient(metrics.gct, metrics.gct_unit);
    return Number.isFinite(ft) && Number.isFinite(gct) && ft > 0 && gct > 0 ? ft / gct : null;
  }
  if (metric === 'ft' || metric === 'gct' || metric === 'sprint_time') {
    const value = normaliseTimeClient(metrics[metric], metrics[`${metric}_unit`]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (metric === 'height_or_distance') {
    const value = normaliseDistanceClient(metrics.height_or_distance, metrics.height_or_distance_unit);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const value = storedNumber(metrics[metric]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function bestModeForMetric(metric) {
  return ['gct', 'sprint_time'].includes(metric) ? 'min' : 'max';
}

function summariseMetricAttempts(attempts = [], metric) {
  const rows = attempts
    .map((attempt) => ({ attempt, value: actualMetricValue(attempt, metric) }))
    .filter((row) => Number.isFinite(row.value));
  if (!rows.length) return null;
  const values = rows.map((row) => row.value);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const best = bestModeForMetric(metric) === 'min' ? Math.min(...values) : Math.max(...values);
  const sd = values.length >= 2
    ? Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1))
    : null;
  return {
    average,
    peak: best,
    best,
    sd,
    consistency: sd === null ? null : Math.max(0, 100 - (sd / Math.max(Math.abs(average), 1)) * 100),
    n: values.length,
    best_attempt: rows.find((row) => row.value === best)?.attempt || null,
  };
}

function buildSessionAnalysis(session = {}, analysis = {}) {
  const metricKeys = ['rsi', 'ft', 'gct', 'height_or_distance', 'sprint_time', 'distance', 'weight', 'bar_velocity'];
  const exercises = session.exercises || [];
  const allAttempts = exercises.flatMap((exercise) =>
    (exercise.actual_metrics || []).map((attempt) => ({
      ...attempt,
      exercise_id: exercise.id,
      exercise_name: exercise.exercise_name,
    }))
  );
  const sessionMetrics = Object.fromEntries(metricKeys.map((metric) => [metric, summariseMetricAttempts(allAttempts, metric)]).filter(([, value]) => value));
  const exerciseSummaries = exercises.map((exercise) => {
    const attempts = exercise.actual_metrics || [];
    const metrics = Object.fromEntries(metricKeys.map((metric) => [metric, summariseMetricAttempts(attempts, metric)]).filter(([, value]) => value));
    const bestMetric = Object.entries(metrics)[0] || null;
    return {
      exercise,
      metrics,
      best_attempt: bestMetric?.[1]?.best_attempt || null,
    };
  });
  const comparisonKeys = ['load', 'fatigue', 'readiness', 'pain', 'pain_delta'];
  const sessionDate = session.date || isoDate();
  const closestRow = (analysis.rows || []).find((row) => String(row.date || '').slice(0, 10) === sessionDate) || analysis.latest || {};
  return {
    sessionMetrics,
    exerciseSummaries,
    attempts: allAttempts,
    comparisons: Object.fromEntries(comparisonKeys.map((key) => [key, closestRow?.[key]]).filter(([, value]) => Number.isFinite(value))),
  };
}

function orderedRows(analysis) {
  return [...(analysis.rows || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function metricSeries(analysis, key) {
  return analysis?.metricSeries?.[key] || [];
}

function metricPointSource(point) {
  return point?.row?.session?.session_name || point?.row?.checkIn?.performance_type || point?.source || 'stored log';
}

function fallbackMetricPoints(data, key) {
  const loggedSessions = allPlannedSessions(data?.programme);
  const sessionPerformancePoints = key === 'performance'
    ? loggedSessions.map((session) => ({
      id: `${session.id}-performance-score`,
      date: session.date || session.session_datetime,
      value: storedNumber(session.performance_score),
      source: session.session_name || 'performance log',
    }))
    : [];
  const actualMetricPoints = loggedSessions.flatMap((session) =>
    (session.exercises || []).flatMap((exercise) =>
      (exercise.actual_metrics || []).map((attempt) => ({
        id: `${session.id}-${exercise.id}-${attempt.id}-${key}`,
        date: session.date || session.session_datetime,
        value: key === 'performance' ? storedNumber(session.performance_score) : actualMetricValue(attempt, key),
        source: [session.session_name, exercise.exercise_name].filter(Boolean).join(' / ') || 'performance log',
      }))
    )
  );
  const actualPoints = [...sessionPerformancePoints, ...actualMetricPoints].filter((point) => Number.isFinite(point.value));

  if (actualPoints.length) return actualPoints;

  const checkInPoints = (data?.checkIns || []).map((checkIn) => {
    let value = null;
    if (key === 'performance') value = storedNumber(checkIn.performance_score);
    else if (key === 'rsi') {
      const ft = storedNumber(checkIn.ft);
      const gct = storedNumber(checkIn.gct);
      value = ft !== null && gct > 0 ? ft / gct : null;
    } else value = storedNumber(checkIn[key]);
    return {
      id: checkIn.id,
      date: checkIn.check_in_datetime,
      value,
      source: checkIn.performance_type || 'check-in',
    };
  });

  const legacySetMetricPoints = (data?.sessions || []).flatMap((session) =>
    (session.exercises || []).flatMap((exercise) =>
      (exercise.set_metrics || []).map((setMetric, index) => {
        const metrics = setMetric.metrics || {};
        let value = null;
        if (key === 'performance') value = storedNumber(setMetric.performance_score);
        else if (key === 'sprint_time') value = storedNumber(metrics.sprint_time ?? metrics.time);
        else if (key === 'rsi') {
          const direct = storedNumber(metrics.rsi);
          const ft = storedNumber(metrics.ft);
          const gct = storedNumber(metrics.gct);
          value = direct ?? (ft !== null && gct > 0 ? ft / gct : null);
        }
        else value = storedNumber(metrics[key]);
        return {
          id: `${session.id}-${exercise.id}-${index}-${key}`,
          date: session.session_datetime,
          value,
          source: [session.session_name, exercise.exercise_name].filter(Boolean).join(' / ') || 'session metric',
        };
      })
    )
  );

  return [...checkInPoints, ...legacySetMetricPoints].filter((point) => Number.isFinite(point.value));
}

function bestMetricPoint(points, mode) {
  const clean = [...points].filter((point) => Number.isFinite(point.value));
  if (!clean.length) return null;
  return clean.sort((a, b) => (mode === 'min' ? a.value - b.value : b.value - a.value))[0];
}

function derivePersonalBests(analysis, data) {
  return Object.fromEntries(derivedPbFields.map((field) => {
    const analysisPoints = metricSeries(analysis, field.key);
    const sourcePoints = analysisPoints.length ? analysisPoints : fallbackMetricPoints(data, field.key);
    const best = bestMetricPoint(sourcePoints, field.mode);
    return [
      field.key,
      best
        ? { value: best.value, date: best.date, source: metricPointSource(best) }
        : { value: null, date: null, source: null },
    ];
  }));
}

function dashboardMetricConfig(key) {
  return dashboardMetrics.find((item) => item.key === key) || { key, label: formatMetricName(key), category: 'Performance', color: '#24883B' };
}

function metricUnitLabel(key) {
  if (['ft', 'gct'].includes(key)) return 'ms';
  if (key === 'sprint_time') return 's';
  if (['height_or_distance', 'distance'].includes(key)) return key === 'height_or_distance' ? 'cm' : 'm';
  if (key === 'weight') return 'kg';
  if (key === 'bar_velocity') return 'm/s';
  return '';
}

function displayMetricValue(key, value, digits = 1) {
  if (!Number.isFinite(value)) return '-';
  const displayValue = ['ft', 'gct'].includes(key) ? value * 1000 : value;
  const precision = ['ft', 'gct'].includes(key) ? 0 : digits;
  const unit = metricUnitLabel(key);
  return `${pretty(displayValue, precision)}${unit ? ` ${unit}` : ''}`;
}

function metricTrendFromPerformanceAnalysis(analysis, key) {
  return analysis?.performanceMetricAnalysis?.metricTrends?.[key] || analysis?.trendInsights?.[key];
}

function multiMetricSeriesForKeys(analysis, keys) {
  return keys.map((key) => {
    const metric = dashboardMetricConfig(key);
    return {
      key,
      label: metric.label,
      color: metric.color,
      points: metricSeries(analysis, key),
      stats: metricStats(analysis, key),
    };
  });
}

function hasJumpProfileMetrics(analysis) {
  return metricSeries(analysis, 'height_or_distance').length >= 2
    && ['ft', 'gct', 'rsi'].some((key) => metricSeries(analysis, key).length >= 2);
}

function hasLiftProfileMetrics(analysis) {
  return metricSeries(analysis, 'weight').length >= 2 && metricSeries(analysis, 'bar_velocity').length >= 2;
}

function metricStats(analysis, key) {
  return analysis?.metricStats?.[key] || {
    avg: null,
    sd: null,
    trend: null,
    volatility: null,
    count: 0,
    min: null,
    max: null,
    highest: [],
    lowest: [],
    changes: [],
  };
}

// Slope of value vs time, scaled to "per typical interval": x is days-since-first
// divided by the median gap between observations, so missed days no longer distort
// the trend. Mirrors app_slope_over_time in backend/logic.py. Falls back to index
// spacing when dates are missing/unparseable.
function slopeOverTime(points = []) {
  const clean = points.filter((point) => Number.isFinite(point.value));
  if (clean.length < 2) return null;
  const times = clean.map((point) => {
    const parsed = point.date ? Date.parse(point.date) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  });
  let xs;
  if (times.some((time) => time === null)) {
    xs = clean.map((_point, index) => index);
  } else {
    const base = times[0];
    const days = times.map((time) => (time - base) / 86400000);
    const gaps = [];
    for (let i = 1; i < days.length; i += 1) {
      const gap = days[i] - days[i - 1];
      if (gap > 0) gaps.push(gap);
    }
    const sorted = [...gaps].sort((a, b) => a - b);
    let medianGap = 1;
    if (sorted.length) {
      const mid = Math.floor(sorted.length / 2);
      medianGap = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    if (!(medianGap > 0)) medianGap = 1;
    xs = days.map((day) => day / medianGap);
  }
  const vals = clean.map((point) => point.value);
  const xMean = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const yMean = vals.reduce((sum, value) => sum + value, 0) / vals.length;
  const numerator = xs.reduce((sum, x, index) => sum + (x - xMean) * (vals[index] - yMean), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0);
  return denominator ? numerator / denominator : null;
}

function metricStatsFromPoints(points = []) {
  const values = points.map((point) => point.value).filter((value) => Number.isFinite(value));
  const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const sd = avg === null ? null : Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
  const trend = slopeOverTime(points);
  const changes = points.slice(1).map((point, index) => ({
    ...point,
    previous: points[index],
    change: point.value - points[index].value,
  })).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 3);

  return {
    avg,
    sd,
    trend,
    volatility: sd,
    count: values.length,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    highest: [...points].sort((a, b) => b.value - a.value).slice(0, 3),
    lowest: [...points].sort((a, b) => a.value - b.value).slice(0, 3),
    changes,
  };
}

function trendStateFromSlope(trend, count) {
  if (count < 2 || trend === null || trend === undefined) return 'Collecting';
  if (trend > 0.05) return 'Increasing';
  if (trend < -0.05) return 'Decreasing';
  return 'Stable';
}

function filteredTrendInsight(baseInsight, metric, stats, filterLabel) {
  return {
    ...(baseInsight || {}),
    status: stats.count >= 12 ? 'More stable' : stats.count >= 6 ? 'Exploratory' : 'Collecting',
    stats,
    evidenceStatement: `${metric.label} ${trendStateFromSlope(stats.trend, stats.count).toLowerCase()} across ${stats.count} filtered observations (${filterLabel}).`,
    interpretation: `Filtered view uses stored ${metric.label.toLowerCase()} values for ${filterLabel}.`,
    limitation: 'Filtered metric view reflects stored logs within the selected date and programme scope only.',
  };
}

function metricChartKind(metric) {
  if (['load', 'volume', 'contacts', 'reps', 'duration', 'average_intent', 'pain_delta'].includes(metric.key)) return 'bar';
  return 'line';
}

function chronologicalMetricPoints(points, limit = 12) {
  return [...points]
    .filter((point) => Number.isFinite(point.value))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-limit);
}

function scaleSvgPoint(value, index, total, min, range, width, height, padding) {
  const xSpan = width - padding.left - padding.right;
  const ySpan = height - padding.top - padding.bottom;
  return {
    x: total <= 1 ? padding.left + xSpan / 2 : padding.left + (index / (total - 1)) * xSpan,
    y: padding.top + (1 - ((value - min) / range)) * ySpan,
  };
}

function smoothSvgPath(coords) {
  if (coords.length < 2) return '';
  return coords.slice(1).reduce((path, point, index) => {
    const previous = coords[index];
    const midX = (previous.x + point.x) / 2;
    return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${coords[0].x} ${coords[0].y}`);
}

function quantile(values, q) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const position = (clean.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  if (clean[base + 1] !== undefined) return clean[base] + rest * (clean[base + 1] - clean[base]);
  return clean[base];
}

function boxStats(points) {
  const values = points.map((point) => point.value).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return {
    min: Math.min(...values),
    q1: quantile(values, 0.25),
    median: quantile(values, 0.5),
    q3: quantile(values, 0.75),
    max: Math.max(...values),
  };
}

function formatMetricName(name = '') {
  const known = dashboardMetrics.find((metric) => metric.key === name || metric.label === name);
  if (known) return known.label;
  return String(name)
    .replace(/_/g, ' ')
    .replace(/power ballistic/g, 'power / ballistic')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRelationshipName(name = '') {
  return String(name)
    .replace(/\s+vs\s+/i, ' vs ')
    .replace(/_to_/g, ' -> ')
    .replace(/_vs_/g, ' vs ')
    .split(/( -> | vs )/)
    .map((part) => (part === ' -> ' || part === ' vs ' ? part.replace('->', '→') : formatMetricName(part)))
    .join('');
}

function metricTone(metric) {
  if (['pain', 'pain_delta', 'fatigue', 'soreness'].includes(metric.key)) return 'risk';
  if (['load', 'volume', 'contacts', 'reps', 'duration', 'average_intent'].includes(metric.key)) return 'neutral';
  return 'positive';
}

function changeStyleForMetric(change, metric) {
  const tone = metricTone(metric);
  if (tone === 'neutral') return styles.neutral;
  if (tone === 'risk') return change >= 0 ? styles.negative : styles.positive;
  return change >= 0 ? styles.positive : styles.negative;
}

function strongestRelationship(analysis, predicate = () => true) {
  return [...(analysis.relationships || [])]
    .filter((relationship) => relationship.r !== null && predicate(relationship))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0] || null;
}

function confidenceLabel(value) {
  const text = String(value || 'Collecting').toLowerCase();
  if (text.includes('high')) return 'High Confidence';
  if (text.includes('moderate') || text.includes('medium')) return 'Moderate Confidence';
  if (text.includes('low')) return 'Low Confidence';
  if (text.includes('collect')) return 'Collecting Evidence';
  return value;
}

function toneFromText(value = '') {
  const text = String(value || '').toLowerCase();
  if (['collect', 'unclear', 'learning', 'not enough', 'no clear'].some((word) => text.includes(word))) return 'collecting';
  if (['good', 'positive', 'improving', 'recovering', 'supported', 'adapting'].some((word) => text.includes(word))) return 'good';
  if (['bad', 'risk', 'worsening', 'declining', 'accumulating', 'limited'].some((word) => text.includes(word))) return 'bad';
  if (['watch', 'spike', 'building', 'pressure', 'low load', 'response'].some((word) => text.includes(word))) return 'warning';
  if (['stable', 'steady', 'holding', 'plateau', 'neutral'].some((word) => text.includes(word))) return 'neutral';
  return 'collecting';
}

function themeToneStyles(tone = 'neutral') {
  const cleanTone = ['good', 'bad', 'warning', 'neutral', 'collecting'].includes(tone) ? tone : toneFromText(tone);
  return {
    good: styles.toneGood,
    bad: styles.toneBad,
    warning: styles.toneWarning,
    neutral: styles.toneNeutral,
    collecting: styles.toneCollecting,
  }[cleanTone] || styles.toneCollecting;
}

function toneAccentColor(tone = 'collecting') {
  const cleanTone = ['good', 'bad', 'warning', 'neutral', 'collecting'].includes(tone) ? tone : toneFromText(tone);
  return {
    good: '#2FA044',
    bad: '#E13F32',
    warning: '#D9822B',
    neutral: '#E7B33C',
    collecting: '#9B9B94',
  }[cleanTone] || '#9B9B94';
}

function toneLabel(tone = 'collecting') {
  const cleanTone = ['good', 'bad', 'warning', 'neutral', 'collecting'].includes(tone) ? tone : toneFromText(tone);
  return {
    good: 'Good',
    bad: 'Risk',
    warning: 'Watch',
    neutral: 'Holding',
    collecting: 'Learning',
  }[cleanTone] || 'Learning';
}

function insightToneCardStyle(tone = 'collecting') {
  const color = toneAccentColor(tone);
  return { borderColor: color, borderLeftColor: color, borderLeftWidth: 6 };
}

function stateTone(value = '', category = '') {
  const text = String(value || '').toLowerCase();
  if (['collect', 'unclear', 'learning', 'not enough', 'no clear'].some((word) => text.includes(word))) return 'collecting';
  if (category === 'loadStress' && text.includes('low load')) return 'warning';
  if (category === 'loadStress' && text.includes('spike')) return 'warning';
  if (category === 'loadStress' && (text.includes('building') || text.includes('steady'))) return 'good';
  if (category === 'irritation' && text.includes('improving')) return 'good';
  if (category === 'fatigue' && text.includes('recovering')) return 'good';
  if (text.includes('strong positive') || text.includes('positive') || text.includes('improving') || text.includes('supported')) return 'good';
  if (text.includes('at risk') || text.includes('worsening') || text.includes('declining') || text.includes('accumulating') || text.includes('strongly declining')) return 'bad';
  if (text.includes('plateau') || text.includes('stable') || text.includes('steady') || text.includes('holding')) return 'neutral';
  return 'collecting';
}

function trendDirectionLabel(metricKey, analysis) {
  const insight = analysis?.trendInsights?.[metricKey];
  const trend = metricStats(analysis, metricKey).trend;
  if (!Number.isFinite(trend)) return 'Collecting';
  if (Math.abs(trend) < 0.03) return 'Stable';
  const improving = ['pain', 'pain_delta', 'fatigue', 'soreness', 'gct', 'sprint_time'].includes(metricKey)
    ? trend < 0
    : trend > 0;
  if (Math.abs(trend) > 0.18) return improving ? 'Strongly Improving' : 'Strongly Declining';
  return improving ? 'Improving' : 'Declining';
}

function currentReadItems(analysis = {}) {
  const adaptation = analysis.adaptationInsight?.label || analysis.currentRead?.adaptation || 'Adaptation Unclear';
  return [
    ['Performance', analysis.currentRead?.performance || trendDirectionLabel('performance', analysis)],
    ['Load stress', analysis.currentRead?.loadStress || trendDirectionLabel('load', analysis)],
    ['Load tolerance', analysis.currentRead?.loadTolerance || 'Collecting'],
    ['Pain', analysis.currentRead?.irritation || trendDirectionLabel('pain', analysis)],
    ['Fatigue', analysis.currentRead?.fatigue || trendDirectionLabel('fatigue', analysis)],
    ['Adaptation', adaptation],
  ];
}

function athleteAdaptationCopy(adaptation = {}) {
  const label = adaptation.label || 'Adaptation Unclear';
  const states = adaptation.componentStates || {};
  if (states.loadStress === 'Low Load' && !label.includes('Positive')) {
    return {
      headline: 'Fresh is not the same as adapting',
      body: 'Recovery may look fine, but the recent training dose is low or flat. That can maintain readiness without building performance.',
      action: 'If the goal is progress, look for a sensible load build while keeping pain and fatigue controlled.',
    };
  }
  if (states.loadStress === 'Load Spike') {
    return {
      headline: 'Load is the main thing to watch',
      body: 'Recent training load is much higher than your recent baseline. Adaptation depends on whether you tolerate that dose without pain, fatigue, or output drop-off.',
      action: 'Do not judge the next session by freshness alone. Watch performance, pain, and fatigue together.',
    };
  }
  if (states.loadTolerance === 'Declining') {
    return {
      headline: 'Tolerance is slipping',
      body: 'The training dose is costing more than it was: pain, fatigue, or output are moving the wrong way for the load being done.',
      action: 'Keep the next step conservative until output and body response line up again.',
    };
  }
  if (label.includes('Strong Positive')) {
    return {
      headline: 'Training is landing well',
      body: 'Performance is moving up, the training dose looks useful, and recovery signals look manageable. This is the kind of response you want to protect.',
      action: 'Keep the rhythm. Do not chase extra volume just because today looks good.',
    };
  }
  if (label.includes('Positive')) {
    return {
      headline: 'You are adapting',
      body: 'The current dose looks productive: performance and load tolerance are moving in the right direction without a clear recovery cost.',
      action: 'Repeat what is working and keep logging pain and performance.',
    };
  }
  if (label.includes('At Risk')) {
    return {
      headline: 'Adaptation needs attention',
      body: 'Load stress, fatigue, pain, or tolerance are moving faster than performance. The next session should be judged by how you respond, not just by output.',
      action: 'Keep the quality high, but be ready to reduce load if pain or soreness climbs.',
    };
  }
  if (label.includes('Plateau')) {
    return {
      headline: 'Progress may be flattening',
      body: 'Training is continuing, but performance is not clearly moving with it.',
      action: 'Look for one simple change: more recovery, cleaner intent, or a small programme adjustment.',
    };
  }
  if (label.includes('Stable')) {
    return {
      headline: 'You are holding steady',
      body: 'Your current training looks more like maintenance than a clear push forward. Feeling recovered can be useful, but it does not prove adaptation is building.',
      action: 'Useful if the goal is to consolidate. If you want progress, check the programme focus.',
    };
  }
  return {
    headline: 'Still learning your pattern',
    body: 'There is not enough clean training, recovery, and performance data yet to call adaptation confidently.',
    action: 'Log check-ins and performance after sessions so the app can separate signal from noise.',
  };
}

function stateNeedsAttention(state) {
  return ['Worsening', 'Accumulating', 'Declining', 'Strongly Declining', 'Adaptation At Risk', 'Load Spike', 'Low Load'].includes(state);
}

function athleteSectionCopy(section, analysis = {}) {
  const adaptation = analysis.adaptationInsight || {};
  const states = adaptation.componentStates || {};
  const copy = {
    performance: {
      title: states.performance || 'Performance',
      body: adaptation.performanceMeaning?.replace(/^For performance, this means:\s*/i, '') || 'See whether outputs are moving in the right direction.',
      metric: 'performance',
    },
    irritation: {
      title: states.irritation === 'Worsening' ? 'Pain is rising' : states.irritation === 'Improving' ? 'Pain is settling' : 'Pain check',
      body: adaptation.componentInterpretations?.irritation || 'Track whether pain is staying manageable around training.',
      metric: 'pain',
    },
    recovery: {
      title: states.fatigue === 'Accumulating' ? 'Recovery is under pressure' : states.fatigue === 'Recovering' ? 'Recovery is improving' : 'Recovery check',
      body: adaptation.componentInterpretations?.fatigue || 'Freshness and soreness show how ready your body is for the next hit.',
      metric: 'fatigue',
    },
    load: {
      title: states.loadStress || 'Training load',
      body: adaptation.loadMeaning?.replace(/^For training load, this means:\s*/i, '') || 'Load is the training dose. It only becomes useful adaptation when performance, pain, and recovery show you are tolerating it.',
      metric: 'load',
    },
    adaptation: {
      title: adaptation.label || 'Adaptation',
      body: athleteAdaptationCopy(adaptation).body,
      metric: 'performance',
    },
    likely_response: {
      title: 'Usual response',
      body: analysis.likelyResponseInsight?.evidenceStatement || 'The app is learning what usually happens after different sessions.',
      metric: 'performance',
    },
  };
  return copy[section.id] || { title: section.title, body: analysis.insightSummaries?.[section.id]?.summary || '', metric: 'performance' };
}

function relevantInsightSections(analysis = {}) {
  const sectionsById = Object.fromEntries(insightSections.map((section) => [section.id, section]));
  const states = analysis.adaptationInsight?.componentStates || {};
  const latest = analysis.latest || {};
  const ids = ['adaptation'];
  if (states.loadStress && states.loadStress !== 'Collecting') ids.push('load');
  if (states.loadTolerance && stateNeedsAttention(states.loadTolerance)) ids.push('load');
  if (stateNeedsAttention(states.fatigue) || (Number.isFinite(latest.readiness) && latest.readiness < 4)) ids.push('recovery');
  if (stateNeedsAttention(states.irritation) || (Number.isFinite(latest.pain) && latest.pain >= 4)) ids.push('irritation');
  if (states.performance && states.performance !== 'Collecting') ids.push('performance');
  if (!ids.includes('performance')) ids.push('performance');
  if (!ids.includes('load')) ids.splice(1, 0, 'load');
  return [...new Set(ids)].map((id) => sectionsById[id]).filter(Boolean).slice(0, 3);
}

function priorityInsight(analysis = {}) {
  return strongestRelationship(analysis)
    || strongestRelationship(analysis, (item) => item.yKey === 'performance')
    || strongestRelationship(analysis, (item) => item.yKey === 'pain');
}

function priorityInsightCopy(relationship) {
  if (!relationship) {
    return {
      title: 'Collecting your priority insight',
      finding: 'Log more check-ins, performance outputs, and programme sessions to reveal the clearest current pattern.',
      interpretation: 'Once enough paired logs exist, Home will surface one priority finding rather than a wall of metrics.',
      confidence: 'Collecting Evidence',
    };
  }
  return {
    title: formatRelationshipName(relationship.title),
    finding: relationship.insight?.evidenceStatement || 'This is currently the clearest relationship in your stored data.',
    interpretation: relationship.insight?.trainingInterpretation || relationship.insight?.whatSuggestsThis || 'Use this as a practical monitoring signal, not a causal claim.',
    confidence: confidenceLabel(relationship.insight?.confidence),
  };
}

function keyActionCards(analysis = {}) {
  const relationships = [...(analysis.relationships || [])]
    .filter((relationship) => Number.isFinite(relationship.r))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const actions = relationships.slice(0, 3).map((relationship) => ({
    title: formatRelationshipName(relationship.title),
    body: relationship.insight?.bringForward || relationship.insight?.trainingInterpretation || relationship.insight?.evidenceStatement || 'Monitor this pattern over the next training block.',
    confidence: confidenceLabel(relationship.insight?.confidence),
  }));
  if (actions.length) return actions;
  return [
    { title: 'Keep logging consistently', body: 'Pair check-ins with performance logs so Impuls can separate useful patterns from noise.', confidence: 'Collecting Evidence' },
    { title: 'Plan training in Programme', body: 'Programme structure gives performance and recovery signals context.', confidence: 'Collecting Evidence' },
    { title: 'Use Log Performance after sessions', body: 'Rep-level outputs are the best source for performance insights.', confidence: 'Collecting Evidence' },
  ];
}

function dateShort(value) {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function App() {
  const [data, setData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [screen, setScreen] = useState('today');
  const [lastSavedCheckInId, setLastSavedCheckInId] = useState(null);
  const [exerciseDraft, setExerciseDraft] = useState(emptyExercise);
  const [addExerciseReturnScreen, setAddExerciseReturnScreen] = useState('session');
  const [performanceSaveStatus, setPerformanceSaveStatus] = useState('');
  const [selectedInsight, setSelectedInsight] = useState('performance_freshness');
  const [selectedDashboardMetric, setSelectedDashboardMetric] = useState('performance');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(isoDate());
  const [selectedPlannedSessionId, setSelectedPlannedSessionId] = useState(null);
  const [plannedSessionReturnScreen, setPlannedSessionReturnScreen] = useState('editBlockCalendar');
  const hasLoadedInitialDataRef = useRef(false);
  const lastProgrammeSaveSignatureRef = useRef(null);
  const latestProgrammeSignatureRef = useRef(null);
  const latestDataRef = useRef(null);
  const onboardingProfileSaveUserRef = useRef(null);
  const justCompletedOnboardingProfileRef = useRef(null);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  async function loadLocalFallback(reason) {
    console.log(`[LOCAL FALLBACK] ${reason}`);
    const localData = await loadAppData();
    hasLoadedInitialDataRef.current = true;
    lastProgrammeSaveSignatureRef.current = programmeSignature(localData.programme);
    latestProgrammeSignatureRef.current = lastProgrammeSaveSignatureRef.current;
    latestDataRef.current = localData;
    setData(localData);
  }

  async function loadDataForUser(user) {
    if (!user) {
      await loadLocalFallback('No authenticated user. Loaded local storage.');
      return;
    }

    try {
      const localSnapshot = latestDataRef.current || await loadAppData().catch(() => null);
      const supabaseData = await loadAppDataFromSupabase(user.id);
      const localProfile = justCompletedOnboardingProfileRef.current || localSnapshot?.profile;
      const nextData = localProfile?.onboarding_completed
        ? { ...supabaseData, profile: mergeProfileForAuthLoad(supabaseData.profile, localProfile) }
        : supabaseData;
      console.log(`[SUPABASE LOAD] Loaded ${supabaseData.checkIns.length} check-ins and ${supabaseData.sessions.length} sessions.`);
      hasLoadedInitialDataRef.current = true;
      lastProgrammeSaveSignatureRef.current = programmeSignature(nextData.programme);
      latestProgrammeSignatureRef.current = lastProgrammeSaveSignatureRef.current;
      latestDataRef.current = nextData;
      setData(nextData);
    } catch (error) {
      console.error('[SUPABASE LOAD] Failed. Falling back to local storage.', error);
      await loadLocalFallback('Supabase load failed. Loaded local storage.');
    }
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      try {
        const user = await getCurrentUser();
        if (!mounted) return;
        setCurrentUser(user);
        console.log(user ? '[AUTH] Existing user session found' : '[AUTH] No active user session');
        await loadDataForUser(user);
      } catch (error) {
        console.error('[AUTH] Failed to read current user.', error);
        if (mounted) await loadLocalFallback('Auth check failed. Loaded local storage.');
      } finally {
        if (mounted) setAuthLoading(false);
      }
    }

    bootstrapAuth();

    const subscription = onAuthStateChange(async (user) => {
      if (!mounted) return;
      setCurrentUser(user);
      console.log(user ? '[AUTH] User signed in' : '[AUTH] User signed out');
      setAuthLoading(true);
      try {
        await loadDataForUser(user);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (data) {
      saveAppData(data);
      if (!currentUser) console.log('[LOCAL FALLBACK] Data saved locally.');
    }
  }, [data, currentUser]);

  useEffect(() => {
    const nextSignature = programmeSignature(data?.programme);
    const hasLoadedInitialData = hasLoadedInitialDataRef.current;
    const programmeChanged = nextSignature !== lastProgrammeSaveSignatureRef.current;
    const suppressReasons = [];

    if (!currentUser?.id) suppressReasons.push('no authenticated user');
    if (!data?.programme) suppressReasons.push('no programme data');
    if (authLoading) suppressReasons.push('auth loading');
    if (!hasLoadedInitialData) suppressReasons.push('initial data not loaded');
    if (!programmeChanged) suppressReasons.push('programme unchanged');

    console.log('[SUPABASE SAVE] Programme autosave check', {
      currentUserId: currentUser?.id || null,
      hasLoadedInitialData,
      authLoading,
      hasProgramme: Boolean(data?.programme),
      programmeChanged,
      suppressed: suppressReasons.length > 0,
      suppressReasons,
    });

    if (suppressReasons.length > 0) return undefined;

    latestProgrammeSignatureRef.current = nextSignature;

    const timer = setTimeout(() => {
      console.log('[SUPABASE SAVE] Programme save started', {
        currentUserId: currentUser.id,
        programme: data.programme,
      });
      saveProgrammeToSupabase(currentUser.id, data.programme)
        .then((result) => {
          if (latestProgrammeSignatureRef.current === nextSignature) {
            lastProgrammeSaveSignatureRef.current = nextSignature;
          }
          console.log('[SUPABASE SAVE] Programme saved', {
            currentUserId: currentUser.id,
            result,
          });
        })
        .catch((error) => {
          console.error('[SUPABASE SAVE] Programme save failed', {
            currentUserId: currentUser.id,
            error,
            message: error?.message,
            code: error?.code,
            details: error?.details,
            hint: error?.hint,
            stack: error?.stack,
          });
        });
    }, 1000);

    return () => clearTimeout(timer);
  }, [authLoading, currentUser?.id, data?.programme]);

  useEffect(() => {
    if (!data) return undefined;
    let cancelled = false;
    setAnalysisLoading(true);
    setAnalysisError(null);

    fetchAnalysisWithFallback(data)
      .then((nextAnalysis) => {
        if (!cancelled) setAnalysis(nextAnalysis);
      })
      .catch((error) => {
        if (!cancelled) {
          setAnalysis(null);
          setAnalysisError(error.message || 'Analysis backend unavailable.');
        }
      })
      .finally(() => {
        if (!cancelled) setAnalysisLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    const review = analysis?.checkInReview;
    if (!data || !review?.checkInId || !lastSavedCheckInId || review.checkInId !== lastSavedCheckInId) return;
    const exists = (data.checkInInsightHistory || []).some((item) => item.checkInId === review.checkInId);
    if (exists) return;
    const historyEntry = {
      ...review,
      savedAt: new Date().toISOString(),
    };
    setData((current) => ({
      ...current,
      checkInInsightHistory: [
        historyEntry,
        ...(current.checkInInsightHistory || []),
      ],
    }));
    if (currentUser) {
      saveCheckInInsightToSupabase(currentUser.id, historyEntry)
        .then(() => console.log('[SUPABASE SAVE] Check-in insight saved'))
        .catch((error) => {
          console.error('[SUPABASE SAVE] Check-in insight failed. Local copy preserved.', error);
          console.log('[LOCAL FALLBACK] Check-in insight remains in local storage.');
        });
    }
  }, [analysis?.checkInReview?.checkInId, currentUser, data, lastSavedCheckInId]);

  if (!data || authLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>Loading Impuls...</Text>
      </SafeAreaView>
    );
  }

  function updateDraft(key, value) {
    setData((current) => ({
      ...current,
      checkInDraft: { ...current.checkInDraft, [key]: value },
    }));
  }

  function updateSession(key, value) {
    setData((current) => ({
      ...current,
      activeSession: { ...current.activeSession, [key]: value },
    }));
  }

  function updateProgramme(key, value) {
    setData((current) => ({
      ...current,
      programme: { ...current.programme, [key]: value },
    }));
  }

  function persistProfile(nextProfile) {
    if (!currentUser) return;
    saveProfileToSupabase(currentUser.id, nextProfile)
      .then(() => console.log('[SUPABASE SAVE] Profile saved'))
      .catch((error) => {
        console.error('[SUPABASE SAVE] Profile save failed. Local copy preserved.', error);
        console.log('[LOCAL FALLBACK] Profile remains in local storage.');
      });
  }

  function updateProfile(patch) {
    const currentProfile = data.profile || {};
    const nextProfile = {
      ...currentProfile,
      ...(typeof patch === 'function' ? patch(currentProfile) : patch),
    };
    setData((current) => ({
      ...current,
      profile: { ...(current.profile || {}), ...nextProfile },
    }));
    persistProfile(nextProfile);
  }

  function updateProfileName(value) {
    updateProfile({ name: value });
  }

  function updateProfilePb(key, value) {
    updateProfile((profile) => ({
      pbs: {
        ...(profile.pbs || {}),
        [key]: value,
      },
    }));
  }

  function dismissTutorial(flagKey) {
    updateProfile((profile) => ({
      tutorialFlags: {
        ...emptyTutorialFlags,
        ...(profile.tutorialFlags || {}),
        [flagKey]: true,
      },
    }));
  }

  function resetTutorialHints() {
    updateProfile({ tutorialFlags: { ...emptyTutorialFlags } });
  }

  function replayOnboarding() {
    updateProfile({ onboarding_completed: false });
  }

  async function completeOnboarding(nextProfile = {}, nextScreen = 'today') {
    const baseProfile = data.profile || {};
    const profile = {
      ...baseProfile,
      ...nextProfile,
      onboarding_completed: true,
      tutorialFlags: {
        ...emptyTutorialFlags,
        ...(baseProfile.tutorialFlags || {}),
        ...(nextProfile.tutorialFlags || {}),
      },
      pbs: {
        ...(baseProfile.pbs || {}),
        ...(nextProfile.pbs || {}),
      },
    };
    const nextData = { ...data, profile };
    justCompletedOnboardingProfileRef.current = profile;
    latestDataRef.current = nextData;
    setData(nextData);
    setScreen(nextScreen);

    const saveUser = currentUser || onboardingProfileSaveUserRef.current;
    if (saveUser?.id) {
      try {
        await saveProfileToSupabase(saveUser.id, profile);
        console.log('[SUPABASE SAVE] Onboarding profile saved');
      } catch (error) {
        console.error('[SUPABASE SAVE] Onboarding profile save failed. Local profile preserved.', error);
        console.log('[LOCAL FALLBACK] Onboarding profile remains in local storage.');
      } finally {
        onboardingProfileSaveUserRef.current = null;
      }
    }
  }

  function addExercise() {
    const exercise = {
      ...exerciseDraft,
      id: createId('exercise'),
      sets: toNumber(exerciseDraft.sets),
      contacts: toNumber(exerciseDraft.contacts),
      reps: toNumber(exerciseDraft.reps),
      distance: toNumber(exerciseDraft.distance),
      duration_minutes: toNumber(exerciseDraft.duration_minutes),
      intensity_value: toNumber(exerciseDraft.intensity_value),
      intent_percent: toNumber(exerciseDraft.intent_percent),
    };
    setData((current) => ({
      ...current,
      activeSession: {
        ...current.activeSession,
        exercises: [...current.activeSession.exercises, { ...exercise, order: current.activeSession.exercises.length + 1 }],
      },
    }));
    setExerciseDraft({ ...emptyExercise, movement_type: exerciseDraft.movement_type });
    setScreen(addExerciseReturnScreen);
  }

  function saveCheckIn() {
    const draft = data.checkInDraft;
    const checkIn = {
      id: createId('checkin'),
      check_in_datetime: checkInTimestamp(draft.check_in_date),
      linked_session_id: data.activeSession.id,
      pain_score: draft.pain_score,
      pain_location: draft.pain_location,
      freshness_score: draft.freshness_score,
    };
    // Optional single output captured in the fast check-in. Only attach a real
    // value: a slider score must be > 0, and typed metrics must be non-empty,
    // so an untouched field never logs a spurious 0.
    const primaryMetric = draft.primary_metric || 'performance_score';
    const numericValue = toNumber(draft.primary_value, NaN);
    const hasTypedValue = String(draft.primary_value ?? '').trim() !== '' && Number.isFinite(numericValue);
    if (primaryMetric === 'performance_score') {
      if (Number.isFinite(numericValue) && numericValue > 0) checkIn.performance_score = numericValue;
    } else if (hasTypedValue) {
      if (primaryMetric === 'height_or_distance') {
        checkIn.height_or_distance = numericValue;
        checkIn.height_or_distance_unit = draft.primary_unit || 'cm';
      } else if (primaryMetric === 'sprint_time') {
        checkIn.sprint_time = numericValue;
        checkIn.sprint_time_unit = draft.primary_unit || 'seconds';
      } else if (primaryMetric === 'ft') {
        checkIn.ft = numericValue;
        checkIn.ft_unit = draft.primary_unit || 'seconds';
      }
    }
    setLastSavedCheckInId(checkIn.id);
    setData((current) => ({
      ...current,
      checkIns: [checkIn, ...current.checkIns],
      checkInDraft: { ...current.checkInDraft, primary_value: '', check_in_date: isoDate() },
    }));
    if (currentUser) {
      saveCheckInToSupabase(currentUser.id, checkIn)
        .then(() => console.log('[SUPABASE SAVE] Check-in saved'))
        .catch((error) => {
          console.error('[SUPABASE SAVE] Check-in failed. Local copy preserved.', error);
          console.log('[LOCAL FALLBACK] Check-in remains in local storage.');
        });
    }
    setScreen('checkinReview');
  }

  function savePerformanceLog(payload) {
    const posNum = (value) => {
      const n = Number(value);
      return String(value ?? '').trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
    };
    const entry = {
      id: createId('checkin'),
      check_in_datetime: checkInTimestamp(payload.date),
      linked_session_id: data.activeSession?.id || null,
    };
    if (payload.mode === 'jump') {
      // Measured jump session. performance_type tags it as measured output so the
      // engine can keep it distinct from the quick-log subjective "felt" score.
      entry.performance_type = 'jumping';
      const score = posNum(payload.performance_score);
      if (score !== null) entry.performance_score = score;
      const h = posNum(payload.height);
      if (h !== null) { entry.height_or_distance = h; entry.height_or_distance_unit = payload.height_unit || 'cm'; }
      const ft = posNum(payload.ft);
      if (ft !== null) { entry.ft = ft; entry.ft_unit = payload.ft_unit || 'seconds'; }
    } else {
      entry.performance_type = 'lift';
      const w = posNum(payload.weight);
      if (w !== null) { entry.weight = w; entry.weight_unit = payload.weight_unit || 'kg'; }
      const bv = posNum(payload.bar_velocity);
      if (bv !== null) entry.bar_velocity = bv;
      if (String(payload.lift_name ?? '').trim()) entry.lift_name = payload.lift_name.trim();
    }
    const hasOutput = ['performance_score', 'height_or_distance', 'ft', 'weight', 'bar_velocity'].some((key) => Number.isFinite(entry[key]));
    if (!hasOutput) { setScreen('today'); return; }
    setLastSavedCheckInId(entry.id);
    setData((current) => ({ ...current, checkIns: [entry, ...current.checkIns] }));
    if (currentUser) {
      saveCheckInToSupabase(currentUser.id, entry).catch((error) => console.error('[SUPABASE SAVE] Performance log failed. Local copy preserved.', error));
    }
    setScreen('today');
  }

  function finishSession(options = {}) {
    const sessionId = options.preserveId && isUuid(data.activeSession.id)
      ? data.activeSession.id
      : createId('session');
    let session = {
      ...data.activeSession,
      id: sessionId,
      session_datetime: new Date().toISOString(),
    };
    const attachedForDirectSave = options.syncPlanned
      ? attachPerformanceSessionToCalendar(JSON.parse(JSON.stringify(data.programme)), session)
      : null;
    if (attachedForDirectSave) session = attachedForDirectSave.session;
    const programmeForDirectSave = attachedForDirectSave?.programme || null;
    setData((current) => {
      const attached = options.syncPlanned
        ? attachPerformanceSessionToCalendar(JSON.parse(JSON.stringify(current.programme)), session)
        : null;
      const nextProgramme = attached?.programme || current.programme;
      const nextSession = attached?.session || session;
      return {
        ...current,
        programme: nextProgramme,
        sessions: [nextSession, ...current.sessions.filter((item) => item.id !== nextSession.id)],
        activeSession: { ...current.activeSession, id: createId('draft'), exercises: [] },
      };
    });
    if (currentUser) {
      saveSessionToSupabase(currentUser.id, session)
        .then(async () => {
          if (programmeForDirectSave) {
            await saveProgrammeToSupabase(currentUser.id, programmeForDirectSave);
            const signature = programmeSignature(programmeForDirectSave);
            latestProgrammeSignatureRef.current = signature;
            lastProgrammeSaveSignatureRef.current = signature;
          }
          console.log('[SUPABASE SAVE] Session saved');
        })
        .catch((error) => {
          console.error('[SUPABASE SAVE] Session failed. Local copy preserved.', error);
          console.log('[LOCAL FALLBACK] Session remains in local storage.');
        });
    }
    setScreen('review');
  }

  function openSessionAnalysis(sessionId, returnDate = selectedCalendarDate) {
    setSelectedPlannedSessionId(sessionId);
    if (returnDate) setSelectedCalendarDate(returnDate);
    setScreen('sessionAnalysis');
  }

  async function savePerformanceDraft() {
    const snapshot = latestDataRef.current;
    if (!snapshot?.activeSession) return null;
    const stableSessionId = isUuid(snapshot.activeSession.id) ? snapshot.activeSession.id : createPersistentSessionId();
    const sessionDraft = {
      ...snapshot.activeSession,
      id: stableSessionId,
      session_datetime: snapshot.activeSession.session_datetime || new Date().toISOString(),
      performance_saved_at: new Date().toISOString(),
    };
    const attached = attachPerformanceSessionToCalendar(JSON.parse(JSON.stringify(snapshot.programme)), sessionDraft);
    const session = attached.session;
    const nextProgramme = attached.programme;
    const nextData = {
      ...snapshot,
      programme: nextProgramme,
      activeSession: session,
      sessions: [
        session,
        ...(snapshot.sessions || []).filter((item) => item.id !== stableSessionId),
      ],
    };

    setPerformanceSaveStatus('Saving...');
    latestDataRef.current = nextData;
    setData(nextData);
    setSelectedCalendarDate(isoDate(session.session_datetime));
    setSelectedPlannedSessionId(session.planned_session_id);

    try {
      await saveAppData(nextData);
      if (currentUser?.id) {
        await saveSessionToSupabase(currentUser.id, session);
        if (session.planned_session_id) {
          await saveProgrammeToSupabase(currentUser.id, nextProgramme);
          const signature = programmeSignature(nextProgramme);
          latestProgrammeSignatureRef.current = signature;
          lastProgrammeSaveSignatureRef.current = signature;
        }
      }
      setPerformanceSaveStatus('Saved just now');
      return session;
    } catch (error) {
      console.error('[SUPABASE SAVE] Performance draft save failed. Local copy preserved where possible.', error);
      setPerformanceSaveStatus('Local save kept. Cloud save failed.');
      Alert.alert('Save failed', error.message || 'Could not save performance log.');
      return null;
    }
  }

  function startTodayPerformance() {
    const planned = todayPlannedSession(data.programme);
    const hasActiveDraft = Boolean(
      String(data.activeSession?.session_name || '').trim()
      || String(data.activeSession?.notes || '').trim()
      || (data.activeSession?.exercises || []).length
    );

    if (!hasActiveDraft) {
      setData((current) => ({
        ...current,
        activeSession: planned.id === 'empty_plan'
          ? {
            ...current.activeSession,
            id: createPersistentSessionId(),
            session_name: 'Performance Log',
            session_datetime: new Date().toISOString(),
            notes: '',
            exercises: [],
          }
          : mapPlannedToActiveSession(planned),
      }));
    }
    if (planned.id !== 'empty_plan') {
      setSelectedCalendarDate(planned.date || isoDate());
      setSelectedPlannedSessionId(planned.id);
    }
    setAddExerciseReturnScreen('performanceSession');
    setScreen('performanceSession');
  }

  function clearAll() {
    Alert.alert('Reset local storage?', 'This clears locally stored JSON objects on this simulator.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => setData(await resetAppData()) },
    ]);
  }

  async function handleSignUp() {
    try {
      setAuthLoading(true);
      const result = await signUp(authEmail.trim(), authPassword);
      const user = result?.session?.user || result?.user || null;
      console.log('[AUTH] Sign up submitted');
      if (result?.session?.user) {
        setCurrentUser(user);
        onboardingProfileSaveUserRef.current = user;
        await completeOnboarding({ name: data.profile?.name || '' }, 'today');
        return true;
      }
      Alert.alert('Account created', 'Check your email to confirm your account. You can continue locally for now.');
      return false;
    } catch (error) {
      console.error('[AUTH] Sign up failed.', error);
      Alert.alert('Sign up failed', error.message || 'Could not sign up with Supabase.');
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignIn() {
    try {
      setAuthLoading(true);
      const result = await signIn(authEmail.trim(), authPassword);
      const user = result?.session?.user || result?.user;
      if (!user) throw new Error('Signed in, but Supabase did not return a user session.');
      setCurrentUser(user);
      onboardingProfileSaveUserRef.current = user;
      console.log('[AUTH] Sign in submitted');
      await completeOnboarding({ name: data.profile?.name || '' }, 'today');
      return true;
    } catch (error) {
      console.error('[AUTH] Sign in failed.', error);
      Alert.alert('Sign in failed', error.message || 'Could not sign in with Supabase.');
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      setAuthLoading(true);
      await signOut();
      console.log('[AUTH] Sign out submitted');
    } catch (error) {
      console.error('[AUTH] Sign out failed.', error);
      Alert.alert('Sign out failed', error.message || 'Could not sign out.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleChangePassword(newPassword, confirmPassword) {
    if (newPassword !== confirmPassword) {
      Alert.alert('Password mismatch', 'New password and confirm password must match.');
      return false;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return false;
    }
    try {
      await updatePassword(newPassword);
      Alert.alert('Password updated', 'Your Supabase password has been changed.');
      console.log('[AUTH] Password updated');
      return true;
    } catch (error) {
      console.error('[AUTH] Password update failed.', error);
      Alert.alert('Password update failed', error.message || 'Could not update password.');
      return false;
    }
  }

  if (!data.profile?.onboarding_completed) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.content, styles.onboardingContent]} keyboardShouldPersistTaps="handled">
            <OnboardingScreen
              profile={data.profile || {}}
              authEmail={authEmail}
              authPassword={authPassword}
              authLoading={authLoading}
              setAuthEmail={setAuthEmail}
              setAuthPassword={setAuthPassword}
              updateProfileName={updateProfileName}
              onSignUp={handleSignUp}
              onSignIn={handleSignIn}
              onComplete={completeOnboarding}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (!analysis) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.backendState}>
          <Text style={styles.h1}>{analysisError ? 'Analysis backend unavailable.' : 'Analyzing stored data...'}</Text>
          <Text style={styles.bodyText}>
            {analysisError || `Waiting for ${ANALYSIS_API_URL}. Start the FastAPI backend, then reload or edit any stored data.`}
          </Text>
          {analysisLoading ? <Text style={styles.muted}>Request in progress.</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.appShell}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {screen === 'today' && (
              <HomeScreen
                data={data}
                analysis={analysis}
                setScreen={setScreen}
                setSelectedInsight={setSelectedInsight}
                setSelectedDashboardMetric={setSelectedDashboardMetric}
                startTodayPerformance={startTodayPerformance}
              />
            )}
            {screen === 'checkin' && (
              <CheckInScreen
                draft={data.checkInDraft}
                updateDraft={updateDraft}
                saveCheckIn={saveCheckIn}
                setScreen={setScreen}
                tutorialSeen={data.profile?.tutorialFlags?.checkin_seen}
                onDismissTutorial={() => dismissTutorial('checkin_seen')}
              />
            )}
            {screen === 'checkinReview' && (
              <CheckInReviewScreen
                analysis={analysis}
                expectedCheckInId={lastSavedCheckInId}
                analysisLoading={analysisLoading}
                setScreen={setScreen}
                startTodayPerformance={startTodayPerformance}
              />
            )}
            {screen === 'session' && (
              <SessionScreen
                data={data}
                analysis={analysis}
                setData={setData}
                updateSession={updateSession}
                setScreen={setScreen}
                finishSession={finishSession}
                onAddExercise={() => {
                  setAddExerciseReturnScreen('session');
                  setScreen('addExercise');
                }}
              />
            )}
            {screen === 'performanceSession' && (
              <PerformanceLogScreen savePerformanceLog={savePerformanceLog} setScreen={setScreen} />
            )}
            {screen === 'addExercise' && (
              <AddExerciseScreen draft={exerciseDraft} setDraft={setExerciseDraft} addExercise={addExercise} setScreen={setScreen} returnScreen={addExerciseReturnScreen} />
            )}
            {screen === 'review' && (
              <ReviewScreen data={data} analysis={analysis} setScreen={setScreen} />
            )}
            {screen === 'calendar' && (
              <CalendarScreen
                data={data}
                setData={setData}
                selectedDate={selectedCalendarDate}
                setSelectedDate={setSelectedCalendarDate}
                setSelectedPlannedSessionId={setSelectedPlannedSessionId}
                setPlannedSessionReturnScreen={setPlannedSessionReturnScreen}
                openSessionAnalysis={openSessionAnalysis}
                setScreen={setScreen}
                tutorialSeen={data.profile?.tutorialFlags?.programme_seen}
                onDismissTutorial={() => dismissTutorial('programme_seen')}
              />
            )}
            {screen === 'editCalendar' && (
              <EditCalendarScreen
                data={data}
                setData={setData}
                updateProgramme={updateProgramme}
                setSelectedDate={setSelectedCalendarDate}
                setScreen={setScreen}
              />
            )}
            {screen === 'editBlockCalendar' && (
              <EditBlockCalendarScreen
                data={data}
                setData={setData}
                selectedDate={selectedCalendarDate}
                setSelectedDate={setSelectedCalendarDate}
                setSelectedPlannedSessionId={setSelectedPlannedSessionId}
                setPlannedSessionReturnScreen={setPlannedSessionReturnScreen}
                openSessionAnalysis={openSessionAnalysis}
                setScreen={setScreen}
              />
            )}
            {screen === 'editPlannedSession' && (
              <EditPlannedSessionScreen
                data={data}
                setData={setData}
                sessionId={selectedPlannedSessionId}
                returnScreen={plannedSessionReturnScreen}
                setScreen={setScreen}
              />
            )}
            {screen === 'sessionAnalysis' && (
              <SessionAnalysisScreen
                data={data}
                analysis={analysis}
                sessionId={selectedPlannedSessionId}
                setScreen={setScreen}
              />
            )}
            {screen === 'insights' && (
              <InsightsScreen
                data={data}
                analysis={analysis}
                setScreen={setScreen}
                setSelectedInsight={setSelectedInsight}
                setSelectedDashboardMetric={setSelectedDashboardMetric}
                tutorialSeen={data.profile?.tutorialFlags?.insights_seen}
                onDismissTutorial={() => dismissTutorial('insights_seen')}
              />
            )}
            {screen === 'detail' && (
              <InsightDetailScreen data={data} analysis={analysis} insightId={selectedInsight} setScreen={setScreen} setSelectedDashboardMetric={setSelectedDashboardMetric} />
            )}
            {(screen === 'dashboard' || screen === 'evidence') && (
              <DashboardScreen
                data={data}
                analysis={analysis}
                metricKey={selectedDashboardMetric}
                setMetricKey={setSelectedDashboardMetric}
                setSelectedInsight={setSelectedInsight}
                setScreen={setScreen}
                tutorialSeen={data.profile?.tutorialFlags?.dashboard_seen}
                onDismissTutorial={() => dismissTutorial('dashboard_seen')}
              />
            )}
            {screen === 'profile' && (
              <ProfileScreen
                data={data}
                analysis={analysis}
                currentUser={currentUser}
                authEmail={authEmail}
                authPassword={authPassword}
                authLoading={authLoading}
                setAuthEmail={setAuthEmail}
                setAuthPassword={setAuthPassword}
                updateProfileName={updateProfileName}
                updateProfilePb={updateProfilePb}
                resetTutorialHints={resetTutorialHints}
                replayOnboarding={replayOnboarding}
                onSignUp={handleSignUp}
                onSignIn={handleSignIn}
                onSignOut={handleSignOut}
                onChangePassword={handleChangePassword}
                startTodayPerformance={startTodayPerformance}
                setSelectedDashboardMetric={setSelectedDashboardMetric}
                setScreen={setScreen}
              />
            )}
          </ScrollView>
          <BottomNav screen={screen} setScreen={setScreen} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HomeScreen({ data, analysis, setScreen, setSelectedInsight, setSelectedDashboardMetric, startTodayPerformance }) {
  const planned = todayPlannedSession(data.programme);
  const hasPlannedSession = planned.id !== 'empty_plan';
  const displayName = String(data.profile?.name || '').trim();

  const readinessNum = toNumber(analysis.latest?.readiness);
  const readinessPct = Math.max(0, Math.min(1, readinessNum / 10));
  const ringDash = `${(readinessPct * 314).toFixed(1)} 314`;
  const readline = readinessNum >= 7.5 ? 'Readiness is high today' : readinessNum >= 5 ? 'Readiness is moderate today' : readinessNum > 0 ? 'Readiness is low today' : 'Log a check-in to see your readiness';
  const noticed = analysis?.adaptationInsight?.label || 'Keep logging to surface your patterns';
  const sessionMeta = hasPlannedSession ? exercisePrescriptionSummary(planned) : 'No session planned for today';

  return (
    <View style={styles.screen}>
      <View style={styles.greetingRow}>
        <View style={styles.flex}>
          <Text style={styles.date}>{todayLabel()}</Text>
          <Text style={styles.h1}>{displayName ? `Morning, ${displayName}` : 'Welcome back'}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.readRow}>
          <View style={styles.ringWrap}>
            <Svg width={104} height={104} viewBox="0 0 120 120">
              <Circle cx="60" cy="60" r="50" stroke="#E6E4DC" strokeWidth="11" fill="none" />
              <Circle cx="60" cy="60" r="50" stroke="#1F8A3E" strokeWidth="11" fill="none" strokeLinecap="round" strokeDasharray={ringDash} transform="rotate(-90 60 60)" />
            </Svg>
            <View style={styles.ringValue}>
              <Text style={styles.ringNum}>{pretty(analysis.latest?.readiness, 1)}</Text>
              <Text style={styles.ringScale}>/10</Text>
            </View>
          </View>
          <View style={styles.readMain}>
            <Text style={styles.label}>Readiness</Text>
            <Text style={styles.readline}>{readline}</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statCell}><Text style={styles.statCellLabel}>Recovery</Text><Text style={styles.statCellValue}>{pretty(analysis.latest?.freshness, 1)}</Text></View>
          <View style={styles.statCell}><Text style={styles.statCellLabel}>Load</Text><Text style={styles.statCellValue}>{pretty(analysis.latest?.load, 0)}</Text></View>
          <View style={styles.statCell}><Text style={styles.statCellLabel}>Pain</Text><Text style={styles.statCellValue}>{pretty(analysis.latest?.pain, 0)}</Text></View>
        </View>
      </View>

      <Pressable style={styles.primaryBtn} onPress={() => setScreen('checkin')}><Text style={styles.primaryBtnText}>Check in</Text></Pressable>

      <View style={styles.card}>
        <Text style={styles.label}>Today's session</Text>
        <Text style={styles.cardTitle}>{planned.session_name}</Text>
        <Text style={styles.calendarMetaText}>{sessionMeta}</Text>
        <View style={styles.twoCol}>
          <Pressable style={styles.ghostBtn} onPress={() => setScreen('calendar')}><Text style={styles.ghostBtnText}>Start session</Text></Pressable>
          <Pressable style={styles.ghostBtn} onPress={startTodayPerformance}><Text style={styles.ghostBtnText}>Log performance</Text></Pressable>
        </View>
      </View>

      <Pressable style={styles.noticedCard} onPress={() => setScreen('insights')}>
        <View style={styles.noticedIcon}><Text style={styles.noticedMark}>↗</Text></View>
        <View style={styles.flex}>
          <Text style={styles.label}>What we noticed</Text>
          <Text style={styles.noticedText} numberOfLines={1}>{noticed}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  );
}

function OnboardingScreen({
  profile,
  authEmail,
  authPassword,
  authLoading,
  setAuthEmail,
  setAuthPassword,
  updateProfileName,
  onSignUp,
  onSignIn,
  onComplete,
}) {
  const name = profile?.name || '';

  return (
    <View style={styles.onboardingScreen}>
      <Text style={styles.h1}>Welcome to Impuls</Text>
      <Text style={styles.screenSubtitle}>Impuls connects what you did, how you felt, and how you performed.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account setup</Text>
        <Input label="Name" value={name} onChangeText={updateProfileName} />
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          style={styles.input}
          value={authEmail}
          onChangeText={setAuthEmail}
        />
        <TextInput
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={authPassword}
          onChangeText={setAuthPassword}
        />
        <View style={styles.authActions}>
          <Pressable style={styles.authButton} onPress={onSignUp} disabled={authLoading}>
            <Text style={styles.authButtonText}>Create Account</Text>
          </Pressable>
          <Pressable style={[styles.authButton, styles.authButtonDark]} onPress={onSignIn} disabled={authLoading}>
            <Text style={[styles.authButtonText, styles.authButtonTextLight]}>Sign In</Text>
          </Pressable>
        </View>
        <ActionButton title="Continue Locally" tone="outline" onPress={() => onComplete({ name }, 'today')} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>How Impuls works</Text>
        <OnboardingInfoCard title="Programme or log performance" body="Capture sessions, exercises, sets, reps, contacts, intent, and intensity." />
        <OnboardingInfoCard title="Check in with recovery, pain, and performance" body="Log the response state that belongs to the training you did." />
        <OnboardingInfoCard title="Learn your response patterns over time" body="Repeated session + check-in pairs become evidence for trends and relationships." />
      </View>
    </View>
  );
}

function OnboardingInfoCard({ title, body }) {
  return (
    <View style={styles.onboardingInfoCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
    </View>
  );
}

function TutorialHint({ visible, title, body, onDismiss }) {
  if (!visible) return null;
  return (
    <View style={styles.tutorialHint}>
      <View style={styles.flex}>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.smallCopy}>{body}</Text>
      </View>
      <Pressable style={styles.hintDismiss} onPress={onDismiss}>
        <Text style={styles.hintDismissText}>Got it</Text>
      </Pressable>
    </View>
  );
}

function metricExplainer(key) {
  switch (key) {
    case 'performance_score': return 'Your own 0–10 rating of the session.';
    case 'height_or_distance': return 'Jump height — how high you left the ground.';
    case 'sprint_time': return 'Time over your sprint distance — lower is faster.';
    case 'ft': return 'Flight time — longer airtime means a higher jump.';
    case 'rsi': return 'Reactive strength = flight time ÷ ground contact. Higher is springier.';
    case 'gct': return 'Ground contact time — shorter is more reactive.';
    case 'bar_velocity': return 'Bar speed — maps to the strength quality you trained.';
    default: return '';
  }
}

function interpretMetric(key, rawValue, unit) {
  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (key === 'performance_score') {
    if (value >= 8.5) return 'An excellent session by feel.';
    if (value >= 6.5) return 'A strong session by feel.';
    if (value >= 4.5) return 'A moderate session by feel.';
    return 'A low-quality session by feel.';
  }
  if (key === 'height_or_distance') {
    const cm = (unit === 'inches' || unit === 'in') ? value * 2.54 : value;
    const band = cm >= 75 ? 'an elite vertical' : cm >= 60 ? 'a very strong vertical' : cm >= 45 ? 'a strong recreational vertical' : cm >= 30 ? 'an average vertical' : 'a developing vertical';
    return `≈ ${Math.round(cm)} cm — ${band}.`;
  }
  if (key === 'ft') {
    const cm = (981 * value * value) / 8;
    const band = cm >= 75 ? 'elite' : cm >= 60 ? 'very strong' : cm >= 45 ? 'strong' : cm >= 30 ? 'average' : 'developing';
    return `≈ ${Math.round(cm)} cm jump — ${band}.`;
  }
  if (key === 'sprint_time') {
    return 'Logged — your own splits over time give this its context.';
  }
  if (key === 'rsi') {
    const band = value >= 3 ? 'elite reactive' : value >= 2.5 ? 'excellent' : value >= 2 ? 'strong' : value >= 1.5 ? 'good' : 'developing';
    return `${band} reactive strength.`;
  }
  if (key === 'gct') {
    const s = unit === 'milliseconds' ? value / 1000 : value;
    const band = s <= 0.18 ? 'very reactive' : s <= 0.25 ? 'reactive' : s <= 0.35 ? 'moderate' : 'slow';
    return `${Math.round(s * 1000)} ms contact — ${band}.`;
  }
  if (key === 'bar_velocity') {
    const band = value >= 1.3 ? 'speed' : value >= 1.0 ? 'speed-strength' : value >= 0.75 ? 'strength-speed' : value >= 0.5 ? 'accelerative strength' : 'max strength';
    return `${value.toFixed(2)} m/s — ${band} zone.`;
  }
  return null;
}

function readDay(fresh, pain) {
  const parts = [];
  if (fresh >= 7) parts.push('feeling fresh'); else if (fresh >= 4) parts.push('moderately fresh'); else if (fresh > 0) parts.push('feeling fatigued');
  if (pain >= 5) parts.push('notable knee pain'); else if (pain > 0) parts.push('mild knee pain'); else if (fresh > 0) parts.push('no pain');
  if (!parts.length) return null;
  return `Your signals today: ${parts.join(', ')}.`;
}

function sessionLoadNote(session) {
  const contacts = (session.exercises || []).reduce((sum, exercise) => sum + (Number(exercise.contacts) || 0), 0);
  if (contacts <= 0) return null;
  const band = contacts >= 120 ? 'high contact volume' : contacts >= 60 ? 'moderate contact volume' : 'low contact volume';
  return `${contacts} contacts · ${band}`;
}

function CheckInScreen({ draft, updateDraft, saveCheckIn, setScreen, tutorialSeen, onDismissTutorial }) {
  const selectedDate = draft.check_in_date || isoDate();

  // Default the date to today each time the screen opens, so a persisted draft never
  // re-opens on a stale day. The user can still step to a past/future day below.
  useEffect(() => {
    updateDraft('check_in_date', isoDate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const painYes = Number(draft.pain_score) > 0;
  const dayRead = readDay(Number(draft.freshness_score) || 0, Number(draft.pain_score) || 0);

  return (
    <View style={styles.screen}>
      <View style={styles.checkinTop}>
        <Pressable style={styles.iconBack} onPress={() => setScreen('today')}><Text style={styles.iconBackText}>‹</Text></Pressable>
        <Text style={[styles.h1, styles.flex]}>Check in</Text>
        <Text style={styles.label}>~15s</Text>
      </View>

      <View style={styles.qGroup}>
        <Text style={styles.q}>For which day?</Text>
        <DateStepper value={selectedDate} onChange={(value) => updateDraft('check_in_date', value)} />
      </View>

      <View style={styles.qGroup}>
        <Text style={styles.q}>How fresh do you feel?</Text>
        <SliderField label="Recovery" value={draft.freshness_score} onChange={(value) => updateDraft('freshness_score', value)} />
        <View style={styles.scaleEnds}><Text style={styles.label}>Fatigued</Text><Text style={styles.label}>Fresh</Text></View>
      </View>

      <View style={styles.qGroup}>
        <Text style={styles.q}>Any jumper's knee pain today?</Text>
        <View style={styles.toggleRow}>
          <Pressable style={[styles.toggleBtn, !painYes && styles.toggleBtnSel]} onPress={() => { updateDraft('pain_score', 0); updateDraft('pain_location', ''); }}>
            <Text style={[styles.toggleBtnText, !painYes && styles.toggleBtnTextSel]}>No, all good</Text>
          </Pressable>
          <Pressable style={[styles.toggleBtn, painYes && styles.toggleBtnSel]} onPress={() => { if (!painYes) updateDraft('pain_score', 5); }}>
            <Text style={[styles.toggleBtnText, painYes && styles.toggleBtnTextSel]}>Yes</Text>
          </Pressable>
        </View>
        {painYes ? (
          <View style={styles.painExtra}>
            <SliderField label="Pain level" value={draft.pain_score} onChange={(value) => updateDraft('pain_score', value)} />
            <View style={styles.scaleEnds}><Text style={styles.label}>Barely there</Text><Text style={styles.label}>Severe</Text></View>
            <Input label="Where? (optional)" value={String(draft.pain_location || '')} onChangeText={(value) => updateDraft('pain_location', value)} />
          </View>
        ) : null}
      </View>

      <View style={styles.qGroup}>
        <Text style={styles.q}>How did today feel? (optional)</Text>
        <Input label="Effort / score (0–10)" value={String(draft.primary_value ?? '')} onChangeText={(value) => updateDraft('primary_value', value)} />
        <Text style={styles.metricExplain}>A quick subjective read on how the session went. Log measured jumps and lifts in Log Performance.</Text>
      </View>

      {dayRead ? <Text style={styles.readDayText}>{dayRead}</Text> : null}
      <Pressable style={styles.primaryBtn} onPress={saveCheckIn}><Text style={styles.primaryBtnText}>Done</Text></Pressable>
    </View>
  );
}

function CheckInReviewScreen({ analysis, expectedCheckInId, analysisLoading, setScreen, startTodayPerformance }) {
  const review = analysis?.checkInReview;
  const isCurrent = review?.checkInId && (!expectedCheckInId || review.checkInId === expectedCheckInId);

  if (!isCurrent) {
    return (
      <View style={styles.screen}>
        <Header title="Check-in Review" onBack={() => setScreen('today')} />
        <View style={[styles.checkInThemeCard, themeToneStyles('neutral')]}>
          <Text style={styles.reviewHeroLabel}>Today’s Theme</Text>
          <Text style={styles.reviewHeroTitle}>Analysis updating</Text>
          <Text style={styles.reviewHeroBody}>
            {analysisLoading ? 'The backend is refreshing this check-in response.' : 'Analysis is waiting for the latest saved check-in.'}
          </Text>
        </View>
        <View style={styles.twoCol}>
          <ActionButton title="Log Performance" tone="black" onPress={startTodayPerformance} />
          <ActionButton title="View Insights" tone="outline" onPress={() => setScreen('insights')} />
        </View>
        <ActionButton title="Back to Home" tone="outline" onPress={() => setScreen('today')} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header title="Check-in Review" subtitle={todayLabel()} onBack={() => setScreen('today')} />
      <CheckInReviewSnapshot review={review} />
      <View style={styles.twoCol}>
        <ActionButton title="Log Performance" tone="black" onPress={startTodayPerformance} />
        <ActionButton title="View Insights" tone="outline" onPress={() => setScreen('insights')} />
      </View>
      <ActionButton title="Back to Home" tone="outline" onPress={() => setScreen('today')} />
    </View>
  );
}

function CheckInReviewSnapshot({ review, showDate = false }) {
  const theme = review?.theme || {};
  const toneStyle = themeToneStyles(theme.tone || theme.frame || theme.title);
  return (
    <>
      <View style={[styles.checkInThemeCard, toneStyle]}>
        <Text style={styles.reviewHeroLabel}>{showDate && review?.savedAt ? dateShort(review.savedAt) : 'Today’s Theme'}</Text>
        <Text style={styles.reviewHeroTitle}>{theme.title || 'Context collecting'}</Text>
        {theme.signal ? <Text style={styles.reviewHeroSignal}>{theme.signal}</Text> : null}
        <Text style={styles.reviewHeroBody}>{theme.meaning || review?.interpretation || 'Keep logging after sessions so Impuls can learn your response pattern.'}</Text>
      </View>
      <CheckInReviewVisual visual={review?.visual} />
    </>
  );
}

function CheckInReviewVisual({ visual }) {
  if (!visual) {
    return (
      <View style={styles.reviewVisualCard}>
        <Text style={styles.sectionTitle}>Review Chart</Text>
        <Text style={styles.muted}>context collecting.</Text>
      </View>
    );
  }

  if (visual.type === 'checkin_state_radar') return <ReviewRadarChart visual={visual} />;
  if (visual.type === 'readiness_decomposition_bar') return <ReadinessDecompositionChart visual={visual} />;
  if (visual.type === 'pain_delta_bar') return <PainDeltaBarChart visual={visual} />;
  if (visual.type === 'load_response_scatter') return <LoadResponseScatterChart visual={visual} />;
  if (visual.type === 'performance_readiness_dual_line') return <ReviewDualLineChart visual={visual} />;
  if (visual.type === 'block_state_small_multiples') return <BlockStateSmallMultiples visual={visual} />;
  return <ReviewRadarChart visual={{ ...visual, type: 'checkin_state_radar', axes: visual.axes || [] }} />;
}

function reviewNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function reviewChartScales(values, fallbackMin = 0, fallbackMax = 10) {
  const clean = values.map(reviewNumber).filter((value) => value !== null);
  if (!clean.length) return { min: fallbackMin, max: fallbackMax, range: fallbackMax - fallbackMin || 1 };
  const min = Math.min(fallbackMin, ...clean);
  const max = Math.max(fallbackMax, ...clean);
  return { min, max, range: max - min || 1 };
}

function reviewScalePoint(value, index, total, min, range, width, height, padding) {
  return scaleSvgPoint(value, index, total, min, range, width, height, padding);
}

function ReviewChartShell({ visual, children }) {
  return (
    <View style={styles.reviewVisualCard}>
      <Text style={styles.chartTitle}>{visual.title || 'Check-in Chart'}</Text>
      {children}
      <View style={styles.axisFooter}>
        <Text style={styles.axisLabel}>X: {visual.xLabel || 'Metric'}</Text>
        <Text style={styles.axisLabel}>Y: {visual.yLabel || 'Value'}</Text>
      </View>
      {visual.interpretation || visual.evidence ? (
        <View style={styles.visualInterpretationBox}>
          <Text style={styles.figureEvidenceLabel}>How to read this</Text>
          <Text style={styles.figureInterpretationText}>{visual.interpretation || visual.evidence}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ReviewEmptyChart({ visual }) {
  return (
    <ReviewChartShell visual={visual}>
      <View style={styles.timeChartEmpty}>
        <Text style={styles.muted}>{visual.emptyState || 'context collecting.'}</Text>
      </View>
    </ReviewChartShell>
  );
}

function ReviewRadarChart({ visual }) {
  const axes = (visual.axes || []).filter((axis) => reviewNumber(axis.value) !== null);
  const width = 320;
  const height = 210;
  const center = { x: 160, y: 104 };
  const radius = 68;

  if (axes.length < 3) return <ReviewEmptyChart visual={visual} />;

  const angleFor = (index) => -Math.PI / 2 + (index / axes.length) * Math.PI * 2;
  const pointFor = (index, value, scale = radius) => {
    const angle = angleFor(index);
    const clamped = Math.max(0, Math.min(10, reviewNumber(value) ?? 0)) / 10;
    return {
      x: center.x + Math.cos(angle) * scale * clamped,
      y: center.y + Math.sin(angle) * scale * clamped,
    };
  };
  const labelFor = (index) => {
    const angle = angleFor(index);
    return {
      x: center.x + Math.cos(angle) * (radius + 34),
      y: center.y + Math.sin(angle) * (radius + 24),
    };
  };
  const polygon = axes.map((axis, index) => pointFor(index, axis.value));
  const path = `${polygon.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} Z`;
  const gridPaths = [0.33, 0.66, 1].map((scale) => {
    const points = axes.map((_, index) => pointFor(index, 10, radius * scale));
    return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} Z`;
  });

  return (
    <ReviewChartShell visual={visual}>
      <View style={styles.reviewSvgFrame}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {gridPaths.map((gridPath, index) => <Path key={`radar-grid-${index}`} d={gridPath} fill="none" stroke="#E3E3DE" strokeWidth="1" />)}
          {axes.map((axis, index) => {
            const end = pointFor(index, 10);
            const label = labelFor(index);
            return (
              <G key={axis.key || axis.label}>
                <Line x1={center.x} y1={center.y} x2={end.x} y2={end.y} stroke="#E8E8E4" strokeWidth="1" />
                <SvgText x={label.x} y={label.y} fill="#5D5D58" fontSize="9" fontWeight="700" textAnchor="middle">
                  {axis.label}
                </SvgText>
              </G>
            );
          })}
          <Path d={path} fill="#2FA04433" stroke="#24883B" strokeWidth="3" strokeLinejoin="round" />
          {polygon.map((point, index) => <Circle key={`radar-point-${index}`} cx={point.x} cy={point.y} r="3.5" fill="#FFFFFF" stroke="#24883B" strokeWidth="2" />)}
        </Svg>
      </View>
      <FigureEvidence items={axes.map((axis) => [axis.label, pretty(axis.value, 1)])} />
    </ReviewChartShell>
  );
}

function ReadinessDecompositionChart({ visual }) {
  const freshness = reviewNumber(visual.freshness);
  const painCost = reviewNumber(visual.painCost);
  const readiness = reviewNumber(visual.readiness);
  const width = 320;
  const height = 132;
  const centerX = 160;
  const barY = 54;
  const maxSide = Math.max(freshness ?? 0, painCost ?? 0, 1);
  const scale = 120 / maxSide;

  if ([freshness, painCost, readiness].some((value) => value === null)) return <ReviewEmptyChart visual={visual} />;

  const freshnessWidth = freshness * scale;
  const painWidth = painCost * scale;

  return (
    <ReviewChartShell visual={visual}>
      <View style={styles.reviewSvgFrame}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <Line x1={centerX} y1={24} x2={centerX} y2={96} stroke="#BDBDB7" strokeWidth="1.5" />
          <Rect x={centerX} y={barY} width={freshnessWidth} height="18" rx="9" fill="#2FA044" />
          <Rect x={centerX - painWidth} y={barY} width={painWidth} height="18" rx="9" fill="#E13F32" />
          <SvgText x={centerX + freshnessWidth + 4} y={barY + 13} fill="#24883B" fontSize="10" fontWeight="700">freshness</SvgText>
          <SvgText x={Math.max(4, centerX - painWidth - 4)} y={barY - 8} fill="#B1382D" fontSize="10" fontWeight="700" textAnchor="end">pain cost</SvgText>
          <SvgText x={centerX} y={116} fill="#111111" fontSize="11" fontWeight="800" textAnchor="middle">readiness {pretty(readiness, 1)}</SvgText>
        </Svg>
      </View>
      <FigureEvidence items={[['Freshness', pretty(freshness, 1)], ['Pain cost', pretty(painCost, 1)], ['Readiness', pretty(readiness, 1)]]} />
    </ReviewChartShell>
  );
}

function PainDeltaBarChart({ visual }) {
  const bars = (visual.bars || []).filter((bar) => reviewNumber(bar.value) !== null);
  const delta = reviewNumber(visual.delta);
  const width = 320;
  const height = 154;
  const padding = { left: 34, right: 20, top: 18, bottom: 34 };

  if (bars.length < 2 || delta === null) return <ReviewEmptyChart visual={visual} />;

  const { min, max, range } = reviewChartScales(bars.map((bar) => bar.value), 0, 10);
  const yBase = height - padding.bottom;
  const xStep = (width - padding.left - padding.right) / bars.length;

  return (
    <ReviewChartShell visual={visual}>
      <View style={styles.reviewSvgFrame}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <Line x1={padding.left} y1={padding.top} x2={padding.left} y2={yBase} stroke="#D8D8D4" strokeWidth="1" />
          <Line x1={padding.left} y1={yBase} x2={width - padding.right} y2={yBase} stroke="#D8D8D4" strokeWidth="1" />
          {bars.map((bar, index) => {
            const value = reviewNumber(bar.value);
            const barHeight = ((value - min) / range) * (height - padding.top - padding.bottom);
            const x = padding.left + index * xStep + xStep * 0.18;
            const y = yBase - barHeight;
            return (
              <G key={`${bar.label}-${index}`}>
                <Rect x={x} y={y} width={xStep * 0.64} height={Math.max(3, barHeight)} rx="7" fill={index === 0 ? '#9B9B94' : delta > 0 ? '#E13F32' : '#2FA044'} />
                <SvgText x={x + xStep * 0.32} y={y - 5} fill="#111111" fontSize="10" fontWeight="800" textAnchor="middle">{pretty(value, 1)}</SvgText>
                <SvgText x={x + xStep * 0.32} y={height - 10} fill="#777771" fontSize="10" fontWeight="700" textAnchor="middle">{bar.label}</SvgText>
              </G>
            );
          })}
          <SvgText x={6} y={padding.top + 4} fill="#777771" fontSize="10" fontWeight="700">{pretty(max, 1)}</SvgText>
          <SvgText x={6} y={yBase} fill="#777771" fontSize="10" fontWeight="700">{pretty(min, 1)}</SvgText>
        </Svg>
      </View>
    </ReviewChartShell>
  );
}

function LoadResponseScatterChart({ visual }) {
  const points = (visual.points || []).filter((point) => reviewNumber(point.x) !== null && reviewNumber(point.y) !== null);
  const width = 320;
  const height = 174;
  const padding = { left: 38, right: 18, top: 18, bottom: 34 };

  if (points.length < 3) return <ReviewEmptyChart visual={visual} />;

  const xScale = reviewChartScales(points.map((point) => point.x), 0, 10);
  const yScale = reviewChartScales(points.map((point) => point.y), 0, 10);
  const xFor = (value) => padding.left + ((value - xScale.min) / xScale.range) * (width - padding.left - padding.right);
  const yFor = (value) => padding.top + (1 - ((value - yScale.min) / yScale.range)) * (height - padding.top - padding.bottom);

  return (
    <ReviewChartShell visual={visual}>
      <View style={styles.reviewSvgFrame}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <Line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#D8D8D4" strokeWidth="1" />
          <Line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#D8D8D4" strokeWidth="1" />
          <Line x1={padding.left} y1={padding.top + 48} x2={width - padding.right} y2={padding.top + 48} stroke="#ECECE8" strokeWidth="1" />
          {points.slice(-24).map((point, index) => <Circle key={`${point.date}-${index}`} cx={xFor(point.x)} cy={yFor(point.y)} r="4" fill="#1F7A40" opacity="0.85" />)}
          <SvgText x={padding.left} y={height - 10} fill="#777771" fontSize="10" fontWeight="700">{pretty(xScale.min, 1)}</SvgText>
          <SvgText x={width - padding.right} y={height - 10} fill="#777771" fontSize="10" fontWeight="700" textAnchor="end">{pretty(xScale.max, 1)}</SvgText>
          <SvgText x={6} y={padding.top + 4} fill="#777771" fontSize="10" fontWeight="700">{pretty(yScale.max, 1)}</SvgText>
          <SvgText x={6} y={height - padding.bottom} fill="#777771" fontSize="10" fontWeight="700">{pretty(yScale.min, 1)}</SvgText>
        </Svg>
      </View>
    </ReviewChartShell>
  );
}

function ReviewDualLineChart({ visual }) {
  return (
    <ReviewChartShell visual={visual}>
      <ReviewLineSvg series={visual.series || []} height={166} />
      <View style={styles.evidenceRow}>
        {(visual.series || []).map((line) => (
          <Text key={line.key} style={[styles.tinyBadge, { color: line.color }]}>{line.label}</Text>
        ))}
      </View>
    </ReviewChartShell>
  );
}

function BlockStateSmallMultiples({ visual }) {
  const series = (visual.series || []).filter((line) => (line.points || []).length >= 2);
  if (!series.length) return <ReviewEmptyChart visual={visual} />;

  return (
    <ReviewChartShell visual={visual}>
      <View style={styles.smallMultipleGrid}>
        {series.map((line) => (
          <View key={line.key} style={styles.smallMultipleCard}>
            <Text style={styles.figureEvidenceLabel}>{line.label}</Text>
            <ReviewLineSvg series={[line]} height={70} compact />
          </View>
        ))}
      </View>
    </ReviewChartShell>
  );
}

function ReviewLineSvg({ series, height = 150, compact = false }) {
  const active = (series || []).filter((line) => (line.points || []).filter((point) => reviewNumber(point.value) !== null).length >= 2);
  const width = 320;
  const padding = compact ? { left: 6, right: 6, top: 8, bottom: 12 } : { left: 34, right: 16, top: 16, bottom: 30 };
  const values = active.flatMap((line) => (line.points || []).map((point) => reviewNumber(point.value)).filter((value) => value !== null));

  if (!active.length) {
    return (
      <View style={styles.timeChartEmpty}>
        <Text style={styles.muted}>Needs at least two stored values.</Text>
      </View>
    );
  }

  const { min, max, range } = reviewChartScales(values, Math.min(...values), Math.max(...values));
  const allDates = [...new Set(active.flatMap((line) => (line.points || []).map((point) => point.date)))].sort((a, b) => new Date(a) - new Date(b));
  const xForDate = (date) => {
    const index = allDates.indexOf(date);
    return allDates.length <= 1 ? width / 2 : padding.left + (index / (allDates.length - 1)) * (width - padding.left - padding.right);
  };
  const yFor = (value) => padding.top + (1 - ((value - min) / range)) * (height - padding.top - padding.bottom);

  return (
    <View style={compact ? styles.smallLineFrame : styles.reviewSvgFrame}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {!compact ? (
          <>
            <Line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#D8D8D4" strokeWidth="1" />
            <Line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#D8D8D4" strokeWidth="1" />
            <SvgText x={6} y={padding.top + 4} fill="#777771" fontSize="10" fontWeight="700">{pretty(max, 1)}</SvgText>
            <SvgText x={6} y={height - padding.bottom} fill="#777771" fontSize="10" fontWeight="700">{pretty(min, 1)}</SvgText>
            <SvgText x={padding.left} y={height - 8} fill="#777771" fontSize="10" fontWeight="700">{dateShort(allDates[0])}</SvgText>
            <SvgText x={width - padding.right} y={height - 8} fill="#777771" fontSize="10" fontWeight="700" textAnchor="end">{dateShort(allDates[allDates.length - 1])}</SvgText>
          </>
        ) : null}
        {active.map((line) => {
          const coords = (line.points || [])
            .filter((point) => reviewNumber(point.value) !== null)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map((point) => ({ x: xForDate(point.date), y: yFor(reviewNumber(point.value)) }));
          return <Path key={`${line.key}-line`} d={smoothSvgPath(coords)} fill="none" stroke={line.color || '#24883B'} strokeWidth={compact ? '2.2' : '3'} strokeLinecap="round" strokeLinejoin="round" />;
        })}
        {active.map((line) => (line.points || [])
          .filter((point) => reviewNumber(point.value) !== null)
          .map((point, index) => <Circle key={`${line.key}-${point.date}-${index}`} cx={xForDate(point.date)} cy={yFor(reviewNumber(point.value))} r={compact ? 2.5 : 3.5} fill="#FFFFFF" stroke={line.color || '#24883B'} strokeWidth="2" />))}
      </Svg>
    </View>
  );
}

function PerformanceLogScreen({ savePerformanceLog, setScreen }) {
  const [mode, setMode] = useState('jump');
  const [form, setForm] = useState({ date: isoDate(), performance_score: 5, height: '', height_unit: 'cm', ft: '', ft_unit: 'seconds', weight: '', weight_unit: 'kg', lift_name: '', bar_velocity: '' });
  const up = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <View style={styles.screen}>
      <View style={styles.checkinTop}>
        <Pressable style={styles.iconBack} onPress={() => setScreen('today')}><Text style={styles.iconBackText}>‹</Text></Pressable>
        <Text style={[styles.h1, styles.flex]}>Log performance</Text>
      </View>
      <View style={styles.qGroup}>
        <Text style={styles.q}>For which day?</Text>
        <DateField value={form.date} onChange={(value) => up('date', value)} />
      </View>
      <View style={styles.toggleRow}>
        <Pressable style={[styles.toggleBtn, mode === 'jump' && styles.toggleBtnSel]} onPress={() => setMode('jump')}><Text style={[styles.toggleBtnText, mode === 'jump' && styles.toggleBtnTextSel]}>Best jump</Text></Pressable>
        <Pressable style={[styles.toggleBtn, mode === 'lift' && styles.toggleBtnSel]} onPress={() => setMode('lift')}><Text style={[styles.toggleBtnText, mode === 'lift' && styles.toggleBtnTextSel]}>Best lift</Text></Pressable>
      </View>
      <Text style={styles.muted}>Log whatever you measured — fields are optional.</Text>
      {mode === 'jump' ? (
        <View style={styles.card}>
          <SliderField label="Performance score" value={form.performance_score} onChange={(value) => up('performance_score', value)} />
          <Input label="Max touch height" value={form.height} onChangeText={(value) => up('height', value)} />
          <ChipWrap options={jumpDistanceUnitOptions} value={form.height_unit} onChange={(value) => up('height_unit', value)} />
          <Input label="Flight time (optional)" value={form.ft} onChangeText={(value) => up('ft', value)} />
          <ChipWrap options={sprintTimeUnitOptions} value={form.ft_unit} onChange={(value) => up('ft_unit', value)} />
        </View>
      ) : (
        <View style={styles.card}>
          <Input label="Exercise name" value={form.lift_name} onChangeText={(value) => up('lift_name', value)} />
          <Input label="Weight" value={form.weight} onChangeText={(value) => up('weight', value)} />
          <ChipWrap options={weightUnitOptions} value={form.weight_unit} onChange={(value) => up('weight_unit', value)} />
          <Input label="Bar velocity (m/s, optional)" value={form.bar_velocity} onChangeText={(value) => up('bar_velocity', value)} />
        </View>
      )}
      <Pressable style={styles.primaryBtn} onPress={() => savePerformanceLog({ mode, ...form })}><Text style={styles.primaryBtnText}>Save</Text></Pressable>
    </View>
  );
}

function SessionScreen({
  data,
  analysis,
  setData,
  updateSession,
  setScreen,
  finishSession,
  savePerformanceDraft,
  performanceSaveStatus,
  onAddExercise,
  mode = 'training',
}) {
  const load = analysis?.activeSessionLoad;
  const isPerformance = mode === 'performance';

  function updateExercise(exerciseId, key, value) {
    setData((current) => ({
      ...current,
      activeSession: {
        ...current.activeSession,
        exercises: current.activeSession.exercises.map((exercise) =>
          exercise.id === exerciseId ? { ...exercise, [key]: value } : exercise
        ),
      },
    }));
  }

  function removeExercise(exerciseId) {
    setData((current) => ({
      ...current,
      activeSession: {
        ...current.activeSession,
        exercises: numberExercises(current.activeSession.exercises.filter((exercise) => exercise.id !== exerciseId)),
      },
    }));
  }

  function updatePerformanceAttempt(exerciseId, attemptId, key, value) {
    setData((current) => ({
      ...current,
      activeSession: {
        ...current.activeSession,
        exercises: current.activeSession.exercises.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise;
          const rows = plannedAttemptRows(exercise);
          const nextRows = rows.map((attempt) => {
            if (attempt.id !== attemptId) return attempt;
            if (key === 'metric_type') {
              return {
                ...attempt,
                metric_type: value,
                metrics: emptyActualMetrics(value, attempt.metrics || {}),
              };
            }
            const nextMetrics = { ...(attempt.metrics || {}), [key]: value };
            if (key === 'ft') nextMetrics.ft_unit = 'milliseconds';
            if (key === 'gct') nextMetrics.gct_unit = 'milliseconds';
            return { ...attempt, metrics: emptyActualMetrics(attempt.metric_type, nextMetrics) };
          });
          const plannedKeys = new Set(nextRows.map(actualMetricRowKey));
          const preservedRows = (exercise.actual_metrics || []).filter((attempt) => !plannedKeys.has(actualMetricRowKey(attempt)));
          return { ...exercise, actual_metrics: [...nextRows, ...preservedRows] };
        }),
      },
    }));
  }

  return (
    <View style={styles.screen}>
      <Header title={isPerformance ? 'Log Performance' : 'Training Session'} onBack={() => setScreen('today')} right="check" onRight={finishSession} />
      <Input label="Session Name" value={data.activeSession.session_name} onChangeText={(value) => updateSession('session_name', value)} />
      {isPerformance ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Whole-session score</Text>
          <SliderField
            label="Performance score (0-10)"
            value={data.activeSession.performance_score ?? 0}
            onChange={(value) => updateSession('performance_score', value)}
          />
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>Session Exercises</Text>
      {data.activeSession.exercises.map((exercise, index) => (
        <View key={exercise.id} style={isPerformance ? styles.performanceExerciseLog : styles.exerciseRow}>
          <View style={styles.exerciseHeaderRow}>
            <View style={styles.orderBadge}><Text style={styles.orderBadgeText}>{exercise.order || index + 1}</Text></View>
            <View style={styles.exerciseEdit}>
              <Input label="Exercise" value={exercise.exercise_name} onChangeText={(value) => updateExercise(exercise.id, 'exercise_name', value)} />
              <Text style={styles.muted}>{exercise.movement_type.replace('_', ' ')} / {exercisePrescription(exercise)}</Text>
            </View>
            <Pressable style={styles.deleteButton} onPress={() => removeExercise(exercise.id)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </Pressable>
          </View>
          {isPerformance ? (
            <CalendarExerciseMetrics
              exercise={exercise}
              onChangeAttempt={(attemptId, key, value) => updatePerformanceAttempt(exercise.id, attemptId, key, value)}
            />
          ) : null}
        </View>
      ))}
      <ActionButton title="Add Exercise" tone="outline" onPress={onAddExercise || (() => setScreen('addExercise'))} />
      {isPerformance ? (
        <View style={styles.savePerformancePanel}>
          <ActionButton title="Save Performance" tone="green" onPress={savePerformanceDraft} />
          {performanceSaveStatus ? <Text style={styles.muted}>{performanceSaveStatus}</Text> : null}
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{isPerformance ? 'Performance Notes' : 'Training Notes'}</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          multiline
          value={data.activeSession.notes || ''}
          onChangeText={(value) => updateSession('notes', value)}
          placeholder={isPerformance ? 'Notes about actual performance' : 'Notes as you train'}
        />
      </View>
      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.label}>Session Summary</Text>
          <Text style={styles.muted}>{data.activeSession.exercises.length} exercise</Text>
        </View>
        <View style={styles.loadPill}>
          <Text style={styles.loadText}>{pretty(load, 1)}</Text>
        </View>
      </View>
      <ActionButton title="Finish Session" tone="black" onPress={finishSession} />
    </View>
  );
}

function AddExerciseScreen({ draft, setDraft, addExercise, setScreen, returnScreen = 'session' }) {
  return (
    <View style={styles.screen}>
      <Header title="Add Exercise" onBack={() => setScreen(returnScreen)} />
      <View style={styles.builderCard}>
        <ExerciseDraftEditor draft={draft} update={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} />
      </View>
      <ActionButton title="Add to Session" tone="green" onPress={addExercise} />
    </View>
  );
}

function ReviewScreen({ analysis, setScreen }) {
  const review = analysis.sessionReview || {};
  const load = review.load;
  const breakdown = review.breakdown || {};
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0) || 1;
  const loadChange = review.loadChange || 0;
  const observation = review.observation || 'Session review is collecting.';
  return (
    <View style={styles.screen}>
      <Header title="Session Review" onBack={() => setScreen('today')} />
      <Text style={styles.label}>Session Load</Text>
      <View style={styles.rowBetween}>
        <Text style={styles.bigGreen}>{pretty(load, 1)}</Text>
      </View>
      <Text style={styles.positive}>{loadChange >= 0 ? '+' : ''}{Math.round(loadChange)}% vs recent average</Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Movement Type Breakdown</Text>
        {Object.entries(breakdown).filter(([, value]) => value > 0).map(([key, value]) => (
          <InsightLine key={key} label={key.replace('_', ' ')} value={`${Math.round((value / total) * 100)}%`} />
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Observation</Text>
        <Text style={styles.bodyText}>{observation}</Text>
      </View>
    </View>
  );
}

function CalendarScreen({
  data,
  setData,
  selectedDate,
  setSelectedDate,
  setSelectedPlannedSessionId,
  setPlannedSessionReturnScreen,
  openSessionAnalysis,
  setScreen,
  tutorialSeen,
  onDismissTutorial,
}) {
  const programme = data.programme;
  const macro = currentMacro(programme);
  const block = currentBlock(programme);
  const week = currentWeek(programme);
  const blockSessions = plannedSessionsInCurrentBlock(programme);
  const selectedDaySessions = plannedSessionsOnDate(programme, selectedDate);
  const [calendarMode, setCalendarMode] = useState('week');
  const [openExerciseId, setOpenExerciseId] = useState(null);
  const [editingExId, setEditingExId] = useState(null);
  const [addingSessionId, setAddingSessionId] = useState(null);
  const [exDraft, setExDraft] = useState(emptyExercise);
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [editSessionId, setEditSessionId] = useState(null);
  const weekDays = weekDayLabels(startOfWeekIso(selectedDate));
  const monthDays = monthCalendarDays(selectedDate);
  const yearMonths = monthsInYear(selectedDate);
  const todayIso = isoDate();
  const todayTitle = new Date(`${todayIso}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

  useEffect(() => {
    setSelectedDate(isoDate());
  }, [setSelectedDate]);

  function commitProgramme(updater) {
    setData((current) => {
      const nextProgramme = JSON.parse(JSON.stringify(current.programme));
      updater(nextProgramme);
      return { ...current, programme: nextProgramme };
    });
  }

  function selectCalendarDate(date) {
    const matchingWeek = (block?.weeks || []).find((item) => {
      const start = item.start_date || date;
      const end = item.end_date || addDays(start, 6);
      return dateInBounds(date, { start, end });
    });
    if (matchingWeek) {
      commitProgramme((draft) => {
        draft.selected_week_id = matchingWeek.id;
      });
    }
    setSelectedDate(date);
  }

  function moveCalendar(direction) {
    const nextDate =
      calendarMode === 'year'
        ? addYears(selectedDate, direction)
        : calendarMode === 'month'
          ? addMonths(selectedDate, direction)
          : addDays(selectedDate, direction * 7);
    selectCalendarDate(nextDate);
  }

  function calendarHeading() {
    if (calendarMode === 'year') return yearLabel(selectedDate);
    if (calendarMode === 'month') return monthLabel(selectedDate);
    return dateRangeSummary(startOfWeekIso(selectedDate), addDays(startOfWeekIso(selectedDate), 6));
  }

  function hasSessionOnDate(date) {
    return blockSessions.some((session) => session.date === date);
  }

  function selectMonth(monthIso) {
    selectCalendarDate(monthIso);
    setCalendarMode('month');
  }

  function updatePlannedExercise(sessionId, exerciseId, key, value) {
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (!target) return;
      target.exercises = (target.exercises || []).map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, [key]: value } : exercise
      );
    });
  }

  function updatePlannedSessionPerformance(sessionId, key, value) {
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (target) target[key] = value;
    });
  }

  function updatePlannedAttempt(sessionId, exerciseId, attemptId, key, value) {
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (!target) return;
      target.exercises = (target.exercises || []).map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        const rows = plannedAttemptRows(exercise);
        const nextRows = rows.map((attempt) => {
          if (attempt.id !== attemptId) return attempt;
          if (key === 'metric_type') {
            return {
              ...attempt,
              metric_type: value,
              metrics: emptyActualMetrics(value, attempt.metrics || {}),
            };
          }
          const nextMetrics = { ...(attempt.metrics || {}), [key]: value };
          if (key === 'ft') nextMetrics.ft_unit = 'milliseconds';
          if (key === 'gct') nextMetrics.gct_unit = 'milliseconds';
          return { ...attempt, metrics: emptyActualMetrics(attempt.metric_type, nextMetrics) };
        });
        const plannedKeys = new Set(nextRows.map(actualMetricRowKey));
        const preservedRows = (exercise.actual_metrics || []).filter((attempt) => !plannedKeys.has(actualMetricRowKey(attempt)));
        return { ...exercise, actual_metrics: [...nextRows, ...preservedRows] };
      });
    });
  }

  function analysePlannedSession(session) {
    updatePlannedSessionPerformance(session.id, 'performance_logged_at', new Date().toISOString());
    openSessionAnalysis(session.id, session.date || selectedDate);
  }

  function updateDayNote(value) {
    commitProgramme((draft) => {
      draft.day_notes = { ...(draft.day_notes || {}), [selectedDate]: value };
    });
  }

  function openPlannedSessionFromCalendar(session) {
    setSelectedDate(session.date || selectedDate);
    setSelectedPlannedSessionId(session.id);
    setPlannedSessionReturnScreen('calendar');
    setScreen('editPlannedSession');
  }

  function addSession() {
    const name = newSessionName.trim() || 'New session';
    commitProgramme((draft) => {
      placeSessionInWeek(ensureProgrammeWeek(draft, selectedDate), {
        id: createId('planned_session'),
        session_name: name,
        focus: '',
        duration: '',
        date: selectedDate,
        exercises: [],
      });
    });
    setNewSessionName('');
    setShowAddSession(false);
  }

  function addExerciseToSession(sessionId) {
    const exercise = {
      ...exDraft,
      id: createId('planned_exercise'),
      sets: toNumber(exDraft.sets),
      contacts: toNumber(exDraft.contacts),
      reps: toNumber(exDraft.reps),
      distance: toNumber(exDraft.distance),
      duration_minutes: toNumber(exDraft.duration_minutes),
      intensity_value: toNumber(exDraft.intensity_value),
      intent_percent: toNumber(exDraft.intent_percent),
    };
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (!target) return;
      target.exercises = [...(target.exercises || []), { ...exercise, order: (target.exercises || []).length + 1 }];
    });
    setExDraft({ ...emptyExercise, movement_type: exDraft.movement_type });
    setAddingSessionId(null);
  }

  function removeExercise(sessionId, exerciseId) {
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (!target) return;
      target.exercises = numberExercises((target.exercises || []).filter((exercise) => exercise.id !== exerciseId));
    });
  }

  function movePlannedExercise(sessionId, exerciseId, direction) {
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (!target) return;
      const list = target.exercises || [];
      const index = list.findIndex((exercise) => exercise.id === exerciseId);
      const swapWith = index + direction;
      if (index < 0 || swapWith < 0 || swapWith >= list.length) return;
      [list[index], list[swapWith]] = [list[swapWith], list[index]];
      target.exercises = numberExercises(list);
    });
  }

  // Save a session (with its exercises) as a reusable template; apply it from the block planner.
  function saveSessionAsTemplate(session) {
    commitProgramme((draft) => {
      draft.session_templates = draft.session_templates || [];
      draft.session_templates.push({
        id: createId('tmpl'),
        name: session.session_name || 'Custom template',
        focus: session.focus || '',
        custom: true,
        exercises: (session.exercises || []).map((exercise) => ({ ...exercise })),
      });
    });
  }


  function setSessionField(sessionId, key, value) {
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (target) target[key] = value;
    });
  }

  function deleteSession(sessionId) {
    commitProgramme((draft) => {
      (draft.macro_blocks || []).forEach((macroItem) => (macroItem.blocks || []).forEach((blockItem) => (blockItem.weeks || []).forEach((weekItem) => {
        weekItem.sessions = (weekItem.sessions || []).filter((session) => session.id !== sessionId);
      })));
    });
    setEditSessionId(null);
  }

  return (
    <View style={styles.screen}>
      <Header title="Plan" onBack={() => setScreen('today')} />
      <TutorialHint
        visible={!tutorialSeen}
        title="Build your programme"
        body="Pick a day, add a session, then add exercises. Tap a session to log sets, contacts, and outputs."
        onDismiss={onDismissTutorial}
      />
      <View style={styles.calendarTitleRow}>
        <View>
          <Text style={styles.label}>{macro?.macro_block_name || 'No macro cycle selected'}</Text>
          <Text style={styles.h1}>{block?.block_name || 'No training block'}</Text>
        </View>
        <Pressable style={styles.editProgrammeButton} onPress={() => setScreen('editCalendar')}>
          <Text style={styles.editProgrammeText}>Edit</Text>
        </Pressable>
      </View>
      <View style={styles.weekNav}>
        <Pressable style={styles.weekArrow} hitSlop={10} onPress={() => moveCalendar(-1)}><Text style={styles.chevron}>‹</Text></Pressable>
        <View style={styles.calendarHeadingWrap}>
          <Text style={styles.sectionTitle}>{calendarHeading()}</Text>
          <Text style={styles.calendarTodayTitle}>Today: {todayTitle}</Text>
        </View>
        <Pressable style={styles.weekArrow} hitSlop={10} onPress={() => moveCalendar(1)}><Text style={styles.chevron}>›</Text></Pressable>
      </View>
      <View style={styles.calendarModeTabs}>
        {['week', 'month', 'year'].map((mode) => {
          const active = calendarMode === mode;
          return (
            <Pressable
              key={mode}
              style={[styles.calendarModeTab, active && styles.calendarModeTabActive]}
              onPress={() => setCalendarMode(mode)}
            >
              <Text style={[styles.calendarModeTabText, active && styles.calendarModeTabTextActive]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {calendarMode === 'year' ? (
        <View style={styles.yearGrid}>
          {yearMonths.map((month) => {
            const active = month.iso.slice(0, 7) === selectedDate.slice(0, 7);
            const monthHasSession = blockSessions.some((session) => String(session.date || '').slice(0, 7) === month.iso.slice(0, 7));
            return (
              <Pressable key={month.iso} style={[styles.monthCell, active && styles.monthCellActive]} onPress={() => selectMonth(month.iso)}>
                <Text style={[styles.monthCellText, active && styles.activeDayText]}>{month.label}</Text>
                <View style={[styles.dayDot, monthHasSession && styles.dayDotFilled]} />
              </Pressable>
            );
          })}
        </View>
      ) : calendarMode === 'month' ? (
        <View style={styles.monthCalendar}>
          <View style={styles.monthWeekHeader}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
              <Text key={label} style={styles.monthWeekHeaderText}>{label}</Text>
            ))}
          </View>
          <View style={styles.monthGrid}>
            {monthDays.map((day) => {
              const active = selectedDate === day.iso;
              const isToday = todayIso === day.iso;
              return (
                <Pressable
                  key={day.iso}
                  style={[styles.monthDayCell, day.outsideMonth && styles.monthDayOutside, isToday && styles.todayDay, active && styles.activeDay]}
                  onPress={() => selectCalendarDate(day.iso)}
                >
                  <Text style={[styles.dayText, day.outsideMonth && styles.monthDayOutsideText, active && styles.activeDayText]}>{day.day}</Text>
                  <View style={[styles.dayDot, hasSessionOnDate(day.iso) && styles.dayDotFilled]} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.weekGrid}>
          {weekDays.map((day) => {
            const active = selectedDate === day.iso;
            const isToday = todayIso === day.iso;
            return (
              <Pressable key={day.iso} style={[styles.dayCell, isToday && styles.todayDay, active && styles.activeDay]} onPress={() => selectCalendarDate(day.iso)}>
                <Text style={[styles.dayText, active && styles.activeDayText]}>{day.label}</Text>
                <Text style={[styles.dayText, active && styles.activeDayText]}>{day.day}</Text>
                <View style={[styles.dayDot, hasSessionOnDate(day.iso) && styles.dayDotFilled]} />
              </Pressable>
            );
          })}
        </View>
      )}
      <Pressable style={styles.buildFasterBtn} onPress={() => setScreen('editBlockCalendar')}>
        <Text style={styles.buildFasterIcon}>⚡</Text>
        <View style={styles.flex}>
          <Text style={styles.buildFasterTitle}>Build faster</Text>
          <Text style={styles.buildFasterSub}>Templates · repeat week · progressive overload</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.daySectionLabel}>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</Text>

      {selectedDaySessions.length === 0 && !showAddSession ? (
        <View style={styles.card}>
          <Text style={styles.bodyText}>Rest day — nothing planned.</Text>
          <Pressable style={styles.adds} onPress={() => setShowAddSession(true)}><Text style={styles.addsText}>+ Add a session</Text></Pressable>
        </View>
      ) : null}

      {selectedDaySessions.map((session) => (
        <View key={session.id} style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, styles.flex]}>{session.session_name}</Text>
            <Pressable onPress={() => analysePlannedSession(session)}><Text style={styles.textLink}>Analyse</Text></Pressable>
            <Pressable style={styles.editGap} onPress={() => saveSessionAsTemplate(session)}><Text style={styles.textLink}>Save tmpl</Text></Pressable>
            <Pressable style={styles.editGap} onPress={() => setEditSessionId(editSessionId === session.id ? null : session.id)}><Text style={styles.textLink}>{editSessionId === session.id ? 'Done' : 'Edit'}</Text></Pressable>
          </View>
          {sessionLoadNote(session) ? <Text style={styles.exPrescription}>{sessionLoadNote(session)}</Text> : null}
          {editSessionId === session.id ? (
            <View style={styles.painExtra}>
              <Input label="Session name" value={session.session_name} onChangeText={(value) => setSessionField(session.id, 'session_name', value)} />
              <View style={styles.twoCol}>
                <Input label="Focus" value={session.focus || ''} onChangeText={(value) => setSessionField(session.id, 'focus', value)} />
                <Input label="Duration" value={session.duration || ''} onChangeText={(value) => setSessionField(session.id, 'duration', value)} />
              </View>
              <Pressable style={[styles.ghostBtn, styles.dangerBtn]} onPress={() => deleteSession(session.id)}><Text style={[styles.ghostBtnText, styles.dangerText]}>Delete session</Text></Pressable>
            </View>
          ) : null}
          {(session.exercises || []).length === 0 ? <Text style={styles.muted}>No exercises yet — add your first below.</Text> : null}
          {(session.exercises || []).map((exercise, index) => {
            const open = openExerciseId === exercise.id;
            const editing = editingExId === exercise.id;
            return (
              <View key={exercise.id} style={styles.exItem}>
                <View style={styles.exHeader}>
                  <Pressable style={styles.flex} onPress={() => setOpenExerciseId(open ? null : exercise.id)}>
                    <Text style={styles.exName}>{index + 1}. {exercise.exercise_name || 'Exercise'}</Text>
                    <Text style={styles.exPrescription}>{exercisePrescription(exercise)}</Text>
                  </Pressable>
                  <View style={styles.reorderControls}>
                    <Pressable style={[styles.reorderBtn, index === 0 && styles.reorderBtnDisabled]} disabled={index === 0} onPress={() => movePlannedExercise(session.id, exercise.id, -1)}><Text style={styles.reorderBtnText}>↑</Text></Pressable>
                    <Pressable style={[styles.reorderBtn, index === (session.exercises || []).length - 1 && styles.reorderBtnDisabled]} disabled={index === (session.exercises || []).length - 1} onPress={() => movePlannedExercise(session.id, exercise.id, 1)}><Text style={styles.reorderBtnText}>↓</Text></Pressable>
                    <Pressable onPress={() => setOpenExerciseId(open ? null : exercise.id)}><Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text></Pressable>
                  </View>
                </View>
                {open ? (
                  <View style={styles.painExtra}>
                    <CalendarExerciseMetrics
                      exercise={exercise}
                      onChangeAttempt={(attemptId, key, value) => updatePlannedAttempt(session.id, exercise.id, attemptId, key, value)}
                    />
                    <Pressable onPress={() => setEditingExId(editing ? null : exercise.id)}><Text style={styles.textLink}>{editing ? 'Hide edit' : 'Edit sets / reps'}</Text></Pressable>
                    {editing ? (
                      <View style={styles.painExtra}>
                        <ExerciseDraftEditor draft={exercise} update={(key, value) => updatePlannedExercise(session.id, exercise.id, key, value)} />
                        <Pressable style={styles.deleteButton} onPress={() => removeExercise(session.id, exercise.id)}><Text style={styles.deleteButtonText}>Remove exercise</Text></Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
          {addingSessionId === session.id ? (
            <View style={styles.builderCard}>
              <ExerciseDraftEditor draft={exDraft} update={(key, value) => setExDraft((c) => ({ ...c, [key]: value }))} />
              <View style={styles.twoCol}>
                <Pressable style={styles.ghostBtn} onPress={() => setAddingSessionId(null)}><Text style={styles.ghostBtnText}>Cancel</Text></Pressable>
                <Pressable style={[styles.primaryBtn, styles.flex]} onPress={() => addExerciseToSession(session.id)}><Text style={styles.primaryBtnText}>Add</Text></Pressable>
              </View>
            </View>
          ) : (
            <Pressable style={styles.adds} onPress={() => { setExDraft({ ...emptyExercise }); setAddingSessionId(session.id); }}><Text style={styles.addsText}>+ Add exercise</Text></Pressable>
          )}
        </View>
      ))}

      {showAddSession ? (
        <View style={styles.builderCard}>
          <Input label="Session name" value={newSessionName} onChangeText={setNewSessionName} />
          <View style={styles.twoCol}>
            <Pressable style={styles.ghostBtn} onPress={() => setShowAddSession(false)}><Text style={styles.ghostBtnText}>Cancel</Text></Pressable>
            <Pressable style={[styles.primaryBtn, styles.flex]} onPress={addSession}><Text style={styles.primaryBtnText}>Add session</Text></Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.label}>Notes for this day</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          multiline
          value={(programme.day_notes || {})[selectedDate] || ''}
          onChangeText={updateDayNote}
          placeholder="Optional notes for this training day"
        />
      </View>
    </View>
  );
}

function EditCalendarScreen({ data, setData, updateProgramme, setSelectedDate, setScreen }) {
  const programme = data.programme;
  const macro = currentMacro(programme);
  const [editingItem, setEditingItem] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [rangePickerOpen, setRangePickerOpen] = useState(false);

  function commitProgramme(updater) {
    setData((current) => {
      const nextProgramme = JSON.parse(JSON.stringify(current.programme));
      updater(nextProgramme);
      return { ...current, programme: nextProgramme };
    });
  }

  const [openBlockId, setOpenBlockId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newBlock, setNewBlock] = useState({ name: '', weeks: '4' });
  const [confirmDeleteBlockId, setConfirmDeleteBlockId] = useState(null);

  function ensureMacroDraft(draft) {
    draft.macro_blocks = draft.macro_blocks || [];
    let macroItem = currentMacro(draft);
    if (!macroItem) {
      macroItem = { id: createId('macro'), macro_block_name: '', start_date: isoDate(), end_date: '', blocks: [] };
      draft.macro_blocks.push(macroItem);
      draft.selected_macro_id = macroItem.id;
    }
    return macroItem;
  }

  function setMacroName(value) {
    commitProgramme((draft) => { ensureMacroDraft(draft).macro_block_name = value; });
  }

  function addMacro() {
    commitProgramme((draft) => {
      const id = createId('macro');
      draft.macro_blocks = draft.macro_blocks || [];
      draft.macro_blocks.push({ id, macro_block_name: '', start_date: isoDate(), end_date: '', blocks: [] });
      draft.selected_macro_id = id;
      draft.selected_block_id = null;
      draft.selected_week_id = null;
    });
  }

  function selectMacroById(id) {
    commitProgramme((draft) => {
      const macroItem = (draft.macro_blocks || []).find((item) => item.id === id);
      if (!macroItem) return;
      draft.selected_macro_id = id;
      draft.selected_block_id = macroItem.blocks?.[0]?.id || null;
      draft.selected_week_id = macroItem.blocks?.[0]?.weeks?.[0]?.id || null;
    });
  }

  function addBlock() {
    const weeks = Math.max(1, Math.min(16, Math.round(toNumber(newBlock.weeks, 4)) || 4));
    const name = newBlock.name.trim() || 'New block';
    commitProgramme((draft) => {
      const macroItem = ensureMacroDraft(draft);
      macroItem.blocks = macroItem.blocks || [];
      const last = macroItem.blocks[macroItem.blocks.length - 1];
      const lastEnd = last?.weeks?.[last.weeks.length - 1]?.end_date;
      const start = lastEnd ? addDays(lastEnd, 1) : (macroItem.start_date || isoDate());
      const weekObjs = [];
      let cursor = start;
      for (let i = 0; i < weeks; i += 1) {
        weekObjs.push({ id: createId('week'), week_name: `Week ${i + 1}`, start_date: cursor, end_date: addDays(cursor, 6), sessions: [] });
        cursor = addDays(cursor, 7);
      }
      const id = createId('block');
      macroItem.blocks.push({ id, block_name: name, start_date: start, end_date: addDays(start, weeks * 7 - 1), weeks: weekObjs });
      draft.selected_block_id = id;
      draft.selected_week_id = weekObjs[0].id;
    });
    setNewBlock({ name: '', weeks: '4' });
    setAdding(false);
  }

  function setBlockName(blockId, value) {
    commitProgramme((draft) => {
      const macroItem = currentMacro(draft);
      const blockItem = macroItem?.blocks?.find((item) => item.id === blockId);
      if (blockItem) blockItem.block_name = value;
    });
  }

  function addWeek(blockId) {
    commitProgramme((draft) => {
      const macroItem = currentMacro(draft);
      const blockItem = macroItem?.blocks?.find((item) => item.id === blockId);
      if (!blockItem) return;
      blockItem.weeks = blockItem.weeks || [];
      const last = blockItem.weeks[blockItem.weeks.length - 1];
      const cursor = last ? addDays(last.end_date, 1) : (blockItem.start_date || isoDate());
      blockItem.weeks.push({ id: createId('week'), week_name: `Week ${blockItem.weeks.length + 1}`, start_date: cursor, end_date: addDays(cursor, 6), sessions: [] });
      blockItem.end_date = addDays(cursor, 6);
    });
  }

  function removeWeek(blockId) {
    const macroItem = currentMacro(programme);
    const blockItem = macroItem?.blocks?.find((item) => item.id === blockId);
    const last = blockItem?.weeks?.[blockItem.weeks.length - 1];
    if (!last) return;
    if ((last.sessions || []).length) { Alert.alert('Week has sessions', 'Remove or move its sessions before deleting this week.'); return; }
    commitProgramme((draft) => {
      const macroDraft = currentMacro(draft);
      const blockDraft = macroDraft?.blocks?.find((item) => item.id === blockId);
      if (!blockDraft || !(blockDraft.weeks || []).length) return;
      blockDraft.weeks.pop();
      const newLast = blockDraft.weeks[blockDraft.weeks.length - 1];
      blockDraft.end_date = newLast ? newLast.end_date : blockDraft.start_date;
    });
  }

  function selectBlockById(blockId) {
    let date = isoDate();
    commitProgramme((draft) => {
      const macroItem = currentMacro(draft);
      const blockItem = macroItem?.blocks?.find((item) => item.id === blockId);
      if (!blockItem) return;
      draft.selected_block_id = blockItem.id;
      const firstWeek = blockItem.weeks?.[0];
      draft.selected_week_id = firstWeek?.id || null;
      date = firstWeek?.start_date || isoDate();
    });
    setSelectedDate(date);
  }

  // Direct commit (no Alert) so it works on web too; the UI does a two-tap confirm.
  function deleteBlockById(blockId) {
    commitProgramme((draft) => {
      const macroItem = currentMacro(draft);
      if (!macroItem) return;
      macroItem.blocks = (macroItem.blocks || []).filter((item) => item.id !== blockId);
      if (draft.selected_block_id === blockId) {
        draft.selected_block_id = macroItem.blocks[0]?.id || null;
        draft.selected_week_id = macroItem.blocks[0]?.weeks?.[0]?.id || null;
      }
    });
    setConfirmDeleteBlockId(null);
  }

  // Move a block's start: shift the block + every week + every session by the same delta,
  // so the weeks the user built stay intact and consecutive.
  function shiftBlockStart(blockId, deltaDays) {
    if (!deltaDays) return;
    commitProgramme((draft) => {
      const macroItem = currentMacro(draft);
      const target = (macroItem?.blocks || []).find((item) => item.id === blockId);
      if (!target) return;
      const shift = (value) => (value ? addDays(value, deltaDays) : value);
      target.start_date = shift(target.start_date || target.weeks?.[0]?.start_date || isoDate());
      target.end_date = shift(target.end_date);
      (target.weeks || []).forEach((weekItem) => {
        weekItem.start_date = shift(weekItem.start_date);
        weekItem.end_date = shift(weekItem.end_date);
        (weekItem.sessions || []).forEach((session) => { session.date = shift(session.date); });
      });
    });
  }

  function selectMacro(macroId) {
    commitProgramme((draft) => {
      const selectedMacro = (draft.macro_blocks || []).find((item) => item.id === macroId) || draft.macro_blocks?.[0];
      if (!selectedMacro) return;
      draft.selected_macro_id = selectedMacro.id;
      draft.selected_block_id = selectedMacro.blocks?.[0]?.id || null;
      draft.selected_week_id = selectedMacro.blocks?.[0]?.weeks?.[0]?.id || null;
    });
  }

  function selectBlock(blockId) {
    commitProgramme((draft) => {
      const selectedMacro = currentMacro(draft);
      const selectedBlock = selectedMacro?.blocks?.find((item) => item.id === blockId) || selectedMacro?.blocks?.[0];
      if (!selectedBlock) return;
      draft.selected_block_id = selectedBlock.id;
      draft.selected_week_id = selectedBlock.weeks?.[0]?.id || null;
    });
  }

  function selectBlockAndOpen(blockId) {
    let openingDate = isoDate();
    commitProgramme((draft) => {
      const selectedMacro = currentMacro(draft);
      if (!selectedMacro) return;
      const selectedBlock = selectedMacro.blocks?.find((item) => item.id === blockId) || selectedMacro.blocks?.[0];
      if (!selectedBlock) return;
      const firstWeek = selectedBlock.weeks[0];
      const firstSessionWeek = (selectedBlock.weeks || []).find((week) => (week.sessions || []).length > 0);
      const firstSession = firstSessionWeek?.sessions?.[0];
      draft.selected_block_id = selectedBlock.id;
      draft.selected_week_id = firstSessionWeek?.id || firstWeek?.id;
      openingDate = firstSession?.date || firstWeek?.start_date || isoDate();
    });
    setSelectedDate(openingDate);
    setScreen('editBlockCalendar');
  }

  function addMacroBlock() {
    commitProgramme((draft) => {
      const macroId = createId('macro');
      const blockId = createId('block');
      const weekId = createId('week');
      const startDate = isoDate();
      draft.macro_blocks = draft.macro_blocks || [];
      draft.macro_blocks.push({
        id: macroId,
        macro_block_name: '',
        start_date: startDate,
        end_date: addDays(startDate, 42),
        blocks: [
          {
            id: blockId,
            block_name: '',
            start_date: startDate,
            end_date: '',
            weeks: [{ id: weekId, week_name: '', start_date: startDate, end_date: addDays(startDate, 6), sessions: [] }],
          },
        ],
      });
      draft.selected_macro_id = macroId;
      draft.selected_block_id = blockId;
      draft.selected_week_id = weekId;
    });
  }

  function deleteMacroBlock(macroId) {
    commitProgramme((draft) => {
      draft.macro_blocks = draft.macro_blocks.filter((item) => item.id !== macroId);
      const nextMacro = draft.macro_blocks[0];
      draft.selected_macro_id = nextMacro?.id || null;
      draft.selected_block_id = nextMacro?.blocks?.[0]?.id || null;
      draft.selected_week_id = nextMacro?.blocks?.[0]?.weeks?.[0]?.id || null;
    });
  }

  function addTrainingBlock() {
    commitProgramme((draft) => {
      let selectedMacro = currentMacro(draft);
      if (!selectedMacro) {
        const macroId = createId('macro');
        const startDate = isoDate();
        draft.macro_blocks = [{
          id: macroId,
          macro_block_name: '',
          start_date: startDate,
          end_date: '',
          blocks: [],
        }];
        draft.selected_macro_id = macroId;
        selectedMacro = draft.macro_blocks[0];
      }
      const blockId = createId('block');
      const weekId = createId('week');
      const startDate = selectedMacro.start_date || isoDate();
      selectedMacro.blocks = selectedMacro.blocks || [];
      selectedMacro.blocks.push({
        id: blockId,
        block_name: '',
        start_date: startDate,
        end_date: '',
        weeks: [{ id: weekId, week_name: '', start_date: startDate, end_date: addDays(startDate, 6), sessions: [] }],
      });
      draft.selected_block_id = blockId;
      draft.selected_week_id = weekId;
    });
  }

  function deleteTrainingBlock(blockId) {
    commitProgramme((draft) => {
      const selectedMacro = currentMacro(draft);
      if (!selectedMacro) return;
      selectedMacro.blocks = selectedMacro.blocks.filter((item) => item.id !== blockId);
      if (draft.selected_block_id === blockId) {
        draft.selected_block_id = selectedMacro.blocks[0]?.id || null;
        draft.selected_week_id = selectedMacro.blocks[0]?.weeks?.[0]?.id || null;
      }
    });
  }

  function beginMacroEdit(macroItem) {
    setEditingItem({ type: 'macro', id: macroItem.id });
    setEditDraft({
      name: macroItem.macro_block_name || '',
      startDate: macroItem.start_date || '',
      endDate: macroItem.end_date || '',
    });
  }

  function beginBlockEdit(blockItem) {
    setEditingItem({ type: 'block', id: blockItem.id });
    setEditDraft({
      name: blockItem.block_name || '',
      startDate: blockItem.start_date || '',
      endDate: blockItem.end_date || '',
    });
  }

  function cancelEdit() {
    setEditingItem(null);
    setEditDraft(null);
    setRangePickerOpen(false);
  }

  function saveEdit() {
    if (!editingItem || !editDraft) return;
    if (!editDraft.startDate || !editDraft.endDate) {
      Alert.alert('Date range required', 'Select both a start date and an end date.');
      return;
    }

    if (!isDateRangeValid(editDraft.startDate, editDraft.endDate)) {
      Alert.alert('Invalid date range', 'End date cannot be before start date.');
      return;
    }
    commitProgramme((draft) => {
      if (editingItem.type === 'macro') {
        const targetMacro = (draft.macro_blocks || []).find((item) => item.id === editingItem.id);
        if (!targetMacro) return;
        targetMacro.macro_block_name = editDraft.name;
        targetMacro.start_date = editDraft.startDate;
        targetMacro.end_date = editDraft.endDate;
        return;
      }
      const selectedMacro = currentMacro(draft);
      const targetBlock = selectedMacro?.blocks?.find((item) => item.id === editingItem.id);
      if (!targetBlock) return;
      targetBlock.block_name = editDraft.name;
      targetBlock.start_date = editDraft.startDate;
      targetBlock.end_date = editDraft.endDate;
    });
    cancelEdit();
  }

  function renderEditPanel(type, title) {
    if (!editingItem || editingItem.type !== type || !editDraft) return null;

    return (
      <View style={styles.programmeFocusedPanel}>
        <Text style={styles.sectionTitle}>{title}</Text>

        <Input
          label={type === 'macro' ? 'Macro name' : 'Block name'}
          value={editDraft.name}
          onChangeText={(value) => setEditDraft((current) => ({ ...current, name: value }))}
        />

        <View style={styles.rangeSelectorBox}>
          <Text style={styles.inputLabel}>Date range</Text>
          <Text style={styles.rangeSummaryText}>
            {dateRangeSummary(editDraft.startDate, editDraft.endDate)}
          </Text>

          <Pressable
            style={styles.dateRangeButton}
            onPress={() => setRangePickerOpen((current) => !current)}
          >
            <Text style={styles.dateRangeButtonText}>
              {rangePickerOpen ? 'Close calendar' : 'Select date range'}
            </Text>
          </Pressable>
        </View>

        {rangePickerOpen ? (
          <DateRangePickerCard
            title="Select range"
            startDate={editDraft.startDate}
            endDate={editDraft.endDate}
            onSave={(startDate, endDate) => {
              setEditDraft((current) => ({
                ...current,
                startDate,
                endDate,
              }));
              setRangePickerOpen(false);
            }}
            onCancel={() => setRangePickerOpen(false)}
          />
        ) : null}

        <View style={styles.programmeActions}>
          <Pressable style={[styles.miniButton, styles.miniButtonDark]} onPress={saveEdit}>
            <Text style={[styles.miniButtonText, styles.miniButtonTextLight]}>Save</Text>
          </Pressable>
          <Pressable style={styles.miniButton} onPress={cancelEdit}>
            <Text style={styles.miniButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.checkinTop}>
        <Pressable style={styles.iconBack} onPress={() => setScreen('calendar')}><Text style={styles.iconBackText}>‹</Text></Pressable>
        <Text style={[styles.h1, styles.flex]}>Programme</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Macrocycle · the overall plan</Text>
        <Input label="Name" value={macro?.macro_block_name || ''} onChangeText={setMacroName} />
        {(programme.macro_blocks || []).length > 1 ? (
          <View style={styles.chips}>
            {(programme.macro_blocks || []).map((macroItem) => (
              <Pressable key={macroItem.id} style={[styles.chip, programme.selected_macro_id === macroItem.id && styles.chipActive]} onPress={() => selectMacroById(macroItem.id)}>
                <Text style={[styles.chipText, programme.selected_macro_id === macroItem.id && styles.chipTextActive]}>{macroItem.macro_block_name || 'Untitled'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Pressable style={styles.adds} onPress={addMacro}><Text style={styles.addsText}>+ New macrocycle</Text></Pressable>
      </View>

      <Text style={styles.daySectionLabel}>Mesocycle blocks · training phases</Text>
      {(macro?.blocks || []).length === 0 ? <Text style={styles.muted}>No blocks yet — add your first phase below.</Text> : null}
      {(macro?.blocks || []).map((blockItem, index) => {
        const open = openBlockId === blockItem.id;
        const isCurrent = programme.selected_block_id === blockItem.id;
        const weeks = (blockItem.weeks || []).length;
        return (
          <View key={blockItem.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.exName}>{blockItem.block_name || `Block ${index + 1}`}{isCurrent ? '  ·  current' : ''}</Text>
                <Text style={styles.exPrescription}>{weeks} week{weeks === 1 ? '' : 's'} · {dateRangeSummary(blockItem.start_date, blockItem.end_date)}</Text>
              </View>
              <Pressable onPress={() => { setOpenBlockId(open ? null : blockItem.id); setConfirmDeleteBlockId(null); }}><Text style={styles.textLink}>{open ? 'Done' : 'Edit'}</Text></Pressable>
            </View>
            {open ? (
              <View style={styles.painExtra}>
                <Input label="Block name" value={blockItem.block_name} onChangeText={(value) => setBlockName(blockItem.id, value)} />
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>Weeks (microcycles)</Text>
                  <View style={styles.stepRow}>
                    <Pressable style={styles.stepBtn} onPress={() => removeWeek(blockItem.id)}><Text style={styles.stepBtnText}>−</Text></Pressable>
                    <Text style={styles.stepVal}>{weeks}</Text>
                    <Pressable style={styles.stepBtn} onPress={() => addWeek(blockItem.id)}><Text style={styles.stepBtnText}>+</Text></Pressable>
                  </View>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>Block starts</Text>
                  <View style={styles.stepRow}>
                    <Pressable style={styles.stepBtn} hitSlop={6} onPress={() => shiftBlockStart(blockItem.id, -7)}><Text style={styles.stepBtnText}>‹‹</Text></Pressable>
                    <Pressable style={styles.stepBtn} hitSlop={6} onPress={() => shiftBlockStart(blockItem.id, -1)}><Text style={styles.stepBtnText}>‹</Text></Pressable>
                    <Text style={styles.stepDateVal}>{friendlyDateLabel(blockItem.start_date || blockItem.weeks?.[0]?.start_date)}</Text>
                    <Pressable style={styles.stepBtn} hitSlop={6} onPress={() => shiftBlockStart(blockItem.id, 1)}><Text style={styles.stepBtnText}>›</Text></Pressable>
                    <Pressable style={styles.stepBtn} hitSlop={6} onPress={() => shiftBlockStart(blockItem.id, 7)}><Text style={styles.stepBtnText}>››</Text></Pressable>
                  </View>
                </View>
                <Text style={styles.calendarMetaText}>Moving the start shifts the whole block — weeks and sessions move with it.</Text>
                <Pressable style={styles.primaryBtn} onPress={() => selectBlockAndOpen(blockItem.id)}><Text style={styles.primaryBtnText}>⚡ Plan sessions &amp; build</Text></Pressable>
                <View style={styles.twoCol}>
                  <Pressable style={styles.ghostBtn} onPress={() => selectBlockById(blockItem.id)}><Text style={styles.ghostBtnText}>{isCurrent ? 'Current block' : 'Set current'}</Text></Pressable>
                  {confirmDeleteBlockId === blockItem.id ? (
                    <Pressable style={[styles.ghostBtn, styles.dangerBtn]} onPress={() => deleteBlockById(blockItem.id)}><Text style={[styles.ghostBtnText, styles.dangerText]}>Confirm delete</Text></Pressable>
                  ) : (
                    <Pressable style={styles.ghostBtn} onPress={() => setConfirmDeleteBlockId(blockItem.id)}><Text style={[styles.ghostBtnText, styles.dangerText]}>Delete</Text></Pressable>
                  )}
                </View>
              </View>
            ) : (
              !isCurrent ? <Pressable onPress={() => selectBlockById(blockItem.id)}><Text style={styles.textLink}>Set as current</Text></Pressable> : null
            )}
          </View>
        );
      })}

      {adding ? (
        <View style={styles.builderCard}>
          <Input label="Block name (e.g. Power, Accumulation)" value={newBlock.name} onChangeText={(value) => setNewBlock((current) => ({ ...current, name: value }))} />
          <Input label="Length in weeks" value={String(newBlock.weeks)} onChangeText={(value) => setNewBlock((current) => ({ ...current, weeks: value.replace(/[^0-9]/g, '') }))} />
          <View style={styles.twoCol}>
            <Pressable style={styles.ghostBtn} onPress={() => setAdding(false)}><Text style={styles.ghostBtnText}>Cancel</Text></Pressable>
            <Pressable style={[styles.primaryBtn, styles.flex]} onPress={addBlock}><Text style={styles.primaryBtnText}>Add block</Text></Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.adds} onPress={() => setAdding(true)}><Text style={styles.addsText}>+ Add block</Text></Pressable>
      )}
    </View>
  );
}

function EditBlockCalendarScreen({
  data,
  setData,
  selectedDate,
  setSelectedDate,
  setSelectedPlannedSessionId,
  setPlannedSessionReturnScreen,
  openSessionAnalysis,
  setScreen,
}) {
  const [newSession, setNewSession] = useState({ session_name: '', focus: '', duration: '', date: selectedDate || isoDate() });
  const [templateWeekday, setTemplateWeekday] = useState('1');
  const [repeatCount, setRepeatCount] = useState('3');
  const [repeatProgression, setRepeatProgression] = useState('flat');
  const [overloadDim, setOverloadDim] = useState('volume');
  const [templateOpen, setTemplateOpen] = useState(false);
  const programme = data.programme;
  const macro = currentMacro(programme);
  const block = currentBlock(programme);
  const week = currentWeek(programme);
  const sessions = currentPlannedSessions(programme);
  const sessionsForSelectedDate = sessions.filter((session) => session.date === selectedDate);
  const weekSessions = [...sessions].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const editDays = weekDayLabels(visibleWeekStart(week, selectedDate));

  useEffect(() => {
    setNewSession((current) => ({ ...current, date: selectedDate }));
  }, [selectedDate]);

  function commitProgramme(updater) {
    setData((current) => {
      const nextProgramme = JSON.parse(JSON.stringify(current.programme));
      updater(nextProgramme);
      return { ...current, programme: nextProgramme };
    });
  }

  function resolveBlockRange(targetBlock) {
    const weekStarts = (targetBlock?.weeks || []).map((item) => item.start_date).filter(Boolean).sort();
    const weekEnds = (targetBlock?.weeks || []).map((item) => item.end_date).filter(Boolean).sort();
    const start = targetBlock?.start_date || weekStarts[0] || isoDate();
    const endCandidate = targetBlock?.end_date || weekEnds[weekEnds.length - 1] || addDays(start, 27);
    const end = isDateRangeValid(start, endCandidate) ? endCandidate : start;
    return { start, end };
  }

  function weekForDate(targetBlock, dateValue) {
    const stamp = new Date(`${dateValue}T00:00:00`).getTime();
    return (targetBlock?.weeks || []).find((item) => {
      const start = item.start_date || dateValue;
      const end = item.end_date || addDays(start, 6);
      const startStamp = new Date(`${start}T00:00:00`).getTime();
      const endStamp = new Date(`${end}T23:59:59`).getTime();
      return stamp >= startStamp && stamp <= endStamp;
    });
  }

  function ensureWeekForDate(targetBlock, dateValue) {
    let targetWeek = weekForDate(targetBlock, dateValue);
    if (targetWeek) return targetWeek;
    const start = startOfWeekIso(dateValue);
    targetWeek = {
      id: createId('week'),
      week_name: '',
      start_date: start,
      end_date: addDays(start, 6),
      sessions: [],
    };
    targetBlock.weeks = targetBlock.weeks || [];
    targetBlock.weeks.push(targetWeek);
    targetBlock.weeks.sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
    return targetWeek;
  }

  function sessionTemplateFromDraft(dateValue) {
    return {
      id: createId('planned'),
      date: dateValue,
      session_name: (newSession.session_name || '').trim(),
      focus: (newSession.focus || '').trim(),
      duration: (newSession.duration || '').trim(),
      completed: false,
      exercises: [],
    };
  }

  function moveWeek(direction) {
    const weeks = block?.weeks || [];
    const currentIndex = weeks.findIndex((item) => item.id === week?.id);
    const nextWeek = weeks[currentIndex + direction];
    if (!nextWeek) {
      const nextDate = addDays(selectedDate, direction * 7);
      setSelectedDate(nextDate);
      setNewSession((current) => ({ ...current, date: nextDate }));
      return;
    }
    commitProgramme((draft) => {
      draft.selected_week_id = nextWeek.id;
    });
    const nextDate = nextWeek.start_date || selectedDate;
    setSelectedDate(nextDate);
    setNewSession((current) => ({ ...current, date: nextDate }));
  }

  function addWeek() {
    let nextRange = { start: isoDate(), end: addDays(isoDate(), 6) };
    commitProgramme((draft) => {
      let selectedBlock = currentBlock(draft);
      if (!selectedBlock) {
        ensureProgrammeWeek(draft, nextRange.start);
        selectedBlock = currentBlock(draft);
      }
      nextRange = defaultNextWeekRange(selectedBlock);
      const weekId = createId('week');
      selectedBlock.weeks.push({
        id: weekId,
        week_name: '',
        start_date: nextRange.start,
        end_date: nextRange.end,
        sessions: [],
      });
      draft.selected_week_id = weekId;
    });
    setSelectedDate(nextRange.start);
    setNewSession((current) => ({ ...current, date: nextRange.start }));
  }

  function deleteSelectedWeek() {
    let nextDate = selectedDate;
    commitProgramme((draft) => {
      const selectedBlock = currentBlock(draft);
      if (!selectedBlock) return;
      if ((selectedBlock.weeks || []).length <= 1) return;
      const currentIndex = selectedBlock.weeks.findIndex((item) => item.id === draft.selected_week_id);
      selectedBlock.weeks = selectedBlock.weeks.filter((item) => item.id !== draft.selected_week_id);
      const nextWeek = selectedBlock.weeks[Math.max(0, currentIndex - 1)] || selectedBlock.weeks[0];
      draft.selected_week_id = nextWeek?.id;
      nextDate = nextWeek?.start_date || selectedDate;
    });
    setSelectedDate(nextDate);
    setNewSession((current) => ({ ...current, date: nextDate }));
  }

  function updatePlannedSession(sessionId, key, value) {
    commitProgramme((draft) => {
      const selectedWeek = currentWeek(draft);
      const session = selectedWeek?.sessions?.find((item) => item.id === sessionId);
      if (session) session[key] = value;
    });
  }

  // Move a session onto a date, dropping any other session already there (one session per day).
  function moveSessionToDate(sessionId, date) {
    commitProgramme((draft) => {
      (draft.macro_blocks || []).forEach((macroItem) => (macroItem.blocks || []).forEach((blockItem) => (blockItem.weeks || []).forEach((weekItem) => {
        weekItem.sessions = (weekItem.sessions || []).filter((session) => session.id === sessionId || session.date !== date);
      })));
      const target = findPlannedSession(draft, sessionId)?.session;
      if (target) target.date = date;
    });
  }

  function addPlannedSession() {
    const dateValue = (selectedDate || '').trim();
    if (!isValidDateText(dateValue)) {
      Alert.alert('Invalid date', 'Use a valid calendar date.');
      return;
    }
    if (!(newSession.session_name || '').trim()) {
      Alert.alert('Session name required', 'Name the session before adding it.');
      return;
    }
    let createdId;
    commitProgramme((draft) => {
      let targetBlock = currentBlock(draft);
      if (!targetBlock) {
        ensureProgrammeWeek(draft, dateValue);
        targetBlock = currentBlock(draft);
      }
      if (!targetBlock) return;
      const targetWeek = ensureWeekForDate(targetBlock, dateValue);
      const nextSession = sessionTemplateFromDraft(dateValue);
      createdId = nextSession.id;
      placeSessionInWeek(targetWeek, nextSession);
    });
    setNewSession({ session_name: '', focus: '', duration: '', date: selectedDate });
    if (!createdId) return;
    setSelectedPlannedSessionId(createdId);
    setPlannedSessionReturnScreen('editBlockCalendar');
    setScreen('editPlannedSession');
  }

  function applyTemplateToWeekday() {
    const sessionName = (newSession.session_name || '').trim();
    if (!sessionName) {
      Alert.alert('Session name required', 'Name the session template before applying it.');
      return;
    }
    let created = 0;
    let nextSelectedWeekId = null;
    commitProgramme((draft) => {
      let targetBlock = currentBlock(draft);
      if (!targetBlock) {
        ensureProgrammeWeek(draft, selectedDate || isoDate());
        targetBlock = currentBlock(draft);
      }
      if (!targetBlock) return;
      const bounds = resolveBlockRange(targetBlock);
      const weekday = Number(templateWeekday);
      for (let date = bounds.start; date <= bounds.end; date = addDays(date, 1)) {
        const jsWeekday = new Date(`${date}T00:00:00`).getDay();
        const mondayFirstWeekday = jsWeekday === 0 ? 7 : jsWeekday;
        if (mondayFirstWeekday !== weekday) continue;
        const targetWeek = ensureWeekForDate(targetBlock, date);
        // One session per day: replace whatever is on that date.
        placeSessionInWeek(targetWeek, sessionTemplateFromDraft(date));
        if (!nextSelectedWeekId) nextSelectedWeekId = targetWeek.id;
        created += 1;
      }
      if (nextSelectedWeekId) draft.selected_week_id = nextSelectedWeekId;
    });
    Alert.alert('Template applied', `${created} session${created === 1 ? '' : 's'} set.`);
  }

  function applyTemplateToSpecificDate() {
    if (!(newSession.session_name || '').trim()) {
      Alert.alert('Session name required', 'Name the session before applying to a specific date.');
      return;
    }
    addPlannedSession();
  }

  function copySession(session) {
    commitProgramme((draft) => {
      draft.copied_session = { ...session, id: 'copied_session', completed: false };
    });
  }

  function pasteSession() {
    if (!programme.copied_session) return;
    commitProgramme((draft) => {
      placeSessionInWeek(ensureProgrammeWeek(draft, selectedDate), {
        ...draft.copied_session,
        id: createId('planned'),
        date: selectedDate,
        completed: false,
      });
    });
  }

  // Repeat the selected week across the rest of the block with optional progressive overload.
  // Fills the block's existing following weeks (replacing their sessions); only adds new weeks
  // if the block doesn't have enough. One session per day — never stacks duplicates.
  function repeatWeekWithProgression() {
    const count = Number(repeatCount) || 0;
    if (count < 1) return;
    commitProgramme((draft) => {
      const selectedBlock = currentBlock(draft);
      if (!selectedBlock) return;
      const weeks = selectedBlock.weeks || [];
      weeks.sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
      // Prefer the week containing the selected day; fall back to the selected/first week.
      let sourceIndex = weeks.findIndex((item) => {
        const start = item.start_date;
        const end = item.end_date || (start ? addDays(start, 6) : null);
        return start && end && selectedDate >= start && selectedDate <= end;
      });
      if (sourceIndex < 0) sourceIndex = weeks.findIndex((item) => item.id === draft.selected_week_id);
      if (sourceIndex < 0) sourceIndex = 0;
      const source = weeks[sourceIndex];
      if (!source) return;
      const sourceStart = source.start_date || startOfWeekIso(selectedDate);
      let lastEnd = source.end_date || addDays(sourceStart, 6);
      for (let i = 1; i <= count; i += 1) {
        let target = weeks[sourceIndex + i];
        if (!target) {
          const start = addDays(lastEnd, 1);
          target = { id: createId('week'), week_name: '', start_date: start, end_date: addDays(start, 6), sessions: [] };
          weeks.push(target);
        }
        const targetStart = target.start_date || addDays(lastEnd, 1);
        lastEnd = target.end_date || addDays(targetStart, 6);
        const factor = progressionFactor(repeatProgression, i, count);
        // Replace the target week's sessions with overloaded copies of the source week.
        target.sessions = (source.sessions || []).map((session) => ({
          ...session,
          id: createId('planned'),
          date: addDays(targetStart, dayOffset(session.date, sourceStart)),
          completed: false,
          exercises: (session.exercises || []).map((exercise) => ({ ...applyOverload(exercise, factor, overloadDim), id: createId('planned_exercise') })),
        }));
      }
      if (!selectedBlock.end_date || lastEnd > selectedBlock.end_date) selectedBlock.end_date = lastEnd;
      weeks.sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
    });
  }

  function insertTemplate(template) {
    setTemplateOpen(false);
    commitProgramme((draft) => {
      // Custom templates carry full exercises; curated ones carry library item refs.
      const exercises = Array.isArray(template.exercises)
        ? template.exercises.map((exercise) => ({ ...exercise, id: createId('planned_exercise') }))
        : (template.items || []).map((item) => ({ ...templateItemToExercise(item), id: createId('planned_exercise') }));
      placeSessionInWeek(ensureProgrammeWeek(draft, selectedDate), {
        id: createId('planned'),
        date: selectedDate,
        session_name: template.name,
        focus: template.focus || '',
        duration: '',
        completed: false,
        exercises,
      });
    });
  }

  function saveSessionAsTemplate(session) {
    commitProgramme((draft) => {
      draft.session_templates = draft.session_templates || [];
      draft.session_templates.push({
        id: createId('tmpl'),
        name: session.session_name || 'Custom template',
        focus: session.focus || '',
        custom: true,
        exercises: (session.exercises || []).map((exercise) => ({ ...exercise })),
      });
    });
  }

  function deleteTemplate(templateId) {
    commitProgramme((draft) => {
      draft.session_templates = (draft.session_templates || []).filter((template) => template.id !== templateId);
    });
  }

  function deletePlannedSession(sessionId) {
    commitProgramme((draft) => {
      const selectedWeek = currentWeek(draft);
      if (!selectedWeek) return;
      selectedWeek.sessions = selectedWeek.sessions.filter((session) => session.id !== sessionId);
    });
  }

  function selectEditDate(date) {
    setSelectedDate(date);
    setNewSession((current) => ({ ...current, date }));
  }

  function openPlannedSession(session) {
    setSelectedDate(session.date || selectedDate);
    setSelectedPlannedSessionId(session.id);
    setPlannedSessionReturnScreen('editBlockCalendar');
    setScreen('editPlannedSession');
  }

  return (
    <View style={styles.screen}>
      <Header title={block?.block_name || 'Build block'} onBack={() => setScreen('calendar')} />
      <View style={styles.rowBetween}>
        <Text style={styles.label}>{[macro?.macro_block_name, block?.block_name].filter(Boolean).join(' / ') || 'No block named yet'}</Text>
        <View style={styles.inlineActions}>
          <Pressable style={styles.smallPill} onPress={addWeek}><Text style={styles.smallPillText}>+ Week</Text></Pressable>
          <Pressable style={styles.smallPill} onPress={deleteSelectedWeek}><Text style={styles.smallPillText}>Delete Week</Text></Pressable>
        </View>
      </View>
      <View style={styles.weekNav}>
        <Pressable style={styles.weekArrow} hitSlop={10} onPress={() => moveWeek(-1)}><Text style={styles.chevron}>‹</Text></Pressable>
        <Text style={styles.sectionTitle}>{week?.week_name || 'Today'}</Text>
        <Pressable style={styles.weekArrow} hitSlop={10} onPress={() => moveWeek(1)}><Text style={styles.chevron}>›</Text></Pressable>
      </View>
      <View style={styles.weekGrid}>
        {editDays.map((day) => {
          const active = day.iso === selectedDate;
          const hasSession = sessions.some((session) => session.date === day.iso);
          return (
            <Pressable key={day.iso} style={[styles.dayCell, active && styles.activeDay]} onPress={() => selectEditDate(day.iso)}>
              <Text style={[styles.dayText, active && styles.activeDayText]}>{day.label}</Text>
              <Text style={[styles.dayText, active && styles.activeDayText]}>{day.day}</Text>
              <View style={[styles.dayDot, hasSession && styles.dayDotFilled]} />
            </Pressable>
          );
        })}
      </View>
      <LoadShapePreview block={block} currentWeekId={week?.id} />
      <View style={styles.calendarPanel}>
        <Text style={styles.sectionTitle}>Build faster</Text>
        <ActionButton title="+ Use a template" tone="outline" onPress={() => setTemplateOpen(true)} />
        <Text style={styles.label}>Repeat this week</Text>
        <View style={styles.chipWrap}>
          {['1', '2', '3', '4', '5'].map((count) => (
            <Pressable key={count} style={[styles.chip, repeatCount === count && styles.chipActive]} onPress={() => setRepeatCount(count)}>
              <Text style={[styles.chipText, repeatCount === count && styles.chipTextActive]}>{count}×</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Progressive overload</Text>
        <View style={styles.chipWrap}>
          {PROGRESSION_OPTIONS.map(([id, label]) => (
            <Pressable key={id} style={[styles.chip, repeatProgression === id && styles.chipActive]} onPress={() => setRepeatProgression(id)}>
              <Text style={[styles.chipText, repeatProgression === id && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {repeatProgression !== 'flat' ? (
          <>
            <Text style={styles.label}>Overload what?</Text>
            <View style={styles.chipWrap}>
              {OVERLOAD_OPTIONS.map(([id, label]) => (
                <Pressable key={id} style={[styles.chip, overloadDim === id && styles.chipActive]} onPress={() => setOverloadDim(id)}>
                  <Text style={[styles.chipText, overloadDim === id && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.calendarMetaText}>Each new week scales {overloadDim === 'both' ? 'volume and intensity' : overloadDim} up automatically.</Text>
          </>
        ) : null}
        <ActionButton title={`Repeat week ${repeatCount}×`} tone="black" onPress={repeatWeekWithProgression} />
      </View>
      <TemplatePicker visible={templateOpen} onClose={() => setTemplateOpen(false)} onPick={insertTemplate} custom={programme.session_templates || []} onDelete={deleteTemplate} />
      <View style={styles.calendarPanel}>
        <Text style={styles.sectionTitle}>This Week</Text>
        {weekSessions.length === 0 ? <Text style={styles.muted}>No sessions in this week yet.</Text> : null}
        {weekSessions.map((session) => (
          <Pressable key={session.id} style={styles.weekSessionRow} onPress={() => openPlannedSession(session)}>
            <View style={styles.weekSessionDate}>
              <Text style={styles.weekSessionDay}>{new Date(`${session.date}T00:00:00`).toLocaleDateString([], { weekday: 'short' })}</Text>
              <Text style={styles.weekSessionNumber}>{new Date(`${session.date}T00:00:00`).getDate()}</Text>
            </View>
            <View style={styles.weekSessionMain}>
              <Text style={styles.cardTitle}>{session.session_name}</Text>
              <Text style={styles.muted}>{session.focus} / {session.duration} / {(session.exercises || []).length} exercises</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Sessions on {selectedDate}</Text>
      {sessionsForSelectedDate.length === 0 ? <Text style={styles.muted}>No sessions on this date.</Text> : null}
      {sessionsForSelectedDate.map((session) => (
        <View key={session.id} style={styles.programmeEditRow}>
          <Pressable
            style={styles.programmeEditMain}
            onPress={() => openPlannedSession(session)}
          >
            <Text style={styles.cardTitle}>{session.session_name}</Text>
            <Text style={styles.muted}>{session.date} / {session.focus} / {session.duration}</Text>
          </Pressable>
          <View style={styles.programmeActions}>
            <Pressable style={styles.miniButton} onPress={() => openSessionAnalysis(session.id, session.date || selectedDate)}><Text style={styles.miniButtonText}>Analyse Session</Text></Pressable>
            <Pressable style={styles.miniButton} onPress={() => moveSessionToDate(session.id, selectedDate)}><Text style={styles.miniButtonText}>To Day</Text></Pressable>
            <Pressable style={styles.miniButton} onPress={() => copySession(session)}><Text style={styles.miniButtonText}>Copy</Text></Pressable>
            <Pressable style={styles.miniButton} onPress={() => saveSessionAsTemplate(session)}><Text style={styles.miniButtonText}>Save tmpl</Text></Pressable>
            <Pressable style={styles.miniButton} onPress={() => deletePlannedSession(session.id)}><Text style={styles.miniButtonText}>Del</Text></Pressable>
          </View>
        </View>
      ))}
      <View style={styles.calendarPanel}>
        <Text style={styles.sectionTitle}>Session Template</Text>
        <Input label="Session Name" value={newSession.session_name} onChangeText={(value) => setNewSession((current) => ({ ...current, session_name: value }))} />
        <View style={styles.twoCol}>
          <Input label="Date" value={selectedDate} onChangeText={() => {}} editable={false} />
          <Input label="Duration" value={newSession.duration} onChangeText={(value) => setNewSession((current) => ({ ...current, duration: value }))} />
        </View>
        <View style={styles.twoCol}>
          <Input label="Focus" value={newSession.focus} onChangeText={(value) => setNewSession((current) => ({ ...current, focus: value }))} />
        </View>
        <Text style={styles.label}>Apply to weekday in block range</Text>
        <View style={styles.chipWrap}>
          {[
            ['1', 'Mon'],
            ['2', 'Tue'],
            ['3', 'Wed'],
            ['4', 'Thu'],
            ['5', 'Fri'],
            ['6', 'Sat'],
            ['7', 'Sun'],
          ].map(([id, label]) => (
            <Pressable key={id} style={[styles.chip, templateWeekday === id && styles.chipActive]} onPress={() => setTemplateWeekday(id)}>
              <Text style={[styles.chipText, templateWeekday === id && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.calendarMetaText}>
          Applying across: {dateRangeSummary(block?.start_date, block?.end_date)}
        </Text>
        <View style={styles.twoCol}>
          <ActionButton title="Apply To Weekday" tone="black" onPress={applyTemplateToWeekday} />
          <ActionButton title="Add On Date" tone="outline" onPress={applyTemplateToSpecificDate} />
        </View>
        <View style={styles.twoCol}>
          <ActionButton title="Use Selected Day" tone="outline" onPress={() => setNewSession((current) => ({ ...current, date: selectedDate }))} />
          <ActionButton title={programme.copied_session ? 'Paste Copied' : 'Nothing Copied'} tone="outline" onPress={pasteSession} />
        </View>
      </View>
    </View>
  );
}

function EditPlannedSessionScreen({ data, setData, sessionId, returnScreen = 'editBlockCalendar', setScreen }) {
  const [draftExercise, setDraftExercise] = useState(emptyExercise);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const found = findPlannedSession(data.programme, sessionId);
  const session = found?.session;

  function commitProgramme(updater) {
    setData((current) => {
      const nextProgramme = JSON.parse(JSON.stringify(current.programme));
      updater(nextProgramme);
      return { ...current, programme: nextProgramme };
    });
  }

  function updateSessionField(key, value) {
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (target) target[key] = value;
    });
  }

  function updateExercise(exerciseId, key, value) {
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (!target) return;
      target.exercises = (target.exercises || []).map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, [key]: value } : exercise
      );
    });
  }

  function deleteExercise(exerciseId) {
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (!target) return;
      target.exercises = numberExercises((target.exercises || []).filter((exercise) => exercise.id !== exerciseId));
    });
  }

  function moveExercise(exerciseId, direction) {
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (!target) return;
      const list = target.exercises || [];
      const index = list.findIndex((exercise) => exercise.id === exerciseId);
      const swapWith = index + direction;
      if (index < 0 || swapWith < 0 || swapWith >= list.length) return;
      [list[index], list[swapWith]] = [list[swapWith], list[index]];
      target.exercises = numberExercises(list);
    });
  }

  function addPlannedExercise() {
    const exercise = {
      ...draftExercise,
      id: createId('planned_exercise'),
      sets: toNumber(draftExercise.sets),
      contacts: toNumber(draftExercise.contacts),
      reps: toNumber(draftExercise.reps),
      distance: toNumber(draftExercise.distance),
      duration_minutes: toNumber(draftExercise.duration_minutes),
      intensity_value: toNumber(draftExercise.intensity_value),
      intent_percent: toNumber(draftExercise.intent_percent),
    };
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (!target) return;
      target.exercises = [...(target.exercises || []), { ...exercise, order: (target.exercises || []).length + 1 }];
    });
    setDraftExercise({ ...emptyExercise, movement_type: draftExercise.movement_type });
    setAdding(false);
  }

  function updatePlannedAttempt(exerciseId, attemptId, key, value) {
    commitProgramme((draft) => {
      const target = findPlannedSession(draft, sessionId)?.session;
      if (!target) return;
      target.exercises = (target.exercises || []).map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        const rows = plannedAttemptRows(exercise);
        const nextRows = rows.map((attempt) => {
          if (attempt.id !== attemptId) return attempt;
          if (key === 'metric_type') {
            return { ...attempt, metric_type: value, metrics: emptyActualMetrics(value, attempt.metrics || {}) };
          }
          const nextMetrics = { ...(attempt.metrics || {}), [key]: value };
          if (key === 'ft') nextMetrics.ft_unit = 'milliseconds';
          if (key === 'gct') nextMetrics.gct_unit = 'milliseconds';
          return { ...attempt, metrics: emptyActualMetrics(attempt.metric_type, nextMetrics) };
        });
        const plannedKeys = new Set(nextRows.map(actualMetricRowKey));
        const preservedRows = (exercise.actual_metrics || []).filter((attempt) => !plannedKeys.has(actualMetricRowKey(attempt)));
        return { ...exercise, actual_metrics: [...nextRows, ...preservedRows] };
      });
    });
  }

  if (!session) {
    return (
      <View style={styles.screen}>
        <Header title="Session" onBack={() => setScreen(returnScreen)} />
        <Text style={styles.bodyText}>Session not found.</Text>
      </View>
    );
  }

  const updateDraft = (key, value) => setDraftExercise((current) => ({ ...current, [key]: value }));

  const exercises = session.exercises || [];
  const sessionMeta = [session.date, session.focus, session.duration].filter(Boolean).join(' · ');

  return (
    <View style={styles.screen}>
      <View style={styles.checkinTop}>
        <Pressable style={styles.iconBack} onPress={() => setScreen(returnScreen)}><Text style={styles.iconBackText}>‹</Text></Pressable>
        <View style={styles.flex}><Input label="Session name" value={session.session_name} onChangeText={(value) => updateSessionField('session_name', value)} /></View>
      </View>
      {sessionMeta ? <Text style={styles.calendarMetaText}>{sessionMeta}</Text> : null}

      {exercises.length === 0 ? (
        <Text style={styles.muted}>No exercises yet — add your first below.</Text>
      ) : null}
      {exercises.map((exercise, index) => {
        const open = editingId === exercise.id;
        return (
          <View key={exercise.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardTitle, styles.flex]}>{index + 1}. {exercise.exercise_name || 'Exercise'}</Text>
              <View style={styles.reorderControls}>
                <Pressable style={[styles.reorderBtn, index === 0 && styles.reorderBtnDisabled]} disabled={index === 0} onPress={() => moveExercise(exercise.id, -1)}><Text style={styles.reorderBtnText}>↑</Text></Pressable>
                <Pressable style={[styles.reorderBtn, index === exercises.length - 1 && styles.reorderBtnDisabled]} disabled={index === exercises.length - 1} onPress={() => moveExercise(exercise.id, 1)}><Text style={styles.reorderBtnText}>↓</Text></Pressable>
                <Pressable onPress={() => setEditingId(open ? null : exercise.id)}><Text style={styles.textLink}>{open ? 'Done' : 'Edit'}</Text></Pressable>
              </View>
            </View>
            <Text style={styles.calendarMetaText}>{exercise.movement_type.replace('_', ' ')} · {exercisePrescription(exercise)}</Text>
            {open ? (
              <View style={styles.painExtra}>
                <ExerciseDraftEditor draft={exercise} update={(key, value) => updateExercise(exercise.id, key, value)} />
                <Pressable style={styles.deleteButton} onPress={() => deleteExercise(exercise.id)}><Text style={styles.deleteButtonText}>Delete exercise</Text></Pressable>
              </View>
            ) : null}
            <CalendarExerciseMetrics
              exercise={exercise}
              onChangeAttempt={(attemptId, key, value) => updatePlannedAttempt(exercise.id, attemptId, key, value)}
            />
          </View>
        );
      })}

      {adding ? (
        <View style={styles.builderCard}>
          <Text style={styles.sectionTitle}>Add exercise</Text>
          <ExerciseDraftEditor draft={draftExercise} update={updateDraft} />
          <View style={styles.twoCol}>
            <Pressable style={styles.ghostBtn} onPress={() => setAdding(false)}><Text style={styles.ghostBtnText}>Cancel</Text></Pressable>
            <Pressable style={[styles.primaryBtn, styles.flex]} onPress={addPlannedExercise}><Text style={styles.primaryBtnText}>Add</Text></Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.adds} onPress={() => setAdding(true)}><Text style={styles.addsText}>+ Add exercise</Text></Pressable>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Session notes</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          multiline
          value={session.notes || ''}
          onChangeText={(value) => updateSessionField('notes', value)}
          placeholder="Notes for this session"
        />
      </View>
    </View>
  );
}

function CalendarExerciseMetrics({ exercise, onChangeAttempt }) {
  const [expanded, setExpanded] = useState(true);
  const rows = plannedAttemptRows(exercise);
  const sets = [...new Set(rows.map((row) => row.set_number))];
  const attemptLabel = Math.round(toNumber(exercise.contacts, 0)) > 0 ? 'Contact' : 'Rep';
  const loggedCount = rows.filter(attemptHasLoggedMetrics).length;

  if (!rows.length) {
    return <Text style={styles.muted}>No attempts to log yet.</Text>;
  }

  return (
    <View style={styles.setMetricsList}>
      <Pressable style={styles.chevronRow} onPress={() => setExpanded((value) => !value)}>
        <View>
          <Text style={styles.chevronText}>{expanded ? 'Hide metrics' : 'Log metrics'}</Text>
          <Text style={styles.centerLinkText}>{loggedCount}/{rows.length} {attemptLabel.toLowerCase()}s logged</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
      </Pressable>
      {expanded ? (
        <>
          {sets.map((setNumber) => {
            const setRows = rows.filter((row) => row.set_number === setNumber);
            if (!setRows.length) return null;
            return (
              <View key={`${exercise.id}-set-${setNumber}`} style={styles.performanceSetCard}>
                <Text style={styles.setMetricTitle}>Set {setNumber}</Text>
                {setRows.map((attempt) => (
                  <View key={attempt.id} style={styles.attemptCard}>
                    <Text style={styles.cardTitle}>{attemptLabel} {attempt.rep_number}</Text>
                    <ChipWrap
                      options={performanceMetricOptions}
                      value={attempt.metric_type}
                      onChange={(value) => onChangeAttempt(attempt.id, 'metric_type', value)}
                    />
                    <MetricInputs
                      metricType={attempt.metric_type}
                      metrics={attempt.metrics || {}}
                      onChangeMetric={(key, value) => onChangeAttempt(attempt.id, key, value)}
                    />
                  </View>
                ))}
              </View>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

function SessionAnalysisScreen({ data, analysis, sessionId, setScreen }) {
  const found = findPlannedSession(data.programme, sessionId);
  const session = found?.session;

  if (!session) {
    return (
      <View style={styles.screen}>
        <Header title="Session Analysis" onBack={() => setScreen('calendar')} />
        <Text style={styles.bodyText}>Session not found.</Text>
      </View>
    );
  }

  const result = buildSessionAnalysis(session, analysis);
  const metricKeys = ['rsi', 'height_or_distance', 'gct', 'ft', 'sprint_time', 'distance', 'weight', 'bar_velocity'];
  const sessionMetricRows = metricKeys.map((key) => [key, result.sessionMetrics[key]]).filter(([, summary]) => summary);
  const visibleSessionMetrics = sessionMetricRows.slice(0, 4);
  const bestSessionEntry = sessionMetricRows.find(([, summary]) => summary?.best_attempt) || sessionMetricRows[0];
  const bestSessionMetric = bestSessionEntry?.[1] || null;
  const bestSessionMetricKey = bestSessionEntry?.[0] || null;
  const adaptation = analysis.adaptationInsight || {};
  const adaptationCopy = athleteAdaptationCopy(adaptation);
  const historicalSessions = allPlannedSessions(data.programme)
    .filter((item) => item.id !== session.id && (item.date || '') < (session.date || isoDate()))
    .filter((item) => (item.exercises || []).some((exercise) => (exercise.actual_metrics || []).length));
  const historicalAttempts = historicalSessions.flatMap((item) =>
    (item.exercises || []).flatMap((exercise) =>
      (exercise.actual_metrics || []).map((attempt) => ({ ...attempt, exercise_name: exercise.exercise_name }))
    )
  );
  const historicalComparisons = metricKeys
    .map((key) => {
      const today = result.sessionMetrics[key];
      const historical = summariseMetricAttempts(historicalAttempts, key);
      if (!today || !historical) return null;
      const better = bestModeForMetric(key) === 'min' ? today.peak <= historical.peak : today.peak >= historical.peak;
      return { key, today: today.peak, historical: historical.peak, better };
    })
    .filter(Boolean)
    .slice(0, 3);
  const chartSeries = ['rsi', 'gct', 'ft'].map((key) => ({
    key,
    label: formatMetricName(key),
    color: dashboardMetricConfig(key).color,
    points: result.attempts
      .map((attempt, index) => ({ index, label: `A${index + 1}`, value: actualMetricValue(attempt, key) }))
      .filter((point) => Number.isFinite(point.value)),
  }));

  return (
    <View style={styles.screen}>
      <Header title="Performance Review" subtitle={session.session_name || session.date} onBack={() => setScreen('calendar')} />
      <View style={styles.priorityCard}>
        <Text style={styles.label}>What this session means</Text>
        <Text style={styles.priorityTitle}>{adaptationCopy.headline}</Text>
        <Text style={styles.bodyText}>{adaptationCopy.body}</Text>
        <Text style={styles.muted}>{adaptation.loadMeaning?.replace(/^For training load, this means:\s*/i, '') || 'Compared with your recent performance, pain, recovery, load stress, and load tolerance.'}</Text>
        <Text style={styles.evidenceBadge}>{adaptation.confidence || adaptation.status || 'Collecting Evidence'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Best outputs today</Text>
        {visibleSessionMetrics.length === 0 ? <Text style={styles.muted}>No performance metrics logged yet.</Text> : null}
        {visibleSessionMetrics.map(([key, summary]) => (
          <InsightLine
            key={`peak-${key}`}
            label={formatMetricName(key)}
            value={`Best ${displayMetricValue(key, summary.peak, 2)} / avg ${displayMetricValue(key, summary.average, 2)}`}
          />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Best attempt</Text>
        {bestSessionMetric?.best_attempt ? (
          <Text style={styles.bodyText}>
            Set {bestSessionMetric.best_attempt.set_number}, rep {bestSessionMetric.best_attempt.rep_number}
            {' '}({bestSessionMetric.best_attempt.exercise_name || 'exercise'}) was your best {formatMetricName(bestSessionMetricKey).toLowerCase()} attempt.
          </Text>
        ) : (
          <Text style={styles.muted}>Log rep metrics to identify the best attempt.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Attempts</Text>
        <AttemptMetricChart series={chartSeries} />
      </View>

      {historicalComparisons.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Compared with previous sessions</Text>
          {historicalComparisons.map((comparison) => (
            <InsightLine
              key={`history-${comparison.key}`}
              label={formatMetricName(comparison.key)}
              value={`${displayMetricValue(comparison.key, comparison.today, 2)} today / ${displayMetricValue(comparison.key, comparison.historical, 2)} previous best (${comparison.better ? 'matched or better' : 'below'})`}
            />
          ))}
        </View>
      ) : null}

      {(result.exerciseSummaries || []).filter(({ metrics }) => Object.keys(metrics || {}).length).slice(0, 3).map(({ exercise, metrics, best_attempt }) => (
        <View key={`analysis-${exercise.id}`} style={styles.card}>
          <Text style={styles.label}>Exercise</Text>
          <Text style={styles.sectionTitle}>{exercise.exercise_name || 'Unnamed exercise'}</Text>
          {Object.entries(metrics).slice(0, 3).map(([key, summary]) => (
            <View key={`${exercise.id}-${key}`} style={styles.analysisSubcard}>
              <Text style={styles.cardTitle}>{formatMetricName(key)}</Text>
              <Text style={styles.muted}>Best {displayMetricValue(key, summary.peak, 2)} / avg {displayMetricValue(key, summary.average, 2)}</Text>
              <Text style={styles.smallCopy}>{summary.n} attempt{summary.n === 1 ? '' : 's'} logged</Text>
            </View>
          ))}
          {best_attempt ? <Text style={styles.smallCopy}>Best attempt: set {best_attempt.set_number}, rep {best_attempt.rep_number}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function TrendLine({ values = [], color = '#1F8A3E' }) {
  const vals = values.filter((v) => Number.isFinite(v));
  if (vals.length < 2) return null;
  const W = 300;
  const H = 96;
  const pad = 10;
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const rng = (mx - mn) || 1;
  const x = (i) => pad + (i * (W - 2 * pad)) / (vals.length - 1);
  const y = (v) => H - pad - ((v - mn) / rng) * (H - 2 * pad);
  let d = `M${x(0)} ${y(vals[0])}`;
  for (let i = 1; i < vals.length; i += 1) d += ` L${x(i)} ${y(vals[i])}`;
  const area = `${d} L${x(vals.length - 1)} ${H} L${x(0)} ${H} Z`;
  return (
    <View style={{ height: H, marginTop: 12 }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={area} fill={color} opacity={0.1} />
        <Path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r="4.5" fill={color} />
      </Svg>
    </View>
  );
}

function shortState(state) {
  const v = String(state || '').toLowerCase();
  if (!v || v.includes('collect')) return '—';
  if (v.includes('improv') || v.includes('increas') || v.includes('rising')) return 'Rising';
  if (v.includes('declin') || v.includes('decreas') || v.includes('falling')) return 'Falling';
  if (v.includes('accumulat') || v.includes('worsen') || v.includes('spike')) return 'Rising';
  if (v.includes('recover') || v.includes('settl') || v.includes('easing') || v.includes('low load')) return 'Easing';
  return 'Steady';
}

function stateColor(state) {
  const v = String(state || '').toLowerCase();
  if (v.includes('improv') || v.includes('recover') || v.includes('settl')) return { color: '#1F8A3E' };
  if (v.includes('declin') || v.includes('accumulat') || v.includes('worsen') || v.includes('spike')) return { color: '#C2422B' };
  return { color: '#181A14' };
}

function fmtMetricVal(v) {
  if (!Number.isFinite(v)) return '';
  if (Math.abs(v) >= 100) return String(Math.round(v));
  if (Math.abs(v) >= 10) return v.toFixed(1).replace(/\.0$/, '');
  return v.toFixed(2).replace(/\.?0+$/, '');
}

const OUTPUT_KEYS = ['performance', 'height_or_distance', 'rsi', 'ft', 'sprint_time', 'bar_velocity', 'weight'];

function primaryOutputSeries(analysis) {
  let best = null;
  OUTPUT_KEYS.forEach((key) => {
    const pts = metricSeries(analysis, key).filter((point) => Number.isFinite(point.value));
    if (pts.length >= 2 && (!best || pts.length > best.pts.length)) best = { key, pts };
  });
  return best;
}

function InsightChart({ analysis }) {
  const best = primaryOutputSeries(analysis);
  if (!best) {
    return <Text style={styles.muted}>Log a couple of results and your performance trend will appear here.</Text>;
  }
  const perf = best.pts;
  const loadPts = metricSeries(analysis, 'load').filter((point) => Number.isFinite(point.value));
  const dates = [...new Set([...perf, ...loadPts].map((point) => point.date))].sort();
  const W = 300;
  const H = 152;
  const top = 12;
  const bottom = 24;
  const left = 32;
  const right = 10;
  const xi = (d) => (dates.length <= 1 ? left + (W - left - right) / 2 : left + dates.indexOf(d) * (W - left - right) / (dates.length - 1));
  const axis = (pts) => {
    const vals = pts.map((point) => point.value);
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const rng = (mx - mn) || 1;
    return { fn: (v) => (H - bottom) - ((v - mn) / rng) * ((H - bottom) - top), mn, mx };
  };
  const ps = axis(perf);
  const py = ps.fn;
  let perfLine = `M${xi(perf[0].date)} ${py(perf[0].value)}`;
  perf.slice(1).forEach((point) => { perfLine += ` L${xi(point.date)} ${py(point.value)}`; });
  const perfArea = `${perfLine} L${xi(perf[perf.length - 1].date)} ${H - bottom} L${xi(perf[0].date)} ${H - bottom} Z`;
  let loadArea = '';
  if (loadPts.length >= 2) {
    const ls = axis(loadPts);
    loadArea = `M${xi(loadPts[0].date)} ${ls.fn(loadPts[0].value)}`;
    loadPts.slice(1).forEach((point) => { loadArea += ` L${xi(point.date)} ${ls.fn(point.value)}`; });
    loadArea += ` L${xi(loadPts[loadPts.length - 1].date)} ${H - bottom} L${xi(loadPts[0].date)} ${H - bottom} Z`;
  }
  const last = perf[perf.length - 1];
  const lastX = xi(last.date);
  return (
    <View>
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#1F8A3E' }]} /><Text style={styles.legendText}>{formatMetricName(best.key)}</Text></View>
        {loadPts.length >= 2 ? <View style={styles.legendItem}><View style={[styles.legendBar, { backgroundColor: '#B6B3A6' }]} /><Text style={styles.legendText}>Training load</Text></View> : null}
      </View>
      <View style={{ height: H }}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Line x1={left} y1={top} x2={left} y2={H - bottom} stroke="#E2DFD3" strokeWidth="1" />
          <Line x1={left} y1={H - bottom} x2={W - right} y2={H - bottom} stroke="#E2DFD3" strokeWidth="1" />
          {loadArea ? <Path d={loadArea} fill="#9A9A8E" opacity={0.16} /> : null}
          <Path d={perfArea} fill="#1F8A3E" opacity={0.1} />
          <Path d={perfLine} fill="none" stroke="#1F8A3E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={lastX} cy={py(last.value)} r="4.5" fill="#1F8A3E" />
          <SvgText x={left - 5} y={top + 3} fill="#9A9A8E" fontSize="9" textAnchor="end">{fmtMetricVal(ps.mx)}</SvgText>
          <SvgText x={left - 5} y={H - bottom} fill="#9A9A8E" fontSize="9" textAnchor="end">{fmtMetricVal(ps.mn)}</SvgText>
          <SvgText x={left} y={H - 8} fill="#9A9A8E" fontSize="9" textAnchor="start">{dateShort(dates[0])}</SvgText>
          <SvgText x={W - right} y={H - 8} fill="#9A9A8E" fontSize="9" textAnchor="end">{dateShort(dates[dates.length - 1])}</SvgText>
          <SvgText x={lastX} y={py(last.value) - 8} fill="#1F8A3E" fontSize="11" fontWeight="bold" textAnchor={lastX > W - 40 ? 'end' : 'middle'}>{fmtMetricVal(last.value)}</SvgText>
        </Svg>
      </View>
    </View>
  );
}

// ---- Block read surface (PR7): one scannable card per read = label + plain sentence + one visual ----

function formatEvidenceLabel(key) {
  return String(key).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()).trim();
}

function ReadEvidence({ read }) {
  const evidence = read.evidence || {};
  const scalarItems = Object.entries(evidence).filter(([, value]) => value !== null && typeof value !== 'object');
  const shares = evidence.shares && typeof evidence.shares === 'object' ? evidence.shares : null;
  return (
    <View style={styles.evidenceBox}>
      {scalarItems.map(([key, value]) => (
        <View key={key} style={styles.readEvidenceRow}>
          <Text style={styles.evidenceKey}>{formatEvidenceLabel(key)}</Text>
          <Text style={styles.evidenceVal}>{typeof value === 'number' ? (Math.round(value * 100) / 100) : String(value)}</Text>
        </View>
      ))}
      {shares ? Object.entries(shares).map(([key, value]) => (
        <View key={`share-${key}`} style={styles.readEvidenceRow}>
          <Text style={styles.evidenceKey}>{formatEvidenceLabel(key)} share</Text>
          <Text style={styles.evidenceVal}>{Math.round((Number(value) || 0) * 100)}%</Text>
        </View>
      )) : null}
    </View>
  );
}

function ReadViz({ viz }) {
  if (!viz) return null;
  if (viz.type === 'quality_radar') return <QualityRadarCard viz={viz} />;
  if (viz.type === 'paired_bars') return <PairedBarsCard viz={viz} />;
  if (viz.type === 'dual_line') return <DualLineCard viz={viz} />;
  if (viz.type === 'pain_line') return <PainLineCard viz={viz} />;
  return null;
}

function ProgrammeReadCard({ read, headline }) {
  const [showEvidence, setShowEvidence] = useState(false);
  if (!read) return null;
  return (
    <View style={[styles.card, headline && styles.readCardHeadline]}>
      <View style={styles.rowBetween}>
        <Text style={styles.readCardLabel}>{read.title}</Text>
        {read.confidence ? <Text style={styles.readConfidence}>{read.confidence}</Text> : null}
      </View>
      <Text style={styles.readSentence}>{read.sentence}</Text>
      <ReadViz viz={read.viz} />
      <Pressable onPress={() => setShowEvidence((value) => !value)}>
        <Text style={styles.evlink}>{showEvidence ? 'Hide evidence' : 'See evidence →'}</Text>
      </Pressable>
      {showEvidence ? <ReadEvidence read={read} /> : null}
    </View>
  );
}

// HERO visual: programme FV coverage (filled) vs the deficit-derived target shape (dashed).
function QualityRadarCard({ viz }) {
  const axes = viz.axes || [];
  if (axes.length < 3) return null;
  const size = 264;
  const cx = 132;
  const cy = 120;
  const R = 78;
  const maxVal = Math.max(0.45, ...axes.flatMap((axis) => [axis.current || 0, axis.target || 0]));
  const pointAt = (index, value, radius = R) => {
    const angle = -Math.PI / 2 + (index / axes.length) * Math.PI * 2;
    const r = (Math.max(0, value) / maxVal) * radius;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  };
  const polygon = (key) => axes
    .map((axis, index) => pointAt(index, axis[key]))
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`)
    .join(' ') + ' Z';
  const ring = (scale) => axes
    .map((_, index) => {
      const angle = -Math.PI / 2 + (index / axes.length) * Math.PI * 2;
      return [cx + Math.cos(angle) * R * scale, cy + Math.sin(angle) * R * scale];
    })
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`)
    .join(' ') + ' Z';
  return (
    <View style={styles.reviewSvgFrame}>
      <Svg width="100%" height={246} viewBox={`0 0 ${size} 246`}>
        {[0.5, 1].map((scale) => <Path key={scale} d={ring(scale)} fill="none" stroke="#E3E3DE" strokeWidth="1" />)}
        {axes.map((axis, index) => {
          const angle = -Math.PI / 2 + (index / axes.length) * Math.PI * 2;
          const lx = cx + Math.cos(angle) * (R + 20);
          const ly = cy + Math.sin(angle) * (R + 16);
          return (
            <G key={axis.key}>
              <Line x1={cx} y1={cy} x2={cx + Math.cos(angle) * R} y2={cy + Math.sin(angle) * R} stroke="#E8E8E4" strokeWidth="1" />
              <SvgText x={lx} y={ly} fill="#5D5D58" fontSize="8.5" fontWeight="700" textAnchor="middle">{axis.label}</SvgText>
            </G>
          );
        })}
        <Path d={polygon('target')} fill="none" stroke="#B9A04A" strokeWidth="2" strokeDasharray="4 3" />
        <Path d={polygon('current')} fill="#2FA04433" stroke="#24883B" strokeWidth="2.5" strokeLinejoin="round" />
        {axes.map((axis, index) => {
          const [x, y] = pointAt(index, axis.current);
          return <Circle key={`pt-${axis.key}`} cx={x} cy={y} r="3" fill="#FFFFFF" stroke="#24883B" strokeWidth="2" />;
        })}
      </Svg>
      <View style={styles.radarLegend}>
        <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: '#24883B' }]} /><Text style={styles.legendText}>Your coverage</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: '#B9A04A' }]} /><Text style={styles.legendText}>Target shape</Text></View>
      </View>
    </View>
  );
}

function PairedBarsCard({ viz }) {
  const bars = (viz.bars || []).filter((bar) => (bar.best || 0) > 0 || (bar.flat || 0) > 0);
  if (!bars.length) return null;
  const max = Math.max(1, ...bars.flatMap((bar) => [bar.best || 0, bar.flat || 0]));
  return (
    <View style={styles.pairedWrap}>
      {bars.map((bar) => (
        <View key={bar.label} style={styles.pairedRow}>
          <Text style={styles.pairedLabel}>{bar.label}</Text>
          <View style={styles.pairedBars}>
            <View style={styles.pairedTrack}><View style={[styles.pairedFill, { width: `${Math.round(((bar.best || 0) / max) * 100)}%`, backgroundColor: '#1F8A3E' }]} /></View>
            <View style={styles.pairedTrack}><View style={[styles.pairedFill, { width: `${Math.round(((bar.flat || 0) / max) * 100)}%`, backgroundColor: '#C9C4B6' }]} /></View>
          </View>
        </View>
      ))}
      <View style={styles.radarLegend}>
        <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: '#1F8A3E' }]} /><Text style={styles.legendText}>Best weeks</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: '#C9C4B6' }]} /><Text style={styles.legendText}>Flat weeks</Text></View>
      </View>
    </View>
  );
}

function DualLineCard({ viz }) {
  const series = (viz.series || []).filter((line) => (line.points || []).some((point) => point.y != null));
  if (!series.length) return null;
  const width = 300;
  const height = 120;
  const padX = 12;
  const padY = 14;
  const maxX = Math.max(1, ...series.flatMap((line) => line.points.map((point) => point.x)));
  const linePath = (line) => {
    const ys = line.points.map((point) => point.y).filter((value) => value != null);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const span = max - min || 1;
    return line.points
      .filter((point) => point.y != null)
      .map((point, index) => {
        const x = padX + (point.x / maxX) * (width - 2 * padX);
        const y = height - padY - ((point.y - min) / span) * (height - 2 * padY);
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };
  return (
    <View style={styles.reviewSvgFrame}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {series.map((line) => <Path key={line.label} d={linePath(line)} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinejoin="round" />)}
      </Svg>
      <View style={styles.radarLegend}>
        {series.map((line) => (
          <View key={line.label} style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: line.color }]} /><Text style={styles.legendText}>{line.label}</Text></View>
        ))}
      </View>
    </View>
  );
}

function PainLineCard({ viz }) {
  const points = (viz.points || []).filter((point) => point.pain != null);
  if (points.length < 2) return null;
  const width = 300;
  const height = 132;
  const padX = 12;
  const padY = 14;
  const count = points.length;
  const xAt = (index) => padX + (index / (count - 1)) * (width - 2 * padX);
  const yPain = (value) => height - padY - (value / 10) * (height - 2 * padY);
  const tolerated = viz.tolerated || 0;
  const stressMax = Math.max(1, ...points.map((point) => point.stress || 0));
  const yStress = (value) => height - padY - ((value || 0) / stressMax) * (height - 2 * padY);
  const painPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)} ${yPain(point.pain).toFixed(1)}`).join(' ');
  const stressPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)} ${yStress(point.stress).toFixed(1)}`).join(' ');
  return (
    <View style={styles.reviewSvgFrame}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Rect x={padX} y={yPain(tolerated)} width={width - 2 * padX} height={Math.max(0, (height - padY) - yPain(tolerated))} fill="#EEF5EF" />
        <Line x1={padX} y1={yPain(tolerated)} x2={width - padX} y2={yPain(tolerated)} stroke="#9FC6A6" strokeWidth="1" strokeDasharray="3 3" />
        <Path d={stressPath} fill="none" stroke="#C9A24A" strokeWidth="1.5" strokeDasharray="4 3" />
        <Path d={painPath} fill="none" stroke="#E13F32" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((point, index) => <Circle key={index} cx={xAt(index)} cy={yPain(point.pain)} r="2.6" fill="#FFFFFF" stroke="#E13F32" strokeWidth="1.5" />)}
      </Svg>
      <View style={styles.radarLegend}>
        <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: '#E13F32' }]} /><Text style={styles.legendText}>Knee pain</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: '#C9A24A' }]} /><Text style={styles.legendText}>Reactive load</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendSwatch, { backgroundColor: '#CFE0D2' }]} /><Text style={styles.legendText}>Tolerated</Text></View>
      </View>
    </View>
  );
}

function BlockReadView({ reads, blockContext, showMore, setShowMore }) {
  if (!reads || !reads.hasData || !reads.headline) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Collecting your block</Text>
        <Text style={styles.bodyText}>Plan a block and log a few check-ins and results. Impuls will read whether it's working, what's driving it, and where your deficit is.</Text>
      </View>
    );
  }
  const supporting = reads.supporting || [];
  const more = reads.more || [];
  return (
    <>
      {blockContext ? <Text style={styles.exPrescription}>{blockContext}</Text> : null}
      <ProgrammeReadCard read={reads.headline} headline />
      {supporting.map((read) => <ProgrammeReadCard key={read.id} read={read} />)}
      {more.length ? (
        <>
          <Pressable style={styles.centerLink} onPress={() => setShowMore(!showMore)}>
            <Text style={styles.centerLinkText}>{showMore ? 'Show less' : `More (${more.length})`}</Text>
          </Pressable>
          {showMore ? more.map((read) => <ProgrammeReadCard key={read.id} read={read} />) : null}
        </>
      ) : null}
    </>
  );
}

function SessionReadView({ analysis }) {
  const review = analysis.checkInReview || {};
  const theme = review.theme || {};
  const extras = analysis.sessionExtras || {};
  if (!review.checkInId) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>No check-in yet</Text>
        <Text style={styles.bodyText}>Log a quick check-in or a result and your session read appears here.</Text>
      </View>
    );
  }
  return (
    <>
      {extras.pb ? (
        <View style={[styles.card, styles.pbCard]}>
          <Text style={styles.pbText}>★ New best — performance {pretty(extras.pb.value, 1)} (was {pretty(extras.pb.previous, 1)})</Text>
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.readCardLabel}>{theme.title || 'Today'}</Text>
        <Text style={styles.readSentence}>{theme.signal}</Text>
        {review.visual ? <CheckInReviewVisual visual={review.visual} /> : null}
        {theme.meaning ? <Text style={styles.metricExplain}>{theme.meaning}</Text> : null}
        {extras.mismatch ? <Text style={styles.metricMeaning}>{extras.mismatch.sentence}</Text> : null}
      </View>
    </>
  );
}

function InsightsScreen({ data, analysis, setScreen, setSelectedInsight, setSelectedDashboardMetric, tutorialSeen, onDismissTutorial }) {
  const [mode, setMode] = useState('block');
  const [showMore, setShowMore] = useState(false);
  const reads = analysis.programmeReads || {};
  const blk = currentBlock(data.programme);
  const wks = blk?.weeks || [];
  const wkIdx = wks.findIndex((weekItem) => weekItem.id === data.programme.selected_week_id);
  const blockContext = blk ? `${blk.block_name || 'Current block'}${wks.length ? ` · Week ${(wkIdx >= 0 ? wkIdx : 0) + 1} of ${wks.length}` : ''}` : null;

  return (
    <View style={styles.screen}>
      <View style={styles.rowBetween}>
        <Text style={styles.h1}>Trends</Text>
        <View style={styles.segWrap}>
          {[['block', 'Block'], ['session', 'Session']].map(([id, label]) => {
            const on = mode === id;
            return (
              <Pressable key={id} style={[styles.segBtn, on && styles.segBtnOn]} onPress={() => setMode(id)}>
                <Text style={[styles.segBtnText, on && styles.segBtnTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {mode === 'block'
        ? <BlockReadView reads={reads} blockContext={blockContext} showMore={showMore} setShowMore={setShowMore} />
        : <SessionReadView analysis={analysis} />}
    </View>
  );
}

function CheckInInsightHistory({ history }) {
  if (!history.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Historical Check-in Insights</Text>
        <Text style={styles.bodyText}>No saved check-in insights yet. Save a check-in and the backend-generated review will appear here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {history.map((review) => (
        <View key={`${review.checkInId}-${review.savedAt || ''}`} style={styles.historyInsightItem}>
          <CheckInReviewSnapshot review={review} showDate />
        </View>
      ))}
    </View>
  );
}

function AdaptationStateVisual({ adaptation = {}, analysis = {} }) {
  const states = adaptation.componentStates || {};
  const score = adaptation.score;
  const scorePosition = Number.isFinite(score) ? Math.max(0, Math.min(100, ((score + 0.3) / 0.6) * 100)) : 50;
  const recoveryLabel = states.fatigue || analysis.currentRead?.fatigue || 'Collecting';
  const painLabel = states.irritation || analysis.currentRead?.irritation || 'Collecting';
  const performanceLabel = states.performance || analysis.currentRead?.performance || 'Collecting';
  const loadStressLabel = states.loadStress || analysis.currentRead?.loadStress || 'Collecting';
  const loadToleranceLabel = states.loadTolerance || analysis.currentRead?.loadTolerance || 'Collecting';
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Adaptation status</Text>
      <Text style={styles.bodyText}>{adaptation.summary || 'Log a few sessions to see whether training is building, holding, or costing you.'}</Text>
      <View style={styles.adaptationZoneWrap}>
        <View style={styles.adaptationZoneTrack}>
          <View style={[styles.adaptationZone, styles.adaptationZoneRisk]} />
          <View style={[styles.adaptationZone, styles.adaptationZoneStable]} />
          <View style={[styles.adaptationZone, styles.adaptationZoneGood]} />
          <View style={[styles.adaptationMarker, { left: `${scorePosition}%` }]} />
        </View>
        <View style={styles.axisFooter}>
          <Text style={styles.axisLabel}>At risk</Text>
          <Text style={styles.axisLabel}>Holding</Text>
          <Text style={styles.axisLabel}>Adapting</Text>
        </View>
      </View>
      <View style={styles.currentReadGrid}>
        <CurrentReadItem label="Output" value={performanceLabel} tone={stateTone(performanceLabel, 'performance')} />
        <CurrentReadItem label="Load stress" value={loadStressLabel} tone={stateTone(loadStressLabel, 'loadStress')} />
        <CurrentReadItem label="Load tolerance" value={loadToleranceLabel} tone={stateTone(loadToleranceLabel, 'loadTolerance')} />
        <CurrentReadItem label="Pain / fatigue" value={`${painLabel} / ${recoveryLabel}`} tone={stateTone(`${painLabel} ${recoveryLabel}`, 'bodyCost')} />
      </View>
      {adaptation.loadMeaning ? <Text style={styles.smallCopy}>{adaptation.loadMeaning.replace(/^For training load, this means:\s*/i, '')}</Text> : null}
      <Text style={styles.smallCopy}>{adaptation.confidence || adaptation.status || 'Collecting Evidence'}</Text>
    </View>
  );
}

function InsightDetailScreen({ data, analysis, insightId, setScreen, setSelectedDashboardMetric }) {
  const relationship = analysis.relationships.find((item) => item.id === insightId) || analysis.relationships[0];
  const section = insightSections.find((item) => item.id === insightId);
  if (section) {
    return (
      <InsightSectionDetail
        data={data}
        analysis={analysis}
        section={section}
        setScreen={setScreen}
        setSelectedDashboardMetric={setSelectedDashboardMetric}
      />
    );
  }

  const points = relationship?.points || [];
  const relationshipInsight = relationship?.insight;
  return (
    <View style={styles.screen}>
      <Header title={relationship ? formatRelationshipName(relationship.title) : 'Insight Detail'} onBack={() => setScreen('insights')} />
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Figure Result</Text>
        <Text style={styles.figureResult}>{relationshipInsight?.evidenceStatement || 'Needs more paired logs for this relationship.'}</Text>
      </View>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{relationship ? formatRelationshipName(relationship.title) : 'Relationship'}</Text>
        <Text style={styles.figureResult}>{relationshipInsight?.evidenceStatement || 'No relationship estimate is available yet.'}</Text>
        <Scatter
          points={points}
          color={relationship?.color || '#24883B'}
          xLabel={relationship?.xLabel || formatMetricName(relationship?.xKey)}
          yLabel={relationship?.yLabel || formatMetricName(relationship?.yKey)}
        />
        <FigureEvidence
          items={[
            ['Pearson r', relationship?.r === null || relationship?.r === undefined ? '-' : pretty(relationship.r, 2)],
            ['Spearman r', Number.isFinite(relationship?.spearmanR) ? pretty(relationship.spearmanR, 2) : 'not calculated yet'],
            ['p-value', relationshipInsight?.pValueText || 'not calculated yet'],
            ['n', points.length],
            ['Status', relationshipInsight?.confidence || 'Collecting'],
          ]}
        />
        <Text style={styles.figureInterpretation}>{relationshipInsight?.trainingInterpretation || 'State cannot yet be interpreted because paired observations are insufficient.'}</Text>
        <Text style={styles.figureLimitation}>{relationshipInsight?.limitation || 'Needs more paired logs.'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>What Suggests This?</Text>
        <Text style={styles.bodyText}>{relationshipInsight?.whatSuggestsThis || 'Context is collecting.'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bring Forward / Monitor</Text>
        <Text style={styles.label}>Bring forward</Text>
        <Text style={styles.bodyText}>{relationshipInsight?.bringForward || 'Collecting'}</Text>
        <Text style={styles.label}>Prevent / monitor</Text>
        <Text style={styles.bodyText}>{relationshipInsight?.preventMonitor || 'Collecting'}</Text>
      </View>
      <EvidencePanel relationship={relationship} />
      <CalendarEvidence points={points} relationship={relationship} />
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Caution</Text>
        <Text style={styles.bodyText}>These are exploratory relationships from your stored logs, not causal claims.</Text>
      </View>
    </View>
  );
}

function InsightSectionDetail({ data, analysis, section, setScreen, setSelectedDashboardMetric }) {
  const rows = orderedRows(analysis);
  const bestPerformance = [...rows].sort((a, b) => b.performance - a.performance).slice(0, 3);
  const adaptation = analysis.adaptationInsight;
  const sectionCopy = athleteSectionCopy(section, analysis);

  function openDashboard(metricKey) {
    setSelectedDashboardMetric(metricKey);
    setScreen('evidence');
  }

  return (
    <View style={styles.screen}>
      <Header title={section.title} onBack={() => setScreen('insights')} />
      {section.id === 'overview' && (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Current Read</Text>
            <InsightLine label="Performance" value={analysis.currentRead?.performance || 'collecting'} />
            <InsightLine label="Pain" value={analysis.currentRead?.irritation || 'collecting'} />
            <InsightLine label="Fatigue" value={analysis.currentRead?.fatigue || 'collecting'} />
            <InsightLine label="Adaptation" value={adaptation.label} />
          </View>
          <PriorityInsight analysis={analysis} />
        </>
      )}

      {section.id === 'performance' && (
        <>
          <View style={styles.priorityCard}>
            <Text style={styles.label}>Performance</Text>
            <Text style={styles.priorityTitle}>{sectionCopy.title}</Text>
            <Text style={styles.bodyText}>{sectionCopy.body}</Text>
          </View>
          <DashboardPreview title="Performance trend" metricKey="performance" analysis={analysis} onOpen={() => openDashboard('performance')} />
          {bestPerformance.length ? <RankedDayCards title="Best recent days" points={bestPerformance} valueKey="performance" /> : null}
        </>
      )}

      {section.id === 'irritation' && (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{sectionCopy.title}</Text>
            <Text style={styles.bodyText}>{sectionCopy.body}</Text>
            <Text style={styles.smallCopy}>Guide: 0-2 low, 3-4 watch, 5+ elevated.</Text>
          </View>
          <DashboardPreview title="Pain trend" metricKey="pain" analysis={analysis} onOpen={() => openDashboard('pain')} />
        </>
      )}

      {section.id === 'recovery' && (
        <>
          <View style={styles.priorityCard}>
            <Text style={styles.label}>Recovery</Text>
            <Text style={styles.priorityTitle}>{sectionCopy.title}</Text>
            <Text style={styles.bodyText}>{sectionCopy.body}</Text>
          </View>
          <DashboardPreview title="Recovery trend" metricKey="fatigue" analysis={analysis} onOpen={() => openDashboard('fatigue')} />
        </>
      )}

      {section.id === 'load' && (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{sectionCopy.title}</Text>
            <Text style={styles.bodyText}>{sectionCopy.body}</Text>
          </View>
          <DashboardPreview title="Load trend" metricKey="load" analysis={analysis} onOpen={() => openDashboard('load')} />
          <View style={styles.metricStrip}>
            <Metric label="7-day Load" value={pretty(analysis.weeklyLoad, 1)} />
            <Metric label="Avg Load" value={analysis.avgLoad === null ? '-' : pretty(analysis.avgLoad, 1)} />
          </View>
        </>
      )}

      {section.id === 'adaptation' && (
        <>
          <View style={styles.priorityCard}>
            <Text style={styles.label}>Adaptation State</Text>
            <Text style={styles.h1}>{athleteAdaptationCopy(adaptation).headline}</Text>
            <Text style={styles.bodyText}>{athleteAdaptationCopy(adaptation).body}</Text>
            <Text style={styles.evidenceBadge}>{adaptation.confidence || adaptation.status || 'Collecting'}</Text>
          </View>
          <AdaptationStateVisual adaptation={adaptation} analysis={analysis} />
        </>
      )}

      {section.id === 'likely_response' && (
        <>
          <ForecastCard title="Good Performance Window" insight={analysis.likelyResponseInsight} />
          <ForecastCard title="Pain Window" insight={analysis.likelyResponseInsight} />
          <ForecastCard title="Bad Performance Window" insight={analysis.likelyResponseInsight} />
        </>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Want the data?</Text>
        <Text style={styles.bodyText}>Open Evidence for charts, changes, and relationships behind this insight.</Text>
        <ActionButton title="Open Evidence" tone="outline" onPress={() => openDashboard(sectionCopy.metric || (section.id === 'irritation' ? 'pain' : section.id === 'load' ? 'load' : section.id === 'recovery' ? 'fatigue' : 'performance'))} />
      </View>
    </View>
  );
}

function DashboardScreen({ data, analysis, metricKey, setMetricKey, setSelectedInsight, setScreen, tutorialSeen, onDismissTutorial }) {
  const [rangeFilter, setRangeFilter] = useState('month');
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [macroFilter, setMacroFilter] = useState('all');
  const [blockFilter, setBlockFilter] = useState('all');
  const metric = dashboardMetrics.find((item) => item.key === metricKey) || dashboardMetrics[0];
  const allPoints = metricSeries(analysis, metric.key);
  const points = filterMetricPoints(allPoints, { range: rangeFilter, macroId: macroFilter, blockId: blockFilter }, data.programme);
  const stats = metricStatsFromPoints(points);
  const filterLabel = `${rangeFilter === 'all' ? 'all time' : rangeFilter}${macroFilter === 'all' ? '' : ' / selected macro'}${blockFilter === 'all' ? '' : ' / selected block'}`;
  const trendInsight = filteredTrendInsight(analysis.trendInsights?.[metric.key], metric, stats, filterLabel);
  const categories = [...new Set(dashboardMetrics.map((item) => item.category))];
  const activeCategory = metric.category;
  const categoryMetrics = dashboardMetrics.filter((item) => item.category === activeCategory);
  const macros = data.programme.macro_blocks || [];
  const blocks = programmeBlocks(data.programme, macroFilter);
  const rangeOptions = [
    ['week', 'Week'],
    ['month', 'Month'],
    ['year', 'Year'],
    ['all', 'All time'],
  ];
  const rangeLabel = rangeOptions.find(([id]) => id === rangeFilter)?.[1] || 'Month';
  const rankedRelationships = [...analysis.relationships]
    .filter((item) => item.r !== null && (item.xKey === metric.key || item.yKey === metric.key))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

  return (
    <View style={styles.screen}>
      <View style={styles.rowBetween}>
        <Text style={styles.h1}>Evidence</Text>
        <View style={styles.filterPill}><Text style={styles.filterText}>{metric.category}</Text></View>
      </View>
      <TutorialHint
        visible={!tutorialSeen}
        title="When you want the detail"
        body="Evidence shows the charts and stored logs behind an insight. Use it when you want to check why Impuls said something."
        onDismiss={onDismissTutorial}
      />
      <View style={styles.filterTabs}>
        {categories.map((category) => (
          <Pressable
            key={category}
            style={[styles.filterTab, activeCategory === category && styles.filterTabActive]}
            onPress={() => setMetricKey(dashboardMetrics.find((item) => item.category === category)?.key || metric.key)}
          >
            <Text style={[styles.filterTabText, activeCategory === category && styles.filterTabTextActive]}>{category}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.dashboardCategory}>
        <Text style={styles.label}>{activeCategory} metrics</Text>
        <View style={styles.chipWrap}>
          {categoryMetrics.map((item) => (
            <Pressable key={item.key} style={[styles.dashboardChip, metric.key === item.key && styles.dashboardChipActive]} onPress={() => setMetricKey(item.key)}>
              <Text style={[styles.dashboardChipText, metric.key === item.key && styles.dashboardChipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {activeCategory === 'Performance' ? (
        <PerformanceMetricAnalysisCard analysis={analysis} selectedMetricKey={metric.key} />
      ) : null}
      <MetricFigure
        title={`${metric.label} Time Series`}
        metric={metric}
        points={points}
        insight={trendInsight}
        filterControl={
          <DashboardFilterPanel
            open={rangeMenuOpen}
            setOpen={setRangeMenuOpen}
            rangeLabel={rangeLabel}
            rangeFilter={rangeFilter}
            setRangeFilter={setRangeFilter}
            rangeOptions={rangeOptions}
            macroFilter={macroFilter}
            setMacroFilter={setMacroFilter}
            blockFilter={blockFilter}
            setBlockFilter={setBlockFilter}
            macros={macros}
            blocks={blocks}
            filteredCount={points.length}
            totalCount={allPoints.length}
          />
        }
      />
      <RankedMetricPoints title="Highest Points" points={stats.highest} />
      <RankedMetricPoints title="Lowest Points" points={stats.lowest} />
      <ChangeCards title="Largest Changes" changes={stats.changes} metric={metric} insight={analysis.changeInsights?.[metric.key]} />
      <RelationshipBars
        title="Ranked Relationships"
        relationships={rankedRelationships}
        onSelect={(relationship) => {
          setSelectedInsight(relationship.id);
          setScreen('detail');
        }}
      />
      <RelationshipScatterPreview relationship={rankedRelationships[0]} />
    </View>
  );
}

function DashboardFilterPanel({
  open,
  setOpen,
  rangeLabel,
  rangeFilter,
  setRangeFilter,
  rangeOptions,
  macroFilter,
  setMacroFilter,
  blockFilter,
  setBlockFilter,
  macros,
  blocks,
  filteredCount,
  totalCount,
}) {
  return (
    <View style={styles.chartFilterWrap}>
      <Pressable style={[styles.chartFilterIcon, open && styles.chartFilterIconActive]} hitSlop={8} onPress={() => setOpen((current) => !current)}>
        <Text style={[styles.chartFilterIconText, open && styles.chartFilterIconTextActive]}>≡</Text>
      </Pressable>
      {open ? (
        <View style={styles.chartFilterPopover}>
          <Text style={styles.figureEvidenceLabel}>Time range</Text>
          <View style={styles.compactMenu}>
            {rangeOptions.map(([id, label]) => (
              <Pressable
                key={id}
                style={[styles.compactMenuItem, rangeFilter === id && styles.compactMenuItemActive]}
                onPress={() => setRangeFilter(id)}
              >
                <Text style={[styles.compactMenuText, rangeFilter === id && styles.compactMenuTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.figureEvidenceLabel}>Macro cycle</Text>
          <View style={styles.chipWrap}>
            <Pressable style={[styles.dashboardChip, macroFilter === 'all' && styles.dashboardChipActive]} onPress={() => { setMacroFilter('all'); setBlockFilter('all'); }}>
              <Text style={[styles.dashboardChipText, macroFilter === 'all' && styles.dashboardChipTextActive]}>All</Text>
            </Pressable>
            {macros.map((macro) => (
              <Pressable key={macro.id} style={[styles.dashboardChip, macroFilter === macro.id && styles.dashboardChipActive]} onPress={() => { setMacroFilter(macro.id); setBlockFilter('all'); }}>
                <Text style={[styles.dashboardChipText, macroFilter === macro.id && styles.dashboardChipTextActive]}>{macro.macro_block_name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.figureEvidenceLabel}>Training block</Text>
          <View style={styles.chipWrap}>
            <Pressable style={[styles.dashboardChip, blockFilter === 'all' && styles.dashboardChipActive]} onPress={() => setBlockFilter('all')}>
              <Text style={[styles.dashboardChipText, blockFilter === 'all' && styles.dashboardChipTextActive]}>All</Text>
            </Pressable>
            {blocks.map((block) => (
              <Pressable key={block.id} style={[styles.dashboardChip, blockFilter === block.id && styles.dashboardChipActive]} onPress={() => setBlockFilter(block.id)}>
                <Text style={[styles.dashboardChipText, blockFilter === block.id && styles.dashboardChipTextActive]}>{block.block_name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.muted}>{rangeLabel} / {filteredCount} of {totalCount} observations</Text>
        </View>
      ) : null}
    </View>
  );
}

function PriorityInsight({ analysis }) {
  const adaptation = analysis.adaptationInsight || {};
  return (
    <View style={styles.priorityCard}>
      <Text style={styles.label}>Main Insight</Text>
      <Text style={styles.priorityTitle}>{adaptation.label || 'Adaptation Unclear'}</Text>
      <Text style={styles.bodyText}>{adaptation.summary || 'Add more paired logs to unlock the adaptation insight.'}</Text>
      <Text style={styles.muted}>{adaptation.performanceMeaning || adaptation.trainingInterpretation || 'Performance meaning is collecting.'}</Text>
      <Text style={styles.evidenceBadge}>{adaptation.confidence || adaptation.status || 'Collecting Evidence'}</Text>
    </View>
  );
}

function CurrentReadItem({ label, value, wide = false, tone = 'neutral' }) {
  return (
    <View style={[styles.currentReadItem, insightToneCardStyle(tone), wide && styles.currentReadItemWide]}>
      <View style={styles.miniStateHeader}>
        <Text style={styles.currentReadLabel}>{label}</Text>
        <View style={[styles.miniStateDot, { backgroundColor: toneAccentColor(tone) }]} />
      </View>
      <Text style={styles.currentReadValue}>{value}</Text>
    </View>
  );
}

function DashboardPreview({ title, metricKey, analysis, onOpen }) {
  const metric = dashboardMetrics.find((item) => item.key === metricKey) || dashboardMetrics[0];
  const points = metricSeries(analysis, metric.key);
  return (
    <View style={styles.chartCard}>
      <MetricFigure title={title} metric={metric} points={points} insight={analysis.trendInsights?.[metric.key]} compact />
      <ActionButton title="View Evidence" tone="outline" onPress={onOpen} />
    </View>
  );
}

function PerformanceMetricAnalysisInsightCard({ analysis, onOpenMetric }) {
  const performanceAnalysis = analysis?.performanceMetricAnalysis;
  if (!performanceAnalysis) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Performance Metric Analysis</Text>
        <Text style={styles.bodyText}>Performance metric analysis is collecting.</Text>
      </View>
    );
  }

  const strongest = performanceAnalysis.strongestPerformanceMetric;
  const availableProfiles = [
    performanceAnalysis.jumpProfile,
    performanceAnalysis.sprintProfile,
    performanceAnalysis.liftProfile,
  ].filter((profile) => profile?.availableMetrics?.length && profile?.interpretation);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Performance Metric Analysis</Text>
      <Text style={styles.figureResult}>{performanceAnalysis.evidenceSummary || 'Performance metric analysis is collecting.'}</Text>
      <Text style={styles.bodyText}>{performanceAnalysis.combinedInterpretation || 'Performance metric analysis is collecting.'}</Text>
      {availableProfiles.map((profile) => (
        <View key={profile.id} style={styles.analysisSubcard}>
          <Text style={styles.label}>{profile.label}</Text>
          <Text style={styles.smallCopy}>{profile.interpretation}</Text>
        </View>
      ))}
      {strongest?.reason ? (
        <View style={styles.evidenceRow}>
          <Text style={styles.evidenceBadge}>{strongest.label}</Text>
          <Text style={styles.evidenceBadge}>{strongest.status || 'Collecting'}</Text>
          <Text style={styles.evidenceBadge}>n = {strongest.n || 0}</Text>
        </View>
      ) : null}
      {strongest?.reason ? <Text style={styles.bodyText}>{strongest.reason}</Text> : null}
      <ActionButton title="Open Performance Metrics" tone="outline" onPress={() => onOpenMetric(strongest?.key || 'performance')} />
    </View>
  );
}

function PerformanceMetricAnalysisCard({ analysis, selectedMetricKey }) {
  const performanceAnalysis = analysis?.performanceMetricAnalysis;
  if (!performanceAnalysis) {
    return (
      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Performance Metric Analysis</Text>
        <Text style={styles.bodyText}>Performance metric analysis is collecting.</Text>
      </View>
    );
  }

  const strongest = performanceAnalysis.strongestPerformanceMetric;
  const selectedTrend = performanceMetricKeys.includes(selectedMetricKey)
    ? performanceAnalysis.metricTrends?.[selectedMetricKey]
    : null;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.sectionTitle}>Performance Metric Analysis</Text>
      <Text style={styles.figureResult}>{performanceAnalysis.evidenceSummary || 'Performance metric analysis is collecting.'}</Text>
      <Text style={styles.bodyText}>{performanceAnalysis.combinedInterpretation || 'Performance metric analysis is collecting.'}</Text>
      {strongest ? (
        <View style={styles.evidenceRow}>
          <Text style={styles.evidenceBadge}>Strongest: {strongest.label}</Text>
          <Text style={styles.evidenceBadge}>{strongest.status || 'Collecting'}</Text>
          <Text style={styles.evidenceBadge}>n = {strongest.n || 0}</Text>
        </View>
      ) : null}
      {selectedTrend ? (
        <View style={styles.analysisSubcard}>
          <Text style={styles.label}>{selectedTrend.label || dashboardMetricConfig(selectedMetricKey).label}</Text>
          <Text style={styles.smallCopy}>{selectedTrend.evidenceStatement || 'Metric trend is collecting.'}</Text>
          <Text style={styles.smallCopy}>{selectedTrend.interpretation || 'Metric interpretation is collecting.'}</Text>
        </View>
      ) : null}
      <PerformanceMetricAnalysisChart analysis={analysis} selectedMetricKey={selectedMetricKey} />
    </View>
  );
}

function PerformanceMetricAnalysisChart({ analysis, selectedMetricKey }) {
  if (selectedMetricKey === 'performance') {
    const metric = dashboardMetricConfig('performance');
    const points = metricSeries(analysis, 'performance');
    if (hasJumpProfileMetrics(analysis)) {
      return (
        <View style={styles.figureInner}>
          <Text style={styles.label}>Jump metric profile</Text>
          <MultiMetricLineChart series={multiMetricSeriesForKeys(analysis, jumpMetricKeys)} />
        </View>
      );
    }
    if (points.length < 2) return <Text style={styles.figureLimitation}>Performance metric analysis is collecting.</Text>;
    return (
      <MetricFigure
        title="Performance Score Trend"
        metric={metric}
        points={points}
        insight={metricTrendFromPerformanceAnalysis(analysis, 'performance')}
        compact
      />
    );
  }

  if (jumpMetricKeys.includes(selectedMetricKey)) {
    if (!hasJumpProfileMetrics(analysis)) {
      return <Text style={styles.figureLimitation}>Jump profile needs height/distance plus FT/GCT or RSI before combined interpretation is available.</Text>;
    }
    return (
      <View style={styles.figureInner}>
        <Text style={styles.label}>Jump metric profile</Text>
        <MultiMetricLineChart series={multiMetricSeriesForKeys(analysis, jumpMetricKeys)} />
      </View>
    );
  }

  if (selectedMetricKey === 'sprint_time') {
    const metric = dashboardMetricConfig('sprint_time');
    const points = metricSeries(analysis, 'sprint_time');
    if (points.length < 2) return <Text style={styles.figureLimitation}>Sprint/lift profile is collecting.</Text>;
    return (
      <MetricFigure
        title="Sprint Time Trend"
        metric={metric}
        points={points}
        insight={metricTrendFromPerformanceAnalysis(analysis, 'sprint_time')}
        compact
      />
    );
  }

  if (liftMetricKeys.includes(selectedMetricKey)) {
    if (!hasLiftProfileMetrics(analysis)) {
      return <Text style={styles.figureLimitation}>Sprint/lift profile is collecting.</Text>;
    }
    return (
      <View style={styles.figureInner}>
        <Text style={styles.label}>Lift metric profile</Text>
        <MultiMetricLineChart series={multiMetricSeriesForKeys(analysis, liftMetricKeys)} />
      </View>
    );
  }

  return <Text style={styles.figureLimitation}>Performance metric analysis is collecting.</Text>;
}

function MetricFigure({ title, metric, points, insight, compact = false, filterControl = null }) {
  const stats = insight?.stats || metricStats(null, metric.key);
  const evidence = [
    ['n', stats.count],
    ['Mean', stats.avg === null ? '-' : pretty(stats.avg, 1)],
    ['SD', stats.sd === null ? '-' : pretty(stats.sd, 1)],
    ['Slope', stats.trend === null ? '-' : pretty(stats.trend, 2)],
    ['Status', insight?.status || 'Collecting'],
  ];
  if (!compact) {
    evidence.push(['Min', stats.min === null ? '-' : pretty(stats.min, 1)]);
    evidence.push(['Max', stats.max === null ? '-' : pretty(stats.max, 1)]);
  }

  return (
    <View style={compact ? styles.figureInner : styles.chartCard}>
      <View style={styles.chartHeaderRow}>
        <Text style={styles.chartTitle}>{title}</Text>
        {filterControl}
      </View>
      <Text style={styles.figureResult}>{insight?.evidenceStatement || 'Trend insight is collecting.'}</Text>
      <Text style={styles.chartSubtitle}>{points.length ? `${dateShort(points[0].date)} to ${dateShort(points[points.length - 1].date)}` : 'No stored values yet'}</Text>
      <TimeSeriesChart points={points} color={metric.color} metric={metric} />
      {!compact ? renderBoxPlot(points, metric) : null}
      <FigureEvidence items={evidence} />
      <Text style={styles.figureInterpretation}>{insight?.interpretation || 'Trend interpretation is collecting.'}</Text>
      <Text style={styles.figureLimitation}>{insight?.limitation || 'Trend reflects stored logs only.'}</Text>
    </View>
  );
}

function FigureEvidence({ items }) {
  return (
    <View style={styles.figureEvidence}>
      {items.map(([label, value]) => (
        <View key={`${label}-${value}`} style={styles.figureEvidenceItem}>
          <Text style={styles.figureEvidenceLabel}>{label}</Text>
          <Text style={styles.figureEvidenceValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function TimeSeriesChart({ points, color, metric = { key: 'performance', label: 'Metric' } }) {
  const kind = metricChartKind(metric);
  const display = chronologicalMetricPoints(points, 12);

  if (!display.length) {
    return (
      <View style={styles.timeChartEmpty}>
        <Text style={styles.muted}>No stored values for this metric yet.</Text>
      </View>
    );
  }

  if (kind === 'line' && display.length < 2) {
    return (
      <View style={styles.timeChartEmpty}>
        <Text style={styles.muted}>Needs at least two stored values for a connected line chart.</Text>
      </View>
    );
  }

  const values = display.map((point) => point.value);
  const max = Math.max(...values);
  const min = kind === 'bar' ? Math.min(...values, 0) : Math.min(...values);
  const range = max - min || 1;
  const chartWidth = 320;
  const chartHeight = 154;
  const padding = { left: 34, right: 14, top: 14, bottom: 30 };
  const coords = display.map((point, index) => ({
    ...scaleSvgPoint(point.value, index, display.length, min, range, chartWidth, chartHeight, padding),
    point,
  }));
  const path = smoothSvgPath(coords);

  return (
    <View style={styles.axisChartWrap}>
      {kind === 'bar' ? (
        <>
          <Text style={styles.yAxisLabel}>Y: {metric.label}</Text>
          <View style={styles.timeChart}>
            {display.map((point) => {
              const height = Math.max(8, ((point.value - min) / range) * 92 + 8);
              return (
                <View key={`${point.id}-${point.date}`} style={styles.timeChartColumn}>
                  <View style={styles.lineSlot}>
                    <View style={[styles.timeChartBar, { height, backgroundColor: color }]} />
                  </View>
                  <Text style={styles.timeChartLabel}>{dateShort(point.date)}</Text>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View style={styles.svgChartFrame}>
          <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
            <Line x1={padding.left} y1={padding.top} x2={padding.left} y2={chartHeight - padding.bottom} stroke="#D8D8D4" strokeWidth="1" />
            <Line x1={padding.left} y1={chartHeight - padding.bottom} x2={chartWidth - padding.right} y2={chartHeight - padding.bottom} stroke="#D8D8D4" strokeWidth="1" />
            <Line x1={padding.left} y1={padding.top + (chartHeight - padding.top - padding.bottom) / 2} x2={chartWidth - padding.right} y2={padding.top + (chartHeight - padding.top - padding.bottom) / 2} stroke="#ECECE8" strokeWidth="1" />
            <SvgText x={6} y={padding.top + 4} fill="#777771" fontSize="10" fontWeight="700">{pretty(max, 1)}</SvgText>
            <SvgText x={6} y={chartHeight - padding.bottom} fill="#777771" fontSize="10" fontWeight="700">{pretty(min, 1)}</SvgText>
            <SvgText x={padding.left} y={chartHeight - 8} fill="#777771" fontSize="10" fontWeight="700">{dateShort(display[0].date)}</SvgText>
            <SvgText x={chartWidth - padding.right} y={chartHeight - 8} fill="#777771" fontSize="10" fontWeight="700" textAnchor="end">{dateShort(display[display.length - 1].date)}</SvgText>
            <Path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {coords.map((coord, index) => (
              <Circle key={`${coord.point.id}-${coord.point.date}-${index}`} cx={coord.x} cy={coord.y} r={3.5} fill="#FFFFFF" stroke={color} strokeWidth="2" />
            ))}
          </Svg>
        </View>
      )}
      <View style={styles.axisFooter}>
        <Text style={styles.axisLabel}>X: Date</Text>
        <Text style={styles.axisLabel}>Range {pretty(min, 1)} - {pretty(max, 1)}</Text>
      </View>
    </View>
  );
}

function renderBoxPlot(points, metric) {
  const stats = boxStats(points);
  if (!stats) {
    return (
      <View style={styles.boxPlotEmpty}>
        <Text style={styles.muted}>Box plot cannot be displayed until values are stored.</Text>
      </View>
    );
  }
  const range = stats.max - stats.min || 1;
  const position = (value) => `${Math.max(0, Math.min(100, ((value - stats.min) / range) * 100))}%`;

  return (
    <View style={styles.boxPlotWrap}>
      <View style={styles.boxPlotHeader}>
        <Text style={styles.label}>Descriptive Distribution</Text>
        <Text style={styles.axisLabel}>X: {metric.label}</Text>
      </View>
      <View style={styles.boxPlot}>
        <View style={styles.boxWhisker} />
        <View style={[styles.boxRange, { left: position(stats.q1), right: `${100 - Number(position(stats.q3).replace('%', ''))}%`, borderColor: metric.color }]} />
        <View style={[styles.boxMedian, { left: position(stats.median), backgroundColor: metric.color }]} />
        <View style={[styles.boxTick, { left: position(stats.min) }]} />
        <View style={[styles.boxTick, { left: position(stats.max) }]} />
      </View>
      <View style={styles.axisFooter}>
        <Text style={styles.axisLabel}>Min {pretty(stats.min, 1)}</Text>
        <Text style={styles.axisLabel}>Median {pretty(stats.median, 1)}</Text>
        <Text style={styles.axisLabel}>Max {pretty(stats.max, 1)}</Text>
      </View>
    </View>
  );
}

function EvidencePanel({ relationship }) {
  const count = relationship?.points?.length || 0;
  const insight = relationship?.insight;
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Evidence</Text>
      <InsightLine label="Relationship strength" value={relationship?.r === null || relationship?.r === undefined ? 'r = -' : `r = ${pretty(relationship.r, 2)}`} />
      <InsightLine label="Spearman r" value={Number.isFinite(relationship?.spearmanR) ? pretty(relationship.spearmanR, 2) : 'not calculated yet'} />
      <InsightLine label="Data points" value={`n = ${count}`} />
      <InsightLine label="p-value" value={insight?.pValueText || 'not calculated yet'} />
      <InsightLine label="Confidence" value={insight?.confidence || 'Collecting'} />
      <Text style={styles.smallCopy}>p-value estimates how surprising this association would be if there were no real relationship. Interpret cautiously when n is small.</Text>
      <Text style={styles.bodyText}>{insight?.pValueInterpretation || 'p-value not calculated yet.'}</Text>
    </View>
  );
}

function CalendarEvidence({ points, relationship }) {
  const xLabel = relationship?.xLabel || formatMetricName(relationship?.xKey || 'x');
  const yLabel = relationship?.yLabel || formatMetricName(relationship?.yKey || 'y');
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Calendar Evidence</Text>
      {!points.length ? <Text style={styles.muted}>No valid paired calendar examples yet.</Text> : null}
      {points.slice(0, 5).map((point) => (
        <View key={`${point.id}-${point.date}`} style={styles.dayEvidenceCard}>
          <Text style={styles.cardTitle}>{dateShort(point.date)}</Text>
          <Text style={styles.muted}>{point.session_name || 'Session context collecting'}</Text>
          <Text style={styles.smallCopy}>{xLabel}: {pretty(point.x, 1)} / {yLabel}: {pretty(point.y, 1)}</Text>
        </View>
      ))}
    </View>
  );
}

function RelationshipBars({ title, relationships, onSelect }) {
  const rows = [...relationships].filter((item) => item.r !== null).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  const top = rows[0];
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.figureResult}>
        {top ? top.insight.evidenceStatement : 'Relationship ranking cannot yet be estimated because paired observations are insufficient.'}
      </Text>
      <Text style={styles.axisLabel}>Longer bars mean stronger stored patterns</Text>
      {rows.length === 0 ? <Text style={styles.muted}>Needs at least three matching logs.</Text> : null}
      {rows.map((relationship) => (
        <Pressable key={relationship.id} style={styles.relationshipRow} onPress={() => onSelect?.(relationship)}>
          <View style={styles.relationshipText}>
            <View style={styles.relationshipTitleRow}>
              <Text style={styles.cardTitle}>{formatRelationshipName(relationship.title)}</Text>
              <Text style={relationship.r >= 0 ? styles.positive : styles.negative}>{relationship.r >= 0 ? 'positive' : 'negative'}</Text>
            </View>
            <Text style={styles.muted}>{relationship.strength} pattern / {relationship.points.length} matching logs</Text>
          </View>
          <View style={styles.relationshipTrack}>
            <View style={[styles.relationshipFill, { width: `${Math.min(100, Math.abs(relationship.r) * 100)}%`, backgroundColor: relationship.color }]} />
          </View>
        </Pressable>
      ))}
      {top ? (
        <>
          <FigureEvidence items={[['Top r', pretty(top.r, 2)], ['Top n', top.points.length], ['Status', top.insight?.confidence || 'Collecting']]} />
          <Text style={styles.figureLimitation}>{top.insight.limitation}</Text>
        </>
      ) : null}
    </View>
  );
}

function RelationshipScatterPreview({ relationship }) {
  if (!relationship) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Scatterplot Detail</Text>
        <Text style={styles.muted}>Needs more paired logs for this relationship.</Text>
      </View>
    );
  }

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{formatRelationshipName(relationship.title)}</Text>
      <Text style={styles.figureResult}>{relationship.insight.evidenceStatement}</Text>
      <Scatter
        points={relationship.points || []}
        color={relationship.color}
        xLabel={relationship.xLabel || formatMetricName(relationship.xKey)}
        yLabel={relationship.yLabel || formatMetricName(relationship.yKey)}
      />
      <Text style={styles.figureInterpretation}>{relationship.insight.trainingInterpretation}</Text>
      <Text style={styles.figureLimitation}>{relationship.insight.limitation}</Text>
      <EvidencePanel relationship={relationship} />
    </View>
  );
}

function RankedDayCards({ title, points, valueKey }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {points.length === 0 ? <Text style={styles.muted}>No calendar evidence yet.</Text> : null}
      {points.map((row) => (
        <View key={`${title}-${row.id}`} style={styles.dayEvidenceCard}>
          <Text style={styles.cardTitle}>{dateShort(row.date)}</Text>
          <Text style={styles.muted}>Value: {pretty(row[valueKey], 1)} / Load: {pretty(row.load, 1)} / Pain: {pretty(row.pain, 1)}</Text>
          <Text style={styles.smallCopy}>{row.session?.session_name || 'Session context collecting'}</Text>
        </View>
      ))}
    </View>
  );
}

function RankedMetricPoints({ title, points }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {points.length === 0 ? <Text style={styles.muted}>No points yet.</Text> : null}
      {points.map((point) => (
        <InsightLine key={`${title}-${point.id}-${point.value}`} label={dateShort(point.date)} value={pretty(point.value, 1)} />
      ))}
    </View>
  );
}

function ChangeCards({ title, changes, metric = { key: 'performance', category: 'Performance' }, insight }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.figureResult}>{insight?.statement || 'Change insight is collecting.'}</Text>
      {changes.length === 0 ? <Text style={styles.muted}>Needs at least two values.</Text> : null}
      {changes.map((change, index) => (
        <View key={`${title}-${change.id}-${change.date}`} style={styles.changeCard}>
          <Text style={styles.cardTitle}>{dateShort(change.previous?.date)} {'→'} {dateShort(change.date)}</Text>
          <Text style={styles.figureResult}>{insight?.items?.[index]?.statement || insight?.statement || 'Change insight is collecting.'}</Text>
          <Text style={changeStyleForMetric(change.change, metric)}>Change {change.change >= 0 ? '+' : ''}{pretty(change.change, 1)}</Text>
          <Text style={styles.muted}>{pretty(change.previous?.value, 1)} {'→'} {pretty(change.value, 1)}</Text>
          <Text style={styles.smallCopy}>{insight?.items?.[index]?.interpretation || 'Change interpretation is collecting.'}</Text>
        </View>
      ))}
      <Text style={styles.figureLimitation}>{insight?.limitation || 'Needs at least two stored observations before change can be estimated.'}</Text>
    </View>
  );
}

function AdaptationMetricFigure({ analysis }) {
  const rows = orderedRows(analysis);
  const adaptation = analysis.adaptationInsight;
  const metrics = [
    dashboardMetrics.find((metric) => metric.key === 'performance'),
    dashboardMetrics.find((metric) => metric.key === 'load'),
    dashboardMetrics.find((metric) => metric.key === 'pain'),
    dashboardMetrics.find((metric) => metric.key === 'fatigue'),
    dashboardMetrics.find((metric) => metric.key === 'readiness'),
  ].filter(Boolean);
  const series = metrics.map((metric) => ({
    key: metric.key,
    label: metric.label,
    color: metric.color,
    points: metricSeries(analysis, metric.key),
    stats: metricStats(analysis, metric.key),
  }));
  const count = rows.length;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Adaptation Trends</Text>
      <Text style={styles.figureResult}>{adaptation.evidenceStatement}</Text>
      <AdaptationLineChart series={series} />
      <FigureEvidence
        items={[
          ['n', count],
          ['Performance slope', analysis.performanceTrend === null ? '-' : pretty(analysis.performanceTrend, 2)],
          ['Load slope', analysis.loadTrend === null ? '-' : pretty(analysis.loadTrend, 2)],
          ['Pain slope', analysis.irritationTrend === null ? '-' : pretty(analysis.irritationTrend, 2)],
          ['Fatigue slope', analysis.fatigueTrend === null ? '-' : pretty(analysis.fatigueTrend, 2)],
          ['Status', adaptation.confidence || adaptation.status || 'Collecting'],
        ]}
      />
      <Text style={styles.figureInterpretation}>{adaptation.trainingInterpretation}</Text>
      <Text style={styles.figureLimitation}>{adaptation.limitation}</Text>
    </View>
  );
}

function RecoveryDualLineFigure({ analysis }) {
  const freshnessMetric = dashboardMetrics.find((metric) => metric.key === 'freshness');
  const sorenessMetric = dashboardMetrics.find((metric) => metric.key === 'soreness');
  const freshnessPoints = metricSeries(analysis, 'freshness');
  const sorenessPoints = metricSeries(analysis, 'soreness');
  const freshnessStats = metricStats(analysis, 'freshness');
  const sorenessStats = metricStats(analysis, 'soreness');
  const count = Math.min(freshnessStats.count || 0, sorenessStats.count || 0);
  const freshnessInsight = analysis.trendInsights?.freshness;
  const sorenessInsight = analysis.trendInsights?.soreness;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Freshness and Soreness Trends</Text>
      <Text style={styles.figureResult}>{freshnessInsight?.evidenceStatement || 'Freshness trend is collecting.'} {sorenessInsight?.evidenceStatement || 'Soreness trend is collecting.'}</Text>
      <MultiMetricLineChart
        series={[
          { key: 'freshness', label: freshnessMetric.label, color: freshnessMetric.color, points: freshnessPoints, stats: freshnessStats },
          { key: 'soreness', label: sorenessMetric.label, color: '#E13F32', points: sorenessPoints, stats: sorenessStats },
        ]}
      />
      <FigureEvidence
        items={[
          ['Freshness mean', freshnessStats.avg === null ? '-' : pretty(freshnessStats.avg, 1)],
          ['Soreness mean', sorenessStats.avg === null ? '-' : pretty(sorenessStats.avg, 1)],
          ['Freshness slope', freshnessStats.trend === null ? '-' : pretty(freshnessStats.trend, 2)],
          ['Soreness slope', sorenessStats.trend === null ? '-' : pretty(sorenessStats.trend, 2)],
          ['Status', freshnessInsight?.status || sorenessInsight?.status || 'Collecting'],
        ]}
      />
      <Text style={styles.figureInterpretation}>{freshnessInsight?.interpretation || ''} {sorenessInsight?.interpretation || ''}</Text>
      <Text style={styles.figureLimitation}>{freshnessInsight?.limitation || sorenessInsight?.limitation || 'Trend comparison reflects stored logs only.'}</Text>
    </View>
  );
}

function ReadinessStateCard({ analysis }) {
  const metric = dashboardMetrics.find((item) => item.key === 'readiness');
  const points = metricSeries(analysis, 'readiness');
  const stats = metricStats(analysis, 'readiness');
  const latest = analysis.latest.readiness;
  const insight = analysis.trendInsights?.readiness;
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Readiness Current State</Text>
      <Text style={styles.figureResult}>{insight?.evidenceStatement || 'Readiness trend is collecting.'}</Text>
      <Text style={styles.axisLabel}>Gauge scale: 0-10 readiness</Text>
      <Gauge value={latest} />
      <Text style={styles.bigGreen}>{pretty(latest, 1)}</Text>
      <FigureEvidence items={[['n', stats.count], ['Mean', stats.avg === null ? '-' : pretty(stats.avg, 1)], ['SD', stats.sd === null ? '-' : pretty(stats.sd, 1)], ['Status', insight?.status || 'Collecting']]} />
      <Text style={styles.figureInterpretation}>{insight?.interpretation || 'Readiness interpretation is collecting.'}</Text>
      <Text style={styles.figureLimitation}>{insight?.limitation || 'Trend reflects stored logs only.'}</Text>
    </View>
  );
}

function AdaptationLineChart({ series }) {
  const activeSeries = series.filter((item) => item.points.length >= 2);
  const dates = [...new Set(activeSeries.flatMap((item) => item.points.map((point) => point.date)))].sort((a, b) => new Date(a) - new Date(b)).slice(-8);
  const chartWidth = 320;
  const chartHeight = 188;
  const padding = { left: 30, right: 92, top: 18, bottom: 30 };

  if (dates.length < 2 || !activeSeries.length) {
    return (
      <View style={styles.timeChartEmpty}>
        <Text style={styles.muted}>Needs at least two stored observations for adaptation component lines.</Text>
      </View>
    );
  }

  function pointForDate(item, date) {
    return item.points.find((point) => point.date === date);
  }

  const plottedSeries = activeSeries.map((item) => {
    const values = dates.map((date) => pointForDate(item, date)?.value).filter((value) => Number.isFinite(value));
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const coords = dates
      .map((date, index) => {
        const point = pointForDate(item, date);
        if (!point || !Number.isFinite(point.value)) return null;
        return {
          key: `${item.key}-${date}`,
          ...scaleSvgPoint(point.value, index, dates.length, min, range, chartWidth, chartHeight, padding),
          value: point.value,
        };
      })
      .filter(Boolean);

    if (coords.length < 2) return null;
    return { ...item, coords, path: smoothSvgPath(coords) };
  }).filter(Boolean);

  const rawLabels = plottedSeries
    .map((item) => ({ key: item.key, label: item.label, color: item.color, y: item.coords[item.coords.length - 1].y }))
    .sort((a, b) => a.y - b.y)
    .reduce((items, item) => {
      const previous = items[items.length - 1];
      const y = previous ? Math.max(item.y, previous.displayY + 14) : Math.max(padding.top, item.y);
      return [...items, { ...item, displayY: y }];
    }, []);
  const maxLabelY = chartHeight - padding.bottom + 4;
  const labelOverflow = rawLabels.length ? Math.max(0, rawLabels[rawLabels.length - 1].displayY - maxLabelY) : 0;
  const labels = rawLabels.map((item) => ({ ...item, displayY: Math.max(padding.top, item.displayY - labelOverflow) }));

  return (
    <View style={styles.adaptationChartWrap}>
      <Text style={styles.yAxisLabel}>Y: normalized component state</Text>
      <View style={styles.adaptationChart}>
        <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          <Line x1={padding.left} y1={padding.top + 58} x2={chartWidth - padding.right} y2={padding.top + 58} stroke="#E6E6E1" strokeWidth="1" />
          <Line x1={padding.left} y1={padding.top} x2={padding.left} y2={chartHeight - padding.bottom} stroke="#D8D8D4" strokeWidth="1" />
          <Line x1={padding.left} y1={chartHeight - padding.bottom} x2={chartWidth - padding.right} y2={chartHeight - padding.bottom} stroke="#D8D8D4" strokeWidth="1" />
          {plottedSeries.map((item) => (
            <Path key={`${item.key}-path`} d={item.path} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          ))}
          {plottedSeries.map((item) => {
            const end = item.coords[item.coords.length - 1];
            return <Circle key={`${item.key}-end`} cx={end.x} cy={end.y} r={4} fill="#FFFFFF" stroke={item.color} strokeWidth="2" />;
          })}
          {labels.map((item) => (
            <SvgText key={`${item.key}-label`} x={chartWidth - padding.right + 10} y={item.displayY + 4} fill={item.color} fontSize="10" fontWeight="700">
              {item.label}
            </SvgText>
          ))}
        </Svg>
      </View>
      <View style={styles.axisFooter}>
        <Text style={styles.axisLabel}>X: Date</Text>
        <Text style={styles.axisLabel}>{dateShort(dates[0])} to {dateShort(dates[dates.length - 1])}</Text>
      </View>
    </View>
  );
}

function MultiMetricLineChart({ series }) {
  const activeSeries = series.filter((item) => item.points.length >= 2);
  const dates = [...new Set(activeSeries.flatMap((item) => item.points.map((point) => point.date)))].sort((a, b) => new Date(a) - new Date(b)).slice(-12);
  const chartWidth = 320;
  const chartHeight = 172;
  const padding = { left: 32, right: 84, top: 16, bottom: 30 };

  if (dates.length < 2 || !activeSeries.length) {
    return (
      <View style={styles.timeChartEmpty}>
        <Text style={styles.muted}>Needs at least two stored observations for this comparison.</Text>
      </View>
    );
  }

  function pointForDate(item, date) {
    return item.points.find((point) => point.date === date);
  }

  const plottedSeries = activeSeries.map((item) => {
    const values = dates.map((date) => pointForDate(item, date)?.value).filter((value) => Number.isFinite(value));
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const coords = dates
      .map((date, index) => {
        const point = pointForDate(item, date);
        if (!point || !Number.isFinite(point.value)) return null;
        return scaleSvgPoint(point.value, index, dates.length, min, range, chartWidth, chartHeight, padding);
      })
      .filter(Boolean);
    if (coords.length < 2) return null;
    return { ...item, coords, path: smoothSvgPath(coords) };
  }).filter(Boolean);

  return (
    <View style={styles.axisChartWrap}>
      <Text style={styles.yAxisLabel}>Y: Normalized metric value</Text>
      <View style={styles.multiLineChart}>
        <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          <Line x1={padding.left} y1={padding.top + 54} x2={chartWidth - padding.right} y2={padding.top + 54} stroke="#ECECE8" strokeWidth="1" />
          <Line x1={padding.left} y1={padding.top} x2={padding.left} y2={chartHeight - padding.bottom} stroke="#D8D8D4" strokeWidth="1" />
          <Line x1={padding.left} y1={chartHeight - padding.bottom} x2={chartWidth - padding.right} y2={chartHeight - padding.bottom} stroke="#D8D8D4" strokeWidth="1" />
          {plottedSeries.map((item) => (
            <Path key={`${item.key}-path`} d={item.path} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          ))}
          {plottedSeries.map((item) => {
            const end = item.coords[item.coords.length - 1];
            return <Circle key={`${item.key}-end`} cx={end.x} cy={end.y} r={4} fill="#FFFFFF" stroke={item.color} strokeWidth="2" />;
          })}
          {plottedSeries.map((item, index) => {
            const end = item.coords[item.coords.length - 1];
            const y = Math.max(padding.top + 8, Math.min(chartHeight - padding.bottom, end.y + index * 6));
            return (
              <SvgText key={`${item.key}-label`} x={chartWidth - padding.right + 10} y={y + 4} fill={item.color} fontSize="10" fontWeight="700">
                {item.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
      <View style={styles.axisFooter}>
        <Text style={styles.axisLabel}>X: Date</Text>
        <Text style={styles.axisLabel}>{dateShort(dates[0])} to {dateShort(dates[dates.length - 1])}</Text>
      </View>
    </View>
  );
}

function MiniBarRow({ label, value, displayValue, max, color = '#24883B' }) {
  const width = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;
  return (
    <View style={styles.miniBarRow}>
      <View style={styles.miniBarLabelWrap}>
        <Text style={styles.muted}>{label}</Text>
        <Text style={styles.cardTitle}>{displayValue ?? value}</Text>
      </View>
      <View style={styles.relationshipTrack}>
        <View style={[styles.relationshipFill, { width: `${width}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MovementMix({ data, insight }) {
  const breakdown = insight?.breakdown || {};
  const total = insight?.total || Object.values(breakdown).reduce((sum, value) => sum + value, 0) || 1;
  const max = Math.max(...Object.values(breakdown), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Movement Type Frequency</Text>
      <Text style={styles.figureResult}>{insight?.statement || 'Movement type frequency is collecting.'}</Text>
      <Text style={styles.axisLabel}>X: Movement type / Y: Volume</Text>
      {Object.entries(breakdown).map(([key, value]) => (
        <MiniBarRow key={key} label={formatMetricName(key)} value={value} displayValue={`${Math.round((value / total) * 100)}%`} max={max} color="#24883B" />
      ))}
      <FigureEvidence items={insight?.evidenceItems || [['Total volume', '-'], ['Session count', (data.sessions || []).length], ['Status', 'Collecting']]} />
      <Text style={styles.figureLimitation}>{insight?.limitation || 'Movement frequency reflects stored completed sessions only.'}</Text>
    </View>
  );
}

function MaxIntentSummary({ data, insight }) {
  const byType = insight?.byType || {};
  const maxIntentCount = insight?.count || 0;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Max Intent Frequency</Text>
      <Text style={styles.figureResult}>{insight?.statement || 'Max-intent frequency is collecting.'}</Text>
      <Text style={styles.bigGreen}>{maxIntentCount}</Text>
      <Text style={styles.axisLabel}>X: Movement type / Y: Count</Text>
      {Object.entries(byType).map(([key, value]) => <MiniBarRow key={key} label={formatMetricName(key)} value={value} max={Math.max(...Object.values(byType), 1)} color="#188131" />)}
      <FigureEvidence items={insight?.evidenceItems || [['Max-intent exposures', maxIntentCount], ['Exercise count', '-'], ['Status', 'Collecting']]} />
      <Text style={styles.figureLimitation}>{insight?.limitation || 'Max-intent frequency reflects stored completed exercises only.'}</Text>
    </View>
  );
}

function BlockComparison({ data, analysis }) {
  const programme = data.programme;
  const macro = currentMacro(programme);
  const block = currentBlock(programme);
  const week = currentWeek(programme);
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Block Comparison</Text>
      <InsightLine label="Macro block" value={macro?.macro_block_name || '-'} />
      <InsightLine label="Training block" value={block?.block_name || '-'} />
      <InsightLine label="Week" value={week?.week_name || '-'} />
      <InsightLine label="Mean session load" value={analysis.avgLoad === null ? '-' : pretty(analysis.avgLoad, 1)} />
      <InsightLine label="Mean performance" value={analysis.avgPerformance === null ? '-' : pretty(analysis.avgPerformance, 1)} />
      <InsightLine label="Mean pain" value={analysis.avgPain === null ? '-' : pretty(analysis.avgPain, 1)} />
      <InsightLine label="Mean fatigue" value={analysis.avgFatigue === null ? '-' : pretty(analysis.avgFatigue, 1)} />
    </View>
  );
}

function ForecastCard({ title, basis, fallback, insight }) {
  const forecastInsight = basis?.insight || insight;
  return (
    <View style={styles.priorityCard}>
      <Text style={styles.label}>{title}</Text>
      <Text style={styles.priorityTitle}>{basis ? formatRelationshipName(basis.title) : forecastInsight?.label || 'Likely response collecting'}</Text>
      <Text style={styles.bodyText}>{forecastInsight?.evidenceStatement || fallback}</Text>
      {basis ? (
        <View style={styles.evidenceRow}>
          <Text style={styles.evidenceBadge}>r = {basis.r === null || basis.r === undefined ? '-' : pretty(basis.r, 2)}</Text>
          <Text style={styles.evidenceBadge}>n = {basis.points?.length || 0}</Text>
          <Text style={styles.evidenceBadge}>{basis.insight?.confidence || forecastInsight?.confidence || 'Collecting'}</Text>
        </View>
      ) : (
        <Text style={styles.tinyBadge}>No lagged scatterplot yet</Text>
      )}
      <Text style={styles.figureLimitation}>{forecastInsight?.limitation || 'No lagged response model has been calculated yet.'}</Text>
    </View>
  );
}

function ProfileScreen({
  data,
  analysis,
  currentUser,
  authEmail,
  authPassword,
  authLoading,
  setAuthEmail,
  setAuthPassword,
  updateProfileName,
  updateProfilePb,
  resetTutorialHints,
  replayOnboarding,
  onSignUp,
  onSignIn,
  onSignOut,
  onChangePassword,
  startTodayPerformance,
  setSelectedDashboardMetric,
  setScreen,
}) {
  const [showManualPbNotes, setShowManualPbNotes] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const pbs = data.profile?.pbs || {};
  const derivedPbs = derivePersonalBests(analysis, data);
  const hasLoggedPb = Object.values(derivedPbs).some((best) => Number.isFinite(best?.value));
  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Input label="Name" value={data.profile?.name || ''} onChangeText={updateProfileName} />
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.muted}>
              {currentUser ? (currentUser.email || currentUser.id) : 'Local mode'}
            </Text>
          </View>
          <View style={[styles.authStatus, currentUser && styles.authStatusActive]}>
            <Text style={[styles.authStatusText, currentUser && styles.authStatusTextActive]}>
              {currentUser ? 'Signed in' : 'Local mode'}
            </Text>
          </View>
        </View>
        {!currentUser ? (
          <>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Email"
              style={styles.input}
              value={authEmail}
              onChangeText={setAuthEmail}
            />
            <TextInput
              placeholder="Password"
              secureTextEntry
              style={styles.input}
              value={authPassword}
              onChangeText={setAuthPassword}
            />
            <View style={styles.authActions}>
              <Pressable style={styles.authButton} onPress={onSignUp} disabled={authLoading}>
                <Text style={styles.authButtonText}>Create Account</Text>
              </Pressable>
              <Pressable style={[styles.authButton, styles.authButtonDark]} onPress={onSignIn} disabled={authLoading}>
                <Text style={[styles.authButtonText, styles.authButtonTextLight]}>Sign In</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable style={styles.authButton} onPress={onSignOut} disabled={authLoading}>
            <Text style={styles.authButtonText}>Sign Out</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Quick Log</Text>
        <Text style={styles.bodyText}>Use today’s planned session if one exists, or start a new performance log.</Text>
        <ActionButton title="Log Performance" tone="black" onPress={startTodayPerformance} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Evidence</Text>
        <Text style={styles.bodyText}>Detailed charts, relationships, and raw trend checks live here when you want to inspect the numbers.</Text>
        <ActionButton
          title="Open Evidence"
          tone="outline"
          onPress={() => {
            setSelectedDashboardMetric('performance');
            setScreen('evidence');
          }}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Personal Bests</Text>
        <Text style={styles.bodyText}>PBs are calculated from your stored logs.</Text>
        <Text style={styles.muted}>Add performance metrics in Calendar or Log Performance to update PBs.</Text>
        {!hasLoggedPb ? <Text style={styles.figureLimitation}>PBs collecting from stored logs.</Text> : null}
        <View style={styles.profileFieldGrid}>
          {derivedPbFields.map((field) => (
            <PersonalBestItem key={field.key} field={field} best={derivedPbs[field.key]} manualValue={field.manualKey ? pbs[field.manualKey] : ''} />
          ))}
        </View>
        <Pressable style={styles.chevronRow} onPress={() => setShowManualPbNotes((current) => !current)}>
          <Text style={styles.chevronText}>Manual PB notes</Text>
          <Text style={styles.chevron}>{showManualPbNotes ? '⌃' : '⌄'}</Text>
        </Pressable>
        {showManualPbNotes ? (
          <View style={styles.profileFieldGrid}>
            {pbFields.map(([key, label]) => (
              <View key={key} style={styles.profileFieldCell}>
                <Input label={label} value={pbs[key] || ''} onChangeText={(value) => updateProfilePb(key, value)} />
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {currentUser ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Password</Text>
          <TextInput
            placeholder="New password"
            secureTextEntry
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <TextInput
            placeholder="Confirm password"
            secureTextEntry
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <ActionButton
            title="Change Password"
            tone="black"
            onPress={async () => {
              const ok = await onChangePassword(newPassword, confirmPassword);
              if (ok) {
                setNewPassword('');
                setConfirmPassword('');
              }
            }}
          />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>App setup</Text>
        <ActionButton title="Replay onboarding" tone="outline" onPress={replayOnboarding} />
        <ActionButton title="Reset tutorial hints" tone="outline" onPress={resetTutorialHints} />
      </View>
    </View>
  );
}

function PersonalBestItem({ field, best, manualValue }) {
  const hasLogged = Number.isFinite(best?.value);
  const hasManual = manualValue !== undefined && manualValue !== null && String(manualValue).trim() !== '';
  return (
    <View style={styles.profilePbItem}>
      <Text style={styles.currentReadLabel}>{field.label}</Text>
      <Text style={styles.currentReadValue}>
        {hasLogged ? pretty(best.value, field.key === 'rsi' ? 2 : 1) : hasManual ? `Manual note: ${manualValue}` : 'collecting'}
      </Text>
      {hasLogged ? (
        <Text style={styles.muted}>{best.date ? dateShort(best.date) : 'Date collecting'}{best.source ? ` / ${best.source}` : ''}</Text>
      ) : (
        <Text style={styles.muted}>{hasManual ? 'Manual note only; no logged PB yet.' : 'No stored value yet.'}</Text>
      )}
    </View>
  );
}

// Per-type load fields, driven by TYPE_META.fields so all 8 movement types render
// the right inputs without a branch per type.
function ExerciseFields({ draft, update }) {
  const meta = TYPE_META[draft.movement_type] || TYPE_META.skill;
  const fields = meta.fields || [];
  const has = (field) => fields.includes(field);
  return (
    <>
      <View style={styles.twoCol}>
        {has('sets') ? <Input label="Sets" value={String(draft.sets || '')} onChangeText={(value) => update('sets', value)} /> : null}
        {has('reps') ? <Input label="Reps" value={String(draft.reps || '')} onChangeText={(value) => update('reps', value)} /> : null}
        {has('contacts') ? <Input label="Contacts" value={String(draft.contacts || '')} onChangeText={(value) => update('contacts', value)} /> : null}
        {has('distance') ? <Input label="Distance (m)" value={String(draft.distance || '')} onChangeText={(value) => update('distance', value)} /> : null}
        {has('duration') ? <Input label="Duration (min)" value={String(draft.duration_minutes || '')} onChangeText={(value) => update('duration_minutes', value)} /> : null}
        {has('intent') ? <Input label="Intent %" value={String(draft.intent_percent || '')} onChangeText={(value) => update('intent_percent', value)} /> : null}
      </View>
      {has('intensity') ? (
        <>
          <View style={styles.twoCol}>
            <Input label="Intensity" value={String(draft.intensity_value || '')} onChangeText={(value) => update('intensity_value', value)} />
          </View>
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Intensity unit</Text>
            <ChipWrap options={intensityUnitOptions} value={draft.intensity_unit || '%'} onChange={(value) => update('intensity_unit', value)} />
          </View>
        </>
      ) : null}
      {has('rom') ? (
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>ROM</Text>
          <ChipWrap options={ROM_OPTIONS} value={draft.rom || 'full'} onChange={(value) => update('rom', value)} />
        </View>
      ) : null}
      {has('tempo') ? <TempoField value={draft.tempo} onChange={(value) => update('tempo', value)} /> : null}
    </>
  );
}

// Segmented tempo control: four phase cells composing an "ecc-pause-con-pause" string
// (e.g. 3-1-X-0). Clearer than a free-text field and guides the format.
function TempoField({ value, onChange }) {
  const parts = String(value || '').split('-');
  const phases = ['Lower', 'Hold', 'Raise', 'Hold'];
  const get = (index) => parts[index] || '';
  const setPart = (index, raw) => {
    const cleaned = raw.replace(/[^0-9xX]/g, '').slice(0, 1).toUpperCase();
    const next = [0, 1, 2, 3].map((slot) => (slot === index ? cleaned : (parts[slot] || '')));
    onChange(next.every((part) => part === '') ? '' : next.join('-'));
  };
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>Tempo</Text>
      <View style={styles.tempoRow}>
        {phases.map((label, index) => (
          <View key={label + index} style={styles.tempoCell}>
            <TextInput
              style={styles.tempoInput}
              value={String(get(index))}
              onChangeText={(raw) => setPart(index, raw)}
              placeholder="–"
              placeholderTextColor="#B9B9B2"
              maxLength={1}
              textAlign="center"
            />
            <Text style={styles.tempoCellLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.tempoHint}>seconds per phase · X = explosive</Text>
    </View>
  );
}

// Convert a library entry to an exercise-draft patch: type + FV tags + smart default fields.
function libraryEntryToDraft(entry) {
  return {
    movement_type: entry.type,
    exercise_name: entry.name,
    quality: entry.quality || defaultQualityForType(entry.type),
    specificity: entry.specificity || 'general',
    laterality: entry.laterality || 'bilateral',
    variation: '',
    ...defaultFieldsForType(entry.type),
  };
}

// A library pick already carries its FV tags, so an exercise is "custom" only when its
// name is not in the library (then the user sets coverage themselves).
function isCustomExercise(draft) {
  const name = (draft.exercise_name || '').trim();
  if (!name) return false;
  return !EXERCISE_LIBRARY.some((entry) => entry.name === name);
}

function CoverageChip({ label }) {
  if (!label) return null;
  return <View style={styles.coverageChip}><Text style={styles.coverageChipText}>{label}</Text></View>;
}

// Coverage tags. For library exercises the FV quality/specificity/laterality are
// inferred and shown read-only; only custom exercises expose the editable tags.
function ExerciseCoverageSection({ draft, update, isCustom }) {
  if (isCustom) {
    return (
      <View style={styles.tagsCard}>
        <Text style={styles.tagsTitle}>Coverage tags (custom)</Text>
        <Text style={styles.inputLabel}>FV quality</Text>
        <ChipWrap options={QUALITY_OPTIONS} value={draft.quality || ''} onChange={(value) => update('quality', value)} />
        <Text style={styles.inputLabel}>Specificity</Text>
        <ChipWrap options={SPECIFICITY_OPTIONS} value={draft.specificity || 'general'} onChange={(value) => update('specificity', value)} />
        <Text style={styles.inputLabel}>Laterality</Text>
        <ChipWrap options={LATERALITY_OPTIONS} value={draft.laterality || 'bilateral'} onChange={(value) => update('laterality', value)} />
        <Input label="Variation (optional)" value={String(draft.variation || '')} onChangeText={(value) => update('variation', value)} />
      </View>
    );
  }
  const specificityLabel = (SPECIFICITY_OPTIONS.find(([id]) => id === draft.specificity) || [])[1];
  return (
    <View style={styles.tagsCard}>
      <Text style={styles.tagsTitle}>Coverage · inferred</Text>
      <View style={styles.coverageChips}>
        <CoverageChip label={QUALITY_META[draft.quality]?.label} />
        <CoverageChip label={specificityLabel} />
        {draft.laterality === 'unilateral' ? <CoverageChip label="Single-leg" /> : null}
      </View>
      <Input label="Variation (optional)" value={String(draft.variation || '')} onChangeText={(value) => update('variation', value)} />
    </View>
  );
}

// Library-first exercise builder: tap to open the searchable picker, then edit
// per-type load fields. Coverage is inferred from the library (editable only if custom).
function ExerciseDraftEditor({ draft, update, showTags = true }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const applyPick = (entry) => {
    Object.entries(libraryEntryToDraft(entry)).forEach(([key, value]) => update(key, value));
    setPickerOpen(false);
  };
  const meta = TYPE_META[draft.movement_type] || {};
  const chosen = !!draft.exercise_name;
  return (
    <>
      <Pressable style={styles.libraryPickBtn} onPress={() => setPickerOpen(true)}>
        <Text style={styles.libraryPickText}>{chosen ? draft.exercise_name : 'Choose exercise'}</Text>
        <Text style={styles.libraryPickMeta}>{chosen ? (meta.label || 'Exercise') : 'Search the library or create custom'}</Text>
      </Pressable>
      {chosen ? (
        <>
          <ExerciseFields draft={draft} update={update} />
          {showTags ? <ExerciseCoverageSection draft={draft} update={update} isCustom={isCustomExercise(draft)} /> : null}
        </>
      ) : null}
      <ExercisePicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={applyPick} />
    </>
  );
}

// Searchable, pre-tagged library picker. Library-first selection; creating a custom
// exercise requires choosing a type (which sets its load formula + default quality).
function ExercisePicker({ visible, onClose, onPick }) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedFamily, setExpandedFamily] = useState(null);
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState('');

  function reset() {
    setQuery('');
    setTypeFilter('');
    setExpandedFamily(null);
    setCustomMode(false);
    setCustomName('');
    setCustomType('');
  }
  function close() { reset(); onClose(); }
  function pick(entry) { reset(); onPick(entry); }
  const canCreate = customName.trim() && customType;
  function createCustom() {
    if (!canCreate) return;
    pick({ name: customName.trim(), type: customType, quality: defaultQualityForType(customType), specificity: 'general', laterality: 'bilateral' });
  }

  const searching = query.trim().length > 0;
  const results = searchLibrary(query, typeFilter);
  const families = FAMILY_ORDER
    .map((family) => [family, results.filter((entry) => entry.family === family)])
    .filter(([, items]) => items.length);
  const typeFilterOptions = [['', 'All'], ...TYPE_OPTIONS];

  const renderRow = (entry) => (
    <Pressable key={entry.name} style={styles.exRow} onPress={() => pick(entry)}>
      <View style={styles.flex}>
        <Text style={styles.pickerRowName}>{entry.name}</Text>
        <Text style={styles.pickerRowMeta}>{(TYPE_META[entry.type] || {}).label}{entry.laterality === 'unilateral' ? ' · single-leg' : ''}</Text>
      </View>
      <Text style={styles.pickerRowChevron}>›</Text>
    </Pressable>
  );

  // Render a family's exercises, sub-grouped under their umbrella headers (e.g. Pogos, Bounds).
  const renderFamilyItems = (items) => {
    const order = [];
    const byGroup = {};
    items.forEach((entry) => {
      const group = entry.group || '';
      if (!(group in byGroup)) { byGroup[group] = []; order.push(group); }
      byGroup[group].push(entry);
    });
    const hasGroups = order.some((group) => group);
    return order.map((group) => (
      <View key={group || 'ungrouped'}>
        {hasGroups && group ? <Text style={styles.pickerSubgroupTitle}>{group}</Text> : null}
        {byGroup[group].map(renderRow)}
      </View>
    ));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.pickerBackdrop}>
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{customMode ? 'Create custom' : 'Choose exercise'}</Text>
            <Pressable onPress={close}><Text style={styles.pickerClose}>Done</Text></Pressable>
          </View>
          {customMode ? (
            <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
              <Input label="Exercise name" value={customName} onChangeText={setCustomName} />
              <Text style={styles.inputLabel}>Type — required (sets load + coverage)</Text>
              <ChipWrap options={TYPE_OPTIONS} value={customType} onChange={setCustomType} />
              {customType ? <Text style={styles.pickerHint}>Default quality: {QUALITY_META[defaultQualityForType(customType)]?.label || 'untagged'}</Text> : null}
              <Pressable style={[styles.primaryBtn, !canCreate && styles.btnDisabled]} disabled={!canCreate} onPress={createCustom}>
                <Text style={styles.primaryBtnText}>Add custom exercise</Text>
              </Pressable>
              <Pressable style={styles.pickerLink} onPress={() => setCustomMode(false)}><Text style={styles.pickerLinkText}>‹ Back to library</Text></Pressable>
            </ScrollView>
          ) : (
            <>
              <TextInput style={styles.pickerSearch} placeholder="Search exercises…" placeholderTextColor="#9A9A93" value={query} onChangeText={setQuery} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerFilters} contentContainerStyle={styles.pickerFiltersInner}>
                {typeFilterOptions.map(([id, label]) => (
                  <Pressable key={id || 'all'} style={[styles.pickerFilter, typeFilter === id && styles.pickerFilterSel]} onPress={() => setTypeFilter(id)}>
                    <Text style={[styles.pickerFilterText, typeFilter === id && styles.pickerFilterTextSel]}>{label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
                {families.length === 0 ? <Text style={styles.pickerEmpty}>No matches. Try "Create custom".</Text> : null}
                {searching
                  ? families.map(([family, items]) => (
                    <View key={family} style={styles.pickerGroup}>
                      <Text style={styles.pickerGroupTitle}>{family}</Text>
                      {renderFamilyItems(items)}
                    </View>
                  ))
                  : families.map(([family, items]) => {
                    const open = expandedFamily === family;
                    return (
                      <View key={family} style={styles.pickerFamily}>
                        <Pressable style={styles.pickerFamilyHeader} onPress={() => setExpandedFamily(open ? null : family)}>
                          <Text style={[styles.pickerFamilyName, styles.flex]}>{family}</Text>
                          <Text style={styles.pickerFamilyCount}>{items.length}</Text>
                          <Text style={styles.pickerFamilyChevron}>{open ? '▾' : '▸'}</Text>
                        </Pressable>
                        {open ? <View style={styles.pickerFamilyBody}>{renderFamilyItems(items)}</View> : null}
                      </View>
                    );
                  })}
                <Pressable style={styles.pickerCustomBtn} onPress={() => { setCustomMode(true); setCustomName(query); }}>
                  <Text style={styles.pickerCustomText}>+ Create custom exercise</Text>
                </Pressable>
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Live load-shape preview: one bar per week showing total planned load across the block.
function LoadShapePreview({ block, currentWeekId }) {
  const weeks = (block?.weeks || []).slice().sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
  if (!weeks.length) return null;
  const loads = weeks.map((week) => jsWeekLoad(week));
  const max = Math.max(...loads, 1);
  return (
    <View style={styles.loadShapeCard}>
      <Text style={styles.tagsTitle}>Load shape · weekly planned load</Text>
      <View style={styles.loadShapeBars}>
        {weeks.map((week, index) => {
          const height = Math.max(4, Math.round((loads[index] / max) * 56));
          const active = week.id === currentWeekId;
          return (
            <View key={week.id} style={styles.loadShapeCol}>
              <View style={styles.loadShapeTrack}>
                <View style={[styles.loadShapeBar, { height }, active && styles.loadShapeBarActive]} />
              </View>
              <Text style={[styles.loadShapeLabel, active && styles.loadShapeLabelActive]}>{index + 1}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.loadShapeMeta}>Each bar is a week's total planned load. Build the shape you want — steady build, wave, or build-then-deload.</Text>
    </View>
  );
}

// Pick a session template to drop onto a day: the user's saved templates first
// ("Save tmpl" on any session), then the curated starters.
function TemplatePicker({ visible, onClose, onPick, custom = [], onDelete }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Session templates</Text>
            <Pressable onPress={onClose}><Text style={styles.pickerClose}>Done</Text></Pressable>
          </View>
          <ScrollView style={styles.pickerScroll}>
            {custom.length ? <Text style={styles.pickerGroupTitle}>Your templates</Text> : null}
            {custom.map((template) => (
              <View key={template.id} style={styles.exRow}>
                <Pressable style={styles.flex} onPress={() => onPick(template)}>
                  <Text style={styles.pickerRowName}>{template.name}</Text>
                  <Text style={styles.pickerRowMeta}>{template.focus ? `${template.focus} · ` : ''}{(template.exercises || []).length} exercises</Text>
                </Pressable>
                {onDelete ? <Pressable hitSlop={8} onPress={() => onDelete(template.id)}><Text style={styles.dangerText}>Remove</Text></Pressable> : null}
              </View>
            ))}
            <Text style={styles.pickerGroupTitle}>Starter templates</Text>
            {SESSION_TEMPLATES.map((template) => (
              <Pressable key={template.name} style={styles.exRow} onPress={() => onPick(template)}>
                <View style={styles.flex}>
                  <Text style={styles.pickerRowName}>{template.name}</Text>
                  <Text style={styles.pickerRowMeta}>{template.focus} · {template.items.length} exercises</Text>
                </View>
                <Text style={styles.pickerRowChevron}>›</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Header({ title, subtitle, onBack, right, onRight }) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.headerButton} onPress={onBack}><Text style={styles.headerIcon}>‹</Text></Pressable>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      <Pressable style={styles.headerButton} onPress={onRight}><Text style={styles.headerIcon}>{right === 'check' ? '✓' : ''}</Text></Pressable>
    </View>
  );
}

function FormSection({ number, title, children }) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.formTitle}>{number} {title}</Text>
      {children}
    </View>
  );
}

function Input({ label, value, onChangeText, editable = true }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput style={styles.input} value={String(value ?? '')} onChangeText={onChangeText} editable={editable} />
    </View>
  );
}
function DateRangePickerCard({ title, startDate, endDate, onSave, onCancel }) {
  const [visibleMonth, setVisibleMonth] = useState(startDate || endDate || isoDate());
  const [draftStart, setDraftStart] = useState(startDate || '');
  const [draftEnd, setDraftEnd] = useState(endDate || '');

  const days = monthCalendarDays(visibleMonth);

  function dateTime(value) {
    return new Date(`${value}T00:00:00`).getTime();
  }

  function isInSelectedRange(dayIso) {
    if (!draftStart || !draftEnd) return false;
    const time = dateTime(dayIso);
    return time >= dateTime(draftStart) && time <= dateTime(draftEnd);
  }

  function selectDate(dayIso) {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(dayIso);
      setDraftEnd('');
      return;
    }

    if (dateTime(dayIso) < dateTime(draftStart)) {
      setDraftStart(dayIso);
      setDraftEnd('');
      return;
    }

    setDraftEnd(dayIso);
  }

  function saveRange() {
    if (!draftStart || !draftEnd) {
      Alert.alert('Date range required', 'Select a start date and an end date.');
      return;
    }

    if (!isDateRangeValid(draftStart, draftEnd)) {
      Alert.alert('Invalid date range', 'End date cannot be before start date.');
      return;
    }

    onSave(draftStart, draftEnd);
  }

  return (
    <View style={styles.dateRangePickerCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable style={styles.miniButton} onPress={() => {
          setDraftStart('');
          setDraftEnd('');
        }}>
          <Text style={styles.miniButtonText}>Clear</Text>
        </Pressable>
      </View>

      <View style={styles.rangePreviewRow}>
        <View style={styles.rangePreviewItem}>
          <Text style={styles.inputLabel}>Start</Text>
          <Text style={styles.rangePreviewValue}>{draftStart ? formatRangeDate(draftStart) : 'Select'}</Text>
        </View>
        <View style={styles.rangePreviewItem}>
          <Text style={styles.inputLabel}>End</Text>
          <Text style={styles.rangePreviewValue}>{draftEnd ? formatRangeDate(draftEnd) : 'Select'}</Text>
        </View>
      </View>

      <View style={styles.miniCalendarHeader}>
        <Pressable style={styles.miniCalendarArrow} onPress={() => setVisibleMonth((current) => addMonths(current, -1))}>
          <Text style={styles.chevron}>‹</Text>
        </Pressable>
        <Text style={styles.miniCalendarTitle}>{monthLabel(visibleMonth)}</Text>
        <Pressable style={styles.miniCalendarArrow} onPress={() => setVisibleMonth((current) => addMonths(current, 1))}>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.monthWeekHeader}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
          <Text key={label} style={styles.monthWeekHeaderText}>{label}</Text>
        ))}
      </View>

      <View style={styles.rangeCalendarGrid}>
        {days.map((day) => {
          const isStart = draftStart === day.iso;
          const isEnd = draftEnd === day.iso;
          const inRange = isInSelectedRange(day.iso);
          const selected = isStart || isEnd;

          return (
            <Pressable
              key={day.iso}
              style={[
                styles.rangeDayCell,
                day.outsideMonth && styles.rangeDayOutside,
                inRange && styles.rangeDayInRange,
                selected && styles.rangeDaySelected,
              ]}
              onPress={() => selectDate(day.iso)}
            >
              <Text style={[
                styles.rangeDayText,
                day.outsideMonth && styles.rangeDayTextOutside,
                selected && styles.rangeDayTextSelected,
              ]}>
                {day.day}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.programmeActions}>
        <Pressable style={styles.miniButton} onPress={onCancel}>
          <Text style={styles.miniButtonText}>Cancel</Text>
        </Pressable>
        <Pressable style={[styles.miniButton, styles.miniButtonDark]} onPress={saveRange}>
          <Text style={[styles.miniButtonText, styles.miniButtonTextLight]}>Use Range</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MetricInputs({ metricType, metrics, onChangeMetric }) {
  if (metricType === 'jumping' || metricType === 'jump_output' || metricType === 'jump_rsi') {
    const rsi = actualMetricValue({ metrics }, 'rsi');
    return (
      <>
        <Input label="Height / Distance" value={metrics.height_or_distance || ''} onChangeText={(value) => onChangeMetric('height_or_distance', value)} />
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Unit</Text>
          <ChipWrap
            options={jumpDistanceUnitOptions}
            value={metrics.height_or_distance_unit || metrics.unit || 'cm'}
            onChange={(value) => onChangeMetric('height_or_distance_unit', value)}
          />
        </View>
        <View style={styles.twoCol}>
          <Input label="FT (ms)" value={metrics.ft || ''} onChangeText={(value) => onChangeMetric('ft', value)} />
          <Input label="GCT (ms)" value={metrics.gct || ''} onChangeText={(value) => onChangeMetric('gct', value)} />
        </View>
        <Text style={styles.smallCopy}>Auto RSI: {pretty(rsi, 2)}</Text>
      </>
    );
  }
  if (metricType === 'sprinting' || metricType === 'sprint') {
    return (
      <>
        <View style={styles.twoCol}>
          <Input label="Sprint time" value={metrics.sprint_time || metrics.time || ''} onChangeText={(value) => onChangeMetric('sprint_time', value)} />
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Time unit</Text>
            <ChipWrap
              options={sprintTimeUnitOptions}
              value={metrics.sprint_time_unit || 'seconds'}
              onChange={(value) => onChangeMetric('sprint_time_unit', value)}
            />
          </View>
        </View>
        <View style={styles.twoCol}>
          <Input label="Distance" value={metrics.distance || ''} onChangeText={(value) => onChangeMetric('distance', value)} />
          <View style={styles.inputWrap}>
            <Text style={styles.inputLabel}>Distance unit</Text>
            <ChipWrap
              options={sprintDistanceUnitOptions}
              value={metrics.distance_unit || 'metres'}
              onChange={(value) => onChangeMetric('distance_unit', value)}
            />
          </View>
        </View>
      </>
    );
  }
  return (
    <>
      <View style={styles.twoCol}>
        <Input label="Weight" value={metrics.weight || ''} onChangeText={(value) => onChangeMetric('weight', value)} />
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Weight unit</Text>
          <ChipWrap
            options={weightUnitOptions}
            value={metrics.weight_unit || 'kg'}
            onChange={(value) => onChangeMetric('weight_unit', value)}
          />
        </View>
      </View>
      <View style={styles.twoCol}>
        <Input label="Bar velocity" value={metrics.bar_velocity || ''} onChangeText={(value) => onChangeMetric('bar_velocity', value)} />
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Velocity unit</Text>
          <ChipWrap
            options={barVelocityUnitOptions}
            value={metrics.bar_velocity_unit || 'm/s'}
            onChange={(value) => onChangeMetric('bar_velocity_unit', value)}
          />
        </View>
      </View>
    </>
  );
}

function AttemptMetricChart({ series }) {
  const activeSeries = series.filter((item) => item.points.length >= 2);
  const chartWidth = 320;
  const chartHeight = 104;
  const padding = { left: 34, right: 12, top: 12, bottom: 22 };

  if (activeSeries.length === 0) {
    return (
      <View style={styles.timeChartEmpty}>
        <Text style={styles.muted}>Log at least two valid attempts to see attempt trends.</Text>
      </View>
    );
  }

  return (
    <View style={styles.attemptMiniGrid}>
      {activeSeries.map((item) => {
        const values = item.points.map((point) => point.value).filter(Number.isFinite);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const coords = item.points.map((point, index) => ({
          ...scaleSvgPoint(point.value, index, item.points.length, min, range, chartWidth, chartHeight, padding),
          label: point.label,
          value: point.value,
        }));
        const path = smoothSvgPath(coords);
        const guidance = bestModeForMetric(item.key) === 'min' ? 'Lower is better' : 'Higher is better';
        return (
          <View key={`${item.key}-attempt-card`} style={styles.attemptMiniCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{item.label}</Text>
              <Text style={styles.axisLabel}>{guidance}</Text>
            </View>
            <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              <Line x1={padding.left} y1={padding.top} x2={padding.left} y2={chartHeight - padding.bottom} stroke="#D8D8D4" strokeWidth="1" />
              <Line x1={padding.left} y1={chartHeight - padding.bottom} x2={chartWidth - padding.right} y2={chartHeight - padding.bottom} stroke="#D8D8D4" strokeWidth="1" />
              <SvgText x={4} y={padding.top + 4} fill="#777771" fontSize="10" fontWeight="700">{displayMetricValue(item.key, max, 1)}</SvgText>
              <SvgText x={4} y={chartHeight - padding.bottom} fill="#777771" fontSize="10" fontWeight="700">{displayMetricValue(item.key, min, 1)}</SvgText>
              <Path d={path} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {coords.map((coord, index) => (
                <Circle key={`${item.key}-${index}`} cx={coord.x} cy={coord.y} r={3.5} fill="#FFFFFF" stroke={item.color} strokeWidth="2" />
              ))}
            </Svg>
            <View style={styles.axisFooter}>
              <Text style={styles.axisLabel}>First attempt</Text>
              <Text style={styles.axisLabel}>Last attempt</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SliderField({ label, value, onChange }) {
  const numeric = Math.max(0, Math.min(10, toNumber(value)));
  const [trackWidth, setTrackWidth] = useState(1);

  function updateFromLocation(locationX) {
    const clampedX = Math.max(0, Math.min(trackWidth, locationX));
    const nextValue = Math.round((clampedX / Math.max(trackWidth, 1)) * 10);
    onChange(Math.max(0, Math.min(10, nextValue)));
  }

  return (
    <View style={styles.sliderWrap}>
      <View style={styles.rowBetween}>
        <Text style={styles.inputLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{numeric}</Text>
      </View>
      <View style={styles.sliderRow}>
        <Pressable style={styles.stepButton} onPress={() => onChange(Math.max(0, numeric - 1))}><Text>-</Text></Pressable>
        <View
          style={styles.sliderTrack}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width || 1)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(event) => updateFromLocation(event.nativeEvent.locationX)}
          onResponderMove={(event) => updateFromLocation(event.nativeEvent.locationX)}
        >
          <View style={[styles.sliderFill, { width: `${numeric * 10}%` }]} />
          <View style={[styles.sliderThumb, { left: `${numeric * 10}%` }]} />
        </View>
        <Pressable style={styles.stepButton} onPress={() => onChange(Math.min(10, numeric + 1))}><Text>+</Text></Pressable>
      </View>
    </View>
  );
}

function PickerButtons({ label, value, options, onChange }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.pickerRow}>
        {options.map(([id, text]) => (
          <Pressable key={id} style={[styles.pickerChip, value === id && styles.pickerActive]} onPress={() => onChange(id)}>
            <Text style={[styles.pickerText, value === id && styles.pickerTextActive]}>{text}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ChipWrap({ options, value, onChange }) {
  return (
    <View style={styles.chipWrap}>
      {options.map(([id, text]) => (
        <Pressable key={id} style={[styles.chip, value === id && styles.chipActive]} onPress={() => onChange?.(id)}>
          <Text style={[styles.chipText, value === id && styles.chipTextActive]}>{text}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SelectLike({ value }) {
  return (
    <View style={styles.selectLike}>
      <Text style={styles.selectText}>{value}</Text>
      <Text style={styles.selectText}>⌄</Text>
    </View>
  );
}

function ActionButton({ title, tone, onPress }) {
  return (
    <Pressable style={[styles.action, styles[`action_${tone}`]]} onPress={onPress}>
      <Text style={[styles.actionText, tone === 'outline' && styles.actionOutlineText]}>{title}</Text>
    </Pressable>
  );
}

function BottomNav({ screen, setScreen }) {
  const active = {
    today: 'today',
    checkin: 'today',
    session: 'today',
    performanceSession: 'today',
    addExercise: 'today',
    review: 'today',
    checkinReview: 'today',
    calendar: 'calendar',
    editCalendar: 'calendar',
    editBlockCalendar: 'calendar',
    editPlannedSession: 'calendar',
    insights: 'insights',
    detail: 'insights',
    dashboard: 'profile',
    evidence: 'profile',
    profile: 'profile',
  }[screen];
  return (
    <View style={styles.nav}>
      {[
        ['today', '⌂', 'Today'],
        ['calendar', '▦', 'Plan'],
        ['insights', '∿', 'Trends'],
        ['profile', '○', 'Profile'],
      ].map(([id, icon, label]) => (
        <Pressable key={id} style={styles.navItem} onPress={() => setScreen(id)}>
          <Text style={[styles.navIcon, active === id && styles.navActive]}>{icon}</Text>
          <Text style={[styles.navLabel, active === id && styles.navActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Gauge({ value }) {
  const width = Math.max(15, Math.min(100, toNumber(value) * 10));
  return (
    <View style={styles.gauge}>
      <View style={[styles.gaugeFill, { width: `${width}%` }]} />
    </View>
  );
}

function MiniSpark({ color, values = [] }) {
  const clean = values.filter((value) => Number.isFinite(value)).slice(-6);
  if (!clean.length) {
    return (
      <View style={styles.sparkEmpty}>
        <Text style={styles.axisLabel}>Collecting</Text>
      </View>
    );
  }
  const max = Math.max(...clean);
  const min = Math.min(...clean);
  const range = max - min || 1;
  const chartWidth = 120;
  const chartHeight = 38;
  const padding = { left: 4, right: 4, top: 5, bottom: 5 };
  const coords = clean.map((value, index) => scaleSvgPoint(value, index, clean.length, min, range, chartWidth, chartHeight, padding));
  const path = clean.length >= 2 ? smoothSvgPath(coords) : '';
  return (
    <View style={styles.spark}>
      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {path ? <Path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {coords.map((coord, index) => <Circle key={`spark-dot-${index}`} cx={coord.x} cy={coord.y} r={2.5} fill={color} />)}
      </Svg>
    </View>
  );
}

function Scatter({ points, color, xLabel = 'Predictor', yLabel = 'Outcome' }) {
  if (!points.length) {
    return (
      <View style={styles.scatterEmpty}>
        <Text style={styles.muted}>Needs more paired logs for this relationship.</Text>
      </View>
    );
  }

  const xValues = points.map((point) => point.x).filter((value) => Number.isFinite(value));
  const yValues = points.map((point) => point.y).filter((value) => Number.isFinite(value));
  const xMin = Math.min(...xValues, 0);
  const xMax = Math.max(...xValues, 10);
  const yMin = Math.min(...yValues, 0);
  const yMax = Math.max(...yValues, 10);
  const scale = (value, min, max) => {
    if (max === min) return 50;
    return Math.max(4, Math.min(92, ((value - min) / (max - min)) * 88 + 4));
  };
  return (
    <View style={styles.scatterWrap}>
      <Text style={styles.yAxisLabel}>Y: {yLabel}</Text>
      <View style={styles.scatter}>
        {[2, 4, 6, 8].map((line) => <View key={line} style={[styles.gridLine, { bottom: `${line * 10}%` }]} />)}
        {points.slice(0, 35).map((point, index) => (
          <View
            key={`${point.id || index}`}
            style={[
              styles.dot,
              {
                left: `${scale(point.x, xMin, xMax)}%`,
                bottom: `${scale(point.y, yMin, yMax)}%`,
                backgroundColor: color,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.axisFooter}>
        <Text style={styles.axisLabel}>X: {xLabel}</Text>
        <Text style={styles.axisLabel}>n = {points.length}</Text>
      </View>
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

function InlineEdit({ label, value, onChangeText }) {
  return (
    <View style={styles.inlineEdit}>
      <Text style={styles.inlineLabel}>{label}</Text>
      <TextInput style={styles.inlineValue} value={value} onChangeText={onChangeText} />
    </View>
  );
}

function InsightLine({ label, value }) {
  return (
    <View style={styles.insightLine}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.cardTitle}>{value}</Text>
    </View>
  );
}

function InsightMetric({ label, value, note }) {
  return (
    <View style={styles.insightMetric}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.bigGreen}>{value}</Text>
      <Text style={styles.positive}>{note}</Text>
    </View>
  );
}

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2EEE5' },
  flex: { flex: 1 },
  loading: { margin: 24, fontWeight: '800' },
  backendState: { gap: 14, padding: 24 },
  appShell: { flex: 1 },
  content: { padding: 20, paddingBottom: 144 },
  screen: { gap: 18 },
  onboardingContent: { paddingBottom: 40 },
  onboardingScreen: { gap: 18, paddingTop: 16 },
  onboardingSteps: { flexDirection: 'row', gap: 8 },
  onboardingStepDot: { backgroundColor: '#D9D9D4', borderRadius: 999, height: 8, width: 26 },
  onboardingStepDotActive: { backgroundColor: '#111111', width: 42 },
  onboardingInfoCard: { backgroundColor: '#F2EEE5', borderColor: '#E8E8E4', borderRadius: 14, borderWidth: 1, gap: 6, padding: 12 },
  tutorialHint: { alignItems: 'flex-start', backgroundColor: '#ECF8EF', borderColor: '#CFE8D4', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 14 },
  hintDismiss: { backgroundColor: '#111111', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  hintDismissText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  h1: { fontSize: 30, fontWeight: '700', color: '#111111', letterSpacing: -0.4, fontFamily: SERIF },
  screenSubtitle: { color: '#686862', fontSize: 15, fontWeight: '500', lineHeight: 21, fontFamily: SERIF },
  date: { marginTop: 10, fontSize: 14, fontWeight: '500', color: '#6D6D68', fontStyle: 'italic', fontFamily: SERIF },
  streak: { marginTop: 4, color: '#7A7A76', fontWeight: '700' },
  heroCard: { backgroundColor: '#FBF8F0', borderColor: '#E6E4DC', borderWidth: 1, borderRadius: 16, padding: 18, minHeight: 126 },
  heroLabel: { color: '#6D6D68', fontSize: 12, fontWeight: '800' },
  heroScore: { color: '#1A1C16', fontSize: 34, fontWeight: '700', marginTop: 10, fontFamily: SERIF },
  heroScale: { color: '#9A9A8E', fontSize: 14 },
  heroCopy: { color: '#5E5E58', fontSize: 12, fontWeight: '700', marginTop: 8 },
  gauge: { position: 'absolute', right: 18, top: 32, width: 86, height: 8, backgroundColor: '#E6E4DC', borderRadius: 8 },
  gaugeFill: { height: 8, backgroundColor: '#1F8A3E', borderRadius: 8 },
  panelAttached: { backgroundColor: '#FBF8F0', borderColor: '#E6E6E1', borderWidth: 1, borderRadius: 16, marginTop: 12, padding: 16 },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1F8A3E', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', fontFamily: SERIF },
  readRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  readMain: { flex: 1 },
  ringWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  ringValue: { position: 'absolute', alignItems: 'center' },
  ringNum: { fontSize: 28, fontWeight: '700', color: '#1A1C16', fontFamily: SERIF, lineHeight: 30 },
  ringScale: { fontSize: 11, color: '#9A9A8E', fontFamily: MONO },
  readline: { fontSize: 19, fontWeight: '600', color: '#181A14', fontFamily: SERIF, marginTop: 4, lineHeight: 23 },
  statRow: { flexDirection: 'row', gap: 8 },
  statCell: { flex: 1, backgroundColor: '#F1EFE8', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 11 },
  statCellLabel: { color: '#6F6F69', fontSize: 10, fontWeight: '700', letterSpacing: 0.4, fontFamily: MONO, marginBottom: 3, textTransform: 'uppercase' },
  statCellValue: { color: '#181A14', fontSize: 17, fontWeight: '600', fontFamily: SERIF },
  primaryBtn: { backgroundColor: '#1F8A3E', borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', fontFamily: SERIF },
  ghostBtn: { flex: 1, backgroundColor: '#FBF8F0', borderColor: '#E6E6E1', borderWidth: 1, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  ghostBtnText: { color: '#181A14', fontSize: 15, fontWeight: '600', fontFamily: SERIF },
  noticedCard: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FBF8F0', borderColor: '#E6E6E1', borderWidth: 1, borderRadius: 16, padding: 13 },
  noticedIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#ECEADF', alignItems: 'center', justifyContent: 'center' },
  noticedMark: { color: '#1F8A3E', fontSize: 16, fontWeight: '700' },
  noticedText: { color: '#181A14', fontSize: 15, fontWeight: '600', fontFamily: SERIF },
  checkinTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBack: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#E6E6E1', backgroundColor: '#FBF8F0', alignItems: 'center', justifyContent: 'center' },
  iconBackText: { fontSize: 22, color: '#111111', marginTop: -2 },
  qGroup: { gap: 10 },
  q: { fontSize: 19, fontWeight: '600', color: '#181A14', fontFamily: SERIF },
  scale5: { flexDirection: 'row', gap: 5 },
  scaleBtn: { flex: 1, height: 44, borderWidth: 1, borderColor: '#E6E6E1', backgroundColor: '#FBF8F0', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  scaleBtnSel: { backgroundColor: '#1F8A3E', borderColor: 'transparent' },
  scaleBtnWarn: { backgroundColor: '#9C6212', borderColor: 'transparent' },
  scaleBtnText: { fontSize: 14, fontWeight: '600', color: '#181A14', fontFamily: SERIF },
  scaleBtnTextSel: { color: '#FFFFFF' },
  scaleEnds: { flexDirection: 'row', justifyContent: 'space-between' },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { flex: 1, borderWidth: 1, borderColor: '#E6E6E1', backgroundColor: '#FBF8F0', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  toggleBtnSel: { backgroundColor: '#181A14', borderColor: 'transparent' },
  toggleBtnText: { fontSize: 15, fontWeight: '600', color: '#181A14', fontFamily: SERIF },
  toggleBtnTextSel: { color: '#F4F1E8' },
  painExtra: { gap: 10 },
  metricMeaning: { fontSize: 15, fontWeight: '600', color: '#1F8A3E', fontFamily: SERIF, marginTop: 2 },
  metricExplain: { fontSize: 12.5, color: '#74746F', fontFamily: SERIF, fontStyle: 'italic' },
  readDayText: { fontSize: 14.5, color: '#5E5E58', fontFamily: SERIF, fontStyle: 'italic', lineHeight: 20 },
  dateRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  dateNav: { width: 48, height: 52, borderWidth: 1, borderColor: '#E6E6E1', backgroundColor: '#FBF8F0', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateNavText: { fontSize: 22, color: '#181A14', fontFamily: SERIF, lineHeight: 24 },
  dateCenter: { flex: 1, height: 52, borderWidth: 1, borderColor: '#E6E6E1', backgroundColor: '#FBF8F0', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateCenterText: { fontSize: 17, fontWeight: '600', color: '#181A14', fontFamily: SERIF },
  dateReset: { fontSize: 11, color: '#1F8A3E', fontFamily: MONO, letterSpacing: 0.3, marginTop: 1 },
  buildFasterBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F3F8F0', borderWidth: 1, borderColor: '#CFE0D2', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8 },
  buildFasterIcon: { fontSize: 20 },
  buildFasterTitle: { fontSize: 16, fontWeight: '700', color: '#1F7A40', fontFamily: SERIF },
  buildFasterSub: { fontSize: 12, color: '#5E5E58', fontFamily: SERIF, marginTop: 1 },
  dateFieldBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, borderWidth: 1, borderColor: '#E6E6E1', backgroundColor: '#FBF8F0', borderRadius: 12, paddingHorizontal: 16 },
  dateFieldValue: { fontSize: 16, color: '#181A14', fontFamily: SERIF, fontWeight: '600' },
  dateFieldHint: { fontSize: 11, color: '#1F8A3E', fontFamily: MONO, letterSpacing: 0.3, textTransform: 'uppercase' },
  dateTodayLink: { paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  dateTodayText: { fontSize: 13, color: '#1F8A3E', fontFamily: MONO, letterSpacing: 0.3 },
  libraryPickBtn: { borderWidth: 1, borderColor: '#E6E6E1', backgroundColor: '#FBF8F0', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10 },
  libraryPickText: { fontSize: 16, fontWeight: '600', color: '#181A14', fontFamily: SERIF },
  libraryPickMeta: { fontSize: 11, color: '#74746F', fontFamily: MONO, letterSpacing: 0.3, marginTop: 2, textTransform: 'uppercase' },
  tagsCard: { borderWidth: 1, borderColor: '#ECE7DA', backgroundColor: '#FBF8F0', borderRadius: 12, padding: 12, marginTop: 10, gap: 6 },
  tagsTitle: { fontSize: 11, color: '#6F6F69', fontFamily: MONO, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  qualityTag: { borderWidth: 1, borderColor: '#D9E6DC', backgroundColor: '#EEF5EF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  qualityTagText: { fontSize: 10, color: '#1F7A40', fontFamily: MONO, letterSpacing: 0.2 },
  btnDisabled: { opacity: 0.45 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(24,26,20,0.35)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#F2EEE5', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, maxHeight: '88%' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  pickerTitle: { fontSize: 20, fontWeight: '700', color: '#181A14', fontFamily: SERIF },
  pickerClose: { fontSize: 15, fontWeight: '700', color: '#1F8A3E', fontFamily: SERIF },
  pickerSearch: { borderWidth: 1, borderColor: '#E6E6E1', backgroundColor: '#FBF8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: '#181A14', fontFamily: SERIF },
  pickerFilters: { marginTop: 10, marginBottom: 4, flexGrow: 0 },
  pickerFiltersInner: { gap: 7, paddingRight: 8 },
  pickerFilter: { borderWidth: 1, borderColor: '#E6E6E1', backgroundColor: '#FBF8F0', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  pickerFilterSel: { backgroundColor: '#181A14', borderColor: 'transparent' },
  pickerFilterText: { fontSize: 12.5, color: '#5E5E58', fontFamily: SERIF },
  pickerFilterTextSel: { color: '#F4F1E8' },
  pickerScroll: { marginTop: 6 },
  pickerGroup: { marginBottom: 14 },
  pickerGroupTitle: { fontSize: 11, color: '#6F6F69', fontFamily: MONO, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  // Collapsible family accordion (browse mode).
  pickerFamily: { borderBottomWidth: 1, borderBottomColor: '#E6E1D5' },
  pickerFamilyHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  pickerFamilyName: { fontSize: 16.5, color: '#181A14', fontFamily: SERIF, fontWeight: '600' },
  pickerFamilyCount: { fontSize: 12, color: '#9A9A93', fontFamily: MONO, marginRight: 10 },
  pickerFamilyChevron: { fontSize: 13, color: '#9A9A93', width: 16, textAlign: 'center' },
  pickerFamilyBody: { paddingBottom: 8 },
  pickerSubgroupTitle: { fontSize: 10.5, color: '#8A8A82', fontFamily: MONO, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 8, marginBottom: 5, marginLeft: 2 },
  // exRow is the exercise/template card row (distinct from the legacy chip-container pickerRow).
  exRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ECE7DA', backgroundColor: '#FBF8F0', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 8 },
  pickerRowName: { fontSize: 15.5, fontWeight: '600', color: '#181A14', fontFamily: SERIF },
  pickerRowMeta: { fontSize: 11, color: '#9A9A93', fontFamily: MONO, letterSpacing: 0.3, marginTop: 3, textTransform: 'uppercase' },
  pickerRowChevron: { fontSize: 20, color: '#C4C4BC', marginLeft: 8 },
  coverageChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  coverageChip: { borderWidth: 1, borderColor: '#D9E6DC', backgroundColor: '#EEF5EF', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  coverageChipText: { fontSize: 11, color: '#1F7A40', fontFamily: MONO, letterSpacing: 0.2 },
  tempoRow: { flexDirection: 'row', gap: 8 },
  tempoCell: { flex: 1, alignItems: 'center' },
  tempoInput: { width: '100%', height: 46, borderWidth: 1, borderColor: '#E6E6E1', backgroundColor: '#FBF8F0', borderRadius: 10, fontSize: 18, color: '#181A14', fontFamily: SERIF },
  tempoCellLabel: { fontSize: 10, color: '#74746F', fontFamily: MONO, letterSpacing: 0.2, marginTop: 4, textTransform: 'uppercase' },
  tempoHint: { fontSize: 11.5, color: '#9A9A93', fontFamily: SERIF, fontStyle: 'italic', marginTop: 6 },
  pickerEmpty: { fontSize: 14, color: '#74746F', fontFamily: SERIF, fontStyle: 'italic', textAlign: 'center', marginVertical: 16 },
  pickerCustomBtn: { borderWidth: 1, borderColor: '#1F8A3E', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 24, marginTop: 2 },
  pickerCustomText: { fontSize: 15, fontWeight: '700', color: '#1F8A3E', fontFamily: SERIF },
  pickerHint: { fontSize: 12.5, color: '#74746F', fontFamily: SERIF, fontStyle: 'italic', marginTop: 4, marginBottom: 6 },
  pickerLink: { paddingVertical: 12, alignItems: 'center', marginBottom: 24 },
  pickerLinkText: { fontSize: 14, color: '#5E5E58', fontFamily: SERIF },
  loadShapeCard: { borderWidth: 1, borderColor: '#ECE7DA', backgroundColor: '#FBF8F0', borderRadius: 14, padding: 14, marginBottom: 12 },
  loadShapeBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 70, marginTop: 8 },
  loadShapeCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  loadShapeTrack: { height: 56, justifyContent: 'flex-end' },
  loadShapeBar: { width: 16, borderRadius: 5, backgroundColor: '#CFE0D2' },
  loadShapeBarActive: { backgroundColor: '#1F8A3E' },
  loadShapeLabel: { fontSize: 10, color: '#9A9A93', fontFamily: MONO, marginTop: 4 },
  loadShapeLabelActive: { color: '#1F8A3E' },
  loadShapeMeta: { fontSize: 12, color: '#74746F', fontFamily: SERIF, fontStyle: 'italic', marginTop: 8, lineHeight: 17 },
  readCardHeadline: { borderColor: '#CFE0D2', borderWidth: 1.5 },
  readCardLabel: { fontSize: 11, color: '#6F6F69', fontFamily: MONO, letterSpacing: 0.5, textTransform: 'uppercase' },
  readConfidence: { fontSize: 10, color: '#9A9A93', fontFamily: MONO, letterSpacing: 0.3 },
  readSentence: { fontSize: 18, color: '#181A14', fontFamily: SERIF, lineHeight: 25, marginTop: 6, marginBottom: 4 },
  evidenceBox: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#ECE7DA', paddingTop: 8 },
  readEvidenceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  evidenceKey: { fontSize: 12.5, color: '#74746F', fontFamily: SERIF },
  evidenceVal: { fontSize: 12.5, color: '#181A14', fontFamily: MONO },
  radarLegend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 14, marginTop: 6 },
  legendSwatch: { width: 11, height: 11, borderRadius: 3 },
  pairedWrap: { marginTop: 10, gap: 10 },
  pairedRow: { gap: 4 },
  pairedLabel: { fontSize: 12, color: '#5E5E58', fontFamily: MONO, letterSpacing: 0.2 },
  pairedBars: { gap: 3 },
  pairedTrack: { height: 9, backgroundColor: '#F2EEE5', borderRadius: 5, overflow: 'hidden' },
  pairedFill: { height: 9, borderRadius: 5 },
  pbCard: { backgroundColor: '#F3F8F0', borderColor: '#CFE0D2', borderWidth: 1 },
  pbText: { fontSize: 15.5, color: '#1F7A40', fontFamily: SERIF, fontWeight: '700' },
  segWrap: { flexDirection: 'row', backgroundColor: '#ECEADF', borderRadius: 999, padding: 4 },
  segBtn: { paddingVertical: 6, paddingHorizontal: 13, borderRadius: 999 },
  segBtnOn: { backgroundColor: '#FBF8F0' },
  segBtnText: { fontSize: 11, color: '#6F6F69', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: 0.4 },
  segBtnTextOn: { color: '#181A14' },
  storyHeadline: { fontSize: 21, fontWeight: '600', color: '#181A14', fontFamily: SERIF, lineHeight: 26, marginTop: 4 },
  evlink: { color: '#1F8A3E', fontSize: 11, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 12 },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FBF8F0', borderColor: '#E6E6E1', borderWidth: 1, borderRadius: 16, padding: 14 },
  signalDot: { width: 9, height: 9, borderRadius: 5 },
  chartLegend: { flexDirection: 'row', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendBar: { width: 14, height: 8, borderRadius: 2 },
  legendText: { fontSize: 11, color: '#6F6F69', fontFamily: MONO, letterSpacing: 0.3 },
  adds: { borderWidth: 1, borderColor: '#D9D7CC', borderStyle: 'dashed', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  addsText: { color: '#5E5E58', fontSize: 15, fontFamily: SERIF },
  daySectionLabel: { color: '#6F6F69', fontSize: 11, fontWeight: '700', letterSpacing: 0.4, fontFamily: MONO, textTransform: 'uppercase', marginTop: 4 },
  exItem: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EFEDE4' },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exName: { fontSize: 16, fontWeight: '600', color: '#181A14', fontFamily: SERIF },
  exPrescription: { fontSize: 13, color: '#5E5E58', fontFamily: MONO, marginTop: 2 },
  editGap: { marginLeft: 14 },
  dangerText: { color: '#C2422B' },
  dangerBtn: { borderColor: '#E6C9C2', backgroundColor: '#FBF1EF' },
  reorderControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reorderBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: '#E6E6E1', backgroundColor: '#FBF8F0', alignItems: 'center', justifyContent: 'center' },
  reorderBtnDisabled: { opacity: 0.3 },
  reorderBtnText: { fontSize: 15, color: '#181A14', fontFamily: SERIF },
  stepDateVal: { fontSize: 14, fontWeight: '600', color: '#181A14', fontFamily: SERIF, minWidth: 78, textAlign: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#E6E6E1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBF8F0' },
  stepBtnText: { fontSize: 20, color: '#181A14' },
  stepVal: { fontSize: 18, fontWeight: '600', color: '#181A14', fontFamily: SERIF, minWidth: 20, textAlign: 'center' },
  card: { backgroundColor: '#FBF8F0', borderColor: '#E6E6E1', borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  authCard: { backgroundColor: '#FBF8F0', borderColor: '#DCEBDD', borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 },
  authStatus: { backgroundColor: '#F1F1ED', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  authStatusActive: { backgroundColor: '#E8F5EA' },
  authStatusText: { color: '#5E5E58', fontSize: 11, fontWeight: '900' },
  authStatusTextActive: { color: '#188131' },
  authActions: { flexDirection: 'row', gap: 8 },
  authButton: { alignItems: 'center', backgroundColor: '#FBF8F0', borderColor: '#CFCFCA', borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 42, justifyContent: 'center', paddingHorizontal: 12 },
  authButtonDark: { backgroundColor: '#111111', borderColor: '#111111' },
  authButtonText: { color: '#111111', fontWeight: '900' },
  authButtonTextLight: { color: '#FFFFFF' },
  profileFieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  profileFieldCell: { flexBasis: '47%', flexGrow: 1 },
  profilePbItem: { backgroundColor: '#F2EEE5', borderColor: '#E8E8E4', borderRadius: 12, borderWidth: 1, flexBasis: '47%', flexGrow: 1, gap: 5, padding: 12 },
  label: { color: '#6F6F69', fontSize: 11, fontWeight: '700', letterSpacing: 0.4, fontFamily: MONO },
  inputLabel: { color: '#1B1B19', fontSize: 12, fontWeight: '700', fontFamily: MONO },
  cardTitle: { color: '#111111', flexShrink: 1, fontSize: 19, fontWeight: '600', lineHeight: 24, fontFamily: SERIF },
  muted: { color: '#74746F', flexShrink: 1, fontSize: 13.5, fontWeight: '400', lineHeight: 19, fontFamily: SERIF },
  microText: { color: '#8B8B86', fontSize: 10, alignSelf: 'flex-end', fontFamily: MONO },
  bodyText: { color: '#1B1B19', fontSize: 15.5, fontWeight: '400', lineHeight: 23, fontFamily: SERIF },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  twoCol: { flexDirection: 'row', gap: 10 },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  action: { borderRadius: 8, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  action_green: { flex: 1, backgroundColor: '#2FA044' },
  action_black: { flex: 1, backgroundColor: '#111111' },
  action_outline: { backgroundColor: '#FBF8F0', borderColor: '#CFCFCA', borderWidth: 1 },
  actionText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15, fontFamily: SERIF },
  actionOutlineText: { color: '#111111', fontFamily: SERIF },
  metricToggle: { alignSelf: 'flex-start', backgroundColor: '#F1F1ED', borderColor: '#E1E1DC', borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  metricToggleText: { color: '#5B5B55', fontSize: 11, fontWeight: '900' },
  priorityCard: { backgroundColor: '#FBF8F0', borderColor: '#CFE8D4', borderRadius: 18, borderWidth: 1, gap: 12, padding: 16 },
  priorityTitle: { color: '#111111', flexShrink: 1, fontSize: 25, fontWeight: '600', lineHeight: 30, fontFamily: SERIF },
  pressCue: { color: '#188131', fontSize: 13, fontWeight: '800' },
  checkInThemeCard: { borderColor: '#DADAD5', borderRadius: 18, borderWidth: 1, gap: 12, padding: 18 },
  toneGood: { backgroundColor: '#DFF3E3', borderColor: '#2FA044', borderWidth: 1 },
  toneBad: { backgroundColor: '#FDE7E4', borderColor: '#E13F32', borderWidth: 1 },
  toneWarning: { backgroundColor: '#FFF0D7', borderColor: '#D9822B', borderWidth: 1 },
  toneNeutral: { backgroundColor: '#FFF8D1', borderColor: '#E7B33C', borderWidth: 1 },
  toneCollecting: { backgroundColor: '#FBF8F0', borderColor: '#DADAD5', borderWidth: 1 },
  reviewHeroLabel: { color: '#565650', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: MONO },
  reviewHeroTitle: { color: '#111111', flexShrink: 1, fontSize: 28, fontWeight: '600', lineHeight: 33, fontFamily: SERIF },
  reviewHeroSignal: { color: '#111111', flexShrink: 1, fontSize: 15, fontWeight: '600', lineHeight: 21, fontFamily: SERIF },
  reviewHeroBody: { color: '#252522', flexShrink: 1, fontSize: 15, fontWeight: '400', lineHeight: 22, fontFamily: SERIF },
  reviewVisualCard: { backgroundColor: '#FBF8F0', borderColor: '#DCEBDD', borderRadius: 18, borderWidth: 1, gap: 12, padding: 16 },
  deltaVisualRow: { alignItems: 'center', flexDirection: 'row', gap: 14, justifyContent: 'space-between' },
  visualValueBlock: { backgroundColor: '#F2EEE5', borderRadius: 14, flex: 1, gap: 5, padding: 12 },
  reviewVisualValue: { color: '#111111', fontSize: 28, fontWeight: '900' },
  deltaArrow: { fontSize: 32, fontWeight: '900' },
  reviewGaugeTrack: { backgroundColor: '#E8E8E4', borderRadius: 999, height: 12, overflow: 'hidden' },
  reviewGaugeFill: { borderRadius: 999, height: 12 },
  balanceTrack: { backgroundColor: '#E8E8E4', borderRadius: 999, flexDirection: 'row', height: 16, overflow: 'hidden' },
  balanceFresh: { backgroundColor: '#2FA044' },
  balanceRisk: { backgroundColor: '#E13F32' },
  adaptationZoneWrap: { gap: 6 },
  adaptationZoneTrack: { borderRadius: 999, flexDirection: 'row', height: 18, overflow: 'visible', position: 'relative' },
  adaptationZone: { flex: 1 },
  adaptationZoneRisk: { backgroundColor: '#E13F32', borderBottomLeftRadius: 999, borderTopLeftRadius: 999 },
  adaptationZoneStable: { backgroundColor: '#E7B33C' },
  adaptationZoneGood: { backgroundColor: '#2FA044', borderBottomRightRadius: 999, borderTopRightRadius: 999 },
  adaptationMarker: { backgroundColor: '#111111', borderColor: '#FFFFFF', borderRadius: 7, borderWidth: 2, height: 14, marginLeft: -7, position: 'absolute', top: 2, width: 14 },
  reviewSparkRow: { flexDirection: 'row', gap: 12 },
  reviewSparkColumn: { backgroundColor: '#F2EEE5', borderRadius: 14, flex: 1, gap: 8, padding: 12 },
  reviewSvgFrame: { backgroundColor: '#FBFBF9', borderColor: '#ECECE8', borderRadius: 14, borderWidth: 1, overflow: 'hidden', paddingTop: 4 },
  smallMultipleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  smallMultipleCard: { backgroundColor: '#F2EEE5', borderColor: '#ECECE8', borderRadius: 12, borderWidth: 1, gap: 6, padding: 8, width: '48%' },
  smallLineFrame: { height: 70, overflow: 'hidden' },
  historyInsightItem: { borderBottomColor: '#DADAD5', borderBottomWidth: 1, gap: 14, paddingBottom: 18 },
  currentReadGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  currentReadItem: { backgroundColor: '#F2EEE5', borderRadius: 12, flexBasis: '47%', flexGrow: 1, gap: 5, padding: 12 },
  currentReadItemWide: { flexBasis: '100%' },
  currentReadLabel: { color: '#6F6F69', fontSize: 11, fontWeight: '700', lineHeight: 15, letterSpacing: 0.4, fontFamily: MONO },
  currentReadValue: { color: '#111111', flexShrink: 1, fontSize: 17, fontWeight: '600', lineHeight: 22, fontFamily: SERIF },
  miniStateHeader: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  miniStateDot: { borderRadius: 5, height: 10, width: 10 },
  currentReadRow: { alignItems: 'flex-start', borderBottomColor: '#ECECE8', borderBottomWidth: 1, flexDirection: 'column', gap: 4, paddingVertical: 8 },
  evidenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  evidenceBadge: { alignSelf: 'flex-start', backgroundColor: '#E8F5EA', borderRadius: 999, color: '#188131', fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  filterTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterTab: { backgroundColor: '#FBF8F0', borderColor: '#E1E1DC', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  filterTabActive: { backgroundColor: '#111111', borderColor: '#111111' },
  filterTabText: { color: '#474742', fontSize: 13, fontWeight: '700' },
  filterTabTextActive: { color: '#FFFFFF' },
  sectionHeaderRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  textLink: { color: '#188131', fontSize: 13, fontWeight: '800' },
  dashboardCategory: { gap: 8 },
  dashboardChip: { backgroundColor: '#FBF8F0', borderColor: '#E1E1DC', borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  dashboardChipActive: { backgroundColor: '#111111', borderColor: '#111111' },
  dashboardChipText: { color: '#111111', fontSize: 12, fontWeight: '700' },
  dashboardChipTextActive: { color: '#FFFFFF' },
  compactSelectWrap: { gap: 8 },
  compactSelect: { alignItems: 'center', backgroundColor: '#F2EEE5', borderColor: '#E1E1DC', borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 12, paddingVertical: 8 },
  compactSelectValue: { color: '#111111', fontSize: 16, fontWeight: '900', marginTop: 2 },
  compactMenu: { backgroundColor: '#FBF8F0', borderColor: '#E1E1DC', borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  compactMenuItem: { paddingHorizontal: 12, paddingVertical: 11 },
  compactMenuItemActive: { backgroundColor: '#111111' },
  compactMenuText: { color: '#111111', fontSize: 13, fontWeight: '800' },
  compactMenuTextActive: { color: '#FFFFFF' },
  editProgrammeButton: { backgroundColor: '#111111', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  editProgrammeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  calendarTitleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  header: { height: 46, alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerButton: { width: 42, height: 42, justifyContent: 'center' },
  headerIcon: { fontSize: 26, color: '#111111' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111111', fontFamily: SERIF },
  headerSubtitle: { fontSize: 11, color: '#6D6D68', marginTop: 2, fontFamily: MONO },
  formSection: { gap: 10, paddingBottom: 10 },
  formTitle: { color: '#111111', fontSize: 15, fontWeight: '600', fontFamily: SERIF },
  inputWrap: { gap: 6, flex: 1 },
  input: { backgroundColor: '#FBF8F0', borderColor: '#D9D9D4', borderRadius: 6, borderWidth: 1, minHeight: 42, paddingHorizontal: 10, color: '#111111' },
  sliderWrap: { gap: 8 },
  sliderValue: { color: '#111111', fontWeight: '900' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliderTrack: { flex: 1, height: 18, justifyContent: 'center', backgroundColor: '#D8D8D4', borderRadius: 999 },
  sliderFill: { height: 18, backgroundColor: '#111111', borderRadius: 999 },
  sliderThumb: { position: 'absolute', marginLeft: -11, top: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: '#111111', borderColor: '#FFFFFF', borderWidth: 2 },
  stepButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EFEFEC', alignItems: 'center', justifyContent: 'center' },
  setMetricsList: { gap: 10 },
  setMetricCard: { backgroundColor: '#FBF8F0', borderColor: '#E5E5E1', borderRadius: 8, borderWidth: 1, gap: 10, padding: 10 },
  setMetricTitle: { color: '#111111', fontSize: 12, fontWeight: '900' },
  chevronRow: { backgroundColor: '#F2F2EF', borderRadius: 8, minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevronText: { fontWeight: '800', color: '#111111' },
  chevron: { fontSize: 18, fontWeight: '900' },
  centerLink: { alignItems: 'center' },
  centerLinkText: { color: '#54544F', fontSize: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#EFEFEC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  chipActive: { backgroundColor: '#2FA044' },
  chipText: { color: '#111111', fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: '#FFFFFF' },
  exerciseRow: { backgroundColor: '#FBF8F0', borderBottomColor: '#E8E8E4', borderBottomWidth: 1, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' },
  exerciseHeaderRow: { alignItems: 'flex-start', flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  exerciseEdit: { flex: 1, gap: 6, paddingRight: 8 },
  exerciseNameWithOrder: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8 },
  exerciseNameText: { color: '#111111', flex: 1, fontSize: 12, fontWeight: '900' },
  exercisePrescription: { color: '#4C4C47', fontSize: 12, fontWeight: '800', lineHeight: 17 },
  orderBadge: { alignItems: 'center', backgroundColor: '#111111', borderRadius: 10, height: 20, justifyContent: 'center', marginRight: 8, width: 20 },
  orderBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  deleteButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#F3E7E5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  deleteButtonText: { color: '#A23428', fontSize: 11, fontWeight: '900' },
  completeDot: { color: '#2FA044', fontSize: 18, fontWeight: '900' },
  openCircle: { color: '#8A8A84', fontSize: 22 },
  summaryRow: { backgroundColor: '#FBF8F0', borderTopColor: '#E8E8E4', borderTopWidth: 1, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loadPill: { backgroundColor: '#DFF3E3', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  loadText: { color: '#188131', fontWeight: '900' },
  builderCard: { backgroundColor: '#FBF8F0', borderColor: '#E5E5E1', borderRadius: 8, borderWidth: 1, padding: 14, gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111111', fontFamily: SERIF },
  pickerRow: { flexDirection: 'row', gap: 6 },
  pickerChip: { flex: 1, borderRadius: 6, backgroundColor: '#EFEFEC', alignItems: 'center', paddingVertical: 10 },
  pickerActive: { backgroundColor: '#111111' },
  pickerText: { fontSize: 12, fontWeight: '800', color: '#111111' },
  pickerTextActive: { color: '#FFFFFF' },
  selectLike: { minHeight: 44, borderWidth: 1, borderColor: '#D9D9D4', borderRadius: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FBF8F0' },
  selectText: { fontWeight: '800', color: '#111111' },
  bigGreen: { color: '#24883B', fontSize: 30, fontWeight: '900' },
  positive: { color: '#16842B', fontSize: 12, fontWeight: '800' },
  negative: { color: '#B1382D', fontSize: 12, fontWeight: '800' },
  neutral: { color: '#33332F', fontSize: 12, fontWeight: '800' },
  inlineEdit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inlineLabel: { fontSize: 13, fontWeight: '900', color: '#111111' },
  inlineValue: { minWidth: 170, textAlign: 'right', color: '#111111', fontWeight: '700' },
  weekNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  weekArrow: { alignItems: 'center', backgroundColor: '#FBF8F0', borderColor: '#E1E1DC', borderRadius: 10, borderWidth: 1, height: 42, justifyContent: 'center', width: 48 },
  calendarHeadingWrap: { alignItems: 'center', flex: 1, gap: 2, paddingHorizontal: 8 },
  calendarTodayTitle: { color: '#111111', fontSize: 12, fontWeight: '800' },
  calendarModeTabs: { backgroundColor: '#E6E6E1', borderRadius: 12, flexDirection: 'row', gap: 4, padding: 4 },
  calendarModeTab: { alignItems: 'center', borderRadius: 9, flex: 1, paddingVertical: 9 },
  calendarModeTabActive: { backgroundColor: '#111111' },
  calendarModeTabText: { color: '#242421', fontSize: 12, fontWeight: '900' },
  calendarModeTabTextActive: { color: '#FFFFFF' },
  rangeSelectorBox: {backgroundColor: '#FBF8F0', borderColor: '#E1E1DC', borderRadius: 12, borderWidth: 1,gap: 8,padding: 12,},
  dateRangeButton: {alignItems: 'center',backgroundColor: '#111111', borderRadius: 10, paddingVertical: 10,},
  dateRangeButtonText: {color: '#FFFFFF', fontSize: 12,fontWeight: '900',},
  dateRangePickerCard: {backgroundColor: '#FBF8F0', borderColor: '#DADAD5', borderRadius: 14, borderWidth: 1, gap: 12,padding: 12,},
  rangePreviewRow: {flexDirection: 'row', gap: 10,},
  rangePreviewItem: {backgroundColor: '#F2EEE5',borderColor: '#E8E8E4',borderRadius: 10,borderWidth: 1,flex: 1,gap: 4,padding: 10,},
  rangePreviewValue: {color: '#111111',fontSize: 14,fontWeight: '900',},
  rangeCalendarGrid: {flexDirection: 'row',flexWrap: 'wrap',},
  rangeDayCell: {alignItems: 'center',borderRadius: 8,height: 36,justifyContent: 'center',width: '14.2857%',},
  rangeDayOutside: {opacity: 0.7,},
  rangeDayInRange: {backgroundColor: '#DFF3E3',},
  rangeDaySelected: {backgroundColor: '#2FA044',},
  rangeDayText: {color: '#111111',fontSize: 11, fontWeight: '900',},
  rangeDayTextOutside: {color: '#111111',},
  rangeDayTextSelected: {color: '#FFFFFF',},
  programmeLabel: {
  color: '#111111',
  fontSize: 11,
  fontWeight: '900',
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  },

  rangeSummaryText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
  },

  programmeEditMetaText: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '700',
  },
  weekGrid: { flexDirection: 'row', gap: 5 },
  dayCell: { flex: 1, minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  activeDay: { backgroundColor: '#2FA044' },
  todayDay: { backgroundColor: '#E8F0FF', borderColor: '#2F6FDB', borderWidth: 1 },
  dayText: { color: '#111111', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  activeDayText: { color: '#FFFFFF' },
  dayDot: { backgroundColor: 'transparent', borderRadius: 4, height: 6, marginTop: 4, width: 6 },
  dayDotFilled: { backgroundColor: '#111111', borderColor: '#111111' },
  monthCalendar: { backgroundColor: '#FBF8F0', borderColor: '#ECECE8', borderRadius: 12, borderWidth: 1, gap: 8, padding: 8 },
  monthWeekHeader: { flexDirection: 'row' },
  monthWeekHeaderText: { color: '#474742', flex: 1, fontSize: 9, fontWeight: '900', textAlign: 'center' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthDayCell: { alignItems: 'center', borderRadius: 9, height: 40, justifyContent: 'center', width: '14.2857%' },
  monthDayOutside: { opacity: 0.72 },
  monthDayOutsideText: { color: '#111111' },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthCell: { alignItems: 'center', backgroundColor: '#FBF8F0', borderColor: '#E6E6E2', borderRadius: 12, borderWidth: 1, gap: 5, justifyContent: 'center', minHeight: 54, width: '30.8%' },
  monthCellActive: { backgroundColor: '#2FA044', borderColor: '#2FA044' },
  monthCellText: { color: '#111111', fontSize: 12, fontWeight: '900' },
  programmeRow: { backgroundColor: '#FBF8F0', borderBottomColor: '#E6E6E2', borderBottomWidth: 1, paddingVertical: 13, flexDirection: 'row', justifyContent: 'space-between' },
  emptyDay: { gap: 12 },
  todayTrainingCard: { borderTopColor: '#E8E8E4', borderTopWidth: 1, gap: 8, paddingTop: 12 },
  exerciseMetricCard: { backgroundColor: '#F2EEE5', borderRadius: 8, gap: 8, padding: 8 },
  exerciseBulletRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  metricsReveal: { gap: 10, marginTop: 4 },
  daySessionRow: { alignItems: 'center', borderTopColor: '#E8E8E4', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingTop: 12 },
  noteInput: { minHeight: 92, textAlignVertical: 'top' },
  calendarPanel: { backgroundColor: '#FBF8F0', borderColor: '#E8E8E5', borderRadius: 8, borderWidth: 1, gap: 12, padding: 14 },
  treeBlock: { borderTopColor: '#ECECE8', borderTopWidth: 1, gap: 8, paddingTop: 10 },
  treeIndent: { borderLeftColor: '#DADAD5', borderLeftWidth: 2, gap: 8, marginLeft: 8, paddingLeft: 10 },
  treeWeek: { backgroundColor: '#F2EEE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, gap: 8 },
  treeCard: { backgroundColor: '#FBF8F0', borderColor: '#E8E8E5', borderRadius: 8, borderWidth: 1, gap: 4, padding: 10 },
  treeCardActive: { borderColor: '#2FA044', backgroundColor: '#F2FBF4' },
  smallPill: { backgroundColor: '#111111', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  smallPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  programmeEditRow: { backgroundColor: '#FBF8F0', borderColor: '#E8E8E5', borderRadius: 8, borderWidth: 1, gap: 10, padding: 12 },
  programmeEditMain: { gap: 10 },
  programmeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  miniButton: { backgroundColor: '#EFEFEC', borderRadius: 8, flex: 1, alignItems: 'center', paddingVertical: 9 },
  miniButtonDark: { backgroundColor: '#111111' },
  miniButtonText: { color: '#111111', fontSize: 12, fontWeight: '900' },
  miniButtonTextLight: { color: '#FFFFFF' },
  programmeFocusedPanel: { backgroundColor: '#F2EEE5', borderColor: '#DADAD5', borderRadius: 14, borderWidth: 1, gap: 12, padding: 12 },
  performanceExerciseLog: { backgroundColor: '#FBF8F0', borderColor: '#E8E8E4', borderRadius: 12, borderWidth: 1, gap: 12, padding: 12 },
  savePerformancePanel: { backgroundColor: '#F2EEE5', borderColor: '#DCEBDD', borderRadius: 12, borderWidth: 1, gap: 8, padding: 10 },
  performanceSetCard: { backgroundColor: '#F2EEE5', borderColor: '#E1E1DC', borderRadius: 10, borderWidth: 1, gap: 8, padding: 8 },
  attemptCard: { backgroundColor: '#FBF8F0', borderColor: '#E8E8E4', borderRadius: 8, borderWidth: 1, gap: 7, padding: 8 },
  rangeSummaryText: { color: '#1B1B19', flexShrink: 1, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  calendarMetaText: { color: '#5E5E58', flexShrink: 1, fontSize: 13.5, fontWeight: '400', lineHeight: 19, fontFamily: SERIF },
  weekSessionRow: { alignItems: 'center', backgroundColor: '#F2EEE5', borderRadius: 8, flexDirection: 'row', gap: 10, padding: 10 },
  weekSessionDate: { alignItems: 'center', backgroundColor: '#FBF8F0', borderColor: '#E3E3DE', borderRadius: 8, borderWidth: 1, height: 50, justifyContent: 'center', width: 48 },
  weekSessionDay: { color: '#72726C', fontSize: 10, fontWeight: '900' },
  weekSessionNumber: { color: '#111111', fontSize: 16, fontWeight: '900' },
  weekSessionMain: { flex: 1, gap: 3 },
  filterPill: { backgroundColor: '#FBF8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  filterText: { fontSize: 12, fontWeight: '800' },
  insightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  insightCard: { width: '48%', minHeight: 150, backgroundColor: '#FBF8F0', borderColor: '#E8E8E5', borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  insightSignalCard: { backgroundColor: '#FBF8F0' },
  insightIcon: { width: 22, height: 22, borderRadius: 11 },
  categoryCardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  tapCue: { color: '#7A7A74', fontSize: 11, fontWeight: '700' },
  stateBadge: { borderRadius: 999, color: '#FFFFFF', fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, textTransform: 'uppercase' },
  categoryFinding: { color: '#33332F', flexShrink: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  tinyBadge: { alignSelf: 'flex-start', backgroundColor: '#F1F1ED', borderRadius: 999, color: '#5E5E58', fontSize: 10, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  smallCopy: { color: '#33332F', flexShrink: 1, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  axisChartWrap: { gap: 6 },
  yAxisLabel: { color: '#6E6E68', fontSize: 11, fontWeight: '700' },
  timeChart: { alignItems: 'flex-end', flexDirection: 'row', gap: 6, height: 126, paddingTop: 8 },
  timeChartEmpty: { alignItems: 'center', height: 108, justifyContent: 'center' },
  timeChartColumn: { alignItems: 'center', flex: 1, gap: 5, justifyContent: 'flex-end' },
  timeChartBar: { borderRadius: 6, width: '100%' },
  timeChartLabel: { color: '#777771', fontSize: 9, fontWeight: '800' },
  lineSlot: { alignItems: 'center', height: 108, justifyContent: 'flex-end', overflow: 'visible', position: 'relative', width: '100%' },
  svgChartFrame: { backgroundColor: '#FBFBF9', borderColor: '#ECECE8', borderRadius: 14, borderWidth: 1, paddingTop: 4 },
  axisFooter: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  axisLabel: { color: '#777771', flexShrink: 1, fontSize: 10, fontWeight: '700' },
  attemptMiniGrid: { gap: 10 },
  attemptMiniCard: { backgroundColor: '#FBFBF9', borderColor: '#ECECE8', borderRadius: 14, borderWidth: 1, gap: 6, padding: 10 },
  figureInner: { gap: 8 },
  analysisSubcard: { backgroundColor: '#F2EEE5', borderRadius: 12, gap: 6, padding: 10 },
  figureResult: { color: '#1B1B19', flexShrink: 1, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  figureInterpretation: { backgroundColor: '#F2EEE5', borderRadius: 12, color: '#22221F', flexShrink: 1, fontSize: 12, fontWeight: '600', lineHeight: 18, padding: 10 },
  visualInterpretationBox: { backgroundColor: '#F2EEE5', borderColor: '#E6E6E1', borderRadius: 12, borderWidth: 1, gap: 4, padding: 10 },
  figureInterpretationText: { color: '#22221F', flexShrink: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  figureLimitation: { color: '#74746F', flexShrink: 1, fontSize: 11, fontWeight: '600', lineHeight: 16 },
  figureEvidence: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  figureEvidenceItem: { backgroundColor: '#F2EEE5', borderColor: '#E8E8E4', borderRadius: 12, borderWidth: 1, minWidth: '30%', paddingHorizontal: 10, paddingVertical: 8 },
  figureEvidenceLabel: { color: '#6F6F69', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  figureEvidenceValue: { color: '#111111', flexShrink: 1, fontSize: 15, fontWeight: '800', marginTop: 3 },
  boxPlotWrap: { backgroundColor: '#FBFBF9', borderColor: '#ECECE8', borderRadius: 14, borderWidth: 1, gap: 8, padding: 12 },
  boxPlotHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  boxPlot: { height: 42, justifyContent: 'center', position: 'relative' },
  boxWhisker: { backgroundColor: '#BDBDB7', height: 2, left: 0, position: 'absolute', right: 0 },
  boxRange: { backgroundColor: '#FBF8F0', borderRadius: 8, borderWidth: 2, height: 24, position: 'absolute' },
  boxMedian: { borderRadius: 2, height: 30, marginLeft: -1, position: 'absolute', width: 2 },
  boxTick: { backgroundColor: '#777771', height: 18, marginLeft: -1, position: 'absolute', width: 2 },
  boxPlotEmpty: { alignItems: 'center', backgroundColor: '#F2EEE5', borderRadius: 12, minHeight: 56, justifyContent: 'center', padding: 12 },
  adaptationChartWrap: { backgroundColor: '#FBFBF9', borderColor: '#ECECE8', borderRadius: 16, borderWidth: 1, gap: 8, padding: 12 },
  adaptationChart: { height: 188, overflow: 'hidden' },
  multiLineChart: { backgroundColor: '#FBFBF9', borderColor: '#ECECE8', borderRadius: 14, borderWidth: 1, height: 172, overflow: 'hidden' },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  relationshipRow: { gap: 8, paddingVertical: 10 },
  relationshipText: { gap: 3 },
  relationshipTitleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  relationshipTrack: { backgroundColor: '#E8E8E4', borderRadius: 999, height: 5, overflow: 'hidden' },
  relationshipFill: { borderRadius: 999, height: 5 },
  miniBarRow: { gap: 7, paddingVertical: 6 },
  miniBarLabelWrap: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  dayEvidenceCard: { backgroundColor: '#F2EEE5', borderRadius: 12, gap: 4, padding: 10 },
  changeCard: { backgroundColor: '#F2EEE5', borderRadius: 12, gap: 4, padding: 10 },
  spark: { height: 38, marginTop: 'auto', overflow: 'visible', position: 'relative' },
  sparkEmpty: { alignItems: 'center', height: 38, justifyContent: 'center', marginTop: 'auto' },
  detailTabs: { height: 42, flexDirection: 'row', justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: '#E2E2DE' },
  detailTab: { color: '#33332F', fontSize: 12, fontWeight: '700' },
  detailTabActive: { color: '#15812C', fontWeight: '900' },
  chartCard: { backgroundColor: '#FBF8F0', borderRadius: 16, borderWidth: 1, borderColor: '#E8E8E5', gap: 8, padding: 14 },
  chartHeaderRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between', position: 'relative', zIndex: 2 },
  chartTitle: { color: '#111111', flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  chartFilterWrap: { alignItems: 'flex-end', position: 'relative', zIndex: 4 },
  chartFilterIcon: { alignItems: 'center', backgroundColor: '#F1F1ED', borderColor: '#E1E1DC', borderRadius: 999, borderWidth: 1, height: 28, justifyContent: 'center', width: 28 },
  chartFilterIconActive: { backgroundColor: '#111111', borderColor: '#111111' },
  chartFilterIconText: { color: '#111111', fontSize: 16, fontWeight: '900', marginTop: -2 },
  chartFilterIconTextActive: { color: '#FFFFFF' },
  chartFilterPopover: { backgroundColor: '#FBF8F0', borderColor: '#DADAD5', borderRadius: 14, borderWidth: 1, gap: 8, padding: 12, position: 'absolute', right: 0, top: 34, width: 260, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14 },
  chartSubtitle: { color: '#777771', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  scatterWrap: { gap: 6 },
  scatter: { height: 220, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: '#D8D8D4' },
  scatterEmpty: { alignItems: 'center', backgroundColor: '#F2EEE5', borderRadius: 12, minHeight: 140, justifyContent: 'center', padding: 16 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#ECECE8' },
  dot: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: '#24883B' },
  insightLine: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E8E8E4', flexDirection: 'row', justifyContent: 'space-between' },
  insightMetric: { flex: 1, gap: 4 },
  metricStrip: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, backgroundColor: '#FBF8F0', borderWidth: 1, borderColor: '#E8E8E5', borderRadius: 14, padding: 12 },
  metricValue: { color: '#111111', flexShrink: 1, fontSize: 18, fontWeight: '800' },
  metricLabel: { marginTop: 4, fontSize: 12, fontWeight: '600', color: '#6B6B65' },
  jsonBox: { backgroundColor: '#111111', borderRadius: 8, padding: 12 },
  jsonText: { color: '#EAEAE6', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10, lineHeight: 15 },
  nav: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 82, backgroundColor: '#FBF8F0', borderTopWidth: 1, borderTopColor: '#E3E3DF', flexDirection: 'row', paddingTop: 8, paddingBottom: 10 },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navIcon: { color: '#111111', fontSize: 18 },
  navLabel: { color: '#111111', fontSize: 10, fontWeight: '700' },
  navActive: { color: '#238D39', fontWeight: '900' },
});
