from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any
import os
import json

from backend.services.ml_inference import (
    predict_power_consumption,
    detect_anomaly,
    generate_recommendation,
    models_loaded
)
from backend.database import get_db

router = APIRouter(prefix="/ml", tags=["Machine Learning & Digital Twin"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
REPORTS_DIR = os.path.join(BASE_DIR, 'reports')
TRAIN_SCRIPT = os.path.join(BASE_DIR, 'ml', 'training', 'train_models.py')

class PowerPredictRequest(BaseModel):
    outdoor_temp: float
    season_encoded: int
    hour: int
    is_weekend: int
    prev_energy: float
    appliance_type: str
    household_size: int

class AnomalyRequest(BaseModel):
    energy_consumption: float
    hour: int
    outdoor_temp: float

@router.get("/model-info")
async def get_model_info():
    """Returns information about the currently loaded ML models."""
    return {
        "models_loaded": models_loaded,
        "engine": "Scikit-Learn / SHAP",
        "version": "1.0.0"
    }

@router.get("/evaluation")
async def get_evaluation_metrics():
    """Returns the latest evaluation metrics from the reports directory."""
    try:
        with open(os.path.join(REPORTS_DIR, 'evaluation_report.json'), 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {"error": "Evaluation report not found. Run /train first."}

@router.post("/train")
async def trigger_training(background_tasks: BackgroundTasks):
    """Triggers the ML training pipeline in the background."""
    def run_training():
        os.system(f"source ../.venv/bin/activate && python3 {TRAIN_SCRIPT}")
    
    background_tasks.add_task(run_training)
    return {"status": "Training started in background."}

@router.post("/predict-power")
async def predict_power(req: PowerPredictRequest):
    """Predicts power consumption using the loaded model."""
    power_kw = predict_power_consumption(
        outdoor_temp=req.outdoor_temp,
        season_encoded=req.season_encoded,
        hour=req.hour,
        is_weekend=req.is_weekend,
        prev_energy=req.prev_energy,
        appliance_type=req.appliance_type,
        household_size=req.household_size
    )
    return {"predicted_power_kw": power_kw}

@router.post("/anomaly")
async def check_anomaly(req: AnomalyRequest):
    """Checks if the given usage is anomalous."""
    is_anomaly = detect_anomaly(
        energy_consumption=req.energy_consumption,
        hour=req.hour,
        outdoor_temp=req.outdoor_temp
    )
    return {"is_anomaly": is_anomaly}

@router.post("/recommend")
async def get_recommendations(req: PowerPredictRequest):
    """Returns SHAP-based recommendations to reduce energy consumption."""
    recs = generate_recommendation(
        outdoor_temp=req.outdoor_temp,
        season_encoded=req.season_encoded,
        hour=req.hour,
        is_weekend=req.is_weekend,
        prev_energy=req.prev_energy,
        appliance_type=req.appliance_type,
        household_size=req.household_size
    )
    return {"recommendations": recs}
