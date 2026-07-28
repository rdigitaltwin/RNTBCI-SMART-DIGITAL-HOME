import os
import joblib
import numpy as np
import logging
import shap
import math
from datetime import datetime

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, 'ml', 'models')

import torch
from ml.training.lstm_model import EnergyLSTM

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, 'ml', 'models')

# Load models and scalers
try:
    energy_scaler = joblib.load(os.path.join(MODELS_DIR, 'energy_scaler.pkl'))
    appliance_encoder = joblib.load(os.path.join(MODELS_DIR, 'appliance_encoder.pkl'))
    anomaly_model = joblib.load(os.path.join(MODELS_DIR, 'anomaly_model.pkl'))
    
    energy_model = EnergyLSTM(input_size=7, hidden_size=64, num_layers=2)
    energy_model.load_state_dict(torch.load(os.path.join(MODELS_DIR, 'energy_lstm.pth'), map_location='cpu'))
    energy_model.eval()
    models_loaded = True
    logger.info("ML Models loaded successfully.")
except Exception as e:
    logger.warning(f"ML Models failed to load: {e}")
    models_loaded = False
    energy_model, energy_scaler, appliance_encoder, anomaly_model = None, None, None, None

# Stateful rolling buffer per appliance type for sequence generation
sequence_buffer = {}
SEQ_LEN = 12

def predict_power_consumption(outdoor_temp, season_encoded, hour, is_weekend, prev_energy, appliance_type, household_size):
    """Predicts power consumption in kWh using PyTorch LSTM."""
    if not models_loaded:
        return 0.0

    try:
        if appliance_type not in sequence_buffer:
            sequence_buffer[appliance_type] = []
            
        appliance_encoded = appliance_encoder.transform([appliance_type])[0] if appliance_type in appliance_encoder.classes_ else 0
        features = np.array([[outdoor_temp, season_encoded, hour, is_weekend, prev_energy, appliance_encoded, household_size]])
        features_scaled = energy_scaler.transform(features)[0] # Shape (7,)
        
        # Append to buffer
        sequence_buffer[appliance_type].append(features_scaled)
        if len(sequence_buffer[appliance_type]) > SEQ_LEN:
            sequence_buffer[appliance_type].pop(0)
            
        # If we don't have enough history, pad with the current frame
        seq = sequence_buffer[appliance_type].copy()
        while len(seq) < SEQ_LEN:
            seq.insert(0, features_scaled)
            
        # Convert to tensor: shape (1, seq_len, features)
        x_tensor = torch.tensor(np.array([seq]), dtype=torch.float32)
        
        with torch.no_grad():
            pred_kwh = energy_model(x_tensor).item()
        
        return max(0.0, pred_kwh)
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return 0.0

def detect_anomaly(energy_consumption, hour, outdoor_temp):
    """Returns True if the usage is an anomaly."""
    if not models_loaded or anomaly_model is None:
        return False
    
    try:
        features = np.array([[energy_consumption, hour, outdoor_temp]])
        pred = anomaly_model.predict(features)[0]
        return pred == -1  # Isolation forest returns -1 for anomalies
    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        return False

def generate_recommendation(outdoor_temp, season_encoded, hour, is_weekend, prev_energy, appliance_type, household_size):
    """Uses SHAP to explain power consumption and generate recommendations."""
    if not models_loaded or energy_model is None:
        return []
        
    try:
        appliance_encoded = appliance_encoder.transform([appliance_type])[0] if appliance_type in appliance_encoder.classes_ else 0
        
        # We simulate a "shap" style insight without calculating deep tensor gradients for latency
        # A true SHAP explainer for LSTMs can be intensive, so we use a fallback heuristic explanation based on inputs
        
        recs = []
        if outdoor_temp > 30 or outdoor_temp < 10:
            recs.append({
                "type": "efficiency",
                "priority": "high",
                "message": f"Extreme outside temperature ({outdoor_temp}°C) is increasing HVAC load. Consider adjusting thermostat.",
                "potential_savings_w": 150.0
            })
            
        # If it's a high consumption device
        if appliance_type in ["HVAC", "WATER_HEATER", "WASHING_MACHINE"]:
            recs.append({
                "type": "load_reduction",
                "priority": "medium",
                "message": f"High priority device ({appliance_type}) is active. Turn off if not needed.",
                "potential_savings_w": 200.0
            })
            
        return recs
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        return []

def predict_forecast_consumption(current_kw, hour_offset):
    """Predicts future consumption using a time-series model (or fallback to lagged inference)."""
    # For now, we simulate an LSTM/Forecasting output using our core model by shifting time
    target_hour = (datetime.now().hour + hour_offset) % 24
    outdoor_temp = 25 + 10 * math.sin((target_hour - 14) * math.pi / 12)
    
    # We call the core model simulating an average household
    return predict_power_consumption(outdoor_temp, 1, target_hour, 0, current_kw, "Average", 3)

