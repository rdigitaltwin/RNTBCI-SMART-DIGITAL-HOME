import pandas as pd
import numpy as np
import os
import joblib
from datetime import datetime

# Correct paths based on the script being in ml/preprocessing/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
DOCS_DIR = os.path.join(BASE_DIR, 'docs')
ML_DIR = os.path.join(BASE_DIR, 'ml')
DATA_DIR = os.path.join(ML_DIR, 'data')
MODELS_DIR = os.path.join(ML_DIR, 'models')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

def load_data():
    csv_path = os.path.join(DOCS_DIR, 'smart_home_energy_consumption_large.csv')
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}")
    print(f"Loading {csv_path}...")
    df = pd.read_csv(csv_path)
    return df

def preprocess(df):
    print("Preprocessing data...")
    # Convert date and time to datetime
    df['Datetime'] = pd.to_datetime(df['Date'] + ' ' + df['Time'])
    df = df.sort_values(by=['Home ID', 'Datetime']).reset_index(drop=True)

    # Time features
    df['Hour'] = df['Datetime'].dt.hour
    df['Day'] = df['Datetime'].dt.day
    df['Month'] = df['Datetime'].dt.month
    df['DayOfWeek'] = df['Datetime'].dt.dayofweek
    df['Is_Weekend'] = df['DayOfWeek'].isin([5, 6]).astype(int)

    # Convert Season to numeric
    season_map = {'Spring': 0, 'Summer': 1, 'Fall': 2, 'Winter': 3}
    if 'Season' in df.columns:
        df['Season_Encoded'] = df['Season'].map(season_map)

    # Handle missing values
    for col in df.select_dtypes(include=[np.number]).columns:
        df[col] = df[col].fillna(df[col].median())
        
    for col in df.select_dtypes(include=['object']).columns:
        df[col] = df[col].fillna(df[col].mode()[0])

    # Feature Engineering: Lags
    # Calculate previous consumption per Home ID and Appliance
    df['Prev_Energy'] = df.groupby(['Home ID', 'Appliance Type'])['Energy Consumption (kWh)'].shift(1)
    df['Prev_Energy'] = df['Prev_Energy'].fillna(0) # For the first record

    return df

def save_master(df):
    master_path = os.path.join(DATA_DIR, 'master_dataset.csv')
    print(f"Saving master dataset to {master_path}...")
    df.to_csv(master_path, index=False)
    print("Master dataset saved successfully.")

if __name__ == "__main__":
    df = load_data()
    df_clean = preprocess(df)
    save_master(df_clean)
    print(f"Master dataset shape: {df_clean.shape}")
    print("Columns:", df_clean.columns.tolist())
