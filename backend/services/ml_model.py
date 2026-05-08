from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MLScore:
    score: int
    reason: str


def isolation_forest_score(feature_rows: list[list[float]], target_row: list[float]) -> MLScore | None:
    """Optional Isolation Forest scoring.

    The production API uses deterministic rules immediately. When scikit-learn is
    installed and enough audit history exists, this helper can add an ML signal.
    """
    if len(feature_rows) < 50:
        return None
    try:
        from sklearn.ensemble import IsolationForest
    except ImportError:
        return None

    model = IsolationForest(contamination=0.08, random_state=42)
    model.fit(feature_rows)
    prediction = model.predict([target_row])[0]
    if prediction == -1:
        return MLScore(score=35, reason="isolation forest anomaly")
    return MLScore(score=0, reason="normal")
