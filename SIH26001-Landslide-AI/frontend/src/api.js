const API_BASE_URL = 'http://localhost:5000/api';
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
export const submitSosReport = async (payload) => {
  try {
    const res = await fetch(`${API_BASE_URL}/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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