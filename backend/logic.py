from enum import Enum
from datetime import datetime, timedelta
import math
import statistics
from uuid import uuid4


# ----------------------------
# Enums
# ----------------------------

class MovementType(str, Enum):
    PLYOMETRIC = "plyometric"
    POWER_BALLISTIC = "power_ballistic"
    STRENGTH = "strength"
    SPRINT = "sprint"
    GENERAL = "general"
    ENDURANCE = "endurance"
    REHAB = "rehab"
    SKILL = "skill"


class ROMType(str, Enum):
    FULL = "full"
    HALF = "half"
    PARTIAL = "partial"


class IntensityUnit(str, Enum):
    PERCENT = "%"
    KG = "kg"
    LBS = "lbs"


class PerformanceType(str, Enum):
    JUMPING = "jumping"
    RUNNING_SPRINTING = "running_sprinting"
    LIFT = "lift"


# ----------------------------
# UX-driven field rules
# ----------------------------

MOVEMENT_TYPE_FIELDS = {
    MovementType.PLYOMETRIC: [
        "contacts",
        "intent_percent",
    ],
    MovementType.POWER_BALLISTIC: [
        "reps",
        "intensity_value",
        "intensity_unit",
        "intent_percent",
    ],
    MovementType.STRENGTH: [
        "reps",
        "intensity_value",
        "intensity_unit",
        "rom",
    ],
    MovementType.SPRINT: [
        "reps",
        "distance",
        "intent_percent",
    ],
    MovementType.GENERAL: [
        "reps",
        "intensity_value",
        "intensity_unit",
        "rom",
    ],
    MovementType.ENDURANCE: [
        "duration_minutes",
        "intent_percent",
    ],
    MovementType.REHAB: [
        "reps",
        "duration_minutes",
        "intensity_value",
        "intensity_unit",
        "rom",
    ],
    MovementType.SKILL: [
        "duration_minutes",
        "intent_percent",
    ],
}


PERFORMANCE_TYPE_FIELDS = {
    PerformanceType.JUMPING: [
        "gct",
        "gct_unit",
        "ft",
        "ft_unit",
        "height_or_distance",
        "height_or_distance_unit",
    ],
    PerformanceType.RUNNING_SPRINTING: [
        "sprint_time",
        "sprint_time_unit",
        "distance",
        "distance_unit",
    ],
    PerformanceType.LIFT: [
        "lift_name",
        "weight",
        "weight_unit",
        "sets",
        "reps",
        "bar_velocity",
        "bar_velocity_unit",
    ],
}


# ----------------------------
# Basic helpers
# ----------------------------

def make_id(prefix):
    return f"{prefix}_{uuid4().hex[:8]}"


def parse_datetime(value):
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.replace(tzinfo=None)

    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed.replace(tzinfo=None)


def date_key(datetime_value):
    parsed = parse_datetime(datetime_value)
    if parsed is None:
        return None
    return parsed.date().isoformat()


def safe_divide(numerator, denominator):
    if denominator in [0, None]:
        return None

    if numerator is None:
        return None

    return numerator / denominator


def is_positive_number(value):
    return isinstance(value, (int, float)) and math.isfinite(value) and value > 0


def is_finite_number(value):
    return isinstance(value, (int, float)) and math.isfinite(value)


def finite_values(values):
    return [value for value in values if is_finite_number(value)]


def extract_non_null(values):
    return [value for value in values if value is not None]


def sort_by_datetime(items, datetime_key):
    return sorted(
        items,
        key=lambda item: parse_datetime(item[datetime_key])
    )


def validate_score(value, field_name):
    if not isinstance(value, (int, float)):
        raise ValueError(f"{field_name} must be a number")

    if value < 0 or value > 10:
        raise ValueError(f"{field_name} must be between 0 and 10")


def validate_percent(value, field_name):
    if not isinstance(value, (int, float)):
        raise ValueError(f"{field_name} must be a number")

    if value < 0 or value > 100:
        raise ValueError(f"{field_name} must be between 0 and 100")


def get_fields_for_movement_type(movement_type):
    if movement_type not in MOVEMENT_TYPE_FIELDS:
        raise ValueError("Invalid movement type")

    return MOVEMENT_TYPE_FIELDS[movement_type]


def get_fields_for_performance_type(performance_type):
    if performance_type not in PERFORMANCE_TYPE_FIELDS:
        raise ValueError("Invalid performance type")

    return PERFORMANCE_TYPE_FIELDS[performance_type]


def normalise_enum_value(value):
    if isinstance(value, Enum):
        return value.value
    return value


# ----------------------------
# Calendar / periodisation model
# ----------------------------

def create_training_calendar(calendar_name=None):
    return {
        "calendar_id": make_id("calendar"),
        "calendar_name": calendar_name,
        "macro_blocks": [],
        "unassigned_sessions": [],
        "check_ins": [],
    }


def create_macro_block(macro_block_name, start_date=None, end_date=None, blocks=None):
    return {
        "macro_block_id": make_id("macro"),
        "macro_block_name": macro_block_name,
        "start_date": start_date,
        "end_date": end_date,
        "blocks": blocks if blocks is not None else [],
    }


def create_block(block_name, start_date=None, end_date=None, weeks=None):
    return {
        "block_id": make_id("block"),
        "block_name": block_name,
        "start_date": start_date,
        "end_date": end_date,
        "weeks": weeks if weeks is not None else [],
    }


def create_training_week(week_name, start_date=None, end_date=None, sessions=None):
    return {
        "week_id": make_id("week"),
        "week_name": week_name,
        "start_date": start_date,
        "end_date": end_date,
        "training_sessions": sessions if sessions is not None else [],
    }


def add_macro_block_to_calendar(calendar, macro_block):
    calendar["macro_blocks"].append(macro_block)
    return calendar


def add_block_to_macro_block(macro_block, block):
    macro_block["blocks"].append(block)
    return macro_block


def add_week_to_block(block, week):
    block["weeks"].append(week)
    return block


def add_session_to_week(week, session):
    week["training_sessions"].append(session)
    return week


def add_unassigned_session_to_calendar(calendar, session):
    calendar["unassigned_sessions"].append(session)
    return calendar


def add_check_in_to_calendar(calendar, check_in):
    calendar["check_ins"].append(check_in)
    return calendar


def flatten_sessions(calendar):
    rows = []

    for macro_block in calendar.get("macro_blocks", []):
        for block in macro_block.get("blocks", []):
            for week in block.get("weeks", []):
                for session in week.get("training_sessions", []):
                    rows.append({
                        "session": session,
                        "session_id": session.get("session_id"),
                        "session_name": session.get("session_name"),
                        "session_datetime": session.get("session_datetime"),
                        "macro_block_id": macro_block.get("macro_block_id"),
                        "macro_block_name": macro_block.get("macro_block_name"),
                        "block_id": block.get("block_id"),
                        "block_name": block.get("block_name"),
                        "week_id": week.get("week_id"),
                        "week_name": week.get("week_name"),
                    })

    for session in calendar.get("unassigned_sessions", []):
        rows.append({
            "session": session,
            "session_id": session.get("session_id"),
            "session_name": session.get("session_name"),
            "session_datetime": session.get("session_datetime"),
            "macro_block_id": None,
            "macro_block_name": None,
            "block_id": None,
            "block_name": None,
            "week_id": None,
            "week_name": None,
        })

    return sorted(
        rows,
        key=lambda row: parse_datetime(row["session_datetime"])
    )


def get_all_sessions(calendar):
    return [row["session"] for row in flatten_sessions(calendar)]


def find_session_by_id(calendar, session_id):
    for row in flatten_sessions(calendar):
        if row["session_id"] == session_id:
            return row["session"]
    return None


def find_session_by_date(calendar, target_date):
    for row in flatten_sessions(calendar):
        if date_key(row["session_datetime"]) == target_date:
            return row["session"]
    return None


def find_session_context_by_id(calendar, session_id):
    for row in flatten_sessions(calendar):
        if row["session_id"] == session_id:
            return {
                "macro_block_id": row["macro_block_id"],
                "macro_block_name": row["macro_block_name"],
                "block_id": row["block_id"],
                "block_name": row["block_name"],
                "week_id": row["week_id"],
                "week_name": row["week_name"],
                "session_id": row["session_id"],
                "session_name": row["session_name"],
                "session_datetime": row["session_datetime"],
            }
    return None


def find_session_context_by_date(calendar, target_date):
    for row in flatten_sessions(calendar):
        if date_key(row["session_datetime"]) == target_date:
            return find_session_context_by_id(calendar, row["session_id"])
    return None


# ----------------------------
# Training session / exercise
# ----------------------------

def create_exercise(movement_type, exercise_name, **kwargs):
    allowed_fields = get_fields_for_movement_type(movement_type)

    invalid_fields = [
        field for field in kwargs
        if field not in allowed_fields
    ]

    if invalid_fields:
        raise ValueError(
            f"Invalid fields for {movement_type.value}: {invalid_fields}"
        )

    if "intent_percent" in kwargs:
        validate_percent(kwargs["intent_percent"], "intent_percent")

    if "intensity_unit" in kwargs:
        kwargs["intensity_unit"] = normalise_enum_value(kwargs["intensity_unit"])

    if "rom" in kwargs:
        kwargs["rom"] = normalise_enum_value(kwargs["rom"])

    exercise = {
        "exercise_id": make_id("exercise"),
        "exercise_name": exercise_name,
        "movement_type": movement_type.value,
    }

    for field in allowed_fields:
        if field in kwargs:
            exercise[field] = kwargs[field]

    return exercise


def create_training_session(
    session_name=None,
    session_datetime=None,
    exercises=None,
    performance_entries=None,
):
    return {
        "session_id": make_id("session"),
        "session_name": session_name,
        "session_datetime": session_datetime or datetime.now().isoformat(),
        "exercises": exercises if exercises is not None else [],
        "performance_entries": performance_entries if performance_entries is not None else [],
    }


def add_exercise_to_session(session, exercise):
    session["exercises"].append(exercise)
    return session


def edit_session_field(session, field_name, new_value):
    if field_name not in session:
        raise ValueError(f"{field_name} does not exist in session")

    session[field_name] = new_value
    return session


def edit_exercise_in_session(session, exercise_index, updated_exercise):
    if exercise_index < 0 or exercise_index >= len(session["exercises"]):
        raise IndexError("Invalid exercise index")

    session["exercises"][exercise_index] = updated_exercise
    return session


# ----------------------------
# Check-ins
# ----------------------------

def create_pain_entry(pain_score, location):
    validate_score(pain_score, "pain_score")

    return {
        "pain_score": pain_score,
        "location": location,
    }


def create_recovery_entry(freshness_score, soreness_score):
    validate_score(freshness_score, "freshness_score")
    validate_score(soreness_score, "soreness_score")

    return {
        "freshness_score": freshness_score,
        "soreness_score": soreness_score,
    }


def create_performance_entry(performance_type, performance_score=None, **kwargs):
    allowed_fields = get_fields_for_performance_type(performance_type)

    invalid_fields = [
        field for field in kwargs
        if field not in allowed_fields
    ]

    if invalid_fields:
        raise ValueError(
            f"Invalid fields for {performance_type.value}: {invalid_fields}"
        )

    if performance_score is not None:
        validate_score(performance_score, "performance_score")

    performance_entry = {
        "performance_entry_id": make_id("performance"),
        "performance_type": performance_type.value,
    }

    if performance_score is not None:
        performance_entry["performance_score"] = performance_score

    for field in allowed_fields:
        if field in kwargs:
            performance_entry[field] = kwargs[field]

    return performance_entry


def add_performance_to_session(session, performance_entry):
    session["performance_entries"].append(performance_entry)
    return session


def create_check_in(
    check_in_datetime=None,
    pain_entry=None,
    recovery_entry=None,
    performance_entry=None,
    linked_session_id=None,
):
    return {
        "check_in_id": make_id("checkin"),
        "check_in_datetime": check_in_datetime or datetime.now().isoformat(),
        "linked_session_id": linked_session_id,
        "pain": pain_entry,
        "recovery": recovery_entry,
        "performance": performance_entry,
    }


def link_check_in_to_session(calendar, check_in):
    if check_in.get("linked_session_id") is not None:
        return check_in

    target_date = date_key(check_in["check_in_datetime"])
    session = find_session_by_date(calendar, target_date)

    if session is not None:
        check_in["linked_session_id"] = session["session_id"]

    return check_in


# ----------------------------
# Derived variable helpers
# ----------------------------

def get_volume(exercise):
    movement_type = exercise["movement_type"]

    if movement_type == MovementType.PLYOMETRIC.value:
        return exercise.get("contacts", 0)

    if movement_type in [MovementType.POWER_BALLISTIC.value, MovementType.STRENGTH.value]:
        return exercise.get("reps", 0)

    if movement_type in [MovementType.ENDURANCE.value, MovementType.SKILL.value]:
        return exercise.get("duration_minutes", 0)

    return 0


def get_intent_score(exercise):
    intent_percent = exercise.get("intent_percent", 0)
    return intent_percent / 100


def get_intensity_score(exercise):
    intensity_value = exercise.get("intensity_value", 1)
    intensity_unit = exercise.get("intensity_unit")

    if intensity_unit == IntensityUnit.PERCENT.value:
        return intensity_value / 100

    if intensity_unit in [IntensityUnit.KG.value, IntensityUnit.LBS.value]:
        return intensity_value

    return 1


def calculate_exercise_load(exercise):
    movement_type = exercise["movement_type"]
    volume = get_volume(exercise)
    intent_score = get_intent_score(exercise)
    intensity_score = get_intensity_score(exercise)

    if movement_type == MovementType.PLYOMETRIC.value:
        return volume * intent_score

    if movement_type == MovementType.POWER_BALLISTIC.value:
        return volume * intent_score * intensity_score

    if movement_type == MovementType.STRENGTH.value:
        return volume * intensity_score

    if movement_type == MovementType.ENDURANCE.value:
        return volume * intent_score

    if movement_type == MovementType.SKILL.value:
        return volume * intent_score

    return 0


def calculate_session_load(session):
    return sum(
        calculate_exercise_load(exercise)
        for exercise in session.get("exercises", [])
    )


def calculate_session_volume(session):
    return sum(get_volume(exercise) for exercise in session.get("exercises", []))


def calculate_session_contacts(session):
    return sum(
        exercise.get("contacts", 0)
        for exercise in session.get("exercises", [])
    )


def calculate_session_reps(session):
    return sum(
        exercise.get("reps", 0)
        for exercise in session.get("exercises", [])
    )


def calculate_session_duration(session):
    return sum(
        exercise.get("duration_minutes", 0)
        for exercise in session.get("exercises", [])
    )


def calculate_session_average_intent(session):
    intents = [
        exercise.get("intent_percent")
        for exercise in session.get("exercises", [])
        if exercise.get("intent_percent") is not None
    ]

    if not intents:
        return None

    return statistics.mean(intents)


def get_sessions_in_window(sessions, end_datetime, days):
    end_datetime = parse_datetime(end_datetime)
    start_datetime = end_datetime - timedelta(days=days)

    return [
        session for session in sessions
        if start_datetime <= parse_datetime(session["session_datetime"]) <= end_datetime
    ]


def calculate_window_load(sessions, end_datetime, days):
    return sum(
        calculate_session_load(session)
        for session in get_sessions_in_window(sessions, end_datetime, days)
    )


def calculate_weekly_load(sessions, end_datetime):
    return calculate_window_load(sessions, end_datetime, 7)


def calculate_monthly_load(sessions, end_datetime):
    return calculate_window_load(sessions, end_datetime, 30)


def calculate_load_change(current_load, previous_load):
    if not is_finite_number(current_load) or not is_positive_number(previous_load):
        return None
    return ((current_load - previous_load) / previous_load) * 100


def calculate_irritation_delta(current_pain, previous_pain):
    if not is_finite_number(current_pain) or not is_finite_number(previous_pain):
        return None

    return current_pain - previous_pain


def calculate_fatigue(freshness, soreness):
    if not is_finite_number(freshness) or not is_finite_number(soreness):
        return None

    return ((10 - freshness) + soreness) / 2


def calculate_readiness(freshness, soreness, pain):
    if not is_finite_number(freshness) or not is_finite_number(soreness) or not is_finite_number(pain):
        return None

    return freshness - ((soreness + pain) / 2)


def calculate_rsi(ft, gct):
    if not is_positive_number(ft) or not is_positive_number(gct):
        return None

    return ft / gct


def _number_or_none(value):
    try:
        if value in ["", None]:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def normalise_time(value, unit):
    numeric = _number_or_none(value)
    if not is_finite_number(numeric):
        return None
    base_unit = str(unit or "seconds").strip().lower()
    if base_unit in ["milliseconds", "millisecond", "ms"]:
        return numeric / 1000
    return numeric


def normalise_distance(value, unit):
    numeric = _number_or_none(value)
    if not is_finite_number(numeric):
        return None
    base_unit = str(unit or "cm").strip().lower()
    if base_unit in ["inches", "inch", "in"]:
        return numeric * 2.54
    if base_unit in ["metres", "metre", "meters", "meter", "m"]:
        return numeric * 100
    return numeric


def normalise_weight(value, unit):
    numeric = _number_or_none(value)
    if not is_finite_number(numeric):
        return None
    base_unit = str(unit or "kg").strip().lower()
    if base_unit in ["lbs", "lb", "pounds", "pound"]:
        return numeric * 0.45359237
    return numeric


def calculate_normalised_rsi(ft, ft_unit, gct, gct_unit):
    ft_seconds = normalise_time(ft, ft_unit)
    gct_seconds = normalise_time(gct, gct_unit)
    if not is_positive_number(ft_seconds) or not is_positive_number(gct_seconds):
        return None
    return ft_seconds / gct_seconds


def _actual_metric_value(attempt, metric_name):
    metrics = attempt.get("metrics", {}) or {}

    if metric_name == "rsi":
        return calculate_normalised_rsi(
            metrics.get("ft"),
            metrics.get("ft_unit"),
            metrics.get("gct"),
            metrics.get("gct_unit"),
        )
    if metric_name in ["ft", "gct", "sprint_time"]:
        value = normalise_time(metrics.get(metric_name), metrics.get(f"{metric_name}_unit"))
        return value if is_positive_number(value) else None
    if metric_name in ["height_or_distance", "distance"]:
        value = normalise_distance(metrics.get(metric_name), metrics.get(f"{metric_name}_unit"))
        return value if is_positive_number(value) else None
    if metric_name == "weight":
        value = normalise_weight(metrics.get("weight"), metrics.get("weight_unit"))
        return value if is_positive_number(value) else None

    value = _number_or_none(metrics.get(metric_name))
    return value if is_positive_number(value) else None


def _best_mode(metric_name):
    return "min" if metric_name in ["gct", "sprint_time"] else "max"


def _choose_best(metric_name, values):
    values = finite_values(values)
    if not values:
        return None
    return min(values) if _best_mode(metric_name) == "min" else max(values)


def _metric_summary(attempts, metric_name):
    rows = [
        {
            "attempt": attempt,
            "value": _actual_metric_value(attempt, metric_name),
        }
        for attempt in attempts
    ]
    values = finite_values([row["value"] for row in rows])

    if not values:
        return None

    average = statistics.mean(values)
    best = _choose_best(metric_name, values)
    sd = statistics.stdev(values) if len(values) >= 2 else None
    best_attempt = next(
        (row["attempt"] for row in rows if row["value"] == best),
        None,
    )

    return {
        "average": average,
        "peak": best,
        "best": best,
        "sd": sd,
        "consistency": None if sd is None else max(0, 100 - (sd / max(abs(average), 1)) * 100),
        "n": len(values),
        "best_attempt": best_attempt,
    }


def _session_date(session):
    value = session.get("session_datetime") or session.get("date")
    if value is None:
        return None
    parsed = parse_datetime(value if "T" in str(value) else f"{value}T00:00:00")
    return parsed.date()


def _sessions_in_days(sessions, target_session, days):
    target_date = _session_date(target_session)
    if target_date is None:
        return []

    rows = []
    for session in sessions:
        candidate_date = _session_date(session)
        if candidate_date is None:
            continue
        if abs((candidate_date - target_date).days) <= days:
            rows.append(session)
    return rows


def _nearest_check_in(check_ins, session):
    session_date = _session_date(session)
    if session_date is None or not check_ins:
        return None

    same_day = [
        check_in for check_in in check_ins
        if date_key(check_in.get("check_in_datetime")) == session_date.isoformat()
    ]
    if same_day:
        return sort_by_datetime(same_day, "check_in_datetime")[-1]

    return sort_by_datetime(check_ins, "check_in_datetime")[-1]


def sessionPerformanceAnalysis(session, sessions=None, check_ins=None):
    sessions = sessions or [session]
    check_ins = check_ins or []
    metric_names = [
        "rsi",
        "ft",
        "gct",
        "height_or_distance",
        "sprint_time",
        "distance",
        "weight",
        "bar_velocity",
    ]

    exercise_summaries = []
    all_attempts = []

    for exercise in session.get("exercises", []):
        attempts = exercise.get("actual_metrics", []) or []
        all_attempts.extend([
            {
                **attempt,
                "exercise_id": exercise.get("exercise_id") or exercise.get("id"),
                "exercise_name": exercise.get("exercise_name"),
            }
            for attempt in attempts
        ])
        metrics = {
            metric_name: summary
            for metric_name in metric_names
            for summary in [_metric_summary(attempts, metric_name)]
            if summary is not None
        }
        best_metric = None
        for metric_name, summary in metrics.items():
            if best_metric is None:
                best_metric = {"metric": metric_name, **summary}
                continue
            current = summary["peak"]
            previous = best_metric["peak"]
            if not is_finite_number(current) or not is_finite_number(previous):
                continue
            if _best_mode(metric_name) == "min":
                if current < previous:
                    best_metric = {"metric": metric_name, **summary}
            elif current > previous:
                best_metric = {"metric": metric_name, **summary}

        exercise_summaries.append({
            "exercise_id": exercise.get("exercise_id") or exercise.get("id"),
            "exercise_name": exercise.get("exercise_name"),
            "movement_type": exercise.get("movement_type"),
            "metrics": metrics,
            "best_attempt": best_metric.get("best_attempt") if best_metric else None,
            "best_metric": best_metric,
        })

    session_metrics = {
        metric_name: summary
        for metric_name in metric_names
        for summary in [_metric_summary(all_attempts, metric_name)]
        if summary is not None
    }

    check_in = _nearest_check_in(check_ins, session)
    previous_check_ins = [
        item for item in sort_by_datetime(check_ins, "check_in_datetime")
        if check_in is not None and parse_datetime(item["check_in_datetime"]) < parse_datetime(check_in["check_in_datetime"])
    ]
    previous_check_in = previous_check_ins[-1] if previous_check_ins else None
    pain = get_check_in_pain(check_in) if check_in else None
    previous_pain = get_check_in_pain(previous_check_in) if previous_check_in else None

    session_load = calculate_session_load(session)
    weekly_load = sum(calculate_session_load(item) for item in _sessions_in_days(sessions, session, 7))
    monthly_load = sum(calculate_session_load(item) for item in _sessions_in_days(sessions, session, 30))
    freshness = get_check_in_freshness(check_in) if check_in else None
    soreness = get_check_in_soreness(check_in) if check_in else None

    historical_sessions = [
        item for item in sessions
        if item is not session and any(exercise.get("actual_metrics") for exercise in item.get("exercises", []))
    ]
    historical_comparison = {}
    for metric_name in ["rsi", "gct", "ft"]:
        historical_attempts = [
            attempt
            for historical_session in historical_sessions
            for exercise in historical_session.get("exercises", [])
            for attempt in exercise.get("actual_metrics", [])
        ]
        historical_summary = _metric_summary(historical_attempts, metric_name)
        historical_comparison[metric_name] = {
            "today": session_metrics.get(metric_name, {}).get("peak"),
            "historical_best": historical_summary.get("peak") if historical_summary else None,
        }

    best_session_metric = next(iter(session_metrics.values()), None)

    return {
        "exercise_summaries": exercise_summaries,
        "session_metrics": session_metrics,
        "best_exercise": next((item for item in exercise_summaries if item.get("best_metric")), None),
        "best_attempt": best_session_metric.get("best_attempt") if best_session_metric else None,
        "comparisons": {
            "session_load": session_load,
            "weekly_load": weekly_load,
            "monthly_load": monthly_load,
            "freshness": freshness,
            "soreness": soreness,
            "fatigue": calculate_fatigue(freshness, soreness),
            "readiness": calculate_readiness(freshness, soreness, pain),
            "pain": pain,
            "irritation_delta": calculate_irritation_delta(pain, previous_pain),
        },
        "historical_comparison": historical_comparison,
    }


def calculate_slope(values):
    values = finite_values(values)

    if len(values) < 2:
        return None

    x_values = list(range(len(values)))
    x_mean = statistics.mean(x_values)
    y_mean = statistics.mean(values)

    numerator = sum(
        (x - x_mean) * (y - y_mean)
        for x, y in zip(x_values, values)
    )

    denominator = sum((x - x_mean) ** 2 for x in x_values)

    if denominator == 0:
        return None

    return numerator / denominator


def calculate_performance_trend(performance_values):
    return calculate_slope(performance_values)


def calculate_load_trend(load_values):
    return calculate_slope(load_values)


def calculate_irritation_trend(pain_values):
    return calculate_slope(pain_values)


def calculate_fatigue_trend(fatigue_values):
    return calculate_slope(fatigue_values)


def calculate_load_tolerance_trend(load_trend, performance_trend, irritation_trend, fatigue_trend):
    if None in [load_trend, performance_trend, irritation_trend, fatigue_trend]:
        return None

    return load_trend + performance_trend - irritation_trend - fatigue_trend


def calculate_adaptation_trend(performance_trend, load_tolerance_trend, irritation_trend, fatigue_trend):
    if None in [performance_trend, load_tolerance_trend, irritation_trend, fatigue_trend]:
        return None

    return performance_trend + load_tolerance_trend - irritation_trend - fatigue_trend


def calculate_rolling_mean(values):
    values = finite_values(values)

    if len(values) == 0:
        return None

    return statistics.mean(values)


def calculate_rolling_sd(values):
    values = finite_values(values)

    if len(values) < 2:
        return 0

    return statistics.stdev(values)


def calculate_rolling_volatility(values):
    return calculate_rolling_sd(values)


def get_rolling_window(values, window_size):
    if window_size <= 0:
        raise ValueError("window_size must be greater than 0")

    return values[-window_size:]


def calculate_rolling_metrics(values, window_size=None):
    values = finite_values(values)

    if window_size is not None:
        values = get_rolling_window(values, window_size)

    return {
        "mean": calculate_rolling_mean(values),
        "sd": calculate_rolling_sd(values),
        "volatility": calculate_rolling_volatility(values),
        "slope": calculate_slope(values),
        "n": len(values),
    }


# ----------------------------
# Check-in extraction
# ----------------------------

def get_check_in_pain(check_in):
    if check_in is None:
        return None
    pain = check_in.get("pain")
    if isinstance(pain, (int, float)):
        return pain
    if pain is None:
        return check_in.get("pain_score")
    return pain.get("pain_score")


def get_check_in_freshness(check_in):
    if check_in is None:
        return None
    recovery = check_in.get("recovery")
    if check_in.get("freshness") is not None:
        return check_in.get("freshness")
    if recovery is None:
        return check_in.get("freshness_score")
    return recovery.get("freshness_score")


def get_check_in_soreness(check_in):
    if check_in is None:
        return None
    recovery = check_in.get("recovery")
    if check_in.get("soreness") is not None:
        return check_in.get("soreness")
    if recovery is None:
        return check_in.get("soreness_score")
    return recovery.get("soreness_score")


def calculate_check_in_fatigue(check_in):
    return calculate_fatigue(
        get_check_in_freshness(check_in),
        get_check_in_soreness(check_in),
    )


def calculate_check_in_readiness(check_in):
    return calculate_readiness(
        get_check_in_freshness(check_in),
        get_check_in_soreness(check_in),
        get_check_in_pain(check_in),
    )


def calculate_check_in_rsi(check_in):
    performance = check_in.get("performance")

    if performance is None:
        return None

    return calculate_normalised_rsi(
        performance.get("ft"),
        performance.get("ft_unit"),
        performance.get("gct"),
        performance.get("gct_unit"),
    )


def get_performance_metric(performance_entry, metric_name="performance_score"):
    if performance_entry is None:
        return None

    if metric_name == "rsi":
        return calculate_normalised_rsi(
            performance_entry.get("ft"),
            performance_entry.get("ft_unit"),
            performance_entry.get("gct"),
            performance_entry.get("gct_unit"),
        )

    if metric_name == "height_or_distance":
        return _to_cm(
            performance_entry.get("height_or_distance"),
            performance_entry.get("height_or_distance_unit") or performance_entry.get("unit"),
        )

    if metric_name == "sprint_time":
        return _to_seconds(
            performance_entry.get("sprint_time") if performance_entry.get("sprint_time") is not None else performance_entry.get("time"),
            performance_entry.get("sprint_time_unit") or performance_entry.get("time_unit") or "seconds",
        )

    if metric_name == "distance":
        return _to_metres(
            performance_entry.get("distance"),
            performance_entry.get("distance_unit") or performance_entry.get("unit"),
        )

    if metric_name == "weight":
        return _to_kg(performance_entry.get("weight"), performance_entry.get("weight_unit"))

    return performance_entry.get(metric_name)


def get_check_in_performance_metric(check_in, metric_name="performance_score"):
    return get_performance_metric(check_in.get("performance"), metric_name)


def get_check_in_series(check_ins, metric_name):
    sorted_check_ins = sort_by_datetime(check_ins, "check_in_datetime")
    values = []

    for check_in in sorted_check_ins:
        if metric_name == "pain":
            values.append(get_check_in_pain(check_in))
        elif metric_name == "freshness":
            values.append(get_check_in_freshness(check_in))
        elif metric_name == "soreness":
            values.append(get_check_in_soreness(check_in))
        elif metric_name == "fatigue":
            values.append(calculate_check_in_fatigue(check_in))
        elif metric_name == "readiness":
            values.append(calculate_check_in_readiness(check_in))
        elif metric_name == "rsi":
            values.append(calculate_check_in_rsi(check_in))
        else:
            values.append(get_check_in_performance_metric(check_in, metric_name))

    return finite_values(values)


def add_derived_values_to_check_in(check_in, previous_check_in=None):
    pain = get_check_in_pain(check_in)
    previous_pain = get_check_in_pain(previous_check_in) if previous_check_in is not None else None

    check_in["derived"] = {
        "fatigue": calculate_check_in_fatigue(check_in),
        "readiness": calculate_check_in_readiness(check_in),
        "rsi": calculate_check_in_rsi(check_in),
        "irritation_delta": calculate_irritation_delta(pain, previous_pain),
    }

    return check_in


def add_derived_values_to_session(session):
    exercise_loads = [
        calculate_exercise_load(exercise)
        for exercise in session.get("exercises", [])
    ]

    session["derived"] = {
        "exercise_loads": exercise_loads,
        "session_load": sum(exercise_loads),
        "volume": calculate_session_volume(session),
        "contacts": calculate_session_contacts(session),
        "reps": calculate_session_reps(session),
        "duration": calculate_session_duration(session),
        "average_intent": calculate_session_average_intent(session),
    }

    return session


def add_derived_values_to_calendar(calendar):
    for session in get_all_sessions(calendar):
        add_derived_values_to_session(session)

    sorted_check_ins = sort_by_datetime(calendar.get("check_ins", []), "check_in_datetime")
    previous_check_in = None

    for check_in in sorted_check_ins:
        link_check_in_to_session(calendar, check_in)
        add_derived_values_to_check_in(check_in, previous_check_in)
        previous_check_in = check_in

    return calendar


# ----------------------------
# Series helpers
# ----------------------------

def calculate_session_load_series(sessions):
    return [
        calculate_session_load(session)
        for session in sort_by_datetime(sessions, "session_datetime")
    ]


def calculate_session_metric_series(sessions, metric_name):
    sorted_sessions = sort_by_datetime(sessions, "session_datetime")
    values = []

    for session in sorted_sessions:
        if metric_name == "load":
            values.append(calculate_session_load(session))
        elif metric_name == "volume":
            values.append(calculate_session_volume(session))
        elif metric_name == "contacts":
            values.append(calculate_session_contacts(session))
        elif metric_name == "reps":
            values.append(calculate_session_reps(session))
        elif metric_name == "duration":
            values.append(calculate_session_duration(session))
        elif metric_name == "average_intent":
            values.append(calculate_session_average_intent(session))

    return finite_values(values)


def get_session_actual_metric(session, metric_name="rsi"):
    attempts = [
        attempt
        for exercise in session.get("exercises", [])
        for attempt in exercise.get("actual_metrics", [])
    ]
    summary = _metric_summary(attempts, metric_name)
    return summary.get("peak") if summary else None


def calculate_actual_performance_series(sessions, metric_name="rsi"):
    return [
        value for value in [
            get_session_actual_metric(session, metric_name)
            for session in sort_by_datetime(sessions, "session_datetime")
        ]
        if is_finite_number(value)
    ]


def calculate_performance_source_series(calendar, metric_name="performance_score"):
    sessions = get_all_sessions(calendar)
    actual_metric_name = "rsi" if metric_name == "performance_score" else metric_name
    actual_values = calculate_actual_performance_series(sessions, actual_metric_name)
    if actual_values:
        return actual_values
    return get_check_in_series(calendar.get("check_ins", []), metric_name)


def derive_pbs_from_actual_metrics(calendar):
    sessions = get_all_sessions(calendar)
    metric_map = {
        "max_height_or_distance": ("height_or_distance", "max"),
        "max_ft": ("ft", "max"),
        "min_gct": ("gct", "min"),
        "max_rsi": ("rsi", "max"),
        "min_sprint_time": ("sprint_time", "min"),
        "max_bar_velocity": ("bar_velocity", "max"),
        "max_weight": ("weight", "max"),
    }
    attempts = [
        attempt
        for session in sessions
        for exercise in session.get("exercises", [])
        for attempt in exercise.get("actual_metrics", [])
    ]

    pbs = {}
    for pb_key, (metric_name, mode) in metric_map.items():
        values = [
            _actual_metric_value(attempt, metric_name)
            for attempt in attempts
        ]
        values = finite_values(values)
        pbs[pb_key] = min(values) if mode == "min" and values else max(values) if values else None

    return pbs


def calculate_movement_type_frequency(sessions):
    frequency = {}

    for session in sessions:
        for exercise in session.get("exercises", []):
            movement_type = exercise["movement_type"]
            frequency[movement_type] = frequency.get(movement_type, 0) + 1

    return frequency


def calculate_max_intent_frequency(sessions, threshold=90):
    count = 0

    for session in sessions:
        for exercise in session.get("exercises", []):
            intent_percent = exercise.get("intent_percent")
            if is_finite_number(intent_percent) and intent_percent >= threshold:
                count += 1

    return count


def align_series(x_values, y_values):
    return [
        (x, y)
        for x, y in zip(x_values, y_values)
        if x is not None and y is not None
    ]


# ----------------------------
# Correlation helpers
# ----------------------------

def calculate_pearson_r(x_values, y_values):
    paired_values = align_series(x_values, y_values)

    if len(paired_values) < 2:
        return None

    x_values = [pair[0] for pair in paired_values]
    y_values = [pair[1] for pair in paired_values]

    x_mean = statistics.mean(x_values)
    y_mean = statistics.mean(y_values)

    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, y_values))
    x_denominator = sum((x - x_mean) ** 2 for x in x_values)
    y_denominator = sum((y - y_mean) ** 2 for y in y_values)
    denominator = (x_denominator * y_denominator) ** 0.5

    return safe_divide(numerator, denominator)


def calculate_ranks(values):
    sorted_values = sorted((value, index) for index, value in enumerate(values))
    ranks = [0] * len(values)

    index = 0
    while index < len(sorted_values):
        same_value_indexes = [sorted_values[index][1]]
        value = sorted_values[index][0]
        next_index = index + 1

        while next_index < len(sorted_values) and sorted_values[next_index][0] == value:
            same_value_indexes.append(sorted_values[next_index][1])
            next_index += 1

        average_rank = statistics.mean(range(index + 1, next_index + 1))

        for original_index in same_value_indexes:
            ranks[original_index] = average_rank

        index = next_index

    return ranks


def calculate_spearman_r(x_values, y_values):
    paired_values = align_series(x_values, y_values)

    if len(paired_values) < 2:
        return None

    x_values = [pair[0] for pair in paired_values]
    y_values = [pair[1] for pair in paired_values]

    return calculate_pearson_r(calculate_ranks(x_values), calculate_ranks(y_values))


def calculate_effect_size_summary(x_values, y_values):
    return {
        "pearson_r": calculate_pearson_r(x_values, y_values),
        "spearman_r": calculate_spearman_r(x_values, y_values),
        "n": len(align_series(x_values, y_values)),
    }


def absolute_effect_size(effect_summary):
    values = [
        effect_summary.get("pearson_r"),
        effect_summary.get("spearman_r"),
    ]
    values = [abs(value) for value in values if is_finite_number(value)]

    if not values:
        return None

    return max(values)


def rank_effects(effect_map):
    rows = []

    for name, summary in effect_map.items():
        effect_size = absolute_effect_size(summary)

        if effect_size is None:
            continue

        rows.append({
            "relationship": name,
            "effect_size": effect_size,
            "summary": summary,
        })

    return sorted(rows, key=lambda row: row["effect_size"], reverse=True)


def choose_strongest_relationship(relationships):
    ranked = rank_effects(relationships)
    return ranked[0] if ranked else None


# ----------------------------
# Output calculations
# ----------------------------

def calculate_macro_trends(calendar, performance_metric="performance_score"):
    sessions = get_all_sessions(calendar)
    check_ins = calendar.get("check_ins", [])

    session_loads = calculate_session_load_series(sessions)
    performance_values = calculate_performance_source_series(calendar, performance_metric)
    pain_values = get_check_in_series(check_ins, "pain")
    fatigue_values = get_check_in_series(check_ins, "fatigue")

    performance_trend = calculate_performance_trend(performance_values)
    load_trend = calculate_load_trend(session_loads)
    irritation_trend = calculate_irritation_trend(pain_values)
    fatigue_trend = calculate_fatigue_trend(fatigue_values)

    load_tolerance_trend = calculate_load_tolerance_trend(
        load_trend=load_trend,
        performance_trend=performance_trend,
        irritation_trend=irritation_trend,
        fatigue_trend=fatigue_trend,
    )

    adaptation_trend = calculate_adaptation_trend(
        performance_trend=performance_trend,
        load_tolerance_trend=load_tolerance_trend,
        irritation_trend=irritation_trend,
        fatigue_trend=fatigue_trend,
    )

    return {
        "performance_trend": performance_trend,
        "load_trend": load_trend,
        "irritation_trend": irritation_trend,
        "fatigue_trend": fatigue_trend,
        "load_tolerance_trend": load_tolerance_trend,
        "adaptation_trend": adaptation_trend,
    }


def calculate_performance_relationships(calendar, performance_metric="performance_score"):
    sessions = get_all_sessions(calendar)
    check_ins = calendar.get("check_ins", [])
    performance_values = calculate_performance_source_series(calendar, performance_metric)

    return {
        "freshness_to_performance": calculate_effect_size_summary(
            get_check_in_series(check_ins, "freshness"), performance_values
        ),
        "soreness_to_performance": calculate_effect_size_summary(
            get_check_in_series(check_ins, "soreness"), performance_values
        ),
        "fatigue_to_performance": calculate_effect_size_summary(
            get_check_in_series(check_ins, "fatigue"), performance_values
        ),
        "pain_to_performance": calculate_effect_size_summary(
            get_check_in_series(check_ins, "pain"), performance_values
        ),
        "readiness_to_performance": calculate_effect_size_summary(
            get_check_in_series(check_ins, "readiness"), performance_values
        ),
        "load_to_performance": calculate_effect_size_summary(
            calculate_session_load_series(sessions), performance_values
        ),
        "intent_to_performance": calculate_effect_size_summary(
            calculate_session_metric_series(sessions, "average_intent"), performance_values
        ),
    }


def calculate_irritation_relationships(calendar):
    sessions = get_all_sessions(calendar)
    check_ins = calendar.get("check_ins", [])
    pain_values = get_check_in_series(check_ins, "pain")

    return {
        "load_to_pain": calculate_effect_size_summary(
            calculate_session_load_series(sessions), pain_values
        ),
        "intent_to_pain": calculate_effect_size_summary(
            calculate_session_metric_series(sessions, "average_intent"), pain_values
        ),
        "fatigue_to_pain": calculate_effect_size_summary(
            get_check_in_series(check_ins, "fatigue"), pain_values
        ),
        "freshness_to_pain": calculate_effect_size_summary(
            get_check_in_series(check_ins, "freshness"), pain_values
        ),
        "soreness_to_pain": calculate_effect_size_summary(
            get_check_in_series(check_ins, "soreness"), pain_values
        ),
    }


def get_historical_performance_days(calendar, metric_name="performance_score", top_n=5):
    rows = []

    for check_in in calendar.get("check_ins", []):
        value = get_check_in_performance_metric(check_in, metric_name)

        if not is_finite_number(value):
            continue

        context = None
        if check_in.get("linked_session_id"):
            context = find_session_context_by_id(calendar, check_in["linked_session_id"])

        rows.append({
            "date": date_key(check_in["check_in_datetime"]),
            "value": value,
            "check_in_id": check_in["check_in_id"],
            "linked_session_id": check_in.get("linked_session_id"),
            "calendar_context": context,
        })

    rows = sorted(rows, key=lambda row: row["value"], reverse=True)
    values = [row["value"] for row in rows]

    return {
        "range": {
            "min": min(values) if values else None,
            "max": max(values) if values else None,
        },
        "best_days": rows[:top_n],
    }


# ----------------------------
# Calendar mapping / insight layer
# ----------------------------

def create_calendar_event_row(calendar, check_in, performance_metric="performance_score"):
    linked_session = None
    context = None

    if check_in.get("linked_session_id"):
        context = find_session_context_by_id(calendar, check_in["linked_session_id"])
        linked_session = find_session_by_id(calendar, check_in["linked_session_id"])

    if context is None:
        context = find_session_context_by_date(calendar, date_key(check_in["check_in_datetime"]))
        linked_session = find_session_by_date(calendar, date_key(check_in["check_in_datetime"]))

    return {
        "date": date_key(check_in["check_in_datetime"]),
        "check_in_id": check_in["check_in_id"],
        "linked_session_id": check_in.get("linked_session_id"),
        "macro_block": context.get("macro_block_name") if context else None,
        "block": context.get("block_name") if context else None,
        "week": context.get("week_name") if context else None,
        "session_name": context.get("session_name") if context else None,
        "session_load": calculate_session_load(linked_session) if linked_session else None,
        "performance": get_check_in_performance_metric(check_in, performance_metric),
        "pain": get_check_in_pain(check_in),
        "freshness": get_check_in_freshness(check_in),
        "soreness": get_check_in_soreness(check_in),
        "fatigue": calculate_check_in_fatigue(check_in),
        "readiness": calculate_check_in_readiness(check_in),
    }


def calculate_day_to_day_changes(rows):
    changes = []
    rows = sorted(rows, key=lambda row: row["date"])

    for index in range(1, len(rows)):
        previous = rows[index - 1]
        current = rows[index]

        changes.append({
            "from_date": previous["date"],
            "to_date": current["date"],
            "from_session": previous["session_name"],
            "to_session": current["session_name"],
            "macro_block": current["macro_block"],
            "block": current["block"],
            "week": current["week"],
            "load_change": (
                current["session_load"] - previous["session_load"]
                if is_finite_number(current["session_load"]) and is_finite_number(previous["session_load"])
                else None
            ),
            "performance_change": (
                current["performance"] - previous["performance"]
                if is_finite_number(current["performance"]) and is_finite_number(previous["performance"])
                else None
            ),
            "pain_change": (
                current["pain"] - previous["pain"]
                if is_finite_number(current["pain"]) and is_finite_number(previous["pain"])
                else None
            ),
            "fatigue_change": (
                current["fatigue"] - previous["fatigue"]
                if is_finite_number(current["fatigue"]) and is_finite_number(previous["fatigue"])
                else None
            ),
        })

    return changes


def get_largest_absolute_change(changes, metric_name):
    valid_changes = [change for change in changes if is_finite_number(change.get(metric_name))]

    if not valid_changes:
        return None

    return max(valid_changes, key=lambda change: abs(change[metric_name]))


def create_calendar_mapping_to_insight(calendar, performance_metric="performance_score"):
    rows = [
        create_calendar_event_row(calendar, check_in, performance_metric)
        for check_in in calendar.get("check_ins", [])
    ]
    rows = [row for row in rows if row["performance"] is not None or row["pain"] is not None]
    changes = calculate_day_to_day_changes(rows)

    return {
        "mapped_calendar_points": rows,
        "day_to_day_changes": changes,
        "largest_load_change": get_largest_absolute_change(changes, "load_change"),
        "largest_performance_change": get_largest_absolute_change(changes, "performance_change"),
        "largest_pain_change": get_largest_absolute_change(changes, "pain_change"),
        "largest_fatigue_change": get_largest_absolute_change(changes, "fatigue_change"),
        "historical_performance_days": get_historical_performance_days(calendar, performance_metric),
    }


def describe_trend_value(value):
    if not is_finite_number(value):
        return "insufficient data"

    if value > 0:
        return "increasing"

    if value < 0:
        return "decreasing"

    return "stable"


def create_interpretation_summary(macro_trends, strongest_performance_relationship, strongest_irritation_relationship):
    return {
        "adaptation_state": describe_trend_value(macro_trends.get("adaptation_trend")),
        "performance_state": describe_trend_value(macro_trends.get("performance_trend")),
        "irritation_state": describe_trend_value(macro_trends.get("irritation_trend")),
        "fatigue_state": describe_trend_value(macro_trends.get("fatigue_trend")),
        "strongest_performance_relationship": strongest_performance_relationship,
        "strongest_irritation_relationship": strongest_irritation_relationship,
    }


def create_insight(insight_type, category, finding, evidence=None, interpretation=None, calendar_mapping=None, confidence="exploratory"):
    return {
        "type": insight_type,
        "category": category,
        "finding": finding,
        "evidence": evidence if evidence is not None else {},
        "interpretation": interpretation,
        "calendar_mapping": calendar_mapping if calendar_mapping is not None else [],
        "confidence": confidence,
    }


def classify_direction(value, threshold=0):
    if not is_finite_number(value):
        return "unknown"

    if value > threshold:
        return "increasing"

    if value < -threshold:
        return "decreasing"

    return "stable"


def top_calendar_points_by_metric(calendar, metric_name, performance_metric="performance_score", top_n=3, reverse=True):
    rows = [
        create_calendar_event_row(calendar, check_in, performance_metric)
        for check_in in calendar.get("check_ins", [])
    ]

    valid_rows = [row for row in rows if is_finite_number(row.get(metric_name))]
    return sorted(valid_rows, key=lambda row: row[metric_name], reverse=reverse)[:top_n]


def generate_performance_insights(calendar, performance_metric="performance_score"):
    insights = []
    macro_trends = calculate_macro_trends(calendar, performance_metric)
    relationships = calculate_performance_relationships(calendar, performance_metric)
    strongest_relationship = choose_strongest_relationship(relationships)
    performance_trend = macro_trends.get("performance_trend")
    direction = classify_direction(performance_trend)
    calendar_points = top_calendar_points_by_metric(calendar, "performance", performance_metric)

    insights.append(create_insight(
        insight_type="performance_trend",
        category="performance",
        finding=f"Performance trend is {direction}",
        evidence={
            "performance_metric": performance_metric,
            "performance_trend": performance_trend,
            "macro_trends": macro_trends,
        },
        interpretation=(
            "Performance is improving over the selected window."
            if direction == "increasing"
            else "Performance is declining over the selected window."
            if direction == "decreasing"
            else "Performance is broadly stable over the selected window."
        ),
        calendar_mapping=calendar_points,
    ))

    if strongest_relationship is not None:
        insights.append(create_insight(
            insight_type="strongest_performance_relationship",
            category="performance",
            finding=f"Strongest performance relationship: {strongest_relationship['relationship']}",
            evidence=strongest_relationship,
            interpretation="This variable currently has the strongest observed relationship with performance in the selected data.",
            calendar_mapping=calendar_points,
        ))

    return insights


def generate_load_insights(calendar, performance_metric="performance_score"):
    sessions = get_all_sessions(calendar)
    session_loads = calculate_session_load_series(sessions)
    load_trend = calculate_load_trend(session_loads)
    direction = classify_direction(load_trend)

    calendar_mapping = []
    for row in flatten_sessions(calendar):
        session = row["session"]
        calendar_mapping.append({
            "date": date_key(session["session_datetime"]),
            "session_name": session.get("session_name"),
            "session_load": calculate_session_load(session),
            "macro_block": row.get("macro_block_name"),
            "block": row.get("block_name"),
            "week": row.get("week_name"),
        })

    return [create_insight(
        insight_type="load_trend",
        category="load",
        finding=f"Load trend is {direction}",
        evidence={
            "load_trend": load_trend,
            "session_loads": session_loads,
            "movement_type_frequency": calculate_movement_type_frequency(sessions),
            "max_intent_frequency": calculate_max_intent_frequency(sessions),
        },
        interpretation=(
            "Training load is increasing across the selected window."
            if direction == "increasing"
            else "Training load is decreasing across the selected window."
            if direction == "decreasing"
            else "Training load is broadly stable across the selected window."
        ),
        calendar_mapping=calendar_mapping,
    )]


def generate_irritation_insights(calendar):
    check_ins = calendar.get("check_ins", [])
    pain_values = get_check_in_series(check_ins, "pain")
    irritation_trend = calculate_irritation_trend(pain_values)
    direction = classify_direction(irritation_trend)
    relationships = calculate_irritation_relationships(calendar)
    strongest_relationship = choose_strongest_relationship(relationships)
    pain_calendar_points = top_calendar_points_by_metric(calendar, "pain", top_n=3)
    insights = []

    insights.append(create_insight(
        insight_type="irritation_trend",
        category="irritation",
        finding=f"Irritation trend is {direction}",
        evidence={"pain_values": pain_values, "irritation_trend": irritation_trend},
        interpretation=(
            "Pain/irritation is increasing across the selected window."
            if direction == "increasing"
            else "Pain/irritation is decreasing across the selected window."
            if direction == "decreasing"
            else "Pain/irritation is broadly stable across the selected window."
        ),
        calendar_mapping=pain_calendar_points,
    ))

    if strongest_relationship is not None:
        insights.append(create_insight(
            insight_type="strongest_irritation_relationship",
            category="irritation",
            finding=f"Strongest irritation relationship: {strongest_relationship['relationship']}",
            evidence=strongest_relationship,
            interpretation="This variable currently has the strongest observed relationship with pain/irritation in the selected data.",
            calendar_mapping=pain_calendar_points,
        ))

    return insights


def generate_recovery_insights(calendar):
    check_ins = calendar.get("check_ins", [])
    fatigue_values = get_check_in_series(check_ins, "fatigue")
    fatigue_trend = calculate_fatigue_trend(fatigue_values)
    direction = classify_direction(fatigue_trend)

    return [create_insight(
        insight_type="fatigue_trend",
        category="recovery",
        finding=f"Fatigue trend is {direction}",
        evidence={
            "freshness_values": get_check_in_series(check_ins, "freshness"),
            "soreness_values": get_check_in_series(check_ins, "soreness"),
            "fatigue_values": fatigue_values,
            "fatigue_trend": fatigue_trend,
        },
        interpretation=(
            "Fatigue is accumulating across the selected window."
            if direction == "increasing"
            else "Fatigue is reducing across the selected window."
            if direction == "decreasing"
            else "Fatigue is broadly stable across the selected window."
        ),
        calendar_mapping=top_calendar_points_by_metric(calendar, "fatigue", top_n=3),
    )]


def generate_adaptation_insights(calendar, performance_metric="performance_score"):
    macro_trends = calculate_macro_trends(calendar, performance_metric)
    adaptation_trend = macro_trends.get("adaptation_trend")
    direction = classify_direction(adaptation_trend)

    return [create_insight(
        insight_type="adaptation_trend",
        category="adaptation",
        finding=f"Adaptation trend is {direction}",
        evidence=macro_trends,
        interpretation=(
            "Performance and load tolerance are improving relative to irritation and fatigue."
            if direction == "increasing"
            else "Adaptation trend is worsening relative to irritation and fatigue."
            if direction == "decreasing"
            else "Adaptation trend is broadly stable or unclear."
        ),
        calendar_mapping=create_calendar_mapping_to_insight(calendar, performance_metric)["mapped_calendar_points"],
    )]


# ----------------------------
# Likely response
# ----------------------------

def create_lagged_pairs(predictor_values, outcome_values, lag=1):
    if lag <= 0:
        raise ValueError("lag must be greater than 0")

    pairs = []
    upper_bound = min(len(predictor_values), len(outcome_values))

    for index in range(lag, upper_bound):
        predictor = predictor_values[index - lag]
        outcome = outcome_values[index]

        if predictor is not None and outcome is not None:
            pairs.append((predictor, outcome))

    return pairs


def calculate_lagged_effect(predictor_values, outcome_values, lag=1):
    pairs = create_lagged_pairs(predictor_values, outcome_values, lag)

    if len(pairs) < 2:
        return {"lag": lag, "pearson_r": None, "spearman_r": None, "n": len(pairs)}

    predictors = [pair[0] for pair in pairs]
    outcomes = [pair[1] for pair in pairs]

    return {
        "lag": lag,
        "pearson_r": calculate_pearson_r(predictors, outcomes),
        "spearman_r": calculate_spearman_r(predictors, outcomes),
        "n": len(pairs),
    }


def create_likely_response(calendar, performance_metric="performance_score"):
    sessions = get_all_sessions(calendar)
    check_ins = calendar.get("check_ins", [])

    session_loads = calculate_session_load_series(sessions)
    pain_values = get_check_in_series(check_ins, "pain")
    performance_values = get_check_in_series(check_ins, performance_metric)

    return {
        "likely_good_performance_window": {
            "basis": "previous session load to later performance",
            "lag_1": calculate_lagged_effect(session_loads, performance_values, lag=1),
        },
        "likely_pain_window": {
            "basis": "previous session load to later pain",
            "lag_1": calculate_lagged_effect(session_loads, pain_values, lag=1),
        },
        "likely_bad_performance_window": {
            "basis": "previous pain to later performance",
            "lag_1": calculate_lagged_effect(pain_values, performance_values, lag=1),
        },
    }


def generate_likely_response_insights(calendar, performance_metric="performance_score"):
    likely_response = create_likely_response(calendar, performance_metric)

    return [
        create_insight(
            insight_type="likely_good_performance_window",
            category="forecasting",
            finding="Likely good performance window estimated from current relationships",
            evidence=likely_response.get("likely_good_performance_window"),
            interpretation="This is an exploratory estimate based on current load-performance relationships.",
            calendar_mapping=[],
        ),
        create_insight(
            insight_type="likely_pain_window",
            category="forecasting",
            finding="Likely pain window estimated from current relationships",
            evidence=likely_response.get("likely_pain_window"),
            interpretation="This is an exploratory estimate based on current load-pain relationships.",
            calendar_mapping=[],
        ),
        create_insight(
            insight_type="likely_bad_performance_window",
            category="forecasting",
            finding="Likely bad performance window estimated from current relationships",
            evidence=likely_response.get("likely_bad_performance_window"),
            interpretation="This is an exploratory estimate based on current pain-performance relationships.",
            calendar_mapping=[],
        ),
    ]


# ----------------------------
# Insight summary
# ----------------------------

def create_full_insight_summary(calendar, performance_metric="performance_score"):
    return {
        "performance_insights": generate_performance_insights(calendar, performance_metric),
        "load_insights": generate_load_insights(calendar, performance_metric),
        "irritation_insights": generate_irritation_insights(calendar),
        "recovery_insights": generate_recovery_insights(calendar),
        "adaptation_insights": generate_adaptation_insights(calendar, performance_metric),
        "likely_response_insights": generate_likely_response_insights(calendar, performance_metric),
    }


def render_single_insight(insight):
    return {
        "finding": insight.get("finding"),
        "interpretation": insight.get("interpretation"),
        "evidence": insight.get("evidence"),
        "calendar_mapping": insight.get("calendar_mapping", []),
        "confidence": insight.get("confidence"),
    }


def render_insight_summary(insight_summary):
    return {
        section_name: [render_single_insight(insight) for insight in insights]
        for section_name, insights in insight_summary.items()
    }


def create_insight_summary(calendar, performance_metric="performance_score"):
    macro_trends = calculate_macro_trends(calendar, performance_metric)
    performance_relationships = calculate_performance_relationships(calendar, performance_metric)
    irritation_relationships = calculate_irritation_relationships(calendar)
    strongest_performance_relationship = choose_strongest_relationship(performance_relationships)
    strongest_irritation_relationship = choose_strongest_relationship(irritation_relationships)

    return {
        "statistical_finding": {
            "macro_trends": macro_trends,
            "strongest_performance_relationship": strongest_performance_relationship,
            "strongest_irritation_relationship": strongest_irritation_relationship,
        },
        "interpretation_summary": create_interpretation_summary(
            macro_trends,
            strongest_performance_relationship,
            strongest_irritation_relationship,
        ),
        "calendar_mapping_to_insight": create_calendar_mapping_to_insight(calendar, performance_metric),
        "sectioned_insights": render_insight_summary(
            create_full_insight_summary(calendar, performance_metric)
        ),
    }


# ----------------------------
# Main output function
# ----------------------------

def generate_output_summary(calendar, performance_metric="performance_score", end_datetime=None):
    if end_datetime is None:
        end_datetime = datetime.now().isoformat()

    add_derived_values_to_calendar(calendar)

    sessions = get_all_sessions(calendar)
    check_ins = sort_by_datetime(calendar.get("check_ins", []), "check_in_datetime")

    session_loads = calculate_session_load_series(sessions)
    performance_values = get_check_in_series(check_ins, performance_metric)
    pain_values = get_check_in_series(check_ins, "pain")
    freshness_values = get_check_in_series(check_ins, "freshness")
    soreness_values = get_check_in_series(check_ins, "soreness")
    fatigue_values = get_check_in_series(check_ins, "fatigue")
    irritation_delta_values = [
        check_in.get("derived", {}).get("irritation_delta")
        for check_in in check_ins
    ]

    return {
        "monitoring": {
            "training_sessions": sessions,
            "calendar_structure": flatten_sessions(calendar),
        },
        "descriptive_statistics": {
            "rolling_state_metrics": {
                "performance": calculate_rolling_metrics(performance_values),
                "load": calculate_rolling_metrics(session_loads),
                "freshness": calculate_rolling_metrics(freshness_values),
                "soreness": calculate_rolling_metrics(soreness_values),
                "fatigue": calculate_rolling_metrics(fatigue_values),
                "pain": calculate_rolling_metrics(pain_values),
                "irritation_delta": calculate_rolling_metrics(irritation_delta_values),
            },
            "weekly_load": calculate_weekly_load(sessions, end_datetime),
            "monthly_load": calculate_monthly_load(sessions, end_datetime),
            "movement_type_frequency": calculate_movement_type_frequency(sessions),
            "max_intent_frequency": calculate_max_intent_frequency(sessions),
            "historical_performance_days": get_historical_performance_days(calendar, performance_metric),
        },
        "inferential_statistics": {
            "macro_trends": calculate_macro_trends(calendar, performance_metric),
            "performance_relationships": calculate_performance_relationships(calendar, performance_metric),
            "irritation_relationships": calculate_irritation_relationships(calendar),
        },
        "insight_summary": create_insight_summary(calendar, performance_metric),
        "likely_response": create_likely_response(calendar, performance_metric),
    }


# ----------------------------
# Visualisation / metric dashboard layer
# ----------------------------

METRIC_REGISTRY = {
    "performance_score": {
        "label": "Performance Score",
        "category": "performance",
        "source": "check_in",
    },
    "ft": {
        "label": "Flight Time",
        "category": "performance",
        "source": "check_in",
    },
    "gct": {
        "label": "Ground Contact Time",
        "category": "performance",
        "source": "check_in",
    },
    "rsi": {
        "label": "RSI",
        "category": "performance",
        "source": "check_in",
    },
    "height_or_distance": {
        "label": "Jump Height/Distance",
        "category": "performance",
        "source": "check_in",
    },
    "sprint_time": {
        "label": "Sprint Time",
        "category": "performance",
        "source": "check_in",
    },
    "bar_velocity": {
        "label": "Bar Velocity",
        "category": "performance",
        "source": "check_in",
    },
    "weight": {
        "label": "Weight",
        "category": "performance",
        "source": "check_in",
    },
    "pain": {
        "label": "Pain",
        "category": "irritation",
        "source": "check_in",
    },
    "irritation_delta": {
        "label": "Irritation Delta",
        "category": "irritation",
        "source": "check_in",
    },
    "freshness": {
        "label": "Freshness",
        "category": "recovery",
        "source": "check_in",
    },
    "soreness": {
        "label": "Soreness",
        "category": "recovery",
        "source": "check_in",
    },
    "fatigue": {
        "label": "Fatigue",
        "category": "recovery",
        "source": "check_in",
    },
    "readiness": {
        "label": "Readiness",
        "category": "recovery",
        "source": "check_in",
    },
    "session_load": {
        "label": "Session Load",
        "category": "load",
        "source": "session",
    },
    "volume": {
        "label": "Volume",
        "category": "load",
        "source": "session",
    },
    "contacts": {
        "label": "Contacts",
        "category": "load",
        "source": "session",
    },
    "reps": {
        "label": "Reps",
        "category": "load",
        "source": "session",
    },
    "duration": {
        "label": "Duration",
        "category": "load",
        "source": "session",
    },
    "average_intent": {
        "label": "Average Intent",
        "category": "load",
        "source": "session",
    },
}

METRIC_RELATIONSHIPS = {
    "pain": [
        "session_load",
        "average_intent",
        "freshness",
        "soreness",
        "fatigue",
        "readiness",
    ],
    "irritation_delta": [
        "session_load",
        "average_intent",
        "freshness",
        "soreness",
        "fatigue",
    ],
    "performance_score": [
        "session_load",
        "average_intent",
        "freshness",
        "soreness",
        "fatigue",
        "pain",
        "readiness",
    ],
    "ft": [
        "session_load",
        "average_intent",
        "freshness",
        "soreness",
        "fatigue",
        "pain",
        "readiness",
    ],
    "gct": [
        "session_load",
        "average_intent",
        "freshness",
        "soreness",
        "fatigue",
        "pain",
        "readiness",
    ],
    "rsi": [
        "session_load",
        "average_intent",
        "freshness",
        "soreness",
        "fatigue",
        "pain",
        "readiness",
    ],
    "height_or_distance": [
        "session_load",
        "average_intent",
        "freshness",
        "soreness",
        "fatigue",
        "pain",
        "readiness",
    ],
    "sprint_time": [
        "session_load",
        "average_intent",
        "freshness",
        "soreness",
        "fatigue",
        "pain",
        "readiness",
    ],
    "bar_velocity": [
        "session_load",
        "average_intent",
        "freshness",
        "soreness",
        "fatigue",
        "pain",
        "readiness",
    ],
    "freshness": [
        "session_load",
        "average_intent",
        "pain",
        "fatigue",
        "soreness",
        "performance_score",
    ],
    "soreness": [
        "session_load",
        "average_intent",
        "pain",
        "fatigue",
        "freshness",
        "performance_score",
    ],
    "fatigue": [
        "session_load",
        "average_intent",
        "pain",
        "freshness",
        "soreness",
        "performance_score",
    ],
    "readiness": [
        "session_load",
        "average_intent",
        "pain",
        "fatigue",
        "freshness",
        "soreness",
        "performance_score",
    ],
    "session_load": [
        "performance_score",
        "pain",
        "fatigue",
        "freshness",
        "soreness",
        "readiness",
    ],
    "average_intent": [
        "performance_score",
        "pain",
        "fatigue",
        "freshness",
        "soreness",
        "readiness",
    ],
}


def get_metric_info(metric_name):
    if metric_name not in METRIC_REGISTRY:
        raise ValueError(f"Unknown metric: {metric_name}")

    return METRIC_REGISTRY[metric_name]


def get_related_metrics(metric_name):
    if metric_name in METRIC_RELATIONSHIPS:
        return METRIC_RELATIONSHIPS[metric_name]

    metric_info = get_metric_info(metric_name)

    if metric_info["category"] == "performance":
        return [
            "session_load",
            "average_intent",
            "freshness",
            "soreness",
            "fatigue",
            "pain",
            "readiness",
        ]

    if metric_info["category"] == "irritation":
        return [
            "session_load",
            "average_intent",
            "freshness",
            "soreness",
            "fatigue",
            "readiness",
        ]

    if metric_info["category"] == "recovery":
        return [
            "session_load",
            "average_intent",
            "pain",
            "performance_score",
        ]

    if metric_info["category"] == "load":
        return [
            "performance_score",
            "pain",
            "fatigue",
            "freshness",
            "soreness",
        ]

    return []


def get_primary_performance_entry_from_check_in(check_in):
    return check_in.get("performance")


def get_performance_field_value(performance_entry, metric_name):
    if performance_entry is None:
        return None

    if metric_name == "performance_score":
        return performance_entry.get("performance_score")

    if metric_name == "rsi":
        return calculate_normalised_rsi(
            performance_entry.get("ft"),
            performance_entry.get("ft_unit"),
            performance_entry.get("gct"),
            performance_entry.get("gct_unit"),
        )

    if metric_name == "sprint_time":
        return _to_seconds(
            performance_entry.get("sprint_time") if performance_entry.get("sprint_time") is not None else performance_entry.get("time"),
            performance_entry.get("sprint_time_unit") or performance_entry.get("time_unit") or "seconds",
        )

    if metric_name == "height_or_distance":
        return _to_cm(
            performance_entry.get("height_or_distance"),
            performance_entry.get("height_or_distance_unit") or performance_entry.get("unit"),
        )

    if metric_name == "distance":
        return _to_metres(
            performance_entry.get("distance"),
            performance_entry.get("distance_unit") or performance_entry.get("unit"),
        )

    if metric_name == "weight":
        return _to_kg(performance_entry.get("weight"), performance_entry.get("weight_unit"))

    return performance_entry.get(metric_name)


def get_session_visualisation_metrics(session):
    if session is None:
        return {
            "session_load": None,
            "volume": None,
            "contacts": None,
            "reps": None,
            "duration": None,
            "average_intent": None,
        }

    return {
        "session_load": calculate_session_load(session),
        "volume": calculate_session_volume(session),
        "contacts": calculate_session_contacts(session),
        "reps": calculate_session_reps(session),
        "duration": calculate_session_duration(session),
        "average_intent": calculate_session_average_intent(session),
    }


def get_check_in_visualisation_metrics(check_in):
    performance_entry = get_primary_performance_entry_from_check_in(check_in)

    return {
        "pain": get_check_in_pain(check_in),
        "freshness": get_check_in_freshness(check_in),
        "soreness": get_check_in_soreness(check_in),
        "fatigue": calculate_check_in_fatigue(check_in),
        "readiness": calculate_check_in_readiness(check_in),
        "irritation_delta": check_in.get("derived", {}).get("irritation_delta"),
        "performance_score": get_performance_field_value(performance_entry, "performance_score"),
        "ft": get_performance_field_value(performance_entry, "ft"),
        "gct": get_performance_field_value(performance_entry, "gct"),
        "rsi": get_performance_field_value(performance_entry, "rsi"),
        "height_or_distance": get_performance_field_value(performance_entry, "height_or_distance"),
        "sprint_time": get_performance_field_value(performance_entry, "sprint_time"),
        "bar_velocity": get_performance_field_value(performance_entry, "bar_velocity"),
        "weight": get_performance_field_value(performance_entry, "weight"),
    }


def create_visualisation_row_from_check_in(calendar, check_in):
    linked_session = None
    context = None

    if check_in.get("linked_session_id"):
        linked_session = find_session_by_id(calendar, check_in["linked_session_id"])
        context = find_session_context_by_id(calendar, check_in["linked_session_id"])

    if linked_session is None:
        target_date = date_key(check_in["check_in_datetime"])
        linked_session = find_session_by_date(calendar, target_date)
        context = find_session_context_by_date(calendar, target_date)

    row = {
        "date": date_key(check_in["check_in_datetime"]),
        "datetime": check_in["check_in_datetime"],
        "row_type": "check_in",
        "check_in_id": check_in.get("check_in_id"),
        "linked_session_id": check_in.get("linked_session_id"),
        "session_id": linked_session.get("session_id") if linked_session else None,
        "session_name": linked_session.get("session_name") if linked_session else None,
        "macro_block": context.get("macro_block_name") if context else None,
        "block": context.get("block_name") if context else None,
        "week": context.get("week_name") if context else None,
    }

    row.update(get_session_visualisation_metrics(linked_session))
    row.update(get_check_in_visualisation_metrics(check_in))

    return row


def create_visualisation_row_from_session(calendar, session):
    context = find_session_context_by_id(calendar, session["session_id"])

    row = {
        "date": date_key(session["session_datetime"]),
        "datetime": session["session_datetime"],
        "row_type": "session",
        "check_in_id": None,
        "linked_session_id": None,
        "session_id": session.get("session_id"),
        "session_name": session.get("session_name"),
        "macro_block": context.get("macro_block_name") if context else None,
        "block": context.get("block_name") if context else None,
        "week": context.get("week_name") if context else None,
    }

    row.update(get_session_visualisation_metrics(session))

    for metric_name, info in METRIC_REGISTRY.items():
        if info["source"] == "check_in" and metric_name not in row:
            row[metric_name] = None

    return row


def create_visualisation_rows(calendar, include_session_only_rows=True):
    add_derived_values_to_calendar(calendar)

    rows = []
    check_in_session_ids = set()

    for check_in in sort_by_datetime(calendar.get("check_ins", []), "check_in_datetime"):
        rows.append(create_visualisation_row_from_check_in(calendar, check_in))

        if check_in.get("linked_session_id"):
            check_in_session_ids.add(check_in["linked_session_id"])

    if include_session_only_rows:
        for session in get_all_sessions(calendar):
            if session.get("session_id") not in check_in_session_ids:
                rows.append(create_visualisation_row_from_session(calendar, session))

    return sorted(
        rows,
        key=lambda row: parse_datetime(row["datetime"])
    )


def get_metric_series_from_rows(rows, metric_name):
    return [
        row.get(metric_name)
        for row in rows
        if row.get(metric_name) is not None
    ]


def create_time_series_dataset(calendar, metric_name, include_session_only_rows=True):
    get_metric_info(metric_name)

    rows = create_visualisation_rows(
        calendar,
        include_session_only_rows=include_session_only_rows
    )

    return [
        {
            "date": row["date"],
            "datetime": row["datetime"],
            "value": row.get(metric_name),
            "metric": metric_name,
            "session_name": row.get("session_name"),
            "macro_block": row.get("macro_block"),
            "block": row.get("block"),
            "week": row.get("week"),
            "row_type": row.get("row_type"),
        }
        for row in rows
        if row.get(metric_name) is not None
    ]


def create_multi_metric_time_series_dataset(calendar, metric_names, include_session_only_rows=True):
    return {
        metric_name: create_time_series_dataset(
            calendar,
            metric_name,
            include_session_only_rows=include_session_only_rows
        )
        for metric_name in metric_names
    }


def create_scatter_dataset(calendar, x_metric, y_metric):
    get_metric_info(x_metric)
    get_metric_info(y_metric)

    rows = create_visualisation_rows(
        calendar,
        include_session_only_rows=False
    )

    scatter_rows = []

    for row in rows:
        x_value = row.get(x_metric)
        y_value = row.get(y_metric)

        if x_value is None or y_value is None:
            continue

        scatter_rows.append({
            "x": x_value,
            "y": y_value,
            "x_metric": x_metric,
            "y_metric": y_metric,
            "date": row["date"],
            "datetime": row["datetime"],
            "session_name": row.get("session_name"),
            "macro_block": row.get("macro_block"),
            "block": row.get("block"),
            "week": row.get("week"),
        })

    return scatter_rows


def calculate_metric_relationship_from_rows(rows, x_metric, y_metric):
    x_values = []
    y_values = []

    for row in rows:
        x_value = row.get(x_metric)
        y_value = row.get(y_metric)

        if x_value is None or y_value is None:
            continue

        x_values.append(x_value)
        y_values.append(y_value)

    return calculate_effect_size_summary(x_values, y_values)


def calculate_metric_relationships(calendar, metric_name):
    get_metric_info(metric_name)

    rows = create_visualisation_rows(
        calendar,
        include_session_only_rows=False
    )

    relationships = {}

    for related_metric in get_related_metrics(metric_name):
        if related_metric not in METRIC_REGISTRY:
            continue

        relationships[f"{related_metric}_to_{metric_name}"] = calculate_metric_relationship_from_rows(
            rows,
            related_metric,
            metric_name
        )

    return relationships


def create_related_scatter_datasets(calendar, metric_name):
    return {
        f"{related_metric}_to_{metric_name}": create_scatter_dataset(
            calendar,
            related_metric,
            metric_name
        )
        for related_metric in get_related_metrics(metric_name)
        if related_metric in METRIC_REGISTRY
    }


def calculate_metric_trend(calendar, metric_name):
    values = get_metric_series_from_rows(
        create_visualisation_rows(calendar),
        metric_name
    )

    return calculate_slope(values)


def create_metric_calendar_markers(calendar, metric_name, top_n=3):
    rows = [
        row for row in create_visualisation_rows(calendar)
        if row.get(metric_name) is not None
    ]

    if not rows:
        return {
            "highest_points": [],
            "lowest_points": [],
            "largest_changes": [],
        }

    highest_points = sorted(
        rows,
        key=lambda row: row[metric_name],
        reverse=True
    )[:top_n]

    lowest_points = sorted(
        rows,
        key=lambda row: row[metric_name]
    )[:top_n]

    changes = []

    rows = sorted(
        rows,
        key=lambda row: parse_datetime(row["datetime"])
    )

    for index in range(1, len(rows)):
        previous = rows[index - 1]
        current = rows[index]
        current_value = current.get(metric_name)
        previous_value = previous.get(metric_name)
        if not is_finite_number(current_value) or not is_finite_number(previous_value):
            continue

        changes.append({
            "from_date": previous["date"],
            "to_date": current["date"],
            "from_value": previous_value,
            "to_value": current_value,
            "change": current_value - previous_value,
            "from_session": previous.get("session_name"),
            "to_session": current.get("session_name"),
            "macro_block": current.get("macro_block"),
            "block": current.get("block"),
            "week": current.get("week"),
        })

    largest_changes = sorted(
        changes,
        key=lambda change: abs(change["change"]),
        reverse=True
    )[:top_n]

    def trim_marker(row):
        return {
            "date": row.get("date"),
            "datetime": row.get("datetime"),
            "value": row.get(metric_name),
            "session_name": row.get("session_name"),
            "macro_block": row.get("macro_block"),
            "block": row.get("block"),
            "week": row.get("week"),
            "row_type": row.get("row_type"),
        }

    return {
        "highest_points": [trim_marker(row) for row in highest_points],
        "lowest_points": [trim_marker(row) for row in lowest_points],
        "largest_changes": largest_changes,
    }


def create_metric_insights(calendar, metric_name):
    metric_info = get_metric_info(metric_name)
    trend = calculate_metric_trend(calendar, metric_name)
    direction = classify_direction(trend)
    relationships = calculate_metric_relationships(calendar, metric_name)
    strongest_relationship = choose_strongest_relationship(relationships)
    markers = create_metric_calendar_markers(calendar, metric_name)

    insights = [
        create_insight(
            insight_type=f"{metric_name}_trend",
            category=metric_info["category"],
            finding=f"{metric_info['label']} trend is {direction}",
            evidence={
                "metric": metric_name,
                "trend": trend,
                "rolling_metrics": calculate_rolling_metrics(
                    get_metric_series_from_rows(
                        create_visualisation_rows(calendar),
                        metric_name
                    )
                ),
            },
            interpretation=(
                f"{metric_info['label']} is increasing across the selected window."
                if direction == "increasing"
                else f"{metric_info['label']} is decreasing across the selected window."
                if direction == "decreasing"
                else f"{metric_info['label']} is broadly stable across the selected window."
            ),
            calendar_mapping=markers,
        )
    ]

    if strongest_relationship is not None:
        relationship_name = strongest_relationship["relationship"]

        insights.append(
            create_insight(
                insight_type=f"strongest_{metric_name}_relationship",
                category=metric_info["category"],
                finding=f"Strongest relationship for {metric_info['label']}: {relationship_name}",
                evidence=strongest_relationship,
                interpretation=(
                    f"{relationship_name} currently has the strongest observed relationship with "
                    f"{metric_info['label']} in the selected data."
                ),
                calendar_mapping=markers,
            )
        )

    return insights


def render_metric_insights(insights):
    return [
        render_single_insight(insight)
        for insight in insights
    ]


def create_block_comparison_rows(calendar, group_by="block", metric_names=None):
    if metric_names is None:
        metric_names = [
            "session_load",
            "performance_score",
            "pain",
            "freshness",
            "soreness",
            "fatigue",
            "readiness",
        ]

    rows = create_visualisation_rows(calendar)
    groups = {}

    for row in rows:
        group_name = row.get(group_by)

        if group_name is None:
            group_name = "unassigned"

        if group_name not in groups:
            groups[group_name] = []

        groups[group_name].append(row)

    output_rows = []

    for group_name, group_rows in groups.items():
        output_row = {
            "group_by": group_by,
            "group_name": group_name,
            "n_rows": len(group_rows),
        }

        for metric_name in metric_names:
            metric_values = [
                row.get(metric_name)
                for row in group_rows
                if row.get(metric_name) is not None
            ]

            output_row[f"{metric_name}_mean"] = calculate_rolling_mean(metric_values)
            output_row[f"{metric_name}_sd"] = calculate_rolling_sd(metric_values)
            output_row[f"{metric_name}_slope"] = calculate_slope(metric_values)

        output_rows.append(output_row)

    return output_rows


def generate_metric_dashboard(calendar, metric_name, include_related=True):
    metric_info = get_metric_info(metric_name)
    rows = create_visualisation_rows(calendar)

    primary_values = get_metric_series_from_rows(
        rows,
        metric_name
    )

    dashboard = {
        "metric": metric_name,
        "metric_info": metric_info,
        "related_metrics": get_related_metrics(metric_name),
        "time_series": create_time_series_dataset(calendar, metric_name),
        "rolling_metrics": calculate_rolling_metrics(primary_values),
        "trend": {
            "slope": calculate_slope(primary_values),
            "direction": classify_direction(calculate_slope(primary_values)),
        },
        "calendar_markers": create_metric_calendar_markers(calendar, metric_name),
        "insights": render_metric_insights(
            create_metric_insights(calendar, metric_name)
        ),
    }

    if include_related:
        dashboard["relationships"] = calculate_metric_relationships(
            calendar,
            metric_name
        )
        dashboard["ranked_relationships"] = rank_effects(
            dashboard["relationships"]
        )
        dashboard["scatterplots"] = create_related_scatter_datasets(
            calendar,
            metric_name
        )

    return dashboard


def generate_visualisation_output(calendar):
    return {
        "available_metrics": METRIC_REGISTRY,
        "visualisation_rows": create_visualisation_rows(calendar),
        "default_dashboards": {
            "pain": generate_metric_dashboard(calendar, "pain"),
            "performance_score": generate_metric_dashboard(calendar, "performance_score"),
            "fatigue": generate_metric_dashboard(calendar, "fatigue"),
            "session_load": generate_metric_dashboard(calendar, "session_load"),
        },
        "block_comparisons": {
            "by_macro_block": create_block_comparison_rows(calendar, group_by="macro_block"),
            "by_block": create_block_comparison_rows(calendar, group_by="block"),
            "by_week": create_block_comparison_rows(calendar, group_by="week"),
        },
    }


def generate_full_app_output(calendar, performance_metric="performance_score", end_datetime=None):
    return {
        "output_summary": generate_output_summary(
            calendar,
            performance_metric=performance_metric,
            end_datetime=end_datetime,
        ),
        "visualisation": generate_visualisation_output(calendar),
    }

# -----------------------------------------------------------------------------
# Expo app analysis API source of truth
# -----------------------------------------------------------------------------
# The React Native app sends its stored JSON object to analyze_app_data().  All
# data-dependent interpretation copy and analytics used by the UI should be
# generated here, not in App.js.

APP_METRIC_META = {
    "performance": {"label": "Performance score", "tone": "positive"},
    "height_or_distance": {"label": "Height / distance", "tone": "positive"},
    "rsi": {"label": "RSI", "tone": "positive"},
    "ft": {"label": "FT", "tone": "positive"},
    "gct": {"label": "GCT", "tone": "risk"},
    "sprint_time": {"label": "Sprint time", "tone": "risk"},
    "bar_velocity": {"label": "Bar velocity", "tone": "positive"},
    "weight": {"label": "Weight", "tone": "neutral"},
    "load": {"label": "Session load", "tone": "neutral"},
    "volume": {"label": "Volume", "tone": "neutral"},
    "contacts": {"label": "Contacts", "tone": "neutral"},
    "reps": {"label": "Reps", "tone": "neutral"},
    "duration": {"label": "Duration", "tone": "neutral"},
    "average_intent": {"label": "Average intent", "tone": "neutral"},
    "freshness": {"label": "Freshness", "tone": "positive"},
    "fatigue": {"label": "Fatigue", "tone": "risk"},
    "readiness": {"label": "Readiness", "tone": "positive"},
    "pain": {"label": "Pain", "tone": "risk"},
    "pain_delta": {"label": "Pain change", "tone": "risk"},
}

APP_RELATIONSHIP_SPECS = [
    ("pain_load", "Pain vs Load", "Irritation", "load", "pain", "Session Load", "Pain", "#E13F32"),
    ("pain_fatigue", "Pain vs Fatigue", "Irritation", "fatigue", "pain", "Fatigue", "Pain", "#B1382D"),
    ("pain_average_intent", "Pain vs Average Intent", "Irritation", "average_intent", "pain", "Average Intent", "Pain", "#D05A3C"),
    ("performance_freshness", "Performance vs Freshness", "Performance", "freshness", "performance", "Freshness (0-10)", "Performance", "#24883B"),
    ("performance_readiness", "Performance vs Readiness", "Performance", "readiness", "performance", "Readiness", "Performance", "#2D9A68"),
    ("performance_pain", "Performance vs Pain", "Performance", "pain", "performance", "Pain", "Performance", "#E13F32"),
    ("performance_fatigue", "Performance vs Fatigue", "Recovery", "fatigue", "performance", "Fatigue", "Performance", "#6656E8"),
    ("performance_load", "Performance vs Load", "Load Tolerance", "load", "performance", "Session Load", "Performance", "#1F7A40"),
    ("performance_average_intent", "Performance vs Average Intent", "Performance", "average_intent", "performance", "Average Intent", "Performance", "#3B9859"),
    ("fatigue_load", "Fatigue vs Load", "Recovery", "load", "fatigue", "Session Load", "Fatigue", "#6656E8"),
    ("readiness_load", "Readiness vs Load", "Recovery", "load", "readiness", "Session Load", "Readiness", "#2D9A68"),
]


def _num(value, fallback=0):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    if math.isfinite(parsed):
        return parsed
    return fallback


def _finite(value):
    return is_finite_number(value)


def _json_num(value):
    return value if _finite(value) else None


def _pretty(value, digits=1):
    return f"{value:.{digits}f}" if _finite(value) else "-"


def _unit(value):
    return str(value or "").strip().lower()


def _to_seconds(value, unit):
    numeric = _num(value, None)
    if not _finite(numeric) or numeric <= 0:
        return None
    base_unit = _unit(unit) or "seconds"
    if base_unit in ["milliseconds", "ms"]:
        return numeric / 1000
    return numeric


def _to_cm(value, unit):
    numeric = _num(value, None)
    if not _finite(numeric) or numeric <= 0:
        return None
    base_unit = _unit(unit) or "cm"
    if base_unit in ["inches", "inch", "in"]:
        return numeric * 2.54
    return numeric


def _to_metres(value, unit):
    numeric = _num(value, None)
    if not _finite(numeric) or numeric <= 0:
        return None
    base_unit = _unit(unit) or "metres"
    if base_unit in ["yards", "yard", "yd"]:
        return numeric * 0.9144
    return numeric


def _to_kg(value, unit):
    numeric = _num(value, None)
    if not _finite(numeric) or numeric <= 0:
        return None
    base_unit = _unit(unit) or "kg"
    if base_unit in ["lbs", "lb"]:
        return numeric * 0.45359237
    return numeric


def _parse_dt(value):
    if not value:
        return datetime.min
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return datetime.min


def _date_short(value):
    parsed = _parse_dt(value)
    if parsed == datetime.min:
        return "unknown date"
    return parsed.strftime("%b %d").replace(" 0", " ")


def app_get_volume(exercise):
    movement = exercise.get("movement_type")
    if movement == "plyometric":
        return _num(exercise.get("contacts"))
    if movement in ["power_ballistic", "strength", "general"]:
        sets = _num(exercise.get("sets"), 1) or 1
        reps = _num(exercise.get("reps"))
        return sets * reps if sets and reps else reps
    if movement == "sprint":
        reps = _num(exercise.get("reps"), 1) or 1
        distance = _num(exercise.get("distance"))
        return reps * distance if distance else reps
    if movement == "rehab":
        duration = _num(exercise.get("duration_minutes"))
        if duration:
            return duration
        sets = _num(exercise.get("sets"), 1) or 1
        reps = _num(exercise.get("reps"))
        return sets * reps if sets and reps else reps
    return _num(exercise.get("duration_minutes"))


def app_get_intent_score(exercise):
    return _num(exercise.get("intent_percent")) / 100


def app_get_intensity_score(exercise):
    value = _num(exercise.get("intensity_value"), None)
    unit = exercise.get("intensity_unit") or "%"
    if unit == "%":
        return (value / 100) if _finite(value) else 1
    if unit in ["kg", "lbs"]:
        converted = _to_kg(value if _finite(value) else 1, unit)
        return converted if _finite(converted) else 1
    return 1


def app_exercise_load(exercise):
    volume = app_get_volume(exercise)
    intent = app_get_intent_score(exercise)
    intensity = app_get_intensity_score(exercise)
    movement = exercise.get("movement_type")
    if movement == "power_ballistic":
        return volume * intent * intensity
    if movement in ["strength", "general", "rehab"]:
        # reps (x load), intensity defaults to 1 when no load is given.
        return volume * intensity
    # plyometric (contacts x intent), sprint (distance x intent), endurance, skill.
    return volume * intent


def app_session_load(session):
    return sum(app_exercise_load(exercise) for exercise in (session or {}).get("exercises", []))


def app_session_volume_by_type(session):
    rows = {"plyometric": 0, "strength": 0, "power_ballistic": 0, "sprint": 0, "general": 0, "endurance": 0, "rehab": 0, "skill": 0}
    for exercise in (session or {}).get("exercises", []):
        movement = exercise.get("movement_type") or "skill"
        rows[movement] = rows.get(movement, 0) + app_get_volume(exercise)
    return rows


# Force-Velocity coverage taxonomy (mirror of mobile/src/exerciseLibrary.js QUALITY_META).
# Curve qualities are ordered low->high velocity; work_capacity + rehab are off-curve.
QUALITY_KEYS = [
    "max_strength",
    "strength_speed",
    "speed_strength",
    "reactive_strength",
    "max_speed",
    "work_capacity",
    "rehab",
]
QUALITY_CURVE_KEYS = ["max_strength", "strength_speed", "speed_strength", "reactive_strength", "max_speed"]
APP_TYPE_DEFAULT_QUALITY = {
    "strength": "max_strength",
    "power_ballistic": "speed_strength",
    "plyometric": "reactive_strength",
    "sprint": "max_speed",
    "general": "work_capacity",
    "endurance": "work_capacity",
    "rehab": "rehab",
    "skill": None,
}


def app_default_quality_for_type(movement_type):
    return APP_TYPE_DEFAULT_QUALITY.get(movement_type)


def app_exercise_quality(exercise):
    return exercise.get("quality") or app_default_quality_for_type(exercise.get("movement_type"))


def app_session_coverage(session):
    """Load contributed to each FV quality by a session (the coverage 'dose')."""
    coverage = {key: 0.0 for key in QUALITY_KEYS}
    for exercise in (session or {}).get("exercises", []):
        quality = app_exercise_quality(exercise)
        if quality in coverage:
            coverage[quality] += app_exercise_load(exercise)
    return coverage


def _iso_day(value):
    parsed = _parse_dt(value)
    if parsed == datetime.min:
        return None
    return parsed.date().isoformat()


def _day_in_range(day, start, end):
    if not day:
        return False
    start_day = _iso_day(start)
    end_day = _iso_day(end)
    if start_day and day < start_day:
        return False
    if end_day and day > end_day:
        return False
    return bool(start_day or end_day)


def app_programme_structure(data):
    """Flatten the programme into planned sessions tagged with block/week + computed load + FV coverage."""
    programme = data.get("programme") or {}
    items = []
    for macro in programme.get("macro_blocks", []) or []:
        for block in macro.get("blocks", []) or []:
            for week in block.get("weeks", []) or []:
                for session in week.get("sessions", []) or []:
                    items.append({
                        "macro_id": macro.get("id"),
                        "block_id": block.get("id"),
                        "block_name": block.get("block_name") or "Block",
                        "week_id": week.get("id"),
                        "week_start": week.get("start_date"),
                        "week_end": week.get("end_date"),
                        "date": session.get("date"),
                        "session": session,
                        "load": app_session_load(session),
                        "coverage": app_session_coverage(session),
                    })
    return items


def app_build_block_analysis(data, ordered):
    """Aggregate the programme to week + block granularity and couple responses by date.

    This is the big-picture layer the block reads (B1/B2/B3) consume. Stats stay raw
    here; the analysis builders interpret them.
    """
    structure = app_programme_structure(data)
    weeks_by_id = {}
    week_order = []
    for item in structure:
        wid = item["week_id"]
        if not wid:
            continue
        if wid not in weeks_by_id:
            weeks_by_id[wid] = {
                "weekId": wid,
                "blockId": item["block_id"],
                "blockName": item["block_name"],
                "weekStart": item["week_start"],
                "weekEnd": item["week_end"],
                "plannedLoad": 0.0,
                "coverage": {key: 0.0 for key in QUALITY_KEYS},
                "sessionCount": 0,
                "_fatigues": [],
                "_pains": [],
                "_outputs": [],
            }
            week_order.append(wid)
        week = weeks_by_id[wid]
        week["plannedLoad"] += item["load"]
        week["sessionCount"] += 1
        for key, value in item["coverage"].items():
            week["coverage"][key] += value

    # Couple each logged response/output to the planned week whose date range contains it.
    for row in ordered:
        day = _iso_day(row.get("date"))
        if not day:
            continue
        for week in weeks_by_id.values():
            if _day_in_range(day, week["weekStart"], week["weekEnd"]):
                if _finite(row.get("fatigue")):
                    week["_fatigues"].append(row["fatigue"])
                if _finite(row.get("pain")):
                    week["_pains"].append(row["pain"])
                if _finite(row.get("performance")):
                    week["_outputs"].append(row["performance"])
                break

    weeks = []
    for wid in sorted(week_order, key=lambda key: _iso_day(weeks_by_id[key]["weekStart"]) or ""):
        week = weeks_by_id[wid]
        outputs = week["_outputs"]
        weeks.append({
            "weekId": wid,
            "blockId": week["blockId"],
            "blockName": week["blockName"],
            "weekStart": week["weekStart"],
            "weekEnd": week["weekEnd"],
            "plannedLoad": _json_num(week["plannedLoad"]),
            "sessionCount": week["sessionCount"],
            "coverage": {key: _json_num(value) for key, value in week["coverage"].items()},
            "meanFatigue": _json_num(app_mean(week["_fatigues"])),
            "meanPain": _json_num(app_mean(week["_pains"])),
            "bestOutput": _json_num(max(outputs) if outputs else None),
            "meanOutput": _json_num(app_mean(outputs)),
            "responseCount": len(week["_outputs"]) + len(week["_fatigues"]) + len(week["_pains"]),
        })

    blocks_by_id = {}
    block_order = []
    for week in weeks:
        bid = week["blockId"]
        if bid not in blocks_by_id:
            blocks_by_id[bid] = {
                "blockId": bid,
                "blockName": week["blockName"],
                "weeks": [],
                "plannedLoad": 0.0,
                "coverage": {key: 0.0 for key in QUALITY_KEYS},
            }
            block_order.append(bid)
        block = blocks_by_id[bid]
        block["weeks"].append(week)
        block["plannedLoad"] += week["plannedLoad"] or 0
        for key, value in (week["coverage"] or {}).items():
            block["coverage"][key] += value or 0

    blocks = []
    for bid in block_order:
        block = blocks_by_id[bid]
        week_loads = [week["plannedLoad"] for week in block["weeks"] if _finite(week["plannedLoad"])]
        blocks.append({
            "blockId": bid,
            "blockName": block["blockName"],
            "weekCount": len(block["weeks"]),
            "plannedLoad": _json_num(block["plannedLoad"]),
            "coverage": {key: _json_num(value) for key, value in block["coverage"].items()},
            "loadProgression": _json_num(app_slope(week_loads)),
            "weeks": block["weeks"],
        })

    return {"weeks": weeks, "blocks": blocks, "coverageKeys": QUALITY_KEYS, "curveKeys": QUALITY_CURVE_KEYS}


QUALITY_LABELS = {
    "max_strength": "max strength",
    "strength_speed": "strength-speed",
    "speed_strength": "speed-strength",
    "reactive_strength": "reactive strength",
    "max_speed": "max speed",
    "work_capacity": "work capacity",
    "rehab": "rehab",
}

# Deficit-derived target FV shapes (normalised weights across the curve qualities).
DEFICIT_TARGETS = {
    "reactive": {"max_strength": 0.15, "strength_speed": 0.15, "speed_strength": 0.20, "reactive_strength": 0.35, "max_speed": 0.15},
    "velocity": {"max_strength": 0.15, "strength_speed": 0.20, "speed_strength": 0.30, "reactive_strength": 0.20, "max_speed": 0.15},
    "force": {"max_strength": 0.35, "strength_speed": 0.25, "speed_strength": 0.20, "reactive_strength": 0.10, "max_speed": 0.10},
    "conversion": {"max_strength": 0.20, "strength_speed": 0.20, "speed_strength": 0.25, "reactive_strength": 0.20, "max_speed": 0.15},
    "balanced": {"max_strength": 0.20, "strength_speed": 0.20, "speed_strength": 0.20, "reactive_strength": 0.20, "max_speed": 0.20},
}


def app_detect_deficit(block_analysis, metric_stats):
    """Infer the athlete's FV deficit from coverage balance + responsiveness + conversion (Exercise Library §6)."""
    blocks = block_analysis.get("blocks", [])
    weeks = block_analysis.get("weeks", [])
    total = {key: 0.0 for key in QUALITY_CURVE_KEYS}
    for block in blocks:
        for key in QUALITY_CURVE_KEYS:
            total[key] += (block.get("coverage") or {}).get(key, 0) or 0
    grand = sum(total.values())
    if grand <= 0:
        return {"deficit": "unknown", "confidence": "collecting", "rationale": "No coverage logged yet — plan and log a block to read your deficit.", "shares": {}, "target": DEFICIT_TARGETS["balanced"], "responsiveness": {}}

    shares = {key: total[key] / grand for key in QUALITY_CURVE_KEYS}
    # Force end (low velocity) vs velocity end (high velocity) of the curve.
    force_share = shares["max_strength"] + shares["strength_speed"]
    velocity_share = shares["speed_strength"] + shares["reactive_strength"] + shares["max_speed"]
    reactive_speed = shares["reactive_strength"] + shares["max_speed"]
    perf_trend = (metric_stats.get("performance") or {}).get("trend")
    output_flat = _finite(perf_trend) and perf_trend <= 0.02

    # "Balanced" needs breadth, not just a fallback: most qualities meaningfully dosed and
    # no single quality dominating. A reactive-heavy / force-light spread is NOT balanced.
    present = sum(1 for key in QUALITY_CURVE_KEYS if shares[key] >= 0.10)
    max_share = max(shares.values())
    is_balanced = present >= 4 and max_share <= 0.40

    week_outputs = [week.get("bestOutput") for week in weeks]
    responsiveness = {}
    for key in QUALITY_CURVE_KEYS:
        week_quality = [(week.get("coverage") or {}).get(key) for week in weeks]
        pairs = [(x, y) for x, y in zip(week_quality, week_outputs) if _finite(x) and _finite(y)]
        if len(pairs) >= 3:
            responsiveness[key] = app_pearson([p[0] for p in pairs], [p[1] for p in pairs])

    if reactive_speed < 0.18 and force_share >= 0.40:
        deficit, rationale = "reactive", "Your programme is force-heavy with little reactive or speed dose."
    elif force_share < 0.30 and velocity_share >= 0.45:
        deficit, rationale = "force", "Your programme is velocity-heavy with a thin maximal-strength base."
    elif output_flat and force_share >= 0.40 and reactive_speed < 0.30:
        deficit, rationale = "conversion", "Strength dose is high but output is flat — a force-to-velocity conversion gap."
    elif not is_balanced:
        # Skewed, but not a clean force/velocity case: name the thinner end of the curve.
        if force_share <= velocity_share:
            deficit, rationale = "force", "Your coverage leans to the velocity end — the max-strength base is light."
        else:
            deficit, rationale = "reactive", "Your coverage leans to the force end — reactive and speed work is light."
    else:
        candidates = [(key, r) for key, r in responsiveness.items() if _finite(r) and r > 0.3 and shares[key] < 0.18]
        if candidates:
            key = max(candidates, key=lambda item: item[1])[0]
            deficit = {"reactive_strength": "reactive", "max_speed": "velocity", "speed_strength": "velocity", "max_strength": "force", "strength_speed": "force"}[key]
            rationale = f"Output responds to {QUALITY_LABELS[key]} but it is under-dosed."
        else:
            deficit, rationale = "balanced", "Your force-velocity coverage looks reasonably balanced."

    responsive_weeks = len([week for week in weeks if (week.get("responseCount") or 0) > 0])
    return {
        "deficit": deficit,
        "confidence": app_confidence_label(responsive_weeks),
        "rationale": rationale,
        "shares": {key: _json_num(value) for key, value in shares.items()},
        "target": DEFICIT_TARGETS.get(deficit, DEFICIT_TARGETS["balanced"]),
        "responsiveness": {key: _json_num(value) for key, value in responsiveness.items()},
    }


def app_build_coverage_read(block_analysis, deficit):
    """B2/B3 collapsed: programme FV coverage vs the deficit-derived target (the hero radar)."""
    total = {key: 0.0 for key in QUALITY_CURVE_KEYS}
    for block in block_analysis.get("blocks", []):
        for key in QUALITY_CURVE_KEYS:
            total[key] += (block.get("coverage") or {}).get(key, 0) or 0
    grand = sum(total.values())
    current = {key: (total[key] / grand if grand else 0) for key in QUALITY_CURVE_KEYS}
    target = deficit.get("target", DEFICIT_TARGETS["balanced"])

    if grand <= 0:
        sentence = "Plan and log a block to see how your force-velocity coverage matches your needs."
        magnitude = 0.3
    elif deficit["deficit"] in ("balanced", "unknown"):
        sentence = "Your coverage spans the force-velocity curve fairly evenly."
        magnitude = 0.4
    else:
        gap_key = max(QUALITY_CURVE_KEYS, key=lambda key: target[key] - current[key])
        sentence = f"Your data points to a {deficit['deficit']} deficit, and this block under-doses {QUALITY_LABELS[gap_key]}."
        magnitude = min(1.0, 0.5 + abs(target[gap_key] - current[gap_key]) * 2)

    axes = [{"key": key, "label": QUALITY_LABELS[key], "current": _json_num(current[key]), "target": _json_num(target[key])} for key in QUALITY_CURVE_KEYS]
    return {
        "id": "coverage_deficit",
        "title": "Force-velocity coverage",
        "sentence": sentence,
        "confidence": deficit["confidence"],
        "priority": "adaptation",
        "magnitude": magnitude,
        "viz": {"type": "quality_radar", "axes": axes, "deficit": deficit["deficit"]},
        "evidence": {"shares": deficit["shares"], "rationale": deficit["rationale"], "responsiveness": deficit["responsiveness"]},
    }


def app_build_stimulus_read(block_analysis):
    """B1: contrast best-output weeks vs flat weeks on load + coverage levers."""
    weeks = [week for week in block_analysis.get("weeks", []) if _finite(week.get("bestOutput"))]
    if len(weeks) < 3:
        return None
    ordered_weeks = sorted(weeks, key=lambda week: week["bestOutput"])
    half = max(1, len(ordered_weeks) // 2)
    low = ordered_weeks[:half]
    high = ordered_weeks[-half:]

    def avg_load(group):
        return app_mean([week["plannedLoad"] for week in group if _finite(week["plannedLoad"])])

    def avg_cov(group, key):
        return app_mean([(week.get("coverage") or {}).get(key) for week in group])

    bars = [{"label": "Load", "best": _json_num(avg_load(high)), "flat": _json_num(avg_load(low))}]
    for key in QUALITY_CURVE_KEYS:
        bars.append({"label": QUALITY_LABELS[key], "best": _json_num(avg_cov(high, key)), "flat": _json_num(avg_cov(low, key))})
    diffs = [(bar["label"], (bar["best"] or 0) - (bar["flat"] or 0)) for bar in bars]
    top_label, top_diff = max(diffs, key=lambda item: abs(item[1]))
    direction = "more" if top_diff > 0 else "less"
    sentence = f"Your best weeks tend to carry {direction} {top_label.lower()} than your flat weeks." if abs(top_diff) > 0 else "Best and flat weeks look similar so far — keep logging."
    spread = app_mean([week["bestOutput"] for week in high]) - app_mean([week["bestOutput"] for week in low])
    return {
        "id": "stimulus",
        "title": "What drives your best weeks",
        "sentence": sentence,
        "confidence": app_confidence_label(len(weeks)),
        "priority": "stimulus",
        "magnitude": min(1.0, abs(_num(spread)) / 3 + 0.3),
        "viz": {"type": "paired_bars", "bars": bars},
        "evidence": {"bestWeeks": len(high), "flatWeeks": len(low), "outputSpread": _json_num(spread)},
    }


def app_build_sustainability_read(block_analysis):
    """Added: load build vs recovery (divergence = warning)."""
    weeks = [week for week in block_analysis.get("weeks", []) if _finite(week.get("plannedLoad"))]
    if len(weeks) < 3:
        return None
    loads = [week["plannedLoad"] for week in weeks]
    fatigues = [week.get("meanFatigue") for week in weeks]
    load_slope = app_slope(loads)
    finite_fatigues = [value for value in fatigues if _finite(value)]
    fat_slope = app_slope(finite_fatigues) if len(finite_fatigues) >= 2 else None
    diverging = _finite(load_slope) and _finite(fat_slope) and load_slope > 0 and fat_slope > 0
    sentence = "Load is climbing and fatigue is climbing with it — watch that the build stays sustainable." if diverging else "Your load build and recovery are tracking together so far."
    series = [
        {"label": "Planned load", "color": "#1F7A40", "points": [{"x": index, "y": _json_num(week["plannedLoad"])} for index, week in enumerate(weeks)]},
        {"label": "Fatigue", "color": "#6656E8", "points": [{"x": index, "y": _json_num(week.get("meanFatigue"))} for index, week in enumerate(weeks)]},
    ]
    return {
        "id": "sustainability",
        "title": "Is the build sustainable",
        "sentence": sentence,
        "confidence": app_confidence_label(len(weeks)),
        "priority": "adaptation",
        "magnitude": 0.7 if diverging else 0.35,
        "viz": {"type": "dual_line", "series": series},
        "evidence": {"loadSlope": _json_num(load_slope), "fatigueSlope": _json_num(fat_slope), "diverging": diverging},
    }


def app_session_tendon_stress(session):
    """Patellar load-stress: reactive work (plyo/sprint) weighted 1.5x controlled lifts."""
    stress = 0.0
    for exercise in (session or {}).get("exercises", []):
        quality = app_exercise_quality(exercise)
        reactive = quality in ("reactive_strength", "max_speed") or exercise.get("movement_type") in ("plyometric", "sprint")
        stress += app_exercise_load(exercise) * (1.5 if reactive else 1.0)
    return stress


def _check_pain_persistence(pains, threshold):
    """Does pain stay at/above threshold across a run spanning >= 48h?"""
    run = []
    for day, pain in pains:
        if pain >= threshold:
            run.append(day)
            if len(run) >= 2 and (_parse_dt(run[-1]) - _parse_dt(run[0])).days >= 2:
                return True
        else:
            run = []
    return False


def app_build_tendon_read(data, ordered):
    """S4 / tendon ruleset — descriptive: load-stress, 48h persistence, state, tolerated band, risk."""
    pains = [(_iso_day(row.get("date")), _num(row.get("pain"))) for row in ordered if _finite(row.get("pain"))]
    pains = [(day, pain) for day, pain in pains if day]
    if not pains or max(pain for _, pain in pains) <= 0:
        return None

    pain_values = [pain for _, pain in pains]
    baseline = app_mean(pain_values) or 0
    sd = app_sd(pain_values) or 0
    elevated = baseline + sd
    tolerated = max(2.0, baseline)
    latest_pain = pains[-1][1]
    pain_slope = app_slope(pain_values)

    structure = app_programme_structure(data)
    stress_by_day = {}
    for item in structure:
        day = _iso_day(item.get("date"))
        if day:
            stress_by_day[day] = stress_by_day.get(day, 0) + app_session_tendon_stress(item["session"])
    stress_slope = app_slope([stress_by_day.get(day, 0) for day, _ in pains])
    persists = _check_pain_persistence(pains, max(elevated, 1))

    stress_rising = _finite(stress_slope) and stress_slope > 0
    if latest_pain >= elevated and stress_rising and persists:
        state, sentence = "overload", "Knee pain is up while reactive load is climbing, and it is persisting past 48h."
    elif latest_pain >= elevated and stress_rising:
        state, sentence = "rising", "Knee pain is climbing with reactive load — watch whether it settles within 48h."
    elif latest_pain >= elevated and not stress_rising:
        state, sentence = "unexpected spike", "Knee pain rose without a load increase — worth watching."
    elif _finite(pain_slope) and pain_slope < 0:
        state, sentence = "settling", "Knee pain is easing after recent load — a spike-but-settles pattern."
    elif latest_pain <= tolerated:
        state, sentence = "tolerating", f"Knee pain is staying within your usual tolerated range (~{tolerated:.0f}/10)."
    else:
        state, sentence = "stable", "Knee pain is steady for now."

    risk_score = (2 if latest_pain >= 7 else 1 if latest_pain >= 4 else 0) + (1 if _finite(stress_slope) and stress_slope > 0 else 0) + (1 if persists else 0)
    risk = ["green", "amber", "amber", "red", "red"][min(risk_score, 4)]
    points = [{"date": day, "pain": _json_num(pain), "stress": _json_num(stress_by_day.get(day))} for day, pain in pains]
    return {
        "id": "tendon",
        "title": "Knee load tolerance",
        "sentence": sentence,
        "confidence": app_confidence_label(len(pains)),
        "priority": "pain",
        "magnitude": min(1.0, latest_pain / 10 + (0.3 if persists else 0)),
        "viz": {"type": "pain_line", "points": points, "tolerated": _json_num(tolerated)},
        "evidence": {"state": state, "risk": risk, "persists": persists, "tolerated": _json_num(tolerated), "baseline": _json_num(baseline), "stressSlope": _json_num(stress_slope)},
    }


def app_read_salience(read):
    priority_class = {"pain": 5, "output": 4, "adaptation": 3, "stimulus": 2, "routine": 1}.get(read.get("priority", "routine"), 1)
    confidence = {"strong": 1.0, "moderate": 0.8, "emerging": 0.6, "exploratory": 0.4, "collecting": 0.2}.get(str(read.get("confidence", "")).lower(), 0.5)
    magnitude = read.get("magnitude", 0.5)
    novelty = read.get("novelty", 1.0)
    return priority_class * magnitude * confidence * novelty


def app_build_programme_reads(data, ordered, block_analysis, metric_stats):
    """Assemble the block/macro reads, score them by relevance triage, and pick headline + supporting."""
    deficit = app_detect_deficit(block_analysis, metric_stats)
    candidates = [app_build_coverage_read(block_analysis, deficit)]
    for builder in (
        app_build_stimulus_read(block_analysis),
        app_build_sustainability_read(block_analysis),
        app_build_tendon_read(data, ordered),
    ):
        if builder:
            candidates.append(builder)

    for read in candidates:
        read["salience"] = _json_num(app_read_salience(read))
    ranked = sorted(candidates, key=lambda read: read.get("salience") or 0, reverse=True)
    has_data = bool(block_analysis.get("weeks"))
    return {
        "headline": ranked[0] if ranked else None,
        "supporting": ranked[1:3],
        "more": ranked[3:],
        "deficit": deficit,
        "hasData": has_data,
    }


def app_build_session_extras(ordered, best):
    """Added session reads: PB milestone + readiness/output mismatch."""
    extras = {}
    outputs = [row for row in ordered if _finite(row.get("performance"))]
    if outputs:
        latest = outputs[-1]
        prior_best = max((row.get("performance") for row in outputs[:-1]), default=None)
        if _finite(prior_best) and latest.get("performance") is not None and latest["performance"] > prior_best:
            extras["pb"] = {"metric": "performance", "value": _json_num(latest["performance"]), "previous": _json_num(prior_best), "date": latest.get("date")}
    latest_row = ordered[-1] if ordered else None
    if latest_row and _finite(latest_row.get("readiness")) and _finite(latest_row.get("performance")):
        readiness = latest_row["readiness"]
        performance = latest_row["performance"]
        if readiness <= 4 and performance >= 6:
            extras["mismatch"] = {"kind": "robust", "sentence": "You performed well despite low readiness — a sign of robustness or a peak."}
        elif readiness >= 7 and performance <= 4:
            extras["mismatch"] = {"kind": "off_day", "sentence": "Output was low despite feeling fresh — an off day, or worth checking technique or measurement."}
    return extras


def app_all_planned_sessions(data):
    sessions = []
    for macro in ((data.get("programme") or {}).get("macro_blocks") or []):
        for block in macro.get("blocks", []) or []:
            for week in block.get("weeks", []) or []:
                for session in week.get("sessions", []) or []:
                    sessions.append({
                        **session,
                        "macro_id": macro.get("id"),
                        "macro_name": macro.get("macro_block_name"),
                        "block_id": block.get("id"),
                        "block_name": block.get("block_name"),
                        "week_id": week.get("id"),
                        "week_name": week.get("week_name"),
                        "session_datetime": session.get("session_datetime") or session.get("date"),
                    })
    return sessions


def app_session_attempts(session):
    return [
        attempt
        for exercise in (session or {}).get("exercises", [])
        for attempt in exercise.get("actual_metrics", []) or []
    ]


def app_session_actual_metric(session, metric_name):
    if metric_name == "performance":
        return _num((session or {}).get("performance_score"), None)
    attempts = app_session_attempts(session)
    values = finite_values([_actual_metric_value(attempt, metric_name) for attempt in attempts])
    if not values:
        return None
    return min(values) if _best_mode(metric_name) == "min" else max(values)


def app_session_has_actual_outputs(session):
    if _finite(_num((session or {}).get("performance_score"), None)):
        return True
    return any(exercise.get("actual_metrics") for exercise in (session or {}).get("exercises", []))


def app_check_in_metric(check_in, score_key, fallback_key):
    check_in = check_in or {}
    return check_in.get(score_key) if check_in.get(score_key) is not None else check_in.get(fallback_key)


def app_fatigue(check_in):
    # Recovery is now a single Fatigue<->Fresh scale stored in freshness_score (high = fresh).
    # Soreness is no longer collected, so fatigue is simply the inverse of freshness.
    # A performance log carries no freshness, so return None rather than a spurious 0/10.
    raw_freshness = app_check_in_metric(check_in, "freshness_score", "freshness")
    if raw_freshness is None:
        return None
    return 10 - _num(raw_freshness)


def app_readiness(check_in):
    # Readiness = freshness discounted by half of any pain, clamped to 0-10.
    # No freshness recorded (e.g. a performance log) -> no readiness, rather than a phantom 0.
    raw_freshness = app_check_in_metric(check_in, "freshness_score", "freshness")
    if raw_freshness is None:
        return None
    pain = _num(app_check_in_metric(check_in, "pain_score", "pain"))
    return max(0, min(10, _num(raw_freshness) - pain / 2))


def app_rsi(check_in):
    return calculate_normalised_rsi(
        check_in.get("ft"),
        check_in.get("ft_unit"),
        check_in.get("gct"),
        check_in.get("gct_unit"),
    )


def app_mean(values):
    clean = [value for value in values if _finite(value)]
    return sum(clean) / len(clean) if clean else None


def app_sd(values):
    clean = [value for value in values if _finite(value)]
    avg = app_mean(clean)
    if avg is None:
        return None
    return math.sqrt(sum((value - avg) ** 2 for value in clean) / len(clean))


def app_slope(values):
    clean = [value for value in values if _finite(value)]
    if len(clean) < 2:
        return None
    x_mean = (len(clean) - 1) / 2
    y_mean = sum(clean) / len(clean)
    numerator = sum((index - x_mean) * (value - y_mean) for index, value in enumerate(clean))
    denominator = sum((index - x_mean) ** 2 for index, _ in enumerate(clean))
    return numerator / denominator if denominator else None


def _median(values):
    clean = sorted(value for value in values if _finite(value))
    if not clean:
        return None
    mid = len(clean) // 2
    if len(clean) % 2:
        return clean[mid]
    return (clean[mid - 1] + clean[mid]) / 2


def app_slope_over_time(points):
    """Slope of value vs time, scaled to 'per typical interval'.

    x is days-since-first divided by the median gap between observations, so
    regularly spaced logs reproduce the old per-observation slope while
    irregular gaps (missed days) no longer distort the trend. Falls back to
    index spacing when dates are missing or unparseable.
    """
    clean = [point for point in points if _finite(point.get("value"))]
    if len(clean) < 2:
        return None
    parsed = []
    for point in clean:
        dt = _parse_dt(point.get("date"))
        parsed.append(None if dt == datetime.min else dt)
    if any(dt is None for dt in parsed):
        xs = list(range(len(clean)))
    else:
        base = parsed[0]
        days = [(dt - base).total_seconds() / 86400.0 for dt in parsed]
        gaps = [days[i] - days[i - 1] for i in range(1, len(days)) if days[i] - days[i - 1] > 0]
        median_gap = _median(gaps) or 1.0
        if median_gap <= 0:
            median_gap = 1.0
        xs = [day / median_gap for day in days]
    values = [point.get("value") for point in clean]
    x_mean = sum(xs) / len(xs)
    y_mean = sum(values) / len(values)
    numerator = sum((x - x_mean) * (value - y_mean) for x, value in zip(xs, values))
    denominator = sum((x - x_mean) ** 2 for x in xs)
    return numerator / denominator if denominator else None


def app_pearson(x_values, y_values):
    pairs = [(x, y) for x, y in zip(x_values, y_values) if _finite(x) and _finite(y)]
    if len(pairs) < 3:
        return None
    xs = [x for x, _ in pairs]
    ys = [y for _, y in pairs]
    x_mean = sum(xs) / len(xs)
    y_mean = sum(ys) / len(ys)
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in pairs)
    x_den = math.sqrt(sum((x - x_mean) ** 2 for x in xs))
    y_den = math.sqrt(sum((y - y_mean) ** 2 for y in ys))
    if not x_den or not y_den:
        return None
    return numerator / (x_den * y_den)


def _rank(values):
    sorted_values = sorted((value, index) for index, value in enumerate(values))
    ranks = [0] * len(values)
    position = 0
    while position < len(sorted_values):
        end = position
        while end + 1 < len(sorted_values) and sorted_values[end + 1][0] == sorted_values[position][0]:
            end += 1
        avg_rank = (position + end + 2) / 2
        for idx in range(position, end + 1):
            ranks[sorted_values[idx][1]] = avg_rank
        position = end + 1
    return ranks


def app_spearman(x_values, y_values):
    pairs = [(x, y) for x, y in zip(x_values, y_values) if _finite(x) and _finite(y)]
    if len(pairs) < 3:
        return None
    xs = [x for x, _ in pairs]
    ys = [y for _, y in pairs]
    return app_pearson(_rank(xs), _rank(ys))


def app_relationship_strength(r):
    if not _finite(r):
        return "Collecting"
    abs_r = abs(r)
    if abs_r >= 0.7:
        return "Strong"
    if abs_r >= 0.4:
        return "Moderate"
    return "Weak"


def _betacf(a, b, x):
    # Continued-fraction expansion for the incomplete beta function (Lentz's method).
    max_iterations = 200
    eps = 3.0e-12
    tiny = 1.0e-30
    qab = a + b
    qap = a + 1.0
    qam = a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    if abs(d) < tiny:
        d = tiny
    d = 1.0 / d
    h = d
    for m in range(1, max_iterations + 1):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < tiny:
            d = tiny
        c = 1.0 + aa / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        if abs(d) < tiny:
            d = tiny
        c = 1.0 + aa / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < eps:
            break
    return h


def _incomplete_beta(a, b, x):
    # Regularised incomplete beta function I_x(a, b).
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    log_beta = math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
    front = math.exp(log_beta + a * math.log(x) + b * math.log(1.0 - x))
    if x < (a + 1.0) / (a + b + 2.0):
        return front * _betacf(a, b, x) / a
    return 1.0 - front * _betacf(b, a, 1.0 - x) / b


def app_correlation_p_value(r, n):
    # Two-sided p-value for a Pearson correlation, via the exact Student-t
    # distribution. The previous normal approximation understated p at small n,
    # making weak relationships look more significant than they are.
    if r is None or not _finite(r) or n < 4 or abs(r) >= 1:
        return None
    df = n - 2
    t_value = abs(r) * math.sqrt(df / (1 - r * r))
    p_value = _incomplete_beta(df / 2.0, 0.5, df / (df + t_value * t_value))
    return max(0.001, min(0.999, p_value))


def app_confidence_label(count):
    if count >= 12:
        return "High Confidence"
    if count >= 6:
        return "Moderate Confidence"
    if count >= 3:
        return "Low Confidence"
    return "Collecting Evidence"


def app_trend_state(value, count):
    if count < 2 or not _finite(value):
        return "collecting"
    if value > 0.05:
        return "increasing"
    if value < -0.05:
        return "decreasing"
    return "stable"


def app_direction_state(value, count, positive_label, negative_label, stable_label="Stable", strong_positive_label=None, strong_negative_label=None):
    if count < 2 or not _finite(value):
        return "Collecting"
    if value >= 0.18:
        return strong_positive_label or positive_label
    if value > 0.05:
        return positive_label
    if value <= -0.18:
        return strong_negative_label or negative_label
    if value < -0.05:
        return negative_label
    return stable_label


def app_performance_state(value, count):
    return app_direction_state(
        value,
        count,
        "Improving",
        "Declining",
        stable_label="Stable",
        strong_positive_label="Strongly Improving",
        strong_negative_label="Strongly Declining",
    )


def app_irritation_state(value, count):
    return app_direction_state(value, count, "Worsening", "Improving", stable_label="Stable")


def app_fatigue_state(value, count):
    return app_direction_state(value, count, "Accumulating", "Recovering", stable_label="Stable")


def app_load_stress_state(load_trend, load_stress_ratio, count):
    if count < 2:
        return "Collecting"
    if _finite(load_stress_ratio):
        if load_stress_ratio >= 1.5:
            return "Load Spike"
        if load_stress_ratio >= 1.2:
            return "Building Load"
        if load_stress_ratio <= 0.8:
            return "Low Load"
        return "Steady Load"
    return app_direction_state(load_trend, count, "Building Load", "Low Load", stable_label="Steady Load", strong_positive_label="Load Spike")


def app_state_interpretation(kind, label):
    interpretations = {
        "performance": {
            "Strongly Improving": "Output is clearly moving up.",
            "Improving": "Output is moving in the right direction.",
            "Stable": "Output is being maintained.",
            "Declining": "Output is slipping.",
            "Strongly Declining": "Output is dropping enough to take seriously.",
            "Collecting": "Log more performance outputs to read this clearly.",
        },
        "irritation": {
            "Improving": "Pain is settling.",
            "Stable": "Pain is not changing much.",
            "Worsening": "Pain is trending up.",
            "Collecting": "Log more pain check-ins to read this clearly.",
        },
        "fatigue": {
            "Recovering": "Recovery is catching up.",
            "Stable": "Recovery cost is steady.",
            "Accumulating": "Fatigue is building.",
            "Collecting": "Log more recovery check-ins to read this clearly.",
        },
        "loadTolerance": {
            "Improving": "You are handling the training dose better over time.",
            "Stable": "You are handling a similar dose, but tolerance is not clearly improving.",
            "Declining": "The dose is costing more through pain, fatigue, or lower output.",
            "Collecting": "Log more paired training and check-in days to read tolerance.",
        },
        "loadStress": {
            "Load Spike": "Recent load is much higher than your normal.",
            "Building Load": "Recent load is rising. The response over the next sessions matters.",
            "Steady Load": "Recent load is close to your normal.",
            "Low Load": "Recent load is low. Feeling fresh does not always mean you are adapting.",
            "Collecting": "Plan or log more sessions to read load stress.",
        },
    }
    return interpretations.get(kind, {}).get(label, "State interpretation is collecting.")


def app_format_metric_name(key):
    if key in APP_METRIC_META:
        return APP_METRIC_META[key]["label"]
    return str(key).replace("_", " ").title()


def app_movement_summary(session):
    movement_types = []
    for exercise in (session or {}).get("exercises", []):
        movement = exercise.get("movement_type")
        if movement and movement not in movement_types:
            movement_types.append(movement)
    return ", ".join(app_format_metric_name(item) for item in movement_types) if movement_types else "movement context collecting"


def app_exercise_summary(session):
    exercises = (session or {}).get("exercises", [])
    names = [exercise.get("exercise_name") for exercise in exercises if exercise.get("exercise_name")]
    return ", ".join(names[:3]) if names else "Exercise-level context is collecting."


def app_exercise_detail_summary(session):
    exercises = (session or {}).get("exercises", [])
    if not exercises:
        return "Exercise-level context is collecting."
    parts = []
    for exercise in exercises[:3]:
        detail = [exercise.get("exercise_name") or app_format_metric_name(exercise.get("movement_type", "exercise"))]
        for key, label in [("contacts", "contacts"), ("reps", "reps"), ("duration_minutes", "min"), ("intensity_value", "intensity"), ("intent_percent", "intent")]:
            value = exercise.get(key)
            if value not in [None, ""]:
                suffix = "%" if key == "intent_percent" else ""
                detail.append(f"{value}{suffix} {label}")
        parts.append(" / ".join(detail))
    return "; ".join(parts)


def app_metric_value(row, key, previous_row=None):
    if key == "pain_delta":
        if not previous_row:
            return 0
        pain = row.get("pain")
        previous_pain = previous_row.get("pain")
        return pain - previous_pain if _finite(pain) and _finite(previous_pain) else None
    return row.get(key)


def app_metric_series(rows, key):
    points = []
    for index, row in enumerate(rows):
        value = app_metric_value(row, key, rows[index - 1] if index else None)
        if _finite(value):
            points.append({"id": row.get("id"), "date": row.get("date"), "row": row, "value": value})
    return points


def app_metric_stats(points):
    finite_points = [point for point in points if _finite(point.get("value"))]
    values = [point.get("value") for point in finite_points]
    changes = []
    for index, point in enumerate(finite_points[1:], start=1):
        previous = finite_points[index - 1]
        changes.append({**point, "previous": previous, "change": point.get("value") - previous.get("value")})
    changes.sort(key=lambda item: abs(item.get("change", 0)), reverse=True)
    return {
        "avg": _json_num(app_mean(values)),
        "sd": _json_num(app_sd(values)),
        "trend": _json_num(app_slope_over_time(finite_points)),
        "volatility": _json_num(app_sd(values)),
        "count": len(values),
        "min": _json_num(min(values) if values else None),
        "max": _json_num(max(values) if values else None),
        "highest": sorted(finite_points, key=lambda item: item.get("value"), reverse=True)[:3],
        "lowest": sorted(finite_points, key=lambda item: item.get("value"))[:3],
        "changes": changes[:3],
    }


def app_build_trend_insight(metric_key, points):
    meta = APP_METRIC_META.get(metric_key, {"label": app_format_metric_name(metric_key), "tone": "neutral"})
    stats = app_metric_stats(points)
    state = app_trend_state(stats.get("trend"), stats.get("count", 0))
    count = stats.get("count", 0)
    if state == "collecting":
        statement = f"{meta['label']} trend cannot yet be estimated because fewer than two observations are available."
    elif state == "stable":
        statement = f"{meta['label']} remained broadly stable across {count} observations."
    else:
        article = "an" if state == "increasing" else "a"
        statement = f"{meta['label']} showed {article} {state} trend across {count} observations."
    if state == "collecting":
        interpretation = f"{meta['label']} state cannot yet be interpreted because the stored series is too short."
    elif state == "stable":
        interpretation = f"{meta['label']} is currently stable in the stored logs."
    elif meta.get("tone") == "neutral":
        interpretation = f"{meta['label']} is {state}; this may be useful context when compared with performance, recovery, and irritation responses."
    else:
        favourable = (meta.get("tone") == "positive" and state == "increasing") or (meta.get("tone") == "risk" and state == "decreasing")
        interpretation = f"{meta['label']} is {state}; this is currently {'favourable' if favourable else 'unfavourable'} context for this metric state."
    limitation = "Needs at least two stored observations before a trend can be estimated." if count < 2 else ("Small sample; treat as exploratory. Trend reflects stored logs only." if count < 6 else "Trend reflects stored logs only.")
    return {"metricKey": metric_key, "label": meta["label"], "state": state, "status": app_confidence_label(count), "statement": statement, "evidenceStatement": statement, "interpretation": interpretation, "limitation": limitation, "stats": stats}


PERFORMANCE_OUTPUT_METRICS = ["performance", "height_or_distance", "ft", "gct", "rsi", "sprint_time", "bar_velocity", "weight"]
JUMP_PROFILE_METRICS = ["height_or_distance", "ft", "gct", "rsi"]
SPRINT_PROFILE_METRICS = ["sprint_time"]
LIFT_PROFILE_METRICS = ["weight", "bar_velocity"]


def app_metric_observation_count(metric_series, key):
    return len(metric_series.get(key) or [])


def app_available_metrics(metric_series, keys, minimum=2):
    return [key for key in keys if app_metric_observation_count(metric_series, key) >= minimum]


def app_profile_evidence_items(metric_series, trend_insights, keys):
    items = []
    for key in keys:
        insight = trend_insights.get(key) or {}
        stats = insight.get("stats") or app_metric_stats(metric_series.get(key) or [])
        items.append({
            "key": key,
            "label": app_format_metric_name(key),
            "n": stats.get("count", 0),
            "mean": stats.get("avg"),
            "sd": stats.get("sd"),
            "slope": stats.get("trend"),
            "state": insight.get("state") or app_trend_state(stats.get("trend"), stats.get("count", 0)),
            "status": insight.get("status") or app_confidence_label(stats.get("count", 0)),
            "evidenceStatement": insight.get("evidenceStatement") or f"{app_format_metric_name(key)} trend is collecting.",
            "interpretation": insight.get("interpretation") or f"{app_format_metric_name(key)} interpretation is collecting.",
        })
    return items


def app_build_performance_profile(profile_id, label, keys, metric_series, trend_insights, collecting_copy, required_all=None, required_any=None):
    evidence_items = app_profile_evidence_items(metric_series, trend_insights, keys)
    available = [item for item in evidence_items if item.get("n", 0) >= 2]
    total_observations = sum(item.get("n", 0) for item in evidence_items)
    status = app_confidence_label(max([item.get("n", 0) for item in evidence_items] or [0]))
    required_all = required_all or []
    required_any = required_any or []
    has_required_all = all(app_metric_observation_count(metric_series, key) >= 2 for key in required_all)
    has_required_any = True if not required_any else any(app_metric_observation_count(metric_series, key) >= 2 for key in required_any)

    if not available or not has_required_all or not has_required_any:
        return {
            "id": profile_id,
            "label": label,
            "metrics": keys,
            "availableMetrics": [],
            "status": "Collecting",
            "evidenceItems": evidence_items,
            "interpretation": collecting_copy,
            "limitation": collecting_copy,
        }

    state_parts = [
        f"{item['label']} {item['state']} across {item['n']} observations"
        for item in available[:3]
    ]
    interpretation = f"{label} used {total_observations} stored metric observations. " + "; ".join(state_parts) + "."
    limitation = "Small sample; treat profile interpretation as exploratory." if status != "More stable" else "Profile interpretation reflects stored logs only."

    return {
        "id": profile_id,
        "label": label,
        "metrics": keys,
        "availableMetrics": [item["key"] for item in available],
        "status": status,
        "evidenceItems": evidence_items,
        "interpretation": interpretation,
        "limitation": limitation,
    }


def app_strongest_performance_metric(metric_series, trend_insights):
    candidates = []
    for key in PERFORMANCE_OUTPUT_METRICS:
        insight = trend_insights.get(key) or {}
        stats = insight.get("stats") or app_metric_stats(metric_series.get(key) or [])
        trend = stats.get("trend")
        count = stats.get("count", 0)
        if count >= 2 and _finite(trend):
            candidates.append((abs(trend), key, insight, stats))
    if not candidates:
        return None
    _, key, insight, stats = sorted(candidates, key=lambda item: item[0], reverse=True)[0]
    label = app_format_metric_name(key)
    state = insight.get("state") or app_trend_state(stats.get("trend"), stats.get("count", 0))
    return {
        "key": key,
        "label": label,
        "state": state,
        "n": stats.get("count", 0),
        "slope": stats.get("trend"),
        "status": insight.get("status") or app_confidence_label(stats.get("count", 0)),
        "reason": insight.get("evidenceStatement") or f"{label} trend is collecting.",
    }


def app_build_performance_metric_analysis(metric_series, trend_insights):
    metric_trends = {key: trend_insights.get(key) for key in PERFORMANCE_OUTPUT_METRICS if key in trend_insights}
    jump_profile = app_build_performance_profile(
        "jump",
        "Jump profile",
        JUMP_PROFILE_METRICS,
        metric_series,
        trend_insights,
        "Jump profile needs height/distance plus FT/GCT or RSI before combined interpretation is available.",
        required_all=["height_or_distance"],
        required_any=["ft", "gct", "rsi"],
    )
    sprint_profile = app_build_performance_profile(
        "sprint",
        "Sprint profile",
        SPRINT_PROFILE_METRICS,
        metric_series,
        trend_insights,
        "Sprint/lift profile is collecting.",
        required_all=["sprint_time"],
    )
    lift_profile = app_build_performance_profile(
        "lift",
        "Lift profile",
        LIFT_PROFILE_METRICS,
        metric_series,
        trend_insights,
        "Sprint/lift profile is collecting.",
        required_all=["weight", "bar_velocity"],
    )
    strongest = app_strongest_performance_metric(metric_series, trend_insights)
    available_output_metrics = app_available_metrics(metric_series, PERFORMANCE_OUTPUT_METRICS, 2)
    observation_total = sum(app_metric_observation_count(metric_series, key) for key in PERFORMANCE_OUTPUT_METRICS)

    if not available_output_metrics:
        evidence_summary = "Performance metric analysis is collecting."
        combined_interpretation = "Performance metric analysis needs at least two observations from performance score, jump, sprint, or lift metrics before output patterns can be interpreted."
    else:
        labels = ", ".join(app_format_metric_name(key) for key in available_output_metrics[:4])
        remaining = len(available_output_metrics) - 4
        suffix = f", plus {remaining} more" if remaining > 0 else ""
        evidence_summary = f"Performance metric analysis used {observation_total} stored output metric observations across {len(available_output_metrics)} available metrics: {labels}{suffix}."
        combined_interpretation = strongest["reason"] if strongest else "Performance metric analysis is collecting."
        if strongest:
            combined_interpretation += f" This makes {strongest['label'].lower()} the clearest current performance output signal in the stored logs."

    return {
        "evidenceSummary": evidence_summary,
        "combinedInterpretation": combined_interpretation,
        "jumpProfile": jump_profile,
        "sprintProfile": sprint_profile,
        "liftProfile": lift_profile,
        "strongestPerformanceMetric": strongest,
        "visualSuggestions": {
            "jump": {
                "type": "multi_line",
                "metrics": JUMP_PROFILE_METRICS,
                "availableMetrics": jump_profile.get("availableMetrics", []),
                "emptyState": "Jump profile needs height/distance plus FT/GCT or RSI before combined interpretation is available.",
            },
            "sprint": {
                "type": "time_series",
                "metrics": SPRINT_PROFILE_METRICS,
                "availableMetrics": sprint_profile.get("availableMetrics", []),
                "emptyState": "Sprint/lift profile is collecting.",
            },
            "lift": {
                "type": "multi_line",
                "metrics": LIFT_PROFILE_METRICS,
                "availableMetrics": lift_profile.get("availableMetrics", []),
                "emptyState": "Sprint/lift profile is collecting.",
            },
        },
        "metricTrends": metric_trends,
    }


def app_aligned_pairs(rows, x_key, y_key):
    points = []
    for index, row in enumerate(rows):
        x = row.get(x_key)
        y = row.get(y_key)
        if _finite(x) and _finite(y):
            previous = rows[index - 1] if index else None
            pain = row.get("pain")
            previous_pain = previous.get("pain") if previous else None
            points.append({
                "x": x,
                "y": y,
                "date": row.get("date"),
                "id": row.get("id"),
                "session_name": (row.get("session") or {}).get("session_name") or "Session context is collecting.",
                "load": row.get("load"),
                "pain": row.get("pain"),
                "pain_delta": pain - previous_pain if _finite(pain) and _finite(previous_pain) else 0,
                "performance": row.get("performance"),
                "freshness": row.get("freshness"),
                "soreness": row.get("soreness"),
                "fatigue": row.get("fatigue"),
                "readiness": row.get("readiness"),
                "average_intent": row.get("average_intent"),
                "movement_types": app_movement_summary(row.get("session")),
                "exercises": app_exercise_summary(row.get("session")),
                "exercise_details": app_exercise_detail_summary(row.get("session")),
            })
    return points


def app_p_value_text(value):
    return _pretty(value, 3) if _finite(value) else "not calculated yet"


def app_p_value_status(value, count):
    if not _finite(value):
        return "p-value not calculated yet."
    if value < 0.05 and count >= 12:
        return "Statistically notable, but not causal."
    if value < 0.05 and count < 12:
        return "Potential signal, but sample size is small."
    return "No clear statistical signal."


def app_relationship_state(r, count):
    if count < 3 or not _finite(r):
        return "collecting"
    return f"{app_relationship_strength(r).lower()} {'positive' if r >= 0 else 'negative'}"


def app_repeated_context(points, key):
    counts = {}
    for point in points:
        values = []
        raw = point.get(key)
        if not raw or "collecting" in str(raw).lower():
            continue
        if key in ["movement_types", "exercises"]:
            values = [item.strip() for item in str(raw).split(",") if item.strip()]
        else:
            values = [raw]
        for value in values:
            counts[value] = counts.get(value, 0) + 1
    repeated = [f"{value} ({count}x)" for value, count in sorted(counts.items(), key=lambda item: item[1], reverse=True) if count > 1]
    return ", ".join(repeated[:3]) if repeated else "No repeated context is clear yet."


def app_describe_point(point, relationship):
    return (
        f"{_date_short(point.get('date'))} ({point.get('session_name')}; {point.get('movement_types')}; {point.get('exercise_details')}) "
        f"had {relationship['xLabel']} {_pretty(point.get('x'), 1)} and {relationship['yLabel']} {_pretty(point.get('y'), 1)}; "
        f"load {_pretty(point.get('load'), 1)}, pain {_pretty(point.get('pain'), 1)}, irritation delta {_pretty(point.get('pain_delta'), 1)}, "
        f"freshness {_pretty(point.get('freshness'), 1)}, soreness {_pretty(point.get('soreness'), 1)}, fatigue {_pretty(point.get('fatigue'), 1)}, readiness {_pretty(point.get('readiness'), 1)}."
    )


def app_build_pattern_evidence(relationship):
    points = relationship.get("points", [])
    if len(points) < 3:
        return "More paired logs are needed before this can be interpreted."
    valid_x_points = [point for point in points if _finite(point.get("x"))]
    valid_y_points = [point for point in points if _finite(point.get("y"))]
    by_x_high = sorted(valid_x_points, key=lambda item: item.get("x"), reverse=True)[:2]
    by_x_low = sorted(valid_x_points, key=lambda item: item.get("x"))[:2]
    by_y_high = sorted(valid_y_points, key=lambda item: item.get("y"), reverse=True)[:2]
    repeated_sessions = app_repeated_context(points, "session_name")
    repeated_movements = app_repeated_context(points, "movement_types")
    repeated_exercises = app_repeated_context(points, "exercises")
    sections = [
        "Highest predictor examples: " + " ".join(app_describe_point(point, relationship) for point in by_x_high),
        "Lowest predictor examples: " + " ".join(app_describe_point(point, relationship) for point in by_x_low),
        "Highest outcome examples: " + " ".join(app_describe_point(point, relationship) for point in by_y_high),
        f"Repeated session names: {repeated_sessions}",
        f"Repeated movement types: {repeated_movements}",
        f"Repeated exercises: {repeated_exercises}",
    ]
    return " ".join(sections)


def app_build_training_interpretation(relationship):
    count = len(relationship.get("points", []))
    if count < 3 or not _finite(relationship.get("r")):
        return "Programming interpretation is collecting because the relationship estimate is not stable enough yet."
    x_key = relationship.get("xKey")
    y_key = relationship.get("yKey")
    if y_key == "pain" and x_key == "load":
        return "Pain currently appears load-sensitive. In programming terms, irritation may be responding more to accumulated session stress than to one isolated exercise variable."
    if y_key == "pain":
        return f"Pain appears associated with {relationship.get('xLabel', 'the predictor').lower()}. In programming terms, this may be useful context for irritation management when similar recovery or loading states appear again."
    if y_key == "performance" and x_key == "freshness":
        return "Performance appears freshness-sensitive. In programming terms, recovery state may be useful context when interpreting high or low output days."
    if y_key == "performance" and x_key in ["fatigue", "soreness", "pain"]:
        return f"Performance appears associated with {relationship.get('xLabel', 'the predictor').lower()}. In programming terms, recovery and irritation state may be useful context when judging whether output changes reflect readiness rather than exercise selection alone."
    if y_key == "performance":
        return f"Performance appears associated with {relationship.get('xLabel', 'the predictor').lower()}. In programming terms, this may be useful context for reviewing tolerance and output response across the block."
    if y_key in ["fatigue", "readiness"]:
        return f"{relationship.get('yLabel')} appears associated with {relationship.get('xLabel', 'the predictor').lower()}. This may be useful context for recovery/load planning review."
    return f"{relationship.get('yLabel')} appeared associated with {relationship.get('xLabel', 'the predictor').lower()} in stored paired logs. This may be useful context for programming review."


def app_build_bring_forward_prevent(relationship):
    count = len(relationship.get("points", []))
    if count < 3 or not _finite(relationship.get("r")):
        return {"bringForward": "Bring-forward context is collecting until more paired logs are available.", "preventMonitor": "Monitor context is collecting until more paired logs are available."}
    if relationship.get("yKey") == "pain":
        return {
            "bringForward": "When pain is low and recovery state is stable, similar exposure may be useful to recognise as a tolerance reference.",
            "preventMonitor": "When soreness or fatigue is already elevated, similar sessions may be worth monitoring because they have coincided with higher pain in the stored logs.",
        }
    if relationship.get("yKey") == "performance":
        source = relationship.get("xLabel", "the predictor").lower()
        return {
            "bringForward": f"When {source} is in a favourable range and irritation is low, similar session structures may be useful context to bring forward as performance reference points.",
            "preventMonitor": f"When {source} is unfavourable or irritation is elevated, performance changes may be worth monitoring as context rather than treating one session as a standalone signal.",
        }
    return {
        "bringForward": "Similar conditions may be useful to bring forward as comparison context when the state is favourable.",
        "preventMonitor": "Sessions with less favourable recovery or irritation context may be worth monitoring in future reviews.",
    }


def app_build_relationship_insight(relationship):
    count = len(relationship.get("points", []))
    state = app_relationship_state(relationship.get("r"), count)
    if count < 3:
        evidence = f"{relationship.get('title')} cannot yet be estimated because there are not enough paired observations."
    elif not _finite(relationship.get("r")):
        evidence = "No relationship estimate is available yet."
    else:
        evidence = f"{relationship.get('xLabel')} showed a {state} association with {str(relationship.get('yLabel')).lower()} across {count} paired observations."
    copy = app_build_bring_forward_prevent(relationship)
    return {
        "evidenceStatement": evidence,
        "whatSuggestsThis": app_build_pattern_evidence(relationship),
        "trainingInterpretation": app_build_training_interpretation(relationship),
        "bringForward": copy["bringForward"],
        "preventMonitor": copy["preventMonitor"],
        "limitation": (f"Only {count} paired observation{'s' if count != 1 else ''} available; more paired logs are needed. This is not a causal claim." if count < 3 else f"Based on {count} paired observations. This association does not imply causation."),
        "pValueText": app_p_value_text(relationship.get("pValue")),
        "pValueInterpretation": app_p_value_status(relationship.get("pValue"), count),
        "confidence": app_confidence_label(count),
        "state": state,
    }


def app_build_change_insight(metric_key, points):
    meta = APP_METRIC_META.get(metric_key, {"label": app_format_metric_name(metric_key), "tone": "neutral"})
    stats = app_metric_stats(points)
    if not stats["changes"]:
        return {"statement": f"{meta['label']} change cannot yet be estimated because fewer than two observations are available.", "limitation": "Needs at least two stored observations before change can be estimated.", "items": []}
    items = []
    for change in stats["changes"]:
        direction = "increase" if change.get("change", 0) >= 0 else "decrease"
        favourable = None if meta.get("tone") == "neutral" else ((meta.get("tone") == "positive" and change.get("change", 0) >= 0) or (meta.get("tone") == "risk" and change.get("change", 0) < 0))
        items.append({
            "id": f"{change.get('id')}-{change.get('date')}",
            "statement": f"{meta['label']} showed an observed {direction} between {_date_short((change.get('previous') or {}).get('date'))} and {_date_short(change.get('date'))}, changing from {_pretty((change.get('previous') or {}).get('value'), 1)} to {_pretty(change.get('value'), 1)}.",
            "interpretation": (f"{meta['label']} change is descriptive and may be useful when compared with performance, recovery, and irritation context." if meta.get("tone") == "neutral" else f"This {direction} is {'favourable' if favourable else 'unfavourable'} context for {meta['label'].lower()}."),
        })
    return {"statement": items[0]["statement"], "limitation": "Change figures reflect consecutive stored observations only.", "items": items}


def app_build_adaptation_insight(ordered, performance_trend, load_trend, irritation_trend, fatigue_trend):
    count = len(ordered)

    # Standardise each component trend to per-SD units before combining. The
    # incoming trends are slope-per-interval in each metric's raw units, so
    # without this the high-magnitude load trend dominates the composite and
    # the "adaptation" score is essentially just "is load going up". Dividing by
    # the metric's own SD puts performance, load, pain and fatigue on equal
    # footing so each contributes meaningfully. Component direction labels below
    # use the same standardised trends, keeping the whole card internally
    # consistent in SD-per-interval units.
    def _std_trend(trend, key):
        if not _finite(trend):
            return None
        sd = app_sd([row.get(key) for row in ordered])
        if not _finite(sd) or sd <= 1e-9:
            return 0.0
        return trend / sd

    performance_trend = _std_trend(performance_trend, "performance")
    load_trend = _std_trend(load_trend, "load")
    irritation_trend = _std_trend(irritation_trend, "pain")
    fatigue_trend = _std_trend(fatigue_trend, "fatigue")

    load_state = app_trend_state(load_trend, count)
    load_tolerance_trend = None
    if all(_finite(value) for value in [load_trend, performance_trend, irritation_trend, fatigue_trend]):
        load_tolerance_trend = load_trend + performance_trend - irritation_trend - fatigue_trend
    adaptation_score = None
    if all(_finite(value) for value in [performance_trend, load_tolerance_trend, irritation_trend, fatigue_trend]):
        adaptation_score = performance_trend + load_tolerance_trend - irritation_trend - fatigue_trend

    performance_label = app_performance_state(performance_trend, count)
    irritation_label = app_irritation_state(irritation_trend, count)
    fatigue_label = app_fatigue_state(fatigue_trend, count)
    load_tolerance_label = app_direction_state(load_tolerance_trend, count, "Improving", "Declining", stable_label="Stable") if _finite(load_tolerance_trend) else "Collecting"

    load_values = [row.get("load") for row in ordered if _finite(row.get("load"))]
    recent_load = app_mean(load_values[-3:])
    baseline_source = load_values[:-3] if len(load_values) > 3 else load_values
    baseline_load = app_mean(baseline_source)
    load_stress_ratio = recent_load / baseline_load if is_positive_number(recent_load) and is_positive_number(baseline_load) else None
    load_stress_label = app_load_stress_state(load_trend, load_stress_ratio, count)
    load_dose_is_productive = load_stress_label in ["Building Load", "Steady Load"] and load_tolerance_label in ["Improving", "Stable"]
    load_dose_is_low = load_stress_label == "Low Load"
    load_dose_is_spiking = load_stress_label == "Load Spike"

    label = "Adaptation Unclear"
    summary = "Signals are mixed or contradictory, so adaptation cannot yet be called confidently."
    interpretation = "There is currently not enough evidence to confidently determine adaptation status."
    if count < 2 or not _finite(adaptation_score):
        label = "Adaptation Unclear"
        summary = "Adaptation state cannot yet be estimated because there are not enough paired observations."
        interpretation = "There is currently not enough evidence to confidently determine adaptation status."
    elif (
        adaptation_score >= 0.18
        and _finite(performance_trend) and performance_trend > 0.05
        and _finite(load_tolerance_trend) and load_tolerance_trend > 0.03
        and load_dose_is_productive
        and irritation_label in ["Improving", "Stable"]
        and fatigue_label in ["Recovering", "Stable"]
    ):
        label = "Strong Positive Adaptation"
        summary = "Performance is improving while load stress and load tolerance look supportive."
        interpretation = "The athlete appears to be responding exceptionally well to the current training exposure."
    elif (
        adaptation_score >= 0.08
        and performance_label in ["Improving", "Strongly Improving"]
        and load_stress_label != "Low Load"
        and load_tolerance_label != "Declining"
        and irritation_label != "Worsening"
        and fatigue_label != "Accumulating"
    ):
        label = "Positive Adaptation"
        summary = "Performance and load tolerance are generally improving while the training dose remains manageable."
        interpretation = "Current training appears productive."
    elif (
        adaptation_score <= -0.08
        or load_dose_is_spiking
        or load_tolerance_label == "Declining"
        or (fatigue_label == "Accumulating" and performance_label not in ["Improving", "Strongly Improving"])
        or (irritation_label == "Worsening" and performance_label not in ["Strongly Improving"])
    ):
        label = "Adaptation At Risk"
        summary = "Load stress, fatigue, pain, or falling tolerance may be rising faster than performance."
        interpretation = "Current adaptation may not be sustainable if trends continue."
    elif (
        (abs(adaptation_score) <= 0.08 or load_dose_is_low)
        and performance_label == "Stable"
        and (load_dose_is_low or (_finite(load_trend) and load_trend >= 0.03))
    ):
        label = "Adaptation Plateau"
        summary = "Recovery may look okay, but load stress or performance change is not enough to show clear adaptation."
        interpretation = "Current training may be maintaining readiness without clearly building performance."
    elif (
        performance_label == "Stable"
        and irritation_label in ["Improving", "Stable"]
        and fatigue_label in ["Recovering", "Stable"]
        and load_tolerance_label != "Declining"
    ):
        label = "Stable Adaptation"
        summary = "The athlete may feel fresh and tolerate the work, but performance is not clearly moving yet."
        interpretation = "Current training appears to be maintaining readiness and tolerance rather than clearly building performance."
    elif (
        abs(adaptation_score) <= 0.08
        and performance_label == "Stable"
        and irritation_label == "Stable"
        and fatigue_label == "Stable"
    ):
        label = "Stable Adaptation"
        summary = "Performance, load stress, fatigue, pain and load tolerance are relatively unchanged."
        interpretation = "Current training appears to be maintaining rather than developing performance."

    return {
        "label": label,
        "summary": summary,
        "score": _json_num(adaptation_score),
        "loadToleranceTrend": _json_num(load_tolerance_trend),
        "loadStressRatio": _json_num(load_stress_ratio),
        "recentLoad": _json_num(recent_load),
        "baselineLoad": _json_num(baseline_load),
        "evidenceStatement": ("Adaptation component trends cannot yet be estimated because there are not enough paired observations." if count < 2 else f"Adaptation score {_pretty(adaptation_score, 2)} mapped to {label}; performance {performance_label.lower()}, load stress {load_stress_label.lower()}, load tolerance {load_tolerance_label.lower()}, pain {irritation_label.lower()}, and fatigue {fatigue_label.lower()}."),
        "trainingInterpretation": f"{interpretation} This is a block-level interpretation from stored logs, not a prescription.",
        "performanceMeaning": f"For performance, this means: {app_state_interpretation('performance', performance_label)}",
        "loadMeaning": f"For training load, this means: {app_state_interpretation('loadStress', load_stress_label)} {app_state_interpretation('loadTolerance', load_tolerance_label)}",
        "bringForward": "Bring forward sessions where performance improves while load stress is appropriate and pain or fatigue stay manageable.",
        "preventMonitor": "Watch sessions where load spikes, tolerance declines, or performance stays flat even if the athlete feels fresh.",
        "limitation": "Small sample; treat as exploratory. Load-stress bands are monitoring guides, not injury cut-offs." if count < 6 else "Adaptation state reflects stored logs only. Load-stress bands are monitoring guides, not injury cut-offs.",
        "confidence": app_confidence_label(count),
        "status": app_confidence_label(count),
        "componentStates": {
            "performance": performance_label,
            "load": load_state,
            "loadStress": load_stress_label,
            "loadTolerance": load_tolerance_label,
            "irritation": irritation_label,
            "fatigue": fatigue_label,
        },
        "componentInterpretations": {
            "performance": app_state_interpretation("performance", performance_label),
            "irritation": app_state_interpretation("irritation", irritation_label),
            "fatigue": app_state_interpretation("fatigue", fatigue_label),
            "loadStress": app_state_interpretation("loadStress", load_stress_label),
            "loadTolerance": app_state_interpretation("loadTolerance", load_tolerance_label),
        },
    }


def app_build_likely_response_insight(ordered):
    return {
        "label": "Likely response collecting",
        "evidenceStatement": f"Likely response cannot yet be estimated because lagged paired observations are not available across {len(ordered)} stored logs.",
        "whatSuggestsThis": "Lagged evidence is not calculated yet, so no likely response examples are shown.",
        "trainingInterpretation": "Forecast-style interpretation is collecting. Current insights should be read as same-day trends and associations only.",
        "bringForward": "Bring-forward response patterns will be available once lagged paired observations are calculated.",
        "preventMonitor": "Prevent/monitor response patterns will be available once lagged paired observations are calculated.",
        "limitation": "No lagged response model has been calculated yet.",
        "confidence": "Collecting",
        "status": "Collecting",
    }


def app_build_movement_mix_insight(sessions):
    breakdown = {}
    for session in sessions:
        for key, value in app_session_volume_by_type(session).items():
            breakdown[key] = breakdown.get(key, 0) + value
    total = sum(breakdown.values())
    top = sorted(breakdown.items(), key=lambda item: item[1], reverse=True)[0] if breakdown else None
    return {
        "statement": (f"{app_format_metric_name(top[0])} had the highest stored movement volume, contributing {round((top[1] / total) * 100)}% of total volume." if total > 0 and top else "Movement type frequency cannot yet be estimated because no session exercises are stored."),
        "limitation": "Movement frequency reflects stored completed sessions only." if total > 0 else "Needs completed session exercises before frequency can be estimated.",
        "evidenceItems": [["Total volume", _pretty(total, 1)], ["Session count", len(sessions)], ["Status", app_confidence_label(len(sessions))]],
        "breakdown": breakdown,
        "total": total,
    }


def app_build_max_intent_insight(sessions):
    exercises = [exercise for session in sessions for exercise in session.get("exercises", [])]
    max_intent = [exercise for exercise in exercises if _num(exercise.get("intent_percent")) >= 90]
    by_type = {}
    for exercise in max_intent:
        movement = exercise.get("movement_type") or "skill"
        by_type[movement] = by_type.get(movement, 0) + 1
    top = sorted(by_type.items(), key=lambda item: item[1], reverse=True)[0] if by_type else None
    return {
        "statement": (f"{app_format_metric_name(top[0])} had the highest max-intent frequency, with {top[1]} stored exposures at or above 90% intent." if max_intent and top else "Max-intent frequency cannot yet be estimated because no exercises at or above 90% intent are stored."),
        "limitation": "Max-intent frequency reflects stored completed exercises only." if max_intent else "Needs stored high-intent exercise exposures before frequency can be estimated.",
        "evidenceItems": [["Max-intent exposures", len(max_intent)], ["Exercise count", len(exercises)], ["Status", app_confidence_label(len(max_intent))]],
        "byType": by_type,
        "count": len(max_intent),
    }


def app_build_insight_summary(section_id, trend_insights, relationships, adaptation_insight, likely_response_insight, latest, avg_load):
    performance = next((item for item in sorted([r for r in relationships if r.get("yKey") == "performance" and _finite(r.get("r"))], key=lambda item: abs(item.get("r")), reverse=True)), None)
    irritation = next((item for item in sorted([r for r in relationships if r.get("yKey") == "pain" and _finite(r.get("r"))], key=lambda item: abs(item.get("r")), reverse=True)), None)
    components = adaptation_insight.get("componentStates", {})
    component_interpretations = adaptation_insight.get("componentInterpretations", {})
    summaries = {
        "overview": f"{adaptation_insight['label']}: {adaptation_insight['summary']} {adaptation_insight.get('performanceMeaning', '')}",
        "performance": f"{components.get('performance', 'Collecting')}: {component_interpretations.get('performance', 'Performance meaning is collecting.')}",
        "irritation": f"{components.get('irritation', 'Collecting')}: {component_interpretations.get('irritation', 'Pain meaning is collecting.')}",
        "recovery": f"{components.get('fatigue', 'Collecting')}: {component_interpretations.get('fatigue', 'Recovery meaning is collecting.')} Readiness is {_pretty(latest.get('readiness'), 1)} in the latest stored log.",
        "load": f"{components.get('loadStress', 'Collecting')}: {adaptation_insight.get('loadMeaning', 'Load stress and load tolerance are collecting.')} Mean session load is {'-' if avg_load is None else _pretty(avg_load, 1)}.",
        "adaptation": f"{adaptation_insight['summary']} {adaptation_insight.get('loadMeaning', '')} {adaptation_insight.get('performanceMeaning', '')}",
        "likely_response": f"Exploratory forecast: {likely_response_insight['evidenceStatement']}",
        "metric_explorer": "Open a reusable metric dashboard: time series, rolling stats, changes, relationships, and calendar markers.",
    }
    statuses = {
        "overview": trend_insights["performance"]["status"],
        "performance": performance["insight"]["confidence"] if performance else trend_insights["performance"]["status"],
        "irritation": irritation["insight"]["confidence"] if irritation else trend_insights["pain"]["status"],
        "recovery": trend_insights["fatigue"]["status"],
        "load": trend_insights["load"]["status"],
        "adaptation": adaptation_insight.get("status", "Collecting"),
        "likely_response": likely_response_insight.get("status", "Collecting"),
        "metric_explorer": "Available",
    }
    return {"id": section_id, "summary": summaries.get(section_id, ""), "status": statuses.get(section_id, "Collecting")}


def app_build_session_review(data, rows):
    sessions = data.get("sessions") or []
    active = data.get("activeSession") or {}
    last_session = sessions[0] if sessions else active
    latest_check_in = (data.get("checkIns") or [data.get("checkInDraft") or {}])[0]
    load = app_session_load(last_session)
    breakdown = app_session_volume_by_type(last_session)
    session_loads = [app_session_load(session) for session in sessions]
    recent_average = app_mean(session_loads) or load
    load_change = ((load - recent_average) / recent_average) * 100 if recent_average else 0
    max_intent_count = len([exercise for exercise in last_session.get("exercises", []) if _num(exercise.get("intent_percent")) >= 90])
    observation = (f"Today's load is {round(load_change)}% above your recent average. Max-intent exposures: {max_intent_count}. Next check-in soreness and pain response may be useful to monitor." if load > recent_average else f"Today's load is within your recent range. Pain is {_num(latest_check_in.get('pain_score'))} and readiness is {_pretty(app_readiness(latest_check_in), 1)}.")
    return {"load": load, "breakdown": breakdown, "recentAverage": recent_average, "loadChange": load_change, "maxIntentCount": max_intent_count, "observation": observation}


def app_selected_programme_context(data):
    programme = data.get("programme") or {}
    macros = programme.get("macro_blocks") or []
    macro = next((item for item in macros if item.get("id") == programme.get("selected_macro_id")), None) or (macros[0] if macros else {})
    blocks = macro.get("blocks") or []
    block = next((item for item in blocks if item.get("id") == programme.get("selected_block_id")), None) or (blocks[0] if blocks else {})
    weeks = block.get("weeks") or []
    week = next((item for item in weeks if item.get("id") == programme.get("selected_week_id")), None) or (weeks[0] if weeks else {})
    return {
        "macroBlock": macro.get("macro_block_name") or "Macro block context is collecting.",
        "trainingBlock": block.get("block_name") or "Training block context is collecting.",
        "week": week.get("week_name") or "Week context is collecting.",
    }


def app_checkin_deltas(latest, previous):
    if not previous:
        return {"pain": None, "readiness": None, "performance": None, "load": None}
    return {
        "pain": latest.get("pain") - previous.get("pain") if _finite(latest.get("pain")) and _finite(previous.get("pain")) else None,
        "readiness": latest.get("readiness") - previous.get("readiness") if _finite(latest.get("readiness")) and _finite(previous.get("readiness")) else None,
        "performance": latest.get("performance") - previous.get("performance") if _finite(latest.get("performance")) and _finite(previous.get("performance")) else None,
        "load": latest.get("load") - previous.get("load") if _finite(latest.get("load")) and _finite(previous.get("load")) else None,
    }


def app_checkin_load_relationship(relationships, strongest=None):
    candidates = [item for item in relationships if _finite(item.get("r")) and "load" in [item.get("xKey"), item.get("yKey")]]
    if strongest and "load" in [strongest.get("xKey"), strongest.get("yKey")] and _finite(strongest.get("r")):
        return strongest
    return next(iter(sorted(candidates, key=lambda item: abs(item.get("r", 0)), reverse=True)), None)


def app_checkin_frame(latest, previous, strongest, trend_insights, adaptation_insight, relationships):
    if not latest.get("id"):
        return "collecting"

    deltas = app_checkin_deltas(latest, previous)
    pain = latest.get("pain")
    soreness = latest.get("soreness")
    fatigue = latest.get("fatigue")
    freshness = latest.get("freshness")
    readiness = latest.get("readiness")
    performance = latest.get("performance")
    load_rel = app_checkin_load_relationship(relationships, strongest)
    fatigue_state = ((adaptation_insight or {}).get("componentStates") or {}).get("fatigue") or (trend_insights.get("fatigue") or {}).get("state")
    irritation_state = (trend_insights.get("pain") or {}).get("state")
    performance_state = (trend_insights.get("performance") or {}).get("state")

    if previous and _finite(deltas.get("load")) and _finite(deltas.get("pain")) and deltas["load"] > 0 and deltas["pain"] > 0:
        return "load-response signal"
    if load_rel and len(load_rel.get("points", [])) >= 3 and abs(load_rel.get("r", 0)) >= 0.4:
        return "load-response signal"
    if previous and _finite(deltas.get("pain")) and abs(deltas["pain"]) >= 1:
        return "irritation-response signal"
    if _finite(pain) and pain >= 5 and pain >= _num(soreness) and pain >= _num(fatigue):
        return "pain-limited"
    if _finite(soreness) and soreness >= 5 and soreness >= _num(pain) and soreness >= _num(fatigue):
        return "soreness-limited"
    if (_finite(fatigue) and fatigue >= 5 and fatigue >= _num(pain) and fatigue >= _num(soreness)) or fatigue_state in ["increasing", "Accumulating"] or (adaptation_insight or {}).get("label") == "Adaptation At Risk":
        return "fatigue-limited"
    if _finite(freshness) and freshness >= 7 and _finite(readiness) and readiness >= 5 and _num(pain) < 4:
        return "freshness-supported"
    if (_finite(performance) and performance >= 6 and _finite(readiness) and readiness >= 5) or performance_state in ["stable", "increasing"]:
        return "performance-supported"
    if previous and all(_finite(deltas.get(key)) and abs(deltas[key]) < 1 for key in ["pain", "readiness"]) and irritation_state != "increasing":
        return "stable response"
    return "collecting"


def app_checkin_theme(latest, previous, strongest, current_read, adaptation_insight, trend_insights=None, relationships=None):
    if not latest.get("id"):
        return {
            "title": "Context collecting",
            "signal": "No check-in saved yet.",
            "meaning": "Save a quick check-in after training so Impuls can connect your body response to the programme.",
            "frame": "collecting",
            "tone": "neutral",
        }
    return app_checkin_theme_copy(
        {},
        latest,
        previous,
        strongest,
        trend_insights or {},
        adaptation_insight,
        relationships or [],
    )


def app_checkin_evidence_summary(latest, previous, strongest):
    if not latest.get("id"):
        return "Check-in evidence is collecting because no saved check-in is available yet."

    pain_delta = latest.get("pain") - previous.get("pain") if previous and _finite(latest.get("pain")) and _finite(previous.get("pain")) else None
    load_delta = latest.get("load") - previous.get("load") if previous and _finite(latest.get("load")) and _finite(previous.get("load")) else None
    if previous and _finite(pain_delta) and abs(pain_delta) >= 1 and _finite(load_delta):
        direction = "increased" if pain_delta > 0 else "decreased"
        return (
            f"Pain {direction} by {pain_delta:+.1f} from the previous check-in, "
            f"while session load changed from {_pretty(previous.get('load'), 1)} to {_pretty(latest.get('load'), 1)}."
        )

    if strongest and _finite(strongest.get("r")):
        p_text = app_p_value_text(strongest.get("pValue"))
        return (
            f"Current logs show a {strongest.get('strength', 'collecting').lower()} "
            f"{'positive' if strongest.get('r', 0) >= 0 else 'negative'} association between "
            f"{str(strongest.get('xLabel', 'the predictor')).lower()} and {str(strongest.get('yLabel', 'the outcome')).lower()} "
            f"across {len(strongest.get('points', []))} paired observations (r = {_pretty(strongest.get('r'), 2)}, p-value: {p_text})."
        )

    return (
        f"Readiness was {_pretty(latest.get('readiness'), 1)}, with pain {_pretty(latest.get('pain'), 1)} "
        f"and fatigue {_pretty(latest.get('fatigue'), 1)}."
    )


def app_checkin_context(data, latest):
    context = app_selected_programme_context(data)
    session = latest.get("session") or {}
    macro_name = session.get("macro_name") or context["macroBlock"]
    block_name = session.get("block_name") or context["trainingBlock"]
    week_name = session.get("week_name") or context["week"]
    return {
        **context,
        "macroBlock": macro_name,
        "trainingBlock": block_name,
        "week": week_name,
        "sessionName": session.get("session_name") or "Session context is collecting.",
        "movementTypes": app_movement_summary(session),
        "exercises": app_exercise_detail_summary(session),
    }


def app_checkin_context_sentence(data, latest):
    context = app_checkin_context(data, latest)
    parts = [
        value for value in [
            context.get("trainingBlock"),
            context.get("week"),
            context.get("sessionName"),
        ]
        if value and "collecting" not in str(value).lower()
    ]
    return " / ".join(parts) if parts else "your current programme"


def app_checkin_programme_meaning(frame, adaptation_insight, context):
    adaptation_insight = adaptation_insight or {}
    label = adaptation_insight.get("label") or "Adaptation Unclear"
    states = adaptation_insight.get("componentStates") or {}
    block_name = context.get("trainingBlock")
    block_clause = f" in {block_name}" if block_name and "collecting" not in str(block_name).lower() else " in this block"

    if states.get("loadStress") == "Low Load" and frame in ["freshness-supported", "stable response", "collecting"]:
        return f"Across the programme{block_clause}, load is low. Feeling good today may mean you are recovered, not necessarily building adaptation."
    if states.get("loadStress") == "Load Spike":
        return f"Across the programme{block_clause}, load has spiked. The next useful signal is whether pain, soreness, or output worsens."
    if states.get("loadTolerance") == "Declining":
        return f"Across the programme{block_clause}, tolerance is slipping. Treat today's signal as a warning until the body response settles."
    if label in ["Strong Positive Adaptation", "Positive Adaptation"]:
        return f"Across the programme{block_clause}, adaptation is trending well. Keep confirming that this response stays repeatable."
    if label == "Adaptation At Risk":
        return f"Across the programme{block_clause}, adaptation is at risk. Today's body response matters more than chasing extra output."
    if label in ["Stable Adaptation", "Adaptation Plateau"]:
        return f"Across the programme{block_clause}, training looks more like holding than building. Use today's signal to decide whether the next step should change."
    return f"Across the programme{block_clause}, Impuls is still learning what this pattern means."


def app_checkin_theme_tone(frame, latest, previous, deltas, adaptation_insight):
    states = (adaptation_insight or {}).get("componentStates") or {}
    if not latest.get("id"):
        return "neutral"
    if frame in ["pain-limited"]:
        return "bad"
    if frame == "irritation-response signal":
        pain_delta = deltas.get("pain")
        if _finite(pain_delta) and pain_delta < 0:
            return "good"
        return "bad"
    if frame in ["fatigue-limited", "soreness-limited", "load-response signal"]:
        return "warning"
    if frame in ["freshness-supported", "performance-supported"]:
        if states.get("loadStress") in ["Low Load", "Load Spike"] or states.get("loadTolerance") == "Declining":
            return "warning"
        return "good"
    if frame == "stable response":
        return "neutral"
    return "neutral"


def app_checkin_theme_copy(data, latest, previous, strongest, trend_insights, adaptation_insight, relationships):
    frame = app_checkin_frame(latest, previous, strongest, trend_insights or {}, adaptation_insight, relationships or [])
    deltas = app_checkin_deltas(latest, previous)
    context = app_checkin_context(data, latest)
    programme_meaning = app_checkin_programme_meaning(frame, adaptation_insight, context)
    pain = latest.get("pain")
    soreness = latest.get("soreness")
    fatigue = latest.get("fatigue")
    freshness = latest.get("freshness")
    performance = latest.get("performance")
    load = latest.get("load")
    pain_delta = deltas.get("pain")
    load_delta = deltas.get("load")

    if not latest.get("id"):
        return {
            "title": "Context collecting",
            "signal": "No check-in saved yet.",
            "meaning": "Save a quick check-in after training so Impuls can connect your body response to the programme.",
            "frame": "collecting",
            "tone": "neutral",
        }

    titles = {
        "pain-limited": "Pain is the limiter",
        "fatigue-limited": "Recovery is under pressure",
        "soreness-limited": "Soreness is the main cost",
        "freshness-supported": "You feel ready",
        "performance-supported": "Output is holding",
        "load-response signal": "Load response showing",
        "irritation-response signal": "Pain response changed",
        "stable response": "Holding steady",
        "collecting": "Still learning today's pattern",
    }

    if frame == "pain-limited":
        signal = f"Pain is {_pretty(pain, 1)}, higher than the other body-response scores."
        meaning = f"Make pain the main decision point today. {programme_meaning}"
    elif frame == "fatigue-limited":
        signal = f"Fatigue is {_pretty(fatigue, 1)}, the clearest recovery cost today."
        meaning = f"This is a recovery-pressure day. {programme_meaning}"
    elif frame == "soreness-limited":
        signal = f"Soreness is {_pretty(soreness, 1)}, the strongest body-cost signal today."
        meaning = f"Treat soreness as the main limiter before judging performance. {programme_meaning}"
    elif frame == "freshness-supported":
        signal = f"Freshness is {_pretty(freshness, 1)} and pain is not the main limiter."
        meaning = f"You look ready today, but freshness alone is not adaptation. {programme_meaning}"
    elif frame == "performance-supported":
        signal = f"Performance score is {_pretty(performance, 1)} and output is holding."
        meaning = f"Use this as a useful performance day if pain and fatigue stay controlled. {programme_meaning}"
    elif frame == "load-response signal":
        load_change = f" Load changed {load_delta:+.1f} from the previous paired day." if _finite(load_delta) and abs(load_delta) >= 1 else ""
        signal = f"Training load is {_pretty(load, 1)} and body response is moving with the dose.{load_change}"
        meaning = f"Do not read this from freshness alone. Watch whether similar load creates pain, fatigue, or output drop-off. {programme_meaning}"
    elif frame == "irritation-response signal":
        if _finite(pain_delta):
            direction = "up" if pain_delta > 0 else "down"
            signal = f"Pain moved {direction} by {abs(pain_delta):.1f} since the last check-in."
        else:
            signal = f"Pain is {_pretty(pain, 1)} and is the clearest body-response signal."
        if _finite(pain_delta) and pain_delta < 0:
            meaning = f"Pain is settling. Keep using similar sessions as reference points if output also holds. {programme_meaning}"
        else:
            meaning = f"Pain is the signal to watch. Judge the next session by body response first, not readiness or output alone. {programme_meaning}"
    elif frame == "stable response":
        signal = "Pain and recovery scores have not moved much since the last check-in."
        meaning = f"This is useful holding-context, not a big warning or a big green light. {programme_meaning}"
    else:
        signal = "No single signal is dominant yet."
        meaning = f"Keep logging check-ins and performance after sessions so Impuls can separate signal from noise. {programme_meaning}"

    return {
        "title": titles.get(frame, "Check-in response"),
        "signal": signal,
        "meaning": meaning,
        "frame": frame,
        "tone": app_checkin_theme_tone(frame, latest, previous, deltas, adaptation_insight),
        "programmeMeaning": programme_meaning,
    }


def app_checkin_interpretation(data, latest, previous, strongest, trend_insights, adaptation_insight, relationships):
    if not latest.get("id"):
        return "Save a quick check-in after training so Impuls can connect your body response to the programme."

    return app_checkin_theme_copy(
        data,
        latest,
        previous,
        strongest,
        trend_insights,
        adaptation_insight,
        relationships,
    )["meaning"]


def app_chart_point(point, key="value"):
    value = point.get(key)
    return {"date": point.get("date"), "value": _json_num(value)} if _finite(value) else None


def app_chart_series(metric_series, key, label, color, limit=6):
    points = [app_chart_point(point) for point in metric_series.get(key, [])[-limit:]]
    return {"key": key, "label": label, "color": color, "points": [point for point in points if point]}


def app_checkin_state_radar(latest):
    axes = [
        {"key": "pain", "label": "Pain", "value": _json_num(latest.get("pain")), "tone": "risk"},
        {"key": "freshness", "label": "Freshness", "value": _json_num(latest.get("freshness")), "tone": "positive"},
        {"key": "fatigue", "label": "Fatigue", "value": _json_num(latest.get("fatigue")), "tone": "risk"},
        {"key": "readiness", "label": "Readiness", "value": _json_num(latest.get("readiness")), "tone": "positive"},
    ]
    return {
        "type": "checkin_state_radar",
        "title": "Today's check-in scores",
        "xLabel": "Body signal",
        "yLabel": "Score, 0-10",
        "axes": axes,
        "evidence": "Latest check-in values are plotted on a 0-10 scale.",
        "interpretation": "Farther from the centre means a higher score. Green is helpful; red or orange is a body cost to watch.",
        "emptyState": "Needs a saved check-in with pain, freshness, fatigue, and readiness.",
    }


def app_checkin_visual(latest, previous, strongest, metric_series, relationships, frame, ordered):
    if not latest.get("id"):
        return {"type": "checkin_state_radar", "title": "Check-in State Radar", "axes": [], "emptyState": "context collecting."}

    deltas = app_checkin_deltas(latest, previous)
    load_rel = app_checkin_load_relationship(relationships, strongest)

    if frame in ["fatigue-limited", "freshness-supported"]:
        return {
            "type": "readiness_decomposition_bar",
            "title": "What shaped readiness",
            "xLabel": "Green helps, red costs",
            "yLabel": "0-10 check-in score",
            "freshness": _json_num(latest.get("freshness")),
            "painCost": _json_num(_num(latest.get("pain")) / 2),
            "readiness": _json_num(latest.get("readiness")),
            "evidence": f"Freshness {_pretty(latest.get('freshness'), 1)} is balanced against pain cost.",
            "interpretation": "The green bar is what helps you feel ready. The red bar is what pulls readiness down.",
            "emptyState": "Needs freshness and pain to decompose readiness.",
        }

    if previous and _finite(deltas.get("pain")) and abs(deltas["pain"]) >= 1:
        return {
            "type": "pain_delta_bar",
            "title": "Pain change",
            "xLabel": "Last check-in vs today",
            "yLabel": "Pain score, 0-10",
            "bars": [
                {"label": _date_short(previous.get("date")), "date": previous.get("date"), "value": _json_num(previous.get("pain"))},
                {"label": _date_short(latest.get("date")), "date": latest.get("date"), "value": _json_num(latest.get("pain"))},
            ],
            "delta": _json_num(deltas["pain"]),
            "evidence": f"Pain changed {deltas['pain']:+.1f} points.",
            "interpretation": "The second bar is today. Red means pain rose; green means pain eased.",
            "emptyState": "Needs a previous check-in before pain delta can be displayed.",
        }

    if load_rel and len(load_rel.get("points", [])) >= 3:
        return {
            "type": "load_response_scatter",
            "title": load_rel.get("title") or "Load response",
            "xLabel": load_rel.get("xLabel") or "Session load",
            "yLabel": load_rel.get("yLabel") or "Outcome",
            "points": [{"date": point.get("date"), "x": _json_num(point.get("x")), "y": _json_num(point.get("y"))} for point in load_rel.get("points", []) if _finite(point.get("x")) and _finite(point.get("y"))],
            "r": _json_num(load_rel.get("r")),
            "n": len(load_rel.get("points", [])),
            "pValueText": app_p_value_text(load_rel.get("pValue")),
            "evidence": f"{len(load_rel.get('points', []))} paired logs compare training load with body response.",
            "interpretation": "Each dot is a logged training day. If dots climb as load rises, higher load is tending to come with a higher response cost.",
            "emptyState": "Needs at least three paired load-response observations.",
        }

    if len(metric_series.get("performance", [])) >= 2 and len(metric_series.get("readiness", [])) >= 2:
        paired_count = min(len(metric_series.get("performance", [])), len(metric_series.get("readiness", [])))
        return {
            "type": "performance_readiness_dual_line",
            "title": "Output and readiness",
            "xLabel": "Date",
            "yLabel": "Score",
            "series": [
                app_chart_series(metric_series, "performance", "Performance", "#24883B", 6),
                app_chart_series(metric_series, "readiness", "Readiness", "#2D9A68", 6),
            ],
            "evidence": f"Recent performance and readiness are shown across {paired_count} stored observations.",
            "interpretation": "Use the direction of the lines, not tiny day-to-day wiggles. Best case: output holds or rises while readiness does not collapse.",
            "emptyState": "Needs at least two performance and readiness observations.",
        }

    if len(ordered) >= 3:
        return {
            "type": "block_state_small_multiples",
            "title": "Recent training signals",
            "xLabel": "Date",
            "yLabel": "Each chart uses its own scale",
            "series": [
                app_chart_series(metric_series, "performance", "Performance", "#24883B", 6),
                app_chart_series(metric_series, "load", "Load", "#1F7A40", 6),
                app_chart_series(metric_series, "pain", "Pain", "#E13F32", 6),
                app_chart_series(metric_series, "fatigue", "Fatigue", "#6656E8", 6),
                app_chart_series(metric_series, "readiness", "Readiness", "#2D9A68", 6),
            ],
            "evidence": f"Block-state small multiples use the latest {min(len(ordered), 6)} stored observations per metric where available.",
            "interpretation": "Each mini chart is scaled separately, so compare direction, not bar height. You want performance and load to build without pain or fatigue climbing too fast.",
            "emptyState": "Needs at least three stored check-ins for block-state small multiples.",
        }

    return app_checkin_state_radar(latest)


def app_build_checkin_review(data, ordered, rows_desc, metric_series, trend_insights, relationships, current_read, adaptation_insight):
    latest = rows_desc[0] if rows_desc else {}
    previous = ordered[-2] if len(ordered) >= 2 else None
    strongest = next(iter(sorted([item for item in relationships if _finite(item.get("r"))], key=lambda item: abs(item.get("r", 0)), reverse=True)), None)
    frame = app_checkin_frame(latest, previous, strongest, trend_insights, adaptation_insight, relationships)
    theme = app_checkin_theme_copy(data, latest, previous, strongest, trend_insights, adaptation_insight, relationships)
    return {
        "checkInId": latest.get("id"),
        "status": "Ready" if latest.get("id") else "Collecting",
        "theme": theme,
        "evidenceSummary": app_checkin_evidence_summary(latest, previous, strongest),
        "interpretation": app_checkin_interpretation(data, latest, previous, strongest, trend_insights, adaptation_insight, relationships),
        "visual": app_checkin_visual(latest, previous, strongest, metric_series, relationships, frame, ordered),
        "context": app_checkin_context(data, latest),
    }


def analyze_app_data(data):
    sessions = [*(data.get("sessions") or []), *app_all_planned_sessions(data)]
    check_ins = data.get("checkIns") or data.get("check_ins") or []
    active_session = data.get("activeSession") or {}
    session_by_id = {session.get("id"): session for session in sessions if session.get("id")}
    rows = []

    def check_in_value(check_in, primary_key, fallback_key):
        return check_in.get(primary_key) if check_in.get(primary_key) is not None else check_in.get(fallback_key)

    def build_session_row(session, check_in=None):
        exercises = (session or {}).get("exercises", [])
        intents = [_num(exercise.get("intent_percent"), None) for exercise in exercises]
        intents = [value for value in intents if _finite(value)]
        actual_values = {
            "performance": app_session_actual_metric(session, "performance"),
            "height_or_distance": app_session_actual_metric(session, "height_or_distance"),
            "ft": app_session_actual_metric(session, "ft"),
            "gct": app_session_actual_metric(session, "gct"),
            "sprint_time": app_session_actual_metric(session, "sprint_time"),
            "distance": app_session_actual_metric(session, "distance"),
            "bar_velocity": app_session_actual_metric(session, "bar_velocity"),
            "weight": app_session_actual_metric(session, "weight"),
            "rsi": app_session_actual_metric(session, "rsi"),
        }
        has_check_in = bool(check_in)
        check_in = check_in or {}
        return {
            "id": check_in.get("id") or session.get("id"),
            "date": check_in.get("check_in_datetime") or session.get("session_datetime") or session.get("date"),
            "checkIn": check_in,
            "session": session,
            "load": app_session_load(session),
            "volume": sum(app_get_volume(exercise) for exercise in exercises),
            "contacts": sum(_num(exercise.get("contacts")) for exercise in exercises),
            "reps": sum((_num(exercise.get("sets"), 1) or 1) * _num(exercise.get("reps")) for exercise in exercises),
            "duration": sum(_num(exercise.get("duration_minutes")) for exercise in exercises),
            "average_intent": app_mean(intents),
            "pain": _num(check_in_value(check_in, "pain_score", "pain"), None) if has_check_in else None,
            "freshness": _num(check_in_value(check_in, "freshness_score", "freshness"), None) if has_check_in else None,
            "fatigue": app_fatigue(check_in) if has_check_in else None,
            "readiness": app_readiness(check_in) if has_check_in else None,
            "performance": actual_values["performance"] if _finite(actual_values["performance"]) else _num(check_in.get("performance_score"), None),
            "height_or_distance": actual_values["height_or_distance"] if _finite(actual_values["height_or_distance"]) else _to_cm(
                check_in.get("height_or_distance"),
                check_in.get("height_or_distance_unit") or check_in.get("unit"),
            ),
            "ft": actual_values["ft"] if _finite(actual_values["ft"]) else _to_seconds(check_in.get("ft"), check_in.get("ft_unit")),
            "gct": actual_values["gct"] if _finite(actual_values["gct"]) else _to_seconds(check_in.get("gct"), check_in.get("gct_unit")),
            "sprint_time": actual_values["sprint_time"] if _finite(actual_values["sprint_time"]) else _to_seconds(check_in.get("sprint_time"), check_in.get("sprint_time_unit")),
            "distance": actual_values["distance"] if _finite(actual_values["distance"]) else _to_metres(
                check_in.get("distance"),
                check_in.get("distance_unit") or check_in.get("unit"),
            ),
            "bar_velocity": actual_values["bar_velocity"] if _finite(actual_values["bar_velocity"]) else _num(check_in.get("bar_velocity"), None),
            "weight": actual_values["weight"] if _finite(actual_values["weight"]) else _to_kg(check_in.get("weight"), check_in.get("weight_unit")),
            "rsi": actual_values["rsi"] if _finite(actual_values["rsi"]) else app_rsi(check_in),
        }

    for check_in in check_ins:
        linked = session_by_id.get(check_in.get("linked_session_id"), active_session)
        rows.append(build_session_row(linked, check_in))
    logged_session_ids = {row.get("session", {}).get("id") for row in rows}
    for session in sessions:
        if session.get("id") in logged_session_ids:
            continue
        if app_session_has_actual_outputs(session):
            rows.append(build_session_row(session))
    ordered = sorted(rows, key=lambda item: _parse_dt(item.get("date")))
    rows_desc = sorted(rows, key=lambda item: _parse_dt(item.get("date")), reverse=True)
    latest = rows_desc[0] if rows_desc else {
        "checkIn": data.get("checkInDraft") or {},
        "session": active_session,
        "load": app_session_load(active_session),
        "pain": _num((data.get("checkInDraft") or {}).get("pain_score")),
        "freshness": _num((data.get("checkInDraft") or {}).get("freshness_score")),
        "fatigue": app_fatigue(data.get("checkInDraft") or {}),
        "readiness": app_readiness(data.get("checkInDraft") or {}),
        "performance": _num((data.get("checkInDraft") or {}).get("performance_score")),
        "rsi": app_rsi(data.get("checkInDraft") or {}),
    }
    metric_series = {key: app_metric_series(ordered, key) for key in APP_METRIC_META.keys()}
    metric_stats = {key: app_metric_stats(points) for key, points in metric_series.items()}
    trend_insights = {key: app_build_trend_insight(key, points) for key, points in metric_series.items()}
    change_insights = {key: app_build_change_insight(key, points) for key, points in metric_series.items()}
    performance_metric_analysis = app_build_performance_metric_analysis(metric_series, trend_insights)
    relationships = []
    for rel_id, title, category, x_key, y_key, x_label, y_label, color in APP_RELATIONSHIP_SPECS:
        points = app_aligned_pairs(ordered, x_key, y_key)
        x_values = [point["x"] for point in points]
        y_values = [point["y"] for point in points]
        r = app_pearson(x_values, y_values)
        relationship = {
            "id": rel_id,
            "title": title,
            "category": category,
            "xKey": x_key,
            "yKey": y_key,
            "xLabel": x_label,
            "yLabel": y_label,
            "r": _json_num(r),
            "spearmanR": _json_num(app_spearman(x_values, y_values)),
            "pValue": _json_num(app_correlation_p_value(r, len(points))),
            "strength": app_relationship_strength(r),
            "color": color,
            "points": points,
        }
        relationship["finding"] = f"{title} needs at least three matching logs." if not _finite(r) else f"{title} showed a {relationship['strength'].lower()} {'positive' if r >= 0 else 'negative'} association in stored logs."
        relationship["insight"] = app_build_relationship_insight(relationship)
        relationships.append(relationship)
    strongest = next(iter(sorted([item for item in relationships if _finite(item.get("r"))], key=lambda item: abs(item.get("r", 0)), reverse=True)), None)
    performance_trend = metric_stats["performance"].get("trend")
    load_trend = metric_stats["load"].get("trend")
    fatigue_trend = metric_stats["fatigue"].get("trend")
    irritation_trend = metric_stats["pain"].get("trend")
    adaptation_insight = app_build_adaptation_insight(ordered, performance_trend, load_trend, irritation_trend, fatigue_trend)
    likely_response_insight = app_build_likely_response_insight(ordered)
    avg_load = app_mean([row.get("load") for row in rows])
    insight_summaries = {section_id: app_build_insight_summary(section_id, trend_insights, relationships, adaptation_insight, likely_response_insight, latest, avg_load) for section_id in ["overview", "performance", "irritation", "recovery", "load", "adaptation", "likely_response", "metric_explorer"]}
    current_read = {
        "performance": adaptation_insight.get("componentStates", {}).get("performance", trend_insights["performance"]["state"]),
        "loadStress": adaptation_insight.get("componentStates", {}).get("loadStress", trend_insights["load"]["state"]),
        "loadTolerance": adaptation_insight.get("componentStates", {}).get("loadTolerance", "Collecting"),
        "irritation": adaptation_insight.get("componentStates", {}).get("irritation", trend_insights["pain"]["state"]),
        "fatigue": adaptation_insight.get("componentStates", {}).get("fatigue", trend_insights["fatigue"]["state"]),
        "adaptation": adaptation_insight["label"],
    }
    load_performance = next((item.get("r") for item in relationships if item.get("id") == "performance_load"), None)
    freshness_performance = next((item.get("r") for item in relationships if item.get("id") == "performance_freshness"), None)
    fatigue_performance = next((item.get("r") for item in relationships if item.get("id") == "performance_fatigue"), None)
    pain_load = next((item.get("r") for item in relationships if item.get("id") == "pain_load"), None)
    block_analysis = app_build_block_analysis(data, ordered)
    programme_reads = app_build_programme_reads(data, ordered, block_analysis, metric_stats)
    session_extras = app_build_session_extras(ordered, None)
    return {
        "rows": rows_desc,
        "latest": latest,
        "best": next(iter(sorted([row for row in rows if _finite(row.get("performance"))], key=lambda item: item.get("performance"), reverse=True)), None),
        "strongest": strongest,
        "relationships": relationships,
        "cards": [],
        "metricSeries": metric_series,
        "metricStats": metric_stats,
        "trendInsights": trend_insights,
        "changeInsights": change_insights,
        "performanceMetricAnalysis": performance_metric_analysis,
        "adaptationInsight": adaptation_insight,
        "likelyResponseInsight": likely_response_insight,
        "loadDetailInsights": {"movementMix": app_build_movement_mix_insight(sessions), "maxIntent": app_build_max_intent_insight(sessions)},
        "insightSummaries": insight_summaries,
        "currentRead": current_read,
        "weeklyLoad": sum(row.get("load", 0) for row in rows),
        "avgLoad": _json_num(avg_load),
        "avgPerformance": _json_num(app_mean([row.get("performance") for row in rows])),
        "avgFreshness": _json_num(app_mean([row.get("freshness") for row in rows])),
        "avgPain": _json_num(app_mean([row.get("pain") for row in rows])),
        "avgFatigue": _json_num(app_mean([row.get("fatigue") for row in rows])),
        "performanceTrend": _json_num(performance_trend),
        "loadTrend": _json_num(load_trend),
        "fatigueTrend": _json_num(fatigue_trend),
        "irritationTrend": _json_num(irritation_trend),
        "loadPerformance": _json_num(load_performance),
        "freshnessPerformance": _json_num(freshness_performance),
        "fatiguePerformance": _json_num(fatigue_performance),
        "painLoad": _json_num(pain_load),
        "activeSessionLoad": app_session_load(active_session),
        "sessionReview": app_build_session_review(data, rows),
        "checkInReview": app_build_checkin_review(data, ordered, rows_desc, metric_series, trend_insights, relationships, current_read, adaptation_insight),
        "blockAnalysis": block_analysis,
        "programmeReads": programme_reads,
        "sessionExtras": session_extras,
    }
