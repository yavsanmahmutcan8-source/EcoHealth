"""Scientific MET-based calorie calculation.

Formula:
    kcal = MET * weight_kg * duration_hours * sex_factor * age_factor

MET (Metabolic Equivalent of Task) is a per-activity multiplier (admin-tunable
on the Category model via `calorie_met`). Standard references:
    yoga ~2.5, walking ~3.5, hiking ~6.0, running ~9.8, cycling ~7.5, swimming ~8.0

Sex factor: male=1.0, female=0.95 (women burn ~5% fewer kcal at the same MET/weight).
Age factor: 1.0 below 50, decreasing 0.5% per year past 50 (RMR decline approximation).
"""
from typing import Optional


DEFAULT_MET = 4.0
DEFAULT_WEIGHT_KG = 70.0
DEFAULT_AGE = 30
DEFAULT_SEX = "male"


def _sex_factor(sex: Optional[str]) -> float:
    if not sex:
        return 1.0
    s = sex.strip().lower()
    if s in ("female", "f", "woman"):
        return 0.95
    return 1.0


def _age_factor(age: Optional[int]) -> float:
    if not age or age <= 50:
        return 1.0
    # 0.5% reduction per year past 50, floor 0.75
    return max(0.75, 1.0 - 0.005 * (age - 50))


def calculate_calories(
    *,
    met: Optional[float],
    weight_kg: Optional[float],
    duration_minutes: Optional[int],
    sex: Optional[str] = None,
    age: Optional[int] = None,
) -> float:
    """Return kcal burned. Falls back to safe defaults when any input is None/0."""
    met_v = met if (met and met > 0) else DEFAULT_MET
    weight = weight_kg if (weight_kg and weight_kg > 0) else DEFAULT_WEIGHT_KG
    minutes = duration_minutes if (duration_minutes and duration_minutes > 0) else 60
    hours = minutes / 60.0
    kcal = met_v * weight * hours * _sex_factor(sex) * _age_factor(age)
    return round(kcal, 1)
