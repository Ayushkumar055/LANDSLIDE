const API_BASE_URL = 'https://landslide-backend1.onrender.com/api';
const FASTAPI_URL = 'https://landslide-satellite-ai.onrender.com';

export const fetchHotspots = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/hotspots`);
    const data = await res.json();
    return data.data;
  } catch (err) {
    console.error('Failed to fetch hotspots:', err);
    return [];
  }
};

export async function fetchRoads() {
  try {
    const response = await fetch(`${API_BASE_URL}/roads`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch roads");
    }

    return data.data || [];
  } catch (error) {
    console.error("Road API error:", error);
    return [];
  }
}

export const predictRiskScore = async (payload) => {
  try {
    const res = await fetch(`${API_BASE_URL}/predict-risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error('Prediction API error:', err);
    return null;
  }
};

export const dispatchAlert = async (alertData) => {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertData)
    });
    return await res.json();
  } catch (err) {
    console.error('Alert dispatch error:', err);
    return null;
  }
};

export const fetchAlerts = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/alerts`);
    const data = await res.json();
    return data.alerts;
  } catch (err) {
    console.error('Failed to fetch alert logs:', err);
    return [];
  }
};

// ================= SAFE SHELTERS & EVACUATION LAYER =================
export const fetchShelters = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/shelters`);
    const data = await res.json();
    return data.data;
  } catch (err) {
    console.error('Failed to fetch shelters:', err);
    return [];
  }
};

// ================= LIVE WEATHER (Open-Meteo via backend) =================
export const fetchLiveWeather = async (lat, lng) => {
  try {
    const res = await fetch(`${API_BASE_URL}/live-weather?lat=${lat}&lng=${lng}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch live weather:', err);
    return null;
  }
};

// ================= CITIZEN SOS / COMMUNITY REPORTS =================
// Supports both FormData (with photo/video upload) and traditional JSON payload
export const submitSosReport = async (payload) => {
  try {
    const isFormData = payload instanceof FormData;

    const res = await fetch(`${API_BASE_URL}/sos`, {
      method: 'POST',
      // CRITICAL: FormData ke sath Content-Type header manually set nahi kiya jata
      headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
      body: isFormData ? payload : JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to submit SOS report:', err);
    return null;
  }
};

export const fetchSosReports = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/sos`);
    const data = await res.json();
    return data.reports;
  } catch (err) {
    console.error('Failed to fetch SOS reports:', err);
    return [];
  }
};

export const resolveSosReport = async (id) => {
  try {
    const res = await fetch(`${API_BASE_URL}/sos/${id}/resolve`, { method: 'PATCH' });
    return await res.json();
  } catch (err) {
    console.error('Failed to resolve SOS report:', err);
    return null;
  }
};

// ================= REAL IOT SENSOR HARDWARE (ESP32/Arduino field units) =================
export const fetchSensorNetwork = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/sensors/latest`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error('Failed to fetch live sensor network:', err);
    return [];
  }
};

export const fetchSensorHistory = async (deviceId) => {
  try {
    const res = await fetch(`${API_BASE_URL}/sensors/${deviceId}/history`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error('Failed to fetch sensor history:', err);
    return [];
  }
};

// ================= REAL SATELLITE IMAGERY ANALYSIS (FastAPI Engine) =================
export const fetchSatelliteNdvi = async (lat, lng) => {
  try {
    const res = await fetch(`${FASTAPI_URL}/detect/summary`);
    if (!res.ok) throw new Error("FastAPI engine returned error");
    const data = await res.json();

    return {
      success: true,
      source: "Copernicus CDSE Sentinel-2 L2A",
      scarsDetected: data.scars_detected,
      totalDamageHectares: data.total_estimated_damage_hectares,
      label: `Detected ${data.scars_detected} high-risk scar zone(s) with ${data.total_estimated_damage_hectares} ha area exposure.`,
      viewInBrowser: `${FASTAPI_URL}/dashboard`,
      detections: data.detections
    };
  } catch (err) {
    console.error('Failed to fetch live satellite data:', err);
    return {
      success: false,
      error: "Satellite service waking up or connecting. Please refresh in a moment."
    };
  }
};