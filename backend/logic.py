from enum import Enum
from datetime import datetime, timedelta
import statistics
from uuid import uuid4


# ----------------------------
# Enums
# ----------------------------

class MovementType(str, Enum):
    PLYOMETRIC = "plyometric"
    POWER_BALLISTIC = "power_ballistic"
    STRENGTH = "strength"
    ENDURANCE = "endurance"
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
    MovementType.ENDURANCE: [
        "duration_minutes",
        "intent_percent",
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
        return value

    return datetime.fromisoformat(value)


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
    return safe_divide(current_load - previous_load, previous_load) * 100 if previous_load not in [0, None] else None


def calculate_irritation_delta(current_pain, previous_pain):
    if current_pain is None or previous_pain is None:
        return None

    return current_pain - previous_pain


def calculate_fatigue(freshness, soreness):
    if freshness is None or soreness is None:
        return None

    return ((10 - freshness) + soreness) / 2


def calculate_readiness(freshness, soreness, pain):
    if freshness is None or soreness is None or pain is None:
        return None

    return freshness - ((soreness + pain) / 2)


def calculate_rsi(ft, gct):
    if ft is None or gct in [0, None]:
        return None

    return ft / gct


def calculate_slope(values):
    values = extract_non_null(values)

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
    values = extract_non_null(values)

    if len(values) == 0:
        return None

    return statistics.mean(values)


def calculate_rolling_sd(values):
    values = extract_non_null(values)

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
    values = extract_non_null(values)

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
    pain = check_in.get("pain")
    if pain is None:
        return None
    return pain.get("pain_score")


def get_check_in_freshness(check_in):
    recovery = check_in.get("recovery")
    if recovery is None:
        return None
    return recovery.get("freshness_score")


def get_check_in_soreness(check_in):
    recovery = check_in.get("recovery")
    if recovery is None:
        return None
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

    ft = _to_seconds(performance.get("ft"), performance.get("ft_unit"))
    gct = _to_seconds(performance.get("gct"), performance.get("gct_unit"))
    return calculate_rsi(ft, gct)


def get_performance_metric(performance_entry, metric_name="performance_score"):
    if performance_entry is None:
        return None

    if metric_name == "rsi":
        ft = _to_seconds(performance_entry.get("ft"), performance_entry.get("ft_unit"))
        gct = _to_seconds(performance_entry.get("gct"), performance_entry.get("gct_unit"))
        return calculate_rsi(ft, gct)

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

    return extract_non_null(values)


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

    return extract_non_null(values)


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
            if intent_percent is not None and intent_percent >= threshold:
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
    values = [abs(value) for value in values if value is not None]

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
    performance_values = get_check_in_series(check_ins, performance_metric)
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
    performance_values = get_check_in_series(check_ins, performance_metric)

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

        if value is None:
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
                if current["session_load"] is not None and previous["session_load"] is not None
                else None
            ),
            "performance_change": (
                current["performance"] - previous["performance"]
                if current["performance"] is not None and previous["performance"] is not None
                else None
            ),
            "pain_change": (
                current["pain"] - previous["pain"]
                if current["pain"] is not None and previous["pain"] is not None
                else None
            ),
            "fatigue_change": (
                current["fatigue"] - previous["fatigue"]
                if current["fatigue"] is not None and previous["fatigue"] is not None
                else None
            ),
        })

    return changes


def get_largest_absolute_change(changes, metric_name):
    valid_changes = [change for change in changes if change.get(metric_name) is not None]

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
    if value is None:
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
    if value is None:
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

    valid_rows = [row for row in rows if row.get(metric_name) is not None]
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
        return calculate_rsi(
            _to_seconds(performance_entry.get("ft"), performance_entry.get("ft_unit")),
            _to_seconds(performance_entry.get("gct"), performance_entry.get("gct_unit")),
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

        changes.append({
            "from_date": previous["date"],
            "to_date": current["date"],
            "from_value": previous.get(metric_name),
            "to_value": current.get(metric_name),
            "change": current.get(metric_name) - previous.get(metric_name),
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

import math

APP_METRIC_META = {
    "performance": {"label": "Performance score", "tone": "positive"},
    "height_or_distance": {"label": "Height / distance", "tone": "positive"},
    "rsi": {"label": "RSI", "tone": "positive"},
    "ft": {"label": "FT", "tone": "positive"},
    "gct": {"label": "GCT", "tone": "positive"},
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
    "soreness": {"label": "Soreness", "tone": "risk"},
    "fatigue": {"label": "Fatigue", "tone": "risk"},
    "readiness": {"label": "Readiness", "tone": "positive"},
    "pain": {"label": "Pain", "tone": "risk"},
    "pain_delta": {"label": "Irritation delta", "tone": "risk"},
}

APP_RELATIONSHIP_SPECS = [
    ("pain_load", "Pain vs Load", "Irritation", "load", "pain", "Session Load", "Pain", "#E13F32"),
    ("pain_soreness", "Pain vs Soreness", "Irritation", "soreness", "pain", "Soreness", "Pain", "#C73A2E"),
    ("pain_fatigue", "Pain vs Fatigue", "Irritation", "fatigue", "pain", "Fatigue", "Pain", "#B1382D"),
    ("pain_average_intent", "Pain vs Average Intent", "Irritation", "average_intent", "pain", "Average Intent", "Pain", "#D05A3C"),
    ("performance_freshness", "Performance vs Freshness", "Performance", "freshness", "performance", "Freshness (0-10)", "Performance", "#24883B"),
    ("performance_readiness", "Performance vs Readiness", "Performance", "readiness", "performance", "Readiness", "Performance", "#2D9A68"),
    ("performance_pain", "Performance vs Pain", "Performance", "pain", "performance", "Pain", "Performance", "#E13F32"),
    ("performance_soreness", "Performance vs Soreness", "Performance", "soreness", "performance", "Soreness", "Performance", "#7C63E6"),
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
    return isinstance(value, (int, float)) and math.isfinite(value)


def _json_num(value):
    return value if _finite(value) else None


def _pretty(value, digits=1):
    return f"{value:.{digits}f}" if _finite(value) else "-"


def _unit(value):
    return str(value or "").strip().lower()


def _to_seconds(value, unit):
    numeric = _num(value, None)
    if not _finite(numeric):
        return None
    base_unit = _unit(unit) or "seconds"
    if base_unit in ["milliseconds", "ms"]:
        return numeric / 1000
    return numeric


def _to_cm(value, unit):
    numeric = _num(value, None)
    if not _finite(numeric):
        return None
    base_unit = _unit(unit) or "cm"
    if base_unit in ["inches", "inch", "in"]:
        return numeric * 2.54
    return numeric


def _to_metres(value, unit):
    numeric = _num(value, None)
    if not _finite(numeric):
        return None
    base_unit = _unit(unit) or "metres"
    if base_unit in ["yards", "yard", "yd"]:
        return numeric * 0.9144
    return numeric


def _to_kg(value, unit):
    numeric = _num(value, None)
    if not _finite(numeric):
        return None
    base_unit = _unit(unit) or "kg"
    if base_unit in ["lbs", "lb"]:
        return numeric * 0.45359237
    return numeric


def _parse_dt(value):
    if not value:
        return datetime.min
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
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
    if movement in ["power_ballistic", "strength"]:
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
    if movement == "plyometric":
        return volume * intent
    if movement == "power_ballistic":
        return volume * intent * intensity
    if movement == "strength":
        return volume * intensity
    return volume * intent


def app_session_load(session):
    return sum(app_exercise_load(exercise) for exercise in (session or {}).get("exercises", []))


def app_session_volume_by_type(session):
    rows = {"plyometric": 0, "strength": 0, "power_ballistic": 0, "endurance": 0, "skill": 0}
    for exercise in (session or {}).get("exercises", []):
        movement = exercise.get("movement_type") or "skill"
        rows[movement] = rows.get(movement, 0) + app_get_volume(exercise)
    return rows


def app_fatigue(check_in):
    return ((10 - _num(check_in.get("freshness_score"))) + _num(check_in.get("soreness_score"))) / 2


def app_readiness(check_in):
    return _num(check_in.get("freshness_score")) - (_num(check_in.get("soreness_score")) + _num(check_in.get("pain_score"))) / 2


def app_rsi(check_in):
    gct = _to_seconds(check_in.get("gct"), check_in.get("gct_unit"))
    ft = _to_seconds(check_in.get("ft"), check_in.get("ft_unit"))
    return ft / gct if gct > 0 else None


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
    if r is None:
        return "Collecting"
    abs_r = abs(r)
    if abs_r >= 0.7:
        return "Strong"
    if abs_r >= 0.4:
        return "Moderate"
    return "Weak"


def app_correlation_p_value(r, n):
    if r is None or not _finite(r) or n < 4 or abs(r) >= 1:
        return None
    t_value = abs(r) * math.sqrt((n - 2) / (1 - r * r))
    return max(0.001, min(0.999, 2 * (1 - (0.5 * (1 + math.erf(t_value / math.sqrt(2)))))))


def app_confidence_label(count):
    if count >= 12:
        return "More stable"
    if count >= 6:
        return "Exploratory"
    return "Collecting"


def app_trend_state(value, count):
    if count < 2 or value is None:
        return "collecting"
    if value > 0.05:
        return "increasing"
    if value < -0.05:
        return "decreasing"
    return "stable"


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
        return row.get("pain") - previous_row.get("pain") if previous_row else 0
    return row.get(key)


def app_metric_series(rows, key):
    points = []
    for index, row in enumerate(rows):
        value = app_metric_value(row, key, rows[index - 1] if index else None)
        if _finite(value):
            points.append({"id": row.get("id"), "date": row.get("date"), "row": row, "value": value})
    return points


def app_metric_stats(points):
    values = [point.get("value") for point in points if _finite(point.get("value"))]
    changes = []
    for index, point in enumerate(points[1:], start=1):
        previous = points[index - 1]
        changes.append({**point, "previous": previous, "change": point.get("value") - previous.get("value")})
    changes.sort(key=lambda item: abs(item.get("change", 0)), reverse=True)
    return {
        "avg": _json_num(app_mean(values)),
        "sd": _json_num(app_sd(values)),
        "trend": _json_num(app_slope(values)),
        "volatility": _json_num(app_sd(values)),
        "count": len(values),
        "min": _json_num(min(values) if values else None),
        "max": _json_num(max(values) if values else None),
        "highest": sorted(points, key=lambda item: item.get("value", 0), reverse=True)[:3],
        "lowest": sorted(points, key=lambda item: item.get("value", 0))[:3],
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
            points.append({
                "x": x,
                "y": y,
                "date": row.get("date"),
                "id": row.get("id"),
                "session_name": (row.get("session") or {}).get("session_name") or "Session context is collecting.",
                "load": row.get("load"),
                "pain": row.get("pain"),
                "pain_delta": row.get("pain") - previous.get("pain") if previous else 0,
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
    if count < 3 or r is None:
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
    by_x_high = sorted(points, key=lambda item: item.get("x", 0), reverse=True)[:2]
    by_x_low = sorted(points, key=lambda item: item.get("x", 0))[:2]
    by_y_high = sorted(points, key=lambda item: item.get("y", 0), reverse=True)[:2]
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
    if count < 3 or relationship.get("r") is None:
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
    if count < 3 or relationship.get("r") is None:
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
    elif relationship.get("r") is None:
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
    perf_state = app_trend_state(performance_trend, count)
    load_state = app_trend_state(load_trend, count)
    irritation_state = app_trend_state(irritation_trend, count)
    fatigue_state = app_trend_state(fatigue_trend, count)
    label = "Unclear"
    summary = "Signals are mixed; collect more paired logs before calling the block."
    if count < 2:
        label = "Collecting"
        summary = "Adaptation state cannot yet be estimated because fewer than two observations are available."
    elif perf_state == "increasing" and load_state == "increasing" and irritation_state != "increasing":
        label = "Adapting"
        summary = "Performance and load are rising without a clear irritation rise."
    elif irritation_state == "increasing":
        label = "Irritation accumulating"
        summary = "Pain is rising, so the block may warrant closer monitoring."
    elif fatigue_state == "increasing" and perf_state != "increasing":
        label = "Fatigue accumulating"
        summary = "Fatigue is rising without a clear performance lift yet."
    elif perf_state != "increasing" and load_state != "increasing":
        label = "Stable"
        summary = "The block is currently stable rather than strongly adapting."
    return {
        "label": label,
        "summary": summary,
        "evidenceStatement": ("Adaptation component trends cannot yet be estimated because fewer than two observations are available." if count < 2 else f"Adaptation state was {label.lower()} across {count} logged observations; performance {perf_state}, load {load_state}, irritation {irritation_state}, and fatigue {fatigue_state}."),
        "trainingInterpretation": f"{summary} This is a block-level interpretation from stored logs, not a prescription.",
        "bringForward": "Bring forward sessions that coincide with favourable performance, stable irritation, and manageable fatigue as comparison context.",
        "preventMonitor": "Sessions where fatigue, soreness, or pain are elevated may be worth monitoring because those states may change how load is interpreted.",
        "limitation": "Small sample; treat as exploratory. Adaptation state reflects stored logs only." if count < 6 else "Adaptation state reflects stored logs only.",
        "confidence": app_confidence_label(count),
        "status": app_confidence_label(count),
        "componentStates": {"performance": perf_state, "load": load_state, "irritation": irritation_state, "fatigue": fatigue_state},
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
    performance = next((item for item in sorted([r for r in relationships if r.get("yKey") == "performance" and r.get("r") is not None], key=lambda item: abs(item.get("r", 0)), reverse=True)), None)
    irritation = next((item for item in sorted([r for r in relationships if r.get("yKey") == "pain" and r.get("r") is not None], key=lambda item: abs(item.get("r", 0)), reverse=True)), None)
    summaries = {
        "overview": f"Current read: performance {trend_insights['performance']['state']}, irritation {trend_insights['pain']['state']}, fatigue {trend_insights['fatigue']['state']}.",
        "performance": f"{trend_insights['performance']['evidenceStatement']} {performance['insight']['evidenceStatement'] if performance else 'Performance relationships are collecting.'}",
        "irritation": f"{trend_insights['pain']['evidenceStatement']} {irritation['insight']['evidenceStatement'] if irritation else 'Irritation relationships are collecting.'}",
        "recovery": f"{trend_insights['fatigue']['evidenceStatement']} Readiness is {_pretty(latest.get('readiness'), 1)} in the latest stored log.",
        "load": f"{trend_insights['load']['evidenceStatement']} Mean session load is {'-' if avg_load is None else _pretty(avg_load, 1)}.",
        "adaptation": adaptation_insight["summary"],
        "likely_response": likely_response_insight["evidenceStatement"],
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
    candidates = [item for item in relationships if item.get("r") is not None and "load" in [item.get("xKey"), item.get("yKey")]]
    if strongest and "load" in [strongest.get("xKey"), strongest.get("yKey")] and strongest.get("r") is not None:
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
    fatigue_state = (trend_insights.get("fatigue") or {}).get("state")
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
    if (_finite(fatigue) and fatigue >= 5 and fatigue >= _num(pain) and fatigue >= _num(soreness)) or fatigue_state == "increasing" or (adaptation_insight or {}).get("label") == "Fatigue accumulating":
        return "fatigue-limited"
    if _finite(freshness) and freshness >= 7 and _finite(readiness) and readiness >= 5 and _num(pain) < 4:
        return "freshness-supported"
    if (_finite(performance) and performance >= 6 and _finite(readiness) and readiness >= 5) or performance_state in ["stable", "increasing"]:
        return "performance-supported"
    if previous and all(_finite(deltas.get(key)) and abs(deltas[key]) < 1 for key in ["pain", "readiness"]) and irritation_state != "increasing":
        return "stable response"
    return "collecting"


def app_checkin_theme(latest, previous, strongest, current_read, adaptation_insight, trend_insights=None, relationships=None):
    frame = app_checkin_frame(latest, previous, strongest, trend_insights or {}, adaptation_insight, relationships or [])
    deltas = app_checkin_deltas(latest, previous)
    pain = latest.get("pain")
    freshness = latest.get("freshness")
    soreness = latest.get("soreness")
    fatigue = latest.get("fatigue")
    readiness = latest.get("readiness")
    performance = latest.get("performance")

    titles = {
        "pain-limited": "Pain-Limited Check-in",
        "fatigue-limited": "Fatigue-Limited State",
        "soreness-limited": "Soreness-Limited State",
        "freshness-supported": "Freshness-Supported Day",
        "performance-supported": "Performance-Supported Day",
        "load-response signal": "Load-Response Signal",
        "irritation-response signal": "Irritation-Response Signal",
        "stable response": "Stable Response Day",
        "collecting": "Context Collecting",
    }
    signals = {
        "pain-limited": f"Pain is {_pretty(pain, 1)}, which is the dominant limiter in the latest check-in.",
        "fatigue-limited": f"Fatigue is {_pretty(fatigue, 1)} with readiness at {_pretty(readiness, 1)}.",
        "soreness-limited": f"Soreness is {_pretty(soreness, 1)}, making it the clearest recovery cost in the latest check-in.",
        "freshness-supported": f"Freshness is {_pretty(freshness, 1)} with readiness at {_pretty(readiness, 1)}.",
        "performance-supported": f"Performance is {_pretty(performance, 1)} while readiness is {_pretty(readiness, 1)}.",
        "load-response signal": f"Session load is {_pretty(latest.get('load'), 1)} and changed by {_pretty(deltas.get('load'), 1)} from the previous paired check-in.",
        "irritation-response signal": f"Pain changed by {_pretty(deltas.get('pain'), 1)} from the previous check-in.",
        "stable response": "Pain and readiness were broadly stable compared with the previous check-in.",
        "collecting": "No dominant response frame is stable yet; more paired logs will sharpen the read.",
    }
    if not latest.get("id"):
        return {"title": "Context Collecting", "signal": "No saved check-in is available yet.", "frame": "collecting"}
    return {"title": titles.get(frame, "Check-in Response"), "signal": signals.get(frame, "Current response context is collecting."), "frame": frame}


def app_checkin_evidence_summary(latest, previous, strongest):
    if not latest.get("id"):
        return "Check-in evidence is collecting because no saved check-in is available yet."

    pain_delta = latest.get("pain") - previous.get("pain") if previous else None
    load_delta = latest.get("load") - previous.get("load") if previous else None
    if previous and _finite(pain_delta) and abs(pain_delta) >= 1 and _finite(load_delta):
        direction = "increased" if pain_delta > 0 else "decreased"
        return (
            f"Pain {direction} by {pain_delta:+.1f} from the previous check-in, "
            f"while session load changed from {_pretty(previous.get('load'), 1)} to {_pretty(latest.get('load'), 1)}."
        )

    if strongest and strongest.get("r") is not None:
        p_text = app_p_value_text(strongest.get("pValue"))
        return (
            f"Current logs show a {strongest.get('strength', 'collecting').lower()} "
            f"{'positive' if strongest.get('r', 0) >= 0 else 'negative'} association between "
            f"{str(strongest.get('xLabel', 'the predictor')).lower()} and {str(strongest.get('yLabel', 'the outcome')).lower()} "
            f"across {len(strongest.get('points', []))} paired observations (r = {_pretty(strongest.get('r'), 2)}, p-value: {p_text})."
        )

    return (
        f"Readiness was {_pretty(latest.get('readiness'), 1)}, with pain {_pretty(latest.get('pain'), 1)}, "
        f"soreness {_pretty(latest.get('soreness'), 1)}, and fatigue {_pretty(latest.get('fatigue'), 1)}."
    )


def app_checkin_context(data, latest):
    context = app_selected_programme_context(data)
    session = latest.get("session") or {}
    return {
        **context,
        "sessionName": session.get("session_name") or "Session context is collecting.",
        "movementTypes": app_movement_summary(session),
        "exercises": app_exercise_detail_summary(session),
    }


def app_checkin_context_sentence(data, latest):
    context = app_checkin_context(data, latest)
    return f"{context['macroBlock']} / {context['trainingBlock']} / {context['week']} / {context['sessionName']}"


def app_checkin_interpretation(data, latest, previous, strongest, trend_insights, adaptation_insight, relationships):
    if not latest.get("id"):
        return "User interpretation is collecting because no saved check-in is available yet."

    frame = app_checkin_frame(latest, previous, strongest, trend_insights, adaptation_insight, relationships)
    context = app_checkin_context(data, latest)
    context_label = app_checkin_context_sentence(data, latest)
    pain = latest.get("pain")
    freshness = latest.get("freshness")
    soreness = latest.get("soreness")
    fatigue = latest.get("fatigue")
    readiness = latest.get("readiness")
    performance = latest.get("performance")
    load = latest.get("load")
    deltas = app_checkin_deltas(latest, previous)
    exercise_clause = "" if "collecting" in context["exercises"].lower() else f" The linked exercise detail is {context['exercises']}."
    change_parts = []
    for label, key in [("pain", "pain"), ("readiness", "readiness"), ("performance", "performance"), ("load", "load")]:
        if _finite(deltas.get(key)):
            change_parts.append(f"{label} {deltas[key]:+0.1f}")
    change_clause = f" Compared with the previous check-in, {'; '.join(change_parts)}." if change_parts else ""

    if frame == "pain-limited":
        lead = f"Today’s check-in suggests a pain-limited state: pain is {_pretty(pain, 1)} while soreness is {_pretty(soreness, 1)} and fatigue is {_pretty(fatigue, 1)}, leaving readiness at {_pretty(readiness, 1)}."
    elif frame == "fatigue-limited":
        lead = f"Today’s check-in suggests a fatigue-limited state rather than a pain-limited state: freshness is {_pretty(freshness, 1)} while soreness is {_pretty(soreness, 1)}, which places fatigue at {_pretty(fatigue, 1)} and readiness at {_pretty(readiness, 1)}."
    elif frame == "soreness-limited":
        lead = f"Today’s check-in points to a soreness-limited state: soreness is {_pretty(soreness, 1)} with pain at {_pretty(pain, 1)}, and that recovery cost is pulling readiness to {_pretty(readiness, 1)}."
    elif frame == "freshness-supported":
        lead = f"Today’s check-in suggests a freshness-supported state: freshness is {_pretty(freshness, 1)} while pain is {_pretty(pain, 1)} and soreness is {_pretty(soreness, 1)}, supporting readiness of {_pretty(readiness, 1)}."
    elif frame == "performance-supported":
        lead = f"Today’s check-in points to a performance-supported response: performance is {_pretty(performance, 1)} with readiness at {_pretty(readiness, 1)}, so output is holding against the current recovery state."
    elif frame == "load-response signal":
        lead = f"Today’s check-in suggests a load-response signal: linked session load is {_pretty(load, 1)}, pain is {_pretty(pain, 1)}, and readiness is {_pretty(readiness, 1)}."
    elif frame == "irritation-response signal":
        lead = f"Today’s check-in points to an irritation-response signal: pain is {_pretty(pain, 1)} after changing by {_pretty(deltas.get('pain'), 1)} from the previous check-in, with readiness now {_pretty(readiness, 1)}."
    elif frame == "stable response":
        lead = f"Today’s check-in suggests a stable response: pain is {_pretty(pain, 1)} and readiness is {_pretty(readiness, 1)}, with no large change from the previous check-in."
    else:
        lead = f"Today’s check-in is still collecting a clear response frame: pain is {_pretty(pain, 1)}, freshness is {_pretty(freshness, 1)}, soreness is {_pretty(soreness, 1)}, fatigue is {_pretty(fatigue, 1)}, and readiness is {_pretty(readiness, 1)}."

    return f"{lead}{change_clause} Because this check-in is linked to {context_label} with session load {_pretty(load, 1)}, it becomes evidence for how that session structure is affecting recovery and performance.{exercise_clause}"


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
        {"key": "soreness", "label": "Soreness", "value": _json_num(latest.get("soreness")), "tone": "risk"},
        {"key": "fatigue", "label": "Fatigue", "value": _json_num(latest.get("fatigue")), "tone": "risk"},
        {"key": "readiness", "label": "Readiness", "value": _json_num(latest.get("readiness")), "tone": "positive"},
    ]
    return {
        "type": "checkin_state_radar",
        "title": "Check-in State Radar",
        "xLabel": "State metric",
        "yLabel": "Score, 0-10",
        "axes": axes,
        "evidence": "Latest check-in state values are plotted on a 0-10 scale.",
        "emptyState": "Needs a saved check-in with pain, freshness, soreness, fatigue, and readiness.",
    }


def app_checkin_visual(latest, previous, strongest, metric_series, relationships, frame, ordered):
    if not latest.get("id"):
        return {"type": "checkin_state_radar", "title": "Check-in State Radar", "axes": [], "emptyState": "context collecting."}

    deltas = app_checkin_deltas(latest, previous)
    load_rel = app_checkin_load_relationship(relationships, strongest)

    if frame in ["fatigue-limited", "soreness-limited", "freshness-supported"]:
        return {
            "type": "readiness_decomposition_bar",
            "title": "Readiness Decomposition",
            "xLabel": "Contribution to readiness",
            "yLabel": "Freshness minus pain and soreness cost",
            "freshness": _json_num(latest.get("freshness")),
            "painCost": _json_num(_num(latest.get("pain")) / 2),
            "sorenessCost": _json_num(_num(latest.get("soreness")) / 2),
            "readiness": _json_num(latest.get("readiness")),
            "evidence": f"Readiness = {_pretty(latest.get('readiness'), 1)} from freshness {_pretty(latest.get('freshness'), 1)} minus pain and soreness cost.",
            "emptyState": "Needs freshness, pain, and soreness to decompose readiness.",
        }

    if previous and _finite(deltas.get("pain")) and abs(deltas["pain"]) >= 1:
        return {
            "type": "pain_delta_bar",
            "title": "Pain Delta Bar",
            "xLabel": "Check-in date",
            "yLabel": "Pain score",
            "bars": [
                {"label": _date_short(previous.get("date")), "date": previous.get("date"), "value": _json_num(previous.get("pain"))},
                {"label": _date_short(latest.get("date")), "date": latest.get("date"), "value": _json_num(latest.get("pain"))},
            ],
            "delta": _json_num(deltas["pain"]),
            "evidence": f"Irritation delta: {deltas['pain']:+.1f} pain score.",
            "emptyState": "Needs a previous check-in before pain delta can be displayed.",
        }

    if load_rel and len(load_rel.get("points", [])) >= 3:
        return {
            "type": "load_response_scatter",
            "title": load_rel.get("title") or "Load Response Scatter",
            "xLabel": load_rel.get("xLabel") or "Session load",
            "yLabel": load_rel.get("yLabel") or "Outcome",
            "points": [{"date": point.get("date"), "x": _json_num(point.get("x")), "y": _json_num(point.get("y"))} for point in load_rel.get("points", []) if _finite(point.get("x")) and _finite(point.get("y"))],
            "r": _json_num(load_rel.get("r")),
            "n": len(load_rel.get("points", [])),
            "pValueText": app_p_value_text(load_rel.get("pValue")),
            "evidence": f"r = {_pretty(load_rel.get('r'), 2)} / n = {len(load_rel.get('points', []))} / p-value: {app_p_value_text(load_rel.get('pValue'))}.",
            "emptyState": "Needs at least three paired load-response observations.",
        }

    if len(metric_series.get("performance", [])) >= 2 and len(metric_series.get("readiness", [])) >= 2:
        paired_count = min(len(metric_series.get("performance", [])), len(metric_series.get("readiness", [])))
        return {
            "type": "performance_readiness_dual_line",
            "title": "Performance and Readiness",
            "xLabel": "Date",
            "yLabel": "Score",
            "series": [
                app_chart_series(metric_series, "performance", "Performance", "#24883B", 6),
                app_chart_series(metric_series, "readiness", "Readiness", "#2D9A68", 6),
            ],
            "evidence": f"Recent performance and readiness are shown across {paired_count} stored observations.",
            "emptyState": "Needs at least two performance and readiness observations.",
        }

    if len(ordered) >= 3:
        return {
            "type": "block_state_small_multiples",
            "title": "Block State Small Multiples",
            "xLabel": "Date",
            "yLabel": "Metric value",
            "series": [
                app_chart_series(metric_series, "performance", "Performance", "#24883B", 6),
                app_chart_series(metric_series, "load", "Load", "#1F7A40", 6),
                app_chart_series(metric_series, "pain", "Pain", "#E13F32", 6),
                app_chart_series(metric_series, "fatigue", "Fatigue", "#6656E8", 6),
                app_chart_series(metric_series, "readiness", "Readiness", "#2D9A68", 6),
            ],
            "evidence": f"Block-state small multiples use the latest {min(len(ordered), 6)} stored observations per metric where available.",
            "emptyState": "Needs at least three stored check-ins for block-state small multiples.",
        }

    return app_checkin_state_radar(latest)


def app_build_checkin_review(data, ordered, rows_desc, metric_series, trend_insights, relationships, current_read, adaptation_insight):
    latest = rows_desc[0] if rows_desc else {}
    previous = ordered[-2] if len(ordered) >= 2 else None
    strongest = next(iter(sorted([item for item in relationships if item.get("r") is not None], key=lambda item: abs(item.get("r", 0)), reverse=True)), None)
    frame = app_checkin_frame(latest, previous, strongest, trend_insights, adaptation_insight, relationships)
    theme = app_checkin_theme(latest, previous, strongest, current_read, adaptation_insight, trend_insights, relationships)
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
    sessions = data.get("sessions") or []
    check_ins = data.get("checkIns") or []
    active_session = data.get("activeSession") or {}
    session_by_id = {session.get("id"): session for session in sessions}
    rows = []
    for check_in in check_ins:
        linked = session_by_id.get(check_in.get("linked_session_id"), active_session)
        exercises = linked.get("exercises", [])
        intents = [_num(exercise.get("intent_percent"), None) for exercise in exercises]
        intents = [value for value in intents if _finite(value)]
        row = {
            "id": check_in.get("id"),
            "date": check_in.get("check_in_datetime"),
            "checkIn": check_in,
            "session": linked,
            "load": app_session_load(linked),
            "volume": sum(app_get_volume(exercise) for exercise in exercises),
            "contacts": sum(_num(exercise.get("contacts")) for exercise in exercises),
            "reps": sum((_num(exercise.get("sets"), 1) or 1) * _num(exercise.get("reps")) for exercise in exercises),
            "duration": sum(_num(exercise.get("duration_minutes")) for exercise in exercises),
            "average_intent": app_mean(intents),
            "pain": _num(check_in.get("pain_score")),
            "freshness": _num(check_in.get("freshness_score")),
            "soreness": _num(check_in.get("soreness_score")),
            "fatigue": app_fatigue(check_in),
            "readiness": app_readiness(check_in),
            "performance": _num(check_in.get("performance_score")),
            "height_or_distance": _to_cm(
                check_in.get("height_or_distance"),
                check_in.get("height_or_distance_unit") or check_in.get("unit"),
            ),
            "ft": _to_seconds(check_in.get("ft"), check_in.get("ft_unit")),
            "gct": _to_seconds(check_in.get("gct"), check_in.get("gct_unit")),
            "sprint_time": _to_seconds(check_in.get("sprint_time"), check_in.get("sprint_time_unit")),
            "distance": _to_metres(
                check_in.get("distance"),
                check_in.get("distance_unit") or check_in.get("unit"),
            ),
            "bar_velocity": _num(check_in.get("bar_velocity"), None),
            "weight": _to_kg(check_in.get("weight"), check_in.get("weight_unit")),
            "rsi": app_rsi(check_in),
        }
        rows.append(row)
    ordered = sorted(rows, key=lambda item: _parse_dt(item.get("date")))
    rows_desc = sorted(rows, key=lambda item: _parse_dt(item.get("date")), reverse=True)
    latest = rows_desc[0] if rows_desc else {
        "checkIn": data.get("checkInDraft") or {},
        "session": active_session,
        "load": app_session_load(active_session),
        "pain": _num((data.get("checkInDraft") or {}).get("pain_score")),
        "freshness": _num((data.get("checkInDraft") or {}).get("freshness_score")),
        "soreness": _num((data.get("checkInDraft") or {}).get("soreness_score")),
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
        relationship["finding"] = f"{title} needs at least three matching logs." if r is None else f"{title} showed a {relationship['strength'].lower()} {'positive' if r >= 0 else 'negative'} association in stored logs."
        relationship["insight"] = app_build_relationship_insight(relationship)
        relationships.append(relationship)
    strongest = next(iter(sorted([item for item in relationships if item.get("r") is not None], key=lambda item: abs(item.get("r", 0)), reverse=True)), None)
    performance_trend = metric_stats["performance"].get("trend")
    load_trend = metric_stats["load"].get("trend")
    fatigue_trend = metric_stats["fatigue"].get("trend")
    irritation_trend = metric_stats["pain"].get("trend")
    adaptation_insight = app_build_adaptation_insight(ordered, performance_trend, load_trend, irritation_trend, fatigue_trend)
    likely_response_insight = app_build_likely_response_insight(ordered)
    avg_load = app_mean([row.get("load") for row in rows])
    insight_summaries = {section_id: app_build_insight_summary(section_id, trend_insights, relationships, adaptation_insight, likely_response_insight, latest, avg_load) for section_id in ["overview", "performance", "irritation", "recovery", "load", "adaptation", "likely_response", "metric_explorer"]}
    current_read = {"performance": trend_insights["performance"]["state"], "irritation": trend_insights["pain"]["state"], "fatigue": trend_insights["fatigue"]["state"], "adaptation": adaptation_insight["label"]}
    load_performance = next((item.get("r") for item in relationships if item.get("id") == "performance_load"), None)
    freshness_performance = next((item.get("r") for item in relationships if item.get("id") == "performance_freshness"), None)
    fatigue_performance = next((item.get("r") for item in relationships if item.get("id") == "performance_fatigue"), None)
    pain_load = next((item.get("r") for item in relationships if item.get("id") == "pain_load"), None)
    return {
        "rows": rows_desc,
        "latest": latest,
        "best": next(iter(sorted(rows, key=lambda item: item.get("performance", 0), reverse=True)), None),
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
    }
