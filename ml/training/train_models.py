import pandas as pd
import numpy as np
import os
import joblib
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.model_selection import train_test_split
from sklearn.ensemble import IsolationForest
from ml.training.lstm_model import EnergyLSTM, create_dataloaders
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, accuracy_score, f1_score
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score, accuracy_score, f1_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
ML_DIR = os.path.join(BASE_DIR, 'ml')
DATA_DIR = os.path.join(ML_DIR, 'data')
MODELS_DIR = os.path.join(ML_DIR, 'models')
REPORTS_DIR = os.path.join(BASE_DIR, 'reports')

os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

def load_master_dataset():
    path = os.path.join(DATA_DIR, 'master_dataset.csv')
    return pd.read_csv(path)

def train_energy_consumption_predictor(df):
    print("Training Energy Consumption Predictor...")
    # Features: Outdoor Temperature, Season, Hour, Is_Weekend, Prev_Energy, Appliance
    le = LabelEncoder()
    df['Appliance_Encoded'] = le.fit_transform(df['Appliance Type'])
    joblib.dump(le, os.path.join(MODELS_DIR, 'appliance_encoder.pkl'))

    features = ['Outdoor Temperature (\u00b0C)', 'Season_Encoded', 'Hour', 'Is_Weekend', 'Prev_Energy', 'Appliance_Encoded', 'Household Size']
    target = 'Energy Consumption (kWh)'

    # Handle missing features just in case
    X = df[features].fillna(0)
    y = df[target]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    joblib.dump(scaler, os.path.join(MODELS_DIR, 'energy_scaler.pkl'))

    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y.values, test_size=0.2, random_state=42)

    train_loader, val_loader = create_dataloaders(X_train, y_train, seq_len=12, batch_size=128)

    model = EnergyLSTM(input_size=len(features), hidden_size=64, num_layers=2)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model.to(device)
    
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    print("Starting LSTM training...")
    epochs = 5 # Just 5 epochs for quick turnaround in this demo
    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for seq, target in train_loader:
            seq, target = seq.to(device), target.to(device)
            optimizer.zero_grad()
            out = model(seq).squeeze()
            loss = criterion(out, target)
            loss.backward()
            optimizer.step()
            train_loss += loss.item()
        
        # Validation
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for seq, target in val_loader:
                seq, target = seq.to(device), target.to(device)
                out = model(seq).squeeze()
                loss = criterion(out, target)
                val_loss += loss.item()
                
        print(f"Epoch {epoch+1}/{epochs} | Train Loss: {train_loss/len(train_loader):.4f} | Val Loss: {val_loss/len(val_loader):.4f}")

    # Final test evaluation
    # For simplicity in this script, we'll evaluate on a subset of the test split
    test_loader, _ = create_dataloaders(X_test, y_test, seq_len=12, batch_size=128)
    model.eval()
    all_preds = []
    all_targets = []
    with torch.no_grad():
        for seq, target in test_loader:
            seq = seq.to(device)
            out = model(seq).squeeze()
            all_preds.extend(out.cpu().numpy())
            all_targets.extend(target.numpy())
            
    mse = mean_squared_error(all_targets, all_preds)
    mae = mean_absolute_error(all_targets, all_preds)
    r2 = r2_score(all_targets, all_preds)

    print(f"Energy LSTM Predictor - MSE: {mse:.4f}, MAE: {mae:.4f}, R2: {r2:.4f}")
    
    torch.save(model.state_dict(), os.path.join(MODELS_DIR, 'energy_lstm.pth'))
    return {"MSE": mse, "MAE": mae, "R2": r2}

def train_anomaly_detection(df):
    print("Training Anomaly Detection Model...")
    # We use IsolationForest to detect anomalies in Energy Consumption based on context
    features = ['Energy Consumption (kWh)', 'Hour', 'Outdoor Temperature (\u00b0C)']
    X = df[features].fillna(0)

    model = IsolationForest(contamination=0.01, random_state=42)
    model.fit(X)

    joblib.dump(model, os.path.join(MODELS_DIR, 'anomaly_model.pkl'))
    print("Anomaly model trained and saved.")

def train_models():
    df = load_master_dataset()
    
    metrics = {}
    metrics['Energy_Predictor'] = train_energy_consumption_predictor(df)
    train_anomaly_detection(df)
    
    # Save metrics
    with open(os.path.join(REPORTS_DIR, 'evaluation_report.json'), 'w') as f:
        json.dump(metrics, f, indent=4)
        
    print("All models trained successfully.")

if __name__ == "__main__":
    train_models()
