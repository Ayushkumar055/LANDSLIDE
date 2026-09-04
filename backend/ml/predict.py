import sys
import json
import os
import joblib
import pandas as pd


# ==========================================
# LOAD TRAINED MODEL
# ==========================================

MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "landslide_model.pkl"
)


try:
    model = joblib.load(MODEL_PATH)

except Exception as error:

    print(json.dumps({
        "success": False,
        "error": f"Failed to load ML model: {str(error)}"
    }))

    sys.exit(1)


# ==========================================
# READ INPUT FROM NODE.JS
# ==========================================

try:

    # Node.js JSON data receives through command line
    input_data = json.loads(sys.argv[1])

except Exception:

    print(json.dumps({
        "success": False,
        "error": "Invalid prediction input"
    }))

    sys.exit(1)


# ==========================================
# EXTRACT FEATURES
# ==========================================

try:

    rainfall = float(input_data.get("rainfall", 0))

    slope = float(input_data.get("slope", 0))

    soil_moisture = float(
        input_data.get("soil_moisture", 0)
    )

    elevation = float(
        input_data.get("elevation", 0)
    )

except Exception:

    print(json.dumps({
        "success": False,
        "error": "Invalid feature values"
    }))

    sys.exit(1)


# ==========================================
# CREATE MODEL INPUT
# ==========================================

features = pd.DataFrame(
    [[
        rainfall,
        slope,
        soil_moisture,
        elevation
    ]],

    columns=[
        "rainfall",
        "slope",
        "soil_moisture",
        "elevation"
    ]
)


# ==========================================
# PREDICT
# ==========================================

try:

    prediction = model.predict(features)[0]

    probabilities = model.predict_proba(features)[0]

    # Probability of landslide class (1)
    probability = float(probabilities[1]) * 100


except Exception as error:

    print(json.dumps({
        "success": False,
        "error": f"Prediction failed: {str(error)}"
    }))

    sys.exit(1)


# ==========================================
# DETERMINE RISK LEVEL
# ==========================================

if probability >= 85:

    risk_level = "CRITICAL"

elif probability >= 65:

    risk_level = "HIGH"

elif probability >= 40:

    risk_level = "MODERATE"

else:

    risk_level = "LOW"


# ==========================================
# GENERATE RESPONSE
# ==========================================

result = {

    "success": True,

    "prediction": int(prediction),

    "landslide_probability": round(
        probability,
        2
    ),

    "risk_level": risk_level,

    "input": {

        "rainfall": rainfall,

        "slope": slope,

        "soil_moisture": soil_moisture,

        "elevation": elevation

    }

}


# ==========================================
# SEND JSON OUTPUT TO NODE.JS
# ==========================================

print(
    json.dumps(result)
)