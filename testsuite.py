"""
Smoke test for everything a user might see.

Run from the same folder as your logic file:
    python test_user_visible_outputs.py

The test tries to import logic_updated first, then logic.
It builds a realistic calendar, generates the full app output, then opens every
metric dashboard a user might select, including pain, fatigue, performance,
load, RSI, FT, GCT, sprint time, bar velocity, etc.
"""

import json
from pprint import pprint

try:
    import backend.logic as logic
except ImportError:
    import backend.logic as logic


# ----------------------------
# Assertions / display helpers
# ----------------------------


def assert_has_keys(name, obj, keys):
    missing = [key for key in keys if key not in obj]
    if missing:
        raise AssertionError(f"{name} missing keys: {missing}")


def print_section(title):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


def compact_dashboard_preview(dashboard):
    return {
        "metric": dashboard.get("metric"),
        "label": dashboard.get("metric_info", {}).get("label"),
        "category": dashboard.get("metric_info", {}).get("category"),
        "time_series_points": len(dashboard.get("time_series", [])),
        "rolling_metrics": dashboard.get("rolling_metrics"),
        "trend": dashboard.get("trend"),
        "calendar_marker_counts": {
            "highest_points": len(dashboard.get("calendar_markers", {}).get("highest_points", [])),
            "lowest_points": len(dashboard.get("calendar_markers", {}).get("lowest_points", [])),
            "largest_changes": len(dashboard.get("calendar_markers", {}).get("largest_changes", [])),
        },
        "relationship_count": len(dashboard.get("relationships", {})),
        "ranked_relationship_count": len(dashboard.get("ranked_relationships", [])),
        "scatterplot_count": len(dashboard.get("scatterplots", {})),
        "insight_count": len(dashboard.get("insights", [])),
    }


# ----------------------------
# Build realistic test calendar
# ----------------------------


def build_test_calendar():
    calendar = logic.create_training_calendar("User View Test Calendar")

    macro = logic.create_macro_block(
        "Elastic Development Macro Block",
        start_date="2026-05-01",
        end_date="2026-06-30",
    )

    block_1 = logic.create_block(
        "Accumulation Block",
        start_date="2026-05-01",
        end_date="2026-05-14",
    )

    block_2 = logic.create_block(
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

    logic.add_week_to_block(block_1, week_1)
    logic.add_week_to_block(block_1, week_2)
    logic.add_week_to_block(block_2, week_3)
    logic.add_block_to_macro_block(macro, block_1)
    logic.add_block_to_macro_block(macro, block_2)
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
            "check_in": {
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
            "check_in": {
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
            "check_in": {
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
            "check_in": {
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
            "check_in": {
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
            "check_in": {
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
        },
    ]

    for spec in session_specs:
        session = logic.create_training_session(
            session_name=spec["name"],
            session_datetime=spec["datetime"],
        )

        for exercise in spec["exercises"]:
            logic.add_exercise_to_session(session, exercise)

        logic.add_performance_to_session(session, spec["check_in"]["performance"])
        logic.add_session_to_week(spec["week"], session)

        pain_entry = logic.create_pain_entry(
            pain_score=spec["check_in"]["pain"],
            location="Left Patellar Tendon",
        )
        recovery_entry = logic.create_recovery_entry(
            freshness_score=spec["check_in"]["freshness"],
            soreness_score=spec["check_in"]["soreness"],
        )
        check_in = logic.create_check_in(
            check_in_datetime=spec["datetime"],
            pain_entry=pain_entry,
            recovery_entry=recovery_entry,
            performance_entry=spec["check_in"]["performance"],
            linked_session_id=session["session_id"],
        )
        logic.add_check_in_to_calendar(calendar, check_in)

    # Add one unassigned session to test session-only rows and calendar fallbacks.
    unassigned = logic.create_training_session(
        session_name="Unassigned Recovery Session",
        session_datetime="2026-05-22T10:00:00",
    )
    logic.add_exercise_to_session(
        unassigned,
        logic.create_exercise(
            logic.MovementType.ENDURANCE,
            "Easy Bike",
            duration_minutes=30,
            intent_percent=35,
        ),
    )
    logic.add_unassigned_session_to_calendar(calendar, unassigned)

    return calendar


# ----------------------------
# Main test
# ----------------------------


def main():
    calendar = build_test_calendar()
    logic.add_derived_values_to_calendar(calendar)

    print_section("1. GLOBAL OUTPUT SUMMARY")
    output_summary = logic.generate_output_summary(
        calendar,
        performance_metric="performance_score",
        end_datetime="2026-05-22T10:00:00",
    )

    assert_has_keys(
        "output_summary",
        output_summary,
        [
            "monitoring",
            "descriptive_statistics",
            "inferential_statistics",
            "insight_summary",
            "likely_response",
        ],
    )
    pprint(output_summary)

    print_section("2. VISUALISATION OUTPUT")
    visualisation = logic.generate_visualisation_output(calendar)

    assert_has_keys(
        "visualisation",
        visualisation,
        [
            "available_metrics",
            "visualisation_rows",
            "default_dashboards",
            "block_comparisons",
        ],
    )
    print("Available metrics:", list(visualisation["available_metrics"].keys()))
    print("Visualisation rows:", len(visualisation["visualisation_rows"]))
    print("Default dashboards:", list(visualisation["default_dashboards"].keys()))
    print("Block comparison groups:", list(visualisation["block_comparisons"].keys()))

    print_section("3. EVERY USER-SELECTABLE METRIC DASHBOARD")
    all_dashboard_previews = {}

    for metric_name in logic.METRIC_REGISTRY.keys():
        dashboard = logic.generate_metric_dashboard(calendar, metric_name)

        assert_has_keys(
            f"dashboard:{metric_name}",
            dashboard,
            [
                "metric",
                "metric_info",
                "related_metrics",
                "time_series",
                "rolling_metrics",
                "trend",
                "calendar_markers",
                "insights",
                "relationships",
                "ranked_relationships",
                "scatterplots",
            ],
        )

        preview = compact_dashboard_preview(dashboard)
        all_dashboard_previews[metric_name] = preview
        print(f"\n--- {metric_name} ---")
        pprint(preview)

    print_section("4. SPECIFIC USER SELECTION EXAMPLE: PAIN")
    pain_dashboard = logic.generate_metric_dashboard(calendar, "pain")
    pprint(pain_dashboard)

    print_section("5. SPECIFIC USER SELECTION EXAMPLE: PERFORMANCE SCORE")
    performance_dashboard = logic.generate_metric_dashboard(calendar, "performance_score")
    pprint(performance_dashboard)

    print_section("6. FULL APP OUTPUT")
    full_app_output = logic.generate_full_app_output(
        calendar,
        performance_metric="performance_score",
        end_datetime="2026-05-22T10:00:00",
    )
    assert_has_keys(
        "full_app_output",
        full_app_output,
        ["output_summary", "visualisation"],
    )
    print("Full app output keys:", full_app_output.keys())

    snapshot = {
        "output_summary": output_summary,
        "visualisation_summary": {
            "available_metrics": list(visualisation["available_metrics"].keys()),
            "visualisation_row_count": len(visualisation["visualisation_rows"]),
            "default_dashboards": list(visualisation["default_dashboards"].keys()),
            "block_comparisons": visualisation["block_comparisons"],
        },
        "all_dashboard_previews": all_dashboard_previews,
        "pain_dashboard": pain_dashboard,
        "performance_dashboard": performance_dashboard,
    }

    output_path = "user_visible_output_snapshot.json"
    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(snapshot, file, indent=2, default=str)

    print_section("PASS")
    print("All user-visible output surfaces generated successfully.")
    print(f"Saved snapshot to: {output_path}")


if __name__ == "__main__":
    main()
