"""
Rendered visual smoke test for the training analytics logic.

Run from the same folder as logic.py:
    python visual_test.py

This creates a realistic test calendar, calls the user-selectable dashboard
functions, then saves actual PNG charts to ./visual_outputs.
"""

import os
from datetime import datetime

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

try:
    import logic as logic
except ImportError:
    import logic


OUTPUT_DIR = "visual_outputs"


# ----------------------------
# Test calendar builder
# ----------------------------


def build_test_calendar():
    calendar = logic.create_training_calendar("Rendered Visual Test Calendar")

    macro = logic.create_macro_block(
        "Elastic Development Macro Block",
        start_date="2026-05-01",
        end_date="2026-06-30",
    )

    accumulation = logic.create_block(
        "Accumulation Block",
        start_date="2026-05-01",
        end_date="2026-05-14",
    )

    intensification = logic.create_block(
        "Intensification Block",
        start_date="2026-05-15",
        end_date="2026-05-31",
    )

    week_1 = logic.create_training_week(
        "Week 1 - Rebuild",
        start_date="2026-05-04",
        end_date="2026-05-10",
    )

    week_2 = logic.create_training_week(
        "Week 2 - Higher Intent",
        start_date="2026-05-11",
        end_date="2026-05-17",
    )

    week_3 = logic.create_training_week(
        "Week 3 - Intensification",
        start_date="2026-05-18",
        end_date="2026-05-24",
    )

    logic.add_week_to_block(accumulation, week_1)
    logic.add_week_to_block(accumulation, week_2)
    logic.add_week_to_block(intensification, week_3)
    logic.add_block_to_macro_block(macro, accumulation)
    logic.add_block_to_macro_block(macro, intensification)
    logic.add_macro_block_to_calendar(calendar, macro)

    session_specs = [
        {
            "week": week_1,
            "name": "Jump Reintroduction",
            "datetime": "2026-05-04T10:00:00",
            "exercises": [
                logic.create_exercise(
                    logic.MovementType.PLYOMETRIC,
                    "Approach Jumps",
                    contacts=14,
                    intent_percent=82,
                ),
                logic.create_exercise(
                    logic.MovementType.STRENGTH,
                    "Half Squat",
                    reps=8,
                    intensity_value=120,
                    intensity_unit=logic.IntensityUnit.KG,
                    rom=logic.ROMType.HALF,
                ),
            ],
            "pain": 3,
            "freshness": 6,
            "soreness": 5,
            "performance": logic.create_performance_entry(
                logic.PerformanceType.JUMPING,
                performance_score=6.5,
                gct=0.31,
                ft=0.76,
                height_or_distance=34,
                unit="inches",
            ),
        },
        {
            "week": week_1,
            "name": "Sprint Exposure",
            "datetime": "2026-05-07T10:00:00",
            "exercises": [
                logic.create_exercise(
                    logic.MovementType.SKILL,
                    "Acceleration Runs",
                    duration_minutes=22,
                    intent_percent=78,
                ),
                logic.create_exercise(
                    logic.MovementType.ENDURANCE,
                    "Bike Flush",
                    duration_minutes=18,
                    intent_percent=45,
                ),
            ],
            "pain": 2,
            "freshness": 7,
            "soreness": 4,
            "performance": logic.create_performance_entry(
                logic.PerformanceType.RUNNING_SPRINTING,
                performance_score=7.0,
                time=4.05,
                distance=30,
                unit="m",
            ),
        },
        {
            "week": week_2,
            "name": "Reactive Plyo Day",
            "datetime": "2026-05-11T10:00:00",
            "exercises": [
                logic.create_exercise(
                    logic.MovementType.PLYOMETRIC,
                    "Depth Jumps",
                    contacts=16,
                    intent_percent=92,
                ),
                logic.create_exercise(
                    logic.MovementType.POWER_BALLISTIC,
                    "Jump Squat",
                    reps=12,
                    intensity_value=35,
                    intensity_unit=logic.IntensityUnit.KG,
                    intent_percent=88,
                ),
            ],
            "pain": 2,
            "freshness": 8,
            "soreness": 3,
            "performance": logic.create_performance_entry(
                logic.PerformanceType.JUMPING,
                performance_score=8.0,
                gct=0.28,
                ft=0.80,
                height_or_distance=38,
                unit="inches",
            ),
        },
        {
            "week": week_2,
            "name": "Strength-Speed Lift",
            "datetime": "2026-05-14T10:00:00",
            "exercises": [
                logic.create_exercise(
                    logic.MovementType.STRENGTH,
                    "Quarter Squat",
                    reps=6,
                    intensity_value=150,
                    intensity_unit=logic.IntensityUnit.KG,
                    rom=logic.ROMType.PARTIAL,
                ),
                logic.create_exercise(
                    logic.MovementType.POWER_BALLISTIC,
                    "Power Clean",
                    reps=10,
                    intensity_value=75,
                    intensity_unit=logic.IntensityUnit.PERCENT,
                    intent_percent=91,
                ),
            ],
            "pain": 3,
            "freshness": 7,
            "soreness": 4,
            "performance": logic.create_performance_entry(
                logic.PerformanceType.LIFT,
                performance_score=7.5,
                lift_name="Power Clean",
                weight=80,
                sets=5,
                reps=2,
                bar_velocity=1.25,
            ),
        },
        {
            "week": week_3,
            "name": "Max Jump Day",
            "datetime": "2026-05-18T10:00:00",
            "exercises": [
                logic.create_exercise(
                    logic.MovementType.PLYOMETRIC,
                    "Max Approach Jumps",
                    contacts=22,
                    intent_percent=98,
                ),
                logic.create_exercise(
                    logic.MovementType.POWER_BALLISTIC,
                    "Reactive Jump Squat",
                    reps=15,
                    intensity_value=40,
                    intensity_unit=logic.IntensityUnit.KG,
                    intent_percent=95,
                ),
            ],
            "pain": 4,
            "freshness": 8,
            "soreness": 3,
            "performance": logic.create_performance_entry(
                logic.PerformanceType.JUMPING,
                performance_score=9.0,
                gct=0.26,
                ft=0.83,
                height_or_distance=41,
                unit="inches",
            ),
        },
        {
            "week": week_3,
            "name": "Fatigued Follow-Up",
            "datetime": "2026-05-20T10:00:00",
            "exercises": [
                logic.create_exercise(
                    logic.MovementType.SKILL,
                    "Low Intensity Shooting",
                    duration_minutes=35,
                    intent_percent=55,
                ),
                logic.create_exercise(
                    logic.MovementType.ENDURANCE,
                    "Bike Flush",
                    duration_minutes=25,
                    intent_percent=40,
                ),
            ],
            "pain": 5,
            "freshness": 5,
            "soreness": 6,
            "performance": logic.create_performance_entry(
                logic.PerformanceType.JUMPING,
                performance_score=6.8,
                gct=0.32,
                ft=0.75,
                height_or_distance=33,
                unit="inches",
            ),
        },
    ]

    for spec in session_specs:
        session = logic.create_training_session(
            session_name=spec["name"],
            session_datetime=spec["datetime"],
        )
        for exercise in spec["exercises"]:
            logic.add_exercise_to_session(session, exercise)
        logic.add_performance_to_session(session, spec["performance"])
        logic.add_session_to_week(spec["week"], session)

        pain_entry = logic.create_pain_entry(spec["pain"], "Left Patellar Tendon")
        recovery_entry = logic.create_recovery_entry(spec["freshness"], spec["soreness"])
        check_in = logic.create_check_in(
            check_in_datetime=spec["datetime"],
            pain_entry=pain_entry,
            recovery_entry=recovery_entry,
            performance_entry=spec["performance"],
            linked_session_id=session["session_id"],
        )
        logic.add_check_in_to_calendar(calendar, check_in)

    return calendar


# ----------------------------
# Plot helpers
# ----------------------------


def ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def parse_dates(rows):
    return [datetime.fromisoformat(row["datetime"]) for row in rows]


def save_line_chart(dashboard, filename, title=None):
    rows = dashboard.get("time_series", [])
    rows = [row for row in rows if row.get("value") is not None]
    if not rows:
        return None

    dates = parse_dates(rows)
    values = [row["value"] for row in rows]
    label = dashboard.get("metric_info", {}).get("label", dashboard.get("metric"))

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(dates, values, marker="o")
    ax.set_title(title or f"{label} over time")
    ax.set_xlabel("Date")
    ax.set_ylabel(label)
    ax.tick_params(axis="x", rotation=35)

    for row, date, value in zip(rows, dates, values):
        if row.get("session_name"):
            ax.annotate(
                row["session_name"],
                (date, value),
                textcoords="offset points",
                xytext=(0, 7),
                ha="center",
                fontsize=7,
            )

    fig.tight_layout()
    path = os.path.join(OUTPUT_DIR, filename)
    fig.savefig(path, dpi=160)
    plt.close(fig)
    return path


def save_scatter_chart(dashboard, scatter_key, filename, title=None):
    scatterplots = dashboard.get("scatterplots", {})
    rows = scatterplots.get(scatter_key, [])
    rows = [row for row in rows if row.get("x") is not None and row.get("y") is not None]
    if not rows:
        return None

    x_values = [row["x"] for row in rows]
    y_values = [row["y"] for row in rows]
    x_metric = rows[0].get("x_metric", "x")
    y_metric = rows[0].get("y_metric", "y")

    fig, ax = plt.subplots(figsize=(7, 5))
    ax.scatter(x_values, y_values)
    ax.set_title(title or f"{x_metric} vs {y_metric}")
    ax.set_xlabel(x_metric)
    ax.set_ylabel(y_metric)

    for row in rows:
        if row.get("session_name"):
            ax.annotate(row["session_name"], (row["x"], row["y"]), fontsize=7)

    fig.tight_layout()
    path = os.path.join(OUTPUT_DIR, filename)
    fig.savefig(path, dpi=160)
    plt.close(fig)
    return path


def save_block_comparison_chart(visualisation, filename):
    rows = visualisation.get("block_comparisons", {}).get("by_week", [])
    rows = [row for row in rows if row.get("performance_score_mean") is not None]
    if not rows:
        return None

    labels = [row["group_name"] for row in rows]
    values = [row["performance_score_mean"] for row in rows]

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.bar(labels, values)
    ax.set_title("Mean performance score by week")
    ax.set_xlabel("Week")
    ax.set_ylabel("Mean performance score")
    ax.tick_params(axis="x", rotation=25)
    fig.tight_layout()

    path = os.path.join(OUTPUT_DIR, filename)
    fig.savefig(path, dpi=160)
    plt.close(fig)
    return path


def save_user_selected_metric_set(calendar, metric_name):
    dashboard = logic.generate_metric_dashboard(calendar, metric_name)
    saved = []

    line_path = save_line_chart(
        dashboard,
        f"{metric_name}_time_series.png",
        title=f"User selected: {metric_name}",
    )
    if line_path:
        saved.append(line_path)

    for index, scatter_key in enumerate(list(dashboard.get("scatterplots", {}).keys())[:2], start=1):
        scatter_path = save_scatter_chart(
            dashboard,
            scatter_key,
            f"{metric_name}_scatter_{index}_{scatter_key}.png",
        )
        if scatter_path:
            saved.append(scatter_path)

    return saved


# ----------------------------
# Main visual test
# ----------------------------


def main():
    ensure_output_dir()

    calendar = build_test_calendar()
    logic.add_derived_values_to_calendar(calendar)
    visualisation = logic.generate_visualisation_output(calendar)

    saved_files = []

    for metric_name in [
        "pain",
        "performance_score",
        "session_load",
        "fatigue",
        "readiness",
        "ft",
        "gct",
        "rsi",
    ]:
        saved_files.extend(save_user_selected_metric_set(calendar, metric_name))

    block_path = save_block_comparison_chart(
        visualisation,
        "weekly_performance_comparison.png",
    )
    if block_path:
        saved_files.append(block_path)

    print("Rendered visual test complete.")
    print(f"Output folder: {OUTPUT_DIR}")
    print("Files:")
    for path in saved_files:
        print(f"- {path}")


if __name__ == "__main__":
    main()
