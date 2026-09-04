import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os

# ==========================================
# LANDSLIDE DATASET
# ==========================================

# Features:
# rainfall       = rainfall in mm
# slope          = terrain slope in degrees
# soil_moisture  = percentage
# elevation      = elevation in meters
#
# landslide:
# 0 = Low risk / No landslide
# 1 = Landslide risk

data = {
    "rainfall": [
        10, 20, 35, 15, 45,
        60, 75, 80, 95, 110,
        120, 140, 160, 180, 200,
        220, 250, 280, 300, 320,
        25, 40, 55, 70, 85,
        100, 130, 150, 190, 230
    ],

    "slope": [
        5, 8, 10, 7, 12,
        15, 18, 20, 22, 25,
        28, 30, 35, 38, 40,
        42, 45, 48, 50, 55,
        6, 9, 14, 17, 21,
        26, 32, 36, 43, 52
    ],

    "soil_moisture": [
        20, 25, 30, 22, 35,
        40, 45, 50, 55, 60,
        65, 70, 75, 80, 85,
        88, 90, 92, 95, 98,
        28, 32, 38, 42, 48,
        58, 68, 78, 88, 96
    ],

    "elevation": [
        100, 150, 200, 120, 250,
        300, 350, 400, 450, 500,
        600, 700, 800, 900, 1000,
        1100, 1200, 1300, 1400, 1500,
        180, 220, 280, 330, 390,
        550, 750, 950, 1150, 1450
    ],

    "landslide": [
        0, 0, 0, 0, 0,
        0, 0, 0, 1, 1,
        1, 1, 1, 1, 1,
        1, 1, 1, 1, 1,
        0, 0, 0, 0, 0,
        1, 1, 1, 1, 1
    ]
}

# ==========================================
# CREATE DATAFRAME
# ==========================================

df = pd.DataFrame(data)

print("\n==========================================")
print("LANDSLIDE AI - MODEL TRAINING")
print("==========================================\n")

print("Dataset Preview:")
print(df.head())

print("\nTotal Records:", len(df))

# ==========================================
# INPUT FEATURES AND TARGET
# ==========================================

X = df[
    [
        "rainfall",
        "slope",
        "soil_moisture",
        "elevation"
    ]
]

y = df["landslide"]

# ==========================================
# SPLIT DATASET
# ==========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.25,
    random_state=42,
    stratify=y
)

# ==========================================
# CREATE RANDOM FOREST MODEL
# ==========================================

model = RandomForestClassifier(
    n_estimators=200,
    random_state=42,
    max_depth=8
)

# ==========================================
# TRAIN MODEL
# ==========================================

print("\n🤖 Training Random Forest Model...\n")

model.fit(X_train, y_train)

# ==========================================
# TEST MODEL
# ==========================================

predictions = model.predict(X_test)

accuracy = accuracy_score(
    y_test,
    predictions
)

print(f"Model Accuracy: {accuracy * 100:.2f}%")

print("\nClassification Report:\n")

print(
    classification_report(
        y_test,
        predictions,
        zero_division=0
    )
)

# ==========================================
# SAVE MODEL
# ==========================================

model_path = os.path.join(
    os.path.dirname(__file__),
    "landslide_model.pkl"
)

joblib.dump(model, model_path)

print("\n==========================================")
print("✅ MODEL TRAINING COMPLETED")
print("==========================================")

print(f"\nModel saved at:\n{model_path}")

# ==========================================
# TEST SAMPLE PREDICTION
# ==========================================

sample = pd.DataFrame(
    [[180, 40, 85, 1000]],
    columns=[
        "rainfall",
        "slope",
        "soil_moisture",
        "elevation"
    ]
)

prediction = model.predict(sample)[0]

probability = model.predict_proba(sample)[0][1] * 100

print("\nSample Prediction:")

print(
    f"Risk Probability: {probability:.2f}%"
)

if prediction == 1:
    print("Risk Level: HIGH / LANDSLIDE POSSIBLE")
else:
    print("Risk Level: LOW")