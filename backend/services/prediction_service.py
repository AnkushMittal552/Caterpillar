import random
from typing import Dict, Any, Optional
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

# 5 User-Supplied Benchmark Examples (preserved exactly as provided)
SUPPLIED_BENCHMARK_EXAMPLES = [
    {
        "task_id": "T001",
        "task_type": "Earth Excavation",
        "weather": "Sunny",
        "operator_skill": "Expert",
        "machine_age": 2,
        "estimated_time": 60,
        "actual_time": 58,
        "source": "SUPPLIED_SAMPLE",
    },
    {
        "task_id": "T002",
        "task_type": "Trenching",
        "weather": "Rainy",
        "operator_skill": "Intermediate",
        "machine_age": 4,
        "estimated_time": 45,
        "actual_time": 52,
        "source": "SUPPLIED_SAMPLE",
    },
    {
        "task_id": "T003",
        "task_type": "Material Loading",
        "weather": "Cloudy",
        "operator_skill": "Beginner",
        "machine_age": 3,
        "estimated_time": 30,
        "actual_time": 42,
        "source": "SUPPLIED_SAMPLE",
    },
    {
        "task_id": "T004",
        "task_type": "Grading",
        "weather": "Sunny",
        "operator_skill": "Expert",
        "machine_age": 5,
        "estimated_time": 35,
        "actual_time": 33,
        "source": "SUPPLIED_SAMPLE",
    },
    {
        "task_id": "T005",
        "task_type": "Demolition",
        "weather": "Windy",
        "operator_skill": "Intermediate",
        "machine_age": 6,
        "estimated_time": 90,
        "actual_time": 105,
        "source": "SUPPLIED_SAMPLE",
    },
]

TASK_TYPES = ["Earth Excavation", "Trenching", "Material Loading", "Grading", "Demolition"]
WEATHERS = ["Sunny", "Rainy", "Cloudy", "Windy"]
SKILLS = ["Expert", "Intermediate", "Beginner"]


def generate_synthetic_demo_dataset(seed: int = 42, num_samples: int = 120):
    """
    Generate deterministic synthetic demonstration dataset for model training.
    Clearly marked as SYNTHETIC_DEMO. Not field-validated CAT accuracy.
    """
    rng = random.Random(seed)
    synthetic_records = []

    # Base task durations
    base_durations = {
        "Earth Excavation": 55.0,
        "Trenching": 48.0,
        "Material Loading": 35.0,
        "Grading": 32.0,
        "Demolition": 95.0,
    }

    # Weather multipliers
    weather_multipliers = {
        "Sunny": 1.0,
        "Cloudy": 1.05,
        "Windy": 1.12,
        "Rainy": 1.20,
    }

    # Skill adjustments
    skill_adjustments = {
        "Expert": -0.08,
        "Intermediate": 0.05,
        "Beginner": 0.20,
    }

    for i in range(num_samples):
        tt = rng.choice(TASK_TYPES)
        w = rng.choice(WEATHERS)
        s = rng.choice(SKILLS)
        age = rng.randint(1, 10)

        base = base_durations[tt]
        w_mult = weather_multipliers[w]
        s_adj = skill_adjustments[s]
        age_adj = age * 0.015  # older machine slight degradation
        noise = rng.uniform(-2.5, 2.5)

        actual = (base * w_mult * (1.0 + s_adj + age_adj)) + noise
        actual = max(10.0, round(actual, 1))

        synthetic_records.append({
            "task_type": tt,
            "weather": w,
            "operator_skill": s,
            "machine_age": age,
            "actual_time": actual,
            "source": "SYNTHETIC_DEMO",
        })

    return synthetic_records


class TaskTimePredictionService:
    def __init__(self):
        self.model: Optional[Pipeline] = None
        self.is_trained = False
        self._initialize_and_train()

    def _initialize_and_train(self):
        # 1. Gather supplied rows + synthetic demo rows
        records = []
        for r in SUPPLIED_BENCHMARK_EXAMPLES:
            records.append({
                "task_type": r["task_type"],
                "weather": r["weather"],
                "operator_skill": r["operator_skill"],
                "machine_age": r["machine_age"],
                "actual_time": float(r["actual_time"]),
            })

        synthetic = generate_synthetic_demo_dataset(seed=42, num_samples=150)
        records.extend(synthetic)

        X = []
        y = []
        for r in records:
            X.append([r["task_type"], r["weather"], r["operator_skill"], float(r["machine_age"])])
            y.append(r["actual_time"])

        X = np.array(X, dtype=object)
        y = np.array(y, dtype=float)

        # 2. Categorical preprocessing + regressor pipeline
        categorical_features = [0, 1, 2]
        numeric_features = [3]

        preprocessor = ColumnTransformer(
            transformers=[
                ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), categorical_features),
                ("num", "passthrough", numeric_features),
            ]
        )

        pipeline = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                (
                    "regressor",
                    RandomForestRegressor(
                        n_estimators=50,
                        max_depth=8,
                        random_state=42,
                    ),
                ),
            ]
        )

        pipeline.fit(X, y)
        self.model = pipeline
        self.is_trained = True

    def predict(
        self,
        task_type: str,
        weather: str,
        operator_skill: str,
        machine_age: float,
        baseline_estimate: float,
        current_elapsed_minutes: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Predict task duration and compute variance and risk status against baseline estimate.
        """
        if not self.is_trained or self.model is None:
            return {
                "predicted_minutes": None,
                "baseline_estimate": baseline_estimate,
                "difference_minutes": None,
                "prediction_status": "UNAVAILABLE",
                "model": "random_forest_demo",
                "data_basis": "synthetic_demonstration_history",
            }

        # Validate inputs
        if (
            not task_type
            or not weather
            or not operator_skill
            or machine_age is None
            or baseline_estimate is None
            or baseline_estimate <= 0
        ):
            return {
                "predicted_minutes": None,
                "baseline_estimate": baseline_estimate,
                "difference_minutes": None,
                "prediction_status": "UNAVAILABLE",
                "model": "random_forest_demo",
                "data_basis": "synthetic_demonstration_history",
            }

        input_data = np.array([[task_type, weather, operator_skill, float(machine_age)]], dtype=object)
        pred_value = float(self.model.predict(input_data)[0])
        pred_value = round(pred_value, 1)

        diff = round(pred_value - baseline_estimate, 1)

        # Risk state evaluation:
        # AT_RISK if predicted materially exceeds planned (> 3 minutes over baseline)
        # DELAYED if current elapsed time already exceeds planned
        if current_elapsed_minutes is not None and current_elapsed_minutes > baseline_estimate:
            status = "DELAYED"
        elif diff >= 3.0:
            status = "AT_RISK"
        else:
            status = "ON_TRACK"

        return {
            "predicted_minutes": pred_value,
            "baseline_estimate": baseline_estimate,
            "difference_minutes": diff,
            "prediction_status": status,
            "model": "random_forest_demo",
            "data_basis": "synthetic_demonstration_history",
        }


prediction_service = TaskTimePredictionService()
