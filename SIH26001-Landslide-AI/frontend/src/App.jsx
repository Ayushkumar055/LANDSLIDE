import { useMemo, useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import {
  fetchHotspots,
  predictRiskScore,
  dispatchAlert,
  fetchAlerts,
  fetchShelters,
  fetchLiveWeather,
  submitSosReport,
  fetchSosReports,
} from "./api";
import { exportAlertsToCSV, printIncidentReport } from "./exportUtils";
import { playEmergencySiren, speakEmergencyAdvisory } from "./audioUtils";

const defaultLocations = [
  { name: "Aizawl", state: "Mizoram", lat: 23.7271, lng: 92.7176, rainfall: 142, slope: 43, soil: "High", elevation: 1132 },
  { name: "Gangtok", state: "Sikkim", lat: 27.3389, lng: 88.6065, rainfall: 118, slope: 39, soil: "High", elevation: 1650 },
  { name: "Itanagar", state: "Arunachal Pradesh", lat: 27.0844, lng: 93.6053, rainfall: 104, slope: 36, soil: "Moderate", elevation: 750 },
  { name: "Shillong Ridge", state: "Meghalaya", lat: 25.5788, lng: 91.8933, rainfall: 96, slope: 31, soil: "Moderate", elevation: 1496 },
  { name: "Kohima Bypass", state: "Nagaland", lat: 25.6751, lng: 94.1086, rainfall: 82, slope: 27, soil: "Moderate", elevation: 1261 },
  { name: "Tawang Pass", state: "Arunachal Pradesh", lat: 27.5861, lng: 91.8594, rainfall: 125, slope: 48, soil: "Low", elevation: 3048 },
  { name: "Guwahati Hills", state: "Assam", lat: 26.1445, lng: 91.7362, rainfall: 73, slope: 18, soil: "Low", elevation: 55 }
];

function calculateRisk(location) {
  const rainfallScore = Math.min(((location.rainfall || location.baseRainfall || 0) / 160) * 100, 100);
  const slopeScore = Math.min((location.slope / 45) * 100, 100);
  const soilScore =
    (location.soil || location.soilStability) === "High"
      ? 100
      : (location.soil || location.soilStability) === "Moderate"
      ? 60
      : 25;

  const score = Math.round(rainfallScore * 0.4 + slopeScore * 0.35 + soilScore * 0.25);

  let level = "LOW";
  if (score >= 80) level = "CRITICAL";
  else if (score >= 60) level = "HIGH";
  else if (score >= 40) level = "MODERATE";

  return {
    ...location,
    rainfall: location.rainfall || location.baseRainfall || 0,
    soil: location.soil || location.soilStability || "Moderate",
    risk: score,
    level,
    rainfallScore: Math.round(rainfallScore),
    slopeScore: Math.round(slopeScore),
    soilScore,
  };
}

function getRiskColor(risk) {
  if (typeof risk === "string") {
    if (risk === "CRITICAL") return "#ff304f";
    if (risk === "HIGH") return "#ff8a00";
    if (risk === "MODERATE") return "#ffd400";
    return "#22c55e";
  }
  if (risk >= 80) return "#ff304f";
  if (risk >= 60) return "#ff8a00";
  if (risk >= 40) return "#ffd400";
  return "#22c55e";
}

// Haversine distance between two lat/lng points, in kilometers
function getDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getRiskMessage(level) {
  if (level === "CRITICAL") return "Immediate attention recommended. Multiple risk factors are elevated.";
  if (level === "HIGH") return "Elevated landslide probability detected. Close monitoring recommended.";
  if (level === "MODERATE") return "Moderate risk detected. Continue monitoring rainfall and terrain conditions.";
  return "Current conditions indicate relatively low landslide susceptibility.";
}

function MapController({ location }) {
  const map = useMap();
  useEffect(() => {
    if (!location || !location.lat || !location.lng) return;
    map.flyTo([location.lat, location.lng], 8, { duration: 1.2 });
  }, [location, map]);
  return null;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [locationsList, setLocationsList] = useState(defaultLocations.map(calculateRisk));
  const [selected, setSelected] = useState(defaultLocations.map(calculateRisk)[0]);
  const [mapMode, setMapMode] = useState("risk");
  const [alerts, setAlerts] = useState([]);
  const [warningIssued, setWarningIssued] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  // Safe Shelters & Evacuation Layer
  const [shelters, setShelters] = useState([]);
  const [showEvacRoute, setShowEvacRoute] = useState(true);

  // Live Weather (Open-Meteo)
  const [liveWeather, setLiveWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Citizen SOS / Community Reports
  const [sosReports, setSosReports] = useState([]);
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosSubmitting, setSosSubmitting] = useState(false);
  const [sosSubmitted, setSosSubmitted] = useState(false);
  const [sosForm, setSosForm] = useState({ reporterName: "", issueType: "Road Crack", description: "" });

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminUser, setAdminUser] = useState({ name: "Officer In-Charge", role: "NDRF / SDMA Desk" });
  const [loginForm, setLoginForm] = useState({ officerId: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // Simulation States
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulatedRainfall, setSimulatedRainfall] = useState(selected.rainfall);
  const [liveRiskScore, setLiveRiskScore] = useState(selected.risk);
  const [liveRiskLevel, setLiveRiskLevel] = useState(selected.level);
  const [riskHistory, setRiskHistory] = useState([
    Math.max(selected.risk - 10, 0),
    Math.max(selected.risk - 7, 0),
    Math.max(selected.risk - 5, 0),
    Math.max(selected.risk - 3, 0),
    Math.max(selected.risk - 2, 0),
    selected.risk,
  ]);

  useEffect(() => {
    const initApp = async () => {
      try {
        const backendHotspots = await fetchHotspots();
        if (backendHotspots && backendHotspots.length > 0) {
          const parsed = backendHotspots.map(calculateRisk);
          setLocationsList(parsed);
          setSelected(parsed[0]);
          setSimulatedRainfall(parsed[0].rainfall);
          setLiveRiskScore(parsed[0].risk);
          setLiveRiskLevel(parsed[0].level);
          setBackendOnline(true);
        }

        const backendAlerts = await fetchAlerts();
        if (backendAlerts && backendAlerts.length > 0) {
          setAlerts(backendAlerts);
        }

        const backendShelters = await fetchShelters();
        if (backendShelters && backendShelters.length > 0) {
          setShelters(backendShelters);
        }

        const backendSosReports = await fetchSosReports();
        if (backendSosReports && backendSosReports.length > 0) {
          setSosReports(backendSosReports);
        }
      } catch {
        setBackendOnline(false);
      }
    };
    initApp();
  }, []);

  // Reset live weather reading whenever the selected monitoring location changes
  useEffect(() => {
    setLiveWeather(null);
  }, [selected]);

  // Nearest safe shelter to the currently selected location
  const nearestShelter = useMemo(() => {
    if (!shelters.length || !selected) return null;
    let closest = null;
    let minDist = Infinity;
    shelters.forEach((shelter) => {
      const dist = getDistanceKm(selected.lat, selected.lng, shelter.lat, shelter.lng);
      if (dist < minDist) {
        minDist = dist;
        closest = shelter;
      }
    });
    return closest ? { ...closest, distanceKm: Math.round(minDist * 10) / 10 } : null;
  }, [shelters, selected]);

  async function handleFetchLiveWeather() {
    setWeatherLoading(true);
    const result = await fetchLiveWeather(selected.lat, selected.lng);
    setWeatherLoading(false);
    if (result && result.success) {
      setLiveWeather(result);
      const livePrediction = await predictRiskScore({
        rainfall: result.rainfall24hMm,
        slope: selected.slope,
        soilStability: selected.soil,
      });
      if (livePrediction && livePrediction.success) {
        setSimulatedRainfall(result.rainfall24hMm);
        setLiveRiskScore(livePrediction.riskScore);
        setLiveRiskLevel(livePrediction.riskLevel);
        setRiskHistory((prev) => [...prev.slice(-9), livePrediction.riskScore]);
      }
    }
  }

  async function handleSosSubmit(e) {
    e.preventDefault();
    if (!sosForm.description.trim()) return;

    setSosSubmitting(true);
    const payload = {
      reporterName: sosForm.reporterName || "Anonymous Citizen",
      location: `${selected.name}, ${selected.state}`,
      lat: selected.lat,
      lng: selected.lng,
      issueType: sosForm.issueType,
      description: sosForm.description,
    };

    const response = await submitSosReport(payload);
    setSosSubmitting(false);

    if (response && response.success) {
      setSosReports((current) => [response.report, ...current]);
      setSosSubmitted(true);
      setSosForm({ reporterName: "", issueType: "Road Crack", description: "" });
      setTimeout(() => {
        setSosSubmitted(false);
        setShowSosModal(false);
      }, 1800);
    }
  }

  useEffect(() => {
    setSimulationRunning(false);
    setSimulatedRainfall(selected.rainfall);
    setLiveRiskScore(selected.risk);
    setLiveRiskLevel(selected.level);
    setRiskHistory([
      Math.max(selected.risk - 10, 0),
      Math.max(selected.risk - 7, 0),
      Math.max(selected.risk - 5, 0),
      Math.max(selected.risk - 3, 0),
      Math.max(selected.risk - 2, 0),
      selected.risk,
    ]);
  }, [selected]);

  // Simulation Engine with Auto Audio Alert
  useEffect(() => {
    if (!simulationRunning) return;

    const interval = setInterval(async () => {
      const nextRainfall = Math.min(simulatedRainfall + Math.floor(Math.random() * 6) + 2, 160);
      setSimulatedRainfall(nextRainfall);

      const result = await predictRiskScore({
        rainfall: nextRainfall,
        slope: selected.slope,
        soilStability: selected.soil
      });

      if (result && result.success) {
        setLiveRiskScore(result.riskScore);
        setLiveRiskLevel(result.riskLevel);
        setRiskHistory((prev) => [...prev.slice(-9), result.riskScore]);

        // Auto trigger audio if crosses Critical (80)
        if (result.riskScore >= 80 && liveRiskScore < 80) {
          if (typeof playEmergencySiren === "function") {
            playEmergencySiren();
          }
          if (typeof speakEmergencyAdvisory === "function") {
            speakEmergencyAdvisory(selected.name, "CRITICAL", result.riskScore);
          }
        }
      }
    }, 1800);

    return () => clearInterval(interval);
  }, [simulationRunning, selected, simulatedRainfall, liveRiskScore]);

  const criticalCount = locationsList.filter((l) => l.level === "CRITICAL").length;
  const highCount = locationsList.filter((l) => l.level === "HIGH").length;

  function getMarkerValue(location) {
    if (mapMode === "rainfall") return location.rainfall;
    if (mapMode === "terrain") return location.slope;
    return location.risk;
  }

  function getMarkerColor(location) {
    if (mapMode === "rainfall") {
      if (location.rainfall >= 120) return "#ff304f";
      if (location.rainfall >= 90) return "#ff8a00";
      if (location.rainfall >= 70) return "#ffd400";
      return "#22c55e";
    }
    if (mapMode === "terrain") {
      if (location.slope >= 38) return "#ff304f";
      if (location.slope >= 30) return "#ff8a00";
      if (location.slope >= 20) return "#ffd400";
      return "#22c55e";
    }
    return getRiskColor(location.risk);
  }

  async function issueEarlyWarning() {
    const alertData = {
      location: `${selected.name}, ${selected.state}`,
      level: liveRiskLevel,
      score: liveRiskScore,
      rainfall: Math.round(simulatedRainfall),
      type: liveRiskLevel.toLowerCase(),
      title: `Landslide Risk Alert - ${liveRiskLevel}`,
    };

    // Play Siren & Voice Broadcast
    if (typeof playEmergencySiren === "function") {
      playEmergencySiren();
    }
    if (typeof speakEmergencyAdvisory === "function") {
      speakEmergencyAdvisory(selected.name, liveRiskLevel, liveRiskScore);
    }

    const response = await dispatchAlert(alertData);
    if (response && response.success) {
      setAlerts((current) => [response.alert, ...current]);
    }

    setWarningIssued(true);
    setTimeout(() => setWarningIssued(false), 2500);
  }

  // Handle Login Action
  function handleLogin(e) {
    e.preventDefault();
    if (!loginForm.officerId || !loginForm.password) {
      setLoginError("Please enter Officer ID and Access Code");
      return;
    }
    // Demo authentication check
    setIsAuthenticated(true);
    setAdminUser({
      name: loginForm.officerId.toUpperCase(),
      role: "SDMA Chief Controller"
    });
    setShowAuthModal(false);
    setLoginForm({ officerId: "", password: "" });
    setLoginError("");
  }

  function handleLogout() {
    setIsAuthenticated(false);
    setAdminUser({ name: "Guest User", role: "Monitoring View" });
  }

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">⛰</div>
          <div>
            <h1>Landslide<span>AI</span></h1>
            <p>EARLY WARNING SYSTEM</p>
          </div>
        </div>

        <div className="system-status">
          <span className="status-dot" style={{ background: backendOnline ? "#22c55e" : "#ff8a00" }}></span>
          <div>
            <strong>{backendOnline ? "Backend Connected" : "System Operational"}</strong>
            <small>{backendOnline ? "Express API active" : "AI monitoring active"}</small>
          </div>
        </div>

        <nav>
          <button className={`nav-item ${currentTab === "dashboard" ? "active" : ""}`} onClick={() => setCurrentTab("dashboard")}>
            <span>▦</span> Dashboard
          </button>
          <button className={`nav-item ${currentTab === "monitoring" ? "active" : ""}`} onClick={() => setCurrentTab("monitoring")}>
            <span>◉</span> Risk Monitoring
          </button>
          <button className={`nav-item ${currentTab === "warnings" ? "active" : ""}`} onClick={() => setCurrentTab("warnings")}>
            <span>⚠</span> Early Warnings <b>{alerts.length}</b>
          </button>
          <button className={`nav-item ${currentTab === "analytics" ? "active" : ""}`} onClick={() => setCurrentTab("analytics")}>
            <span>⌁</span> Analytics
          </button>
          <button className={`nav-item ${currentTab === "history" ? "active" : ""}`} onClick={() => setCurrentTab("history")}>
            <span>◫</span> Historical Data
          </button>
          <button className={`nav-item ${currentTab === "mobileapp" ? "active" : ""}`} onClick={() => setCurrentTab("mobileapp")}>
            <span>📱</span> Get Mobile App
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="ai-card">
            <div className="ai-title"><span>✦</span> AI ENGINE</div>
            <strong>Risk Prediction Engine</strong>
            <p>Multi-factor risk assessment</p>
            <div className="accuracy"><span>Model confidence</span><strong>Prototype</strong></div>
          </div>

          {/* ================= USER / ADMIN BOX ================= */}
          <div
            className="user-box"
            onClick={() => {
              if (isAuthenticated) {
                if (window.confirm("Do you want to log out of Disaster Management Authority?")) {
                  handleLogout();
                }
              } else {
                setShowAuthModal(true);
              }
            }}
            style={{
              cursor: "pointer",
              border: isAuthenticated ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)",
              background: isAuthenticated ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)",
              transition: "all 0.2s ease"
            }}
            title={isAuthenticated ? "Click to Log Out" : "Click to Login as Authority"}
          >
            <div className="avatar" style={{ background: isAuthenticated ? "#22c55e" : "#38bdf8", color: "#0b111e", fontWeight: "bold" }}>
              {isAuthenticated ? "✓" : "A"}
            </div>
            <div>
              <strong>{isAuthenticated ? adminUser.name : "Admin Login"}</strong>
              <small style={{ color: isAuthenticated ? "#22c55e" : "#7f91a8" }}>
                {isAuthenticated ? adminUser.role : "Click to Authenticate"}
              </small>
            </div>
            <span style={{ fontSize: "12px", color: isAuthenticated ? "#ff304f" : "#38bdf8" }}>
              {isAuthenticated ? "⏻" : "➔"}
            </span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">NORTH EASTERN REGION • INDIA</p>
            <h2>
              {currentTab === "dashboard" && "Landslide Risk Monitoring"}
              {currentTab === "monitoring" && "Geospatial Risk Monitoring Network"}
              {currentTab === "warnings" && "Early Warning & Disaster Broadcast Log"}
              {currentTab === "analytics" && "Susceptibility & Telemetry Analytics"}
              {currentTab === "history" && "Geological Landslide Event Archive"}
            </h2>
          </div>
          <div className="top-actions">
            <div className="live"><span></span>LIVE MONITORING</div>
            <button className="icon-btn" onClick={() => setCurrentTab("warnings")}>🔔</button>
            <div className="date"><strong>24 AUG 2026</strong><small>22:32 IST</small></div>
          </div>
        </header>

        {/* VIEW 1: DASHBOARD */}
        {currentTab === "dashboard" && (
          <>
            <section className="stats">
              <div className="stat-card" onClick={() => setCurrentTab("monitoring")} style={{ cursor: "pointer" }}>
                <div className="stat-icon red">⚠</div>
                <div><span>CRITICAL ZONES</span><strong>{String(criticalCount).padStart(2, "0")}</strong><small>AI detected</small></div>
              </div>
              <div className="stat-card" onClick={() => setCurrentTab("monitoring")} style={{ cursor: "pointer" }}>
                <div className="stat-icon orange">◉</div>
                <div><span>HIGH RISK AREAS</span><strong>{String(highCount).padStart(2, "0")}</strong><small>Across NER</small></div>
              </div>
              <div className="stat-card" onClick={() => setCurrentTab("monitoring")} style={{ cursor: "pointer" }}>
                <div className="stat-icon blue">⌁</div>
                <div><span>ACTIVE MONITORING</span><strong>{String(locationsList.length).padStart(2, "0")}</strong><small>Locations monitored</small></div>
              </div>
              <div className="stat-card" onClick={() => setCurrentTab("warnings")} style={{ cursor: "pointer" }}>
                <div className="stat-icon green">✓</div>
                <div><span>ALERTS ISSUED</span><strong>{String(alerts.length).padStart(2, "0")}</strong><small>Current session</small></div>
              </div>
            </section>

            <section className="dashboard-grid">
              <div className="panel map-panel">
                <div className="panel-header">
                  <div><h3>Regional Risk Map</h3><p>AI-powered landslide susceptibility monitoring</p></div>
                  <div className="map-controls">
                    <button className={`control ${mapMode === "risk" ? "active" : ""}`} onClick={() => setMapMode("risk")}>Risk</button>
                    <button className={`control ${mapMode === "rainfall" ? "active" : ""}`} onClick={() => setMapMode("rainfall")}>Rainfall</button>
                    <button className={`control ${mapMode === "terrain" ? "active" : ""}`} onClick={() => setMapMode("terrain")}>Terrain</button>
                    <button className={`control ${showEvacRoute ? "active" : ""}`} onClick={() => setShowEvacRoute((s) => !s)}>Shelters</button>
                  </div>
                </div>

                <div className="map-wrapper">
                  <MapContainer center={[25.7, 92.5]} zoom={6} scrollWheelZoom={true} className="map">
                    <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapController location={selected} />
                    {locationsList.map((location) => {
                      const markerColor = getMarkerColor(location);
                      const markerValue = getMarkerValue(location);
                      return (
                        <CircleMarker
                          key={location.name}
                          center={[location.lat, location.lng]}
                          radius={location.risk >= 70 ? 15 : 11}
                          pathOptions={{ color: markerColor, fillColor: markerColor, fillOpacity: 0.65, weight: 2 }}
                          eventHandlers={{ click: () => setSelected(location) }}
                        >
                          <Popup>
                            <strong>{location.name}</strong><br />{location.state}<br />
                            {mapMode === "risk" && `Risk: ${markerValue}/100`}
                            {mapMode === "rainfall" && `Rainfall: ${markerValue} mm`}
                            {mapMode === "terrain" && `Slope: ${markerValue}°`}
                          </Popup>
                        </CircleMarker>
                      );
                    })}

                    {showEvacRoute && shelters.map((shelter) => (
                      <CircleMarker
                        key={`shelter-${shelter.id || shelter.name}`}
                        center={[shelter.lat, shelter.lng]}
                        radius={7}
                        pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.85, weight: 1.5 }}
                      >
                        <Popup>
                          <strong>🏠 {shelter.name}</strong><br />
                          {shelter.type} • {shelter.state}<br />
                          Capacity: {shelter.capacity} people
                        </Popup>
                      </CircleMarker>
                    ))}

                    {showEvacRoute && nearestShelter && (selected.level === "CRITICAL" || selected.level === "HIGH") && (
                      <Polyline
                        positions={[[selected.lat, selected.lng], [nearestShelter.lat, nearestShelter.lng]]}
                        pathOptions={{ color: "#22c55e", weight: 3, dashArray: "8, 8" }}
                      />
                    )}
                  </MapContainer>

                  <div className="map-legend">
                    <strong>{mapMode.toUpperCase()}</strong>
                    <span><i className="critical"></i> Critical</span>
                    <span><i className="high"></i> High</span>
                    <span><i className="moderate"></i> Moderate</span>
                    <span><i className="low"></i> Low</span>
                    <span><i className="low" style={{ background: "#22c55e" }}></i> Shelter</span>
                  </div>
                </div>
              </div>

              {/* AI RISK ANALYSIS */}
              <div className="panel risk-panel">
                <div className="panel-header">
                  <div><h3>AI Risk Analysis</h3><p>Selected monitoring location</p></div>
                  <span className="ai-badge">AI</span>
                </div>

                <div className="location">
                  <div className="location-icon">⌖</div>
                  <div><strong>{selected.name}</strong><span>{selected.state}</span></div>
                </div>

                <div className="risk-score">
                  <div className="score-ring" style={{ "--score": `${liveRiskScore * 3.6}deg`, "--risk-color": getRiskColor(liveRiskScore) }}>
                    <div><strong>{liveRiskScore}</strong><span>/100</span></div>
                  </div>
                  <div>
                    <span className="risk-label">CURRENT RISK</span>
                    <h4 style={{ color: getRiskColor(liveRiskScore) }}>{liveRiskLevel}</h4>
                    <p>Prototype risk engine</p>
                  </div>
                </div>

                <div className="factors">
                  <div className="factor">
                    <div><span>🌧 Rainfall</span><strong>{Math.round(simulatedRainfall)} mm</strong></div>
                    <div className="progress"><span style={{ width: `${Math.min((simulatedRainfall / 160) * 100, 100)}%` }}></span></div>
                  </div>
                  <div className="factor">
                    <div><span>⛰ Terrain Slope</span><strong>{selected.slope}°</strong></div>
                    <div className="progress"><span style={{ width: `${selected.slopeScore}%` }}></span></div>
                  </div>
                  <div className="factor">
                    <div><span>🌍 Soil Stability</span><strong>{selected.soil}</strong></div>
                    <div className="progress"><span style={{ width: `${selected.soilScore}%` }}></span></div>
                  </div>
                  <div className="factor">
                    <div><span>🏔 Elevation</span><strong>{selected.elevation} m</strong></div>
                    <div className="progress"><span style={{ width: `${Math.min(selected.elevation / 20, 100)}%` }}></span></div>
                  </div>
                </div>

                {nearestShelter && (
                  <div style={{ margin: "0 16px 14px", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(34,197,94,.3)", background: "rgba(34,197,94,.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <strong style={{ color: "#22c55e", fontSize: "11px" }}>🏠 Nearest Safe Shelter</strong>
                        <div style={{ fontSize: "13px", fontWeight: "bold", marginTop: "3px" }}>{nearestShelter.name}</div>
                        <small style={{ color: "#7f91a8" }}>{nearestShelter.type} • Capacity {nearestShelter.capacity}</small>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong style={{ color: "#22c55e", fontSize: "16px" }}>{nearestShelter.distanceKm} km</strong>
                        <div style={{ fontSize: "7px", color: "#5d6873", letterSpacing: "0.5px" }}>STRAIGHT-LINE DIST.</div>
                      </div>
                    </div>
                    {(selected.level === "CRITICAL" || selected.level === "HIGH") && (
                      <div style={{ marginTop: "8px", fontSize: "10px", color: "#42d5ac" }}>
                        ● Evacuation route active on map
                      </div>
                    )}
                  </div>
                )}

                <div style={{ margin: "0 16px 14px", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(56,189,248,.25)", background: "rgba(56,189,248,.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: "11px", color: "#38bdf8" }}>🌐 Live Satellite Weather</strong>
                      <small style={{ color: "#7f91a8" }}>
                        {liveWeather ? `Open-Meteo • ${new Date(liveWeather.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Fetch real-time rainfall for this station"}
                      </small>
                    </div>
                    {liveWeather && (
                      <strong style={{ color: "#38bdf8", fontSize: "16px" }}>{liveWeather.rainfall24hMm} mm</strong>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchLiveWeather}
                    disabled={weatherLoading}
                    style={{
                      width: "100%", padding: "9px 12px", borderRadius: "8px", cursor: weatherLoading ? "wait" : "pointer",
                      border: "1px solid rgba(56,189,248,.35)", background: "rgba(56,189,248,.12)", color: "#38bdf8", fontWeight: 700, fontSize: "11px"
                    }}
                  >
                    {weatherLoading ? "Fetching live feed..." : liveWeather ? "↻ Refresh Live Weather" : "⤓ Fetch Live Weather (Open-Meteo)"}
                  </button>
                </div>

                <div style={{ marginBottom: "14px", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(34,197,94,.18)", background: simulationRunning ? "rgba(34,197,94,.07)" : "rgba(255,255,255,.02)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div>
                      <strong style={{ display: "block" }}>Live Risk Simulation</strong>
                      <small style={{ color: "#7f91a8" }}>Environmental conditions changing in real time</small>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: simulationRunning ? "#22c55e" : "#7f91a8" }}>
                      {simulationRunning ? "RUNNING" : "READY"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSimulationRunning((r) => !r)}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
                      border: "1px solid rgba(34,197,94,.3)",
                      background: simulationRunning ? "rgba(255,48,79,.12)" : "rgba(34,197,94,.08)",
                      color: simulationRunning ? "#ff304f" : "#22c55e", fontWeight: 800
                    }}
                  >
                    {simulationRunning ? "■ Stop Live Simulation" : "▶ Start Live Risk Simulation"}
                  </button>
                </div>

                <div className="warning-box">
                  <div className="warning-icon">⚠</div>
                  <div>
                    <strong>{liveRiskLevel === "LOW" ? "Routine Monitoring" : "Early Warning Recommended"}</strong>
                    <p>{getRiskMessage(liveRiskLevel)}</p>
                  </div>
                </div>

                <button className="warning-btn" onClick={issueEarlyWarning}>
                  {warningIssued ? "✓ Warning Issued & Dispatched" : "⚠ Issue Early Warning"}
                </button>
              </div>
            </section>
          </>
        )}

        {/* VIEW 2: RISK MONITORING */}
        {currentTab === "monitoring" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="panel" style={{ padding: "20px" }}>
              <div style={{ marginBottom: "16px" }}>
                <h3 style={{ fontSize: "18px", color: "#38bdf8" }}>All North-Eastern Monitoring Stations</h3>
                <p style={{ color: "#7f91a8", fontSize: "13px" }}>Geological multi-station telemetry across 8 NER states</p>
              </div>

              <div style={{ height: "450px", borderRadius: "10px", overflow: "hidden", marginBottom: "20px" }}>
                <MapContainer center={[25.7, 92.5]} zoom={6.5} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
                  <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {locationsList.map((loc) => (
                    <CircleMarker
                      key={loc.name}
                      center={[loc.lat, loc.lng]}
                      radius={loc.risk >= 70 ? 18 : 12}
                      pathOptions={{ color: getRiskColor(loc.risk), fillColor: getRiskColor(loc.risk), fillOpacity: 0.65 }}
                      eventHandlers={{ click: () => setSelected(loc) }}
                    >
                      <Popup>
                        <strong>{loc.name}, {loc.state}</strong><br />
                        Risk: {loc.risk}/100 ({loc.level})<br />
                        Rainfall: {loc.rainfall} mm | Slope: {loc.slope}°
                      </Popup>
                    </CircleMarker>
                  ))}
                  {shelters.map((shelter) => (
                    <CircleMarker
                      key={`mon-shelter-${shelter.id || shelter.name}`}
                      center={[shelter.lat, shelter.lng]}
                      radius={6}
                      pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.85, weight: 1.5 }}
                    >
                      <Popup>
                        <strong>🏠 {shelter.name}</strong><br />
                        {shelter.type} • Capacity {shelter.capacity}
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                {locationsList.map((loc) => (
                  <div
                    key={loc.name}
                    onClick={() => { setSelected(loc); setCurrentTab("dashboard"); }}
                    style={{
                      padding: "14px", borderRadius: "8px", background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${selected.name === loc.name ? "#38bdf8" : "rgba(255,255,255,0.08)"}`,
                      cursor: "pointer", transition: "all 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{loc.name}</strong>
                      <span style={{ fontSize: "11px", fontWeight: "bold", padding: "2px 8px", borderRadius: "4px", background: getRiskColor(loc.risk), color: "#0b111e" }}>
                        {loc.level}
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#7f91a8", marginTop: "4px" }}>{loc.state}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "12px" }}>
                      <span>Rain: <b>{loc.rainfall}mm</b></span>
                      <span>Slope: <b>{loc.slope}°</b></span>
                      <span>Risk: <b style={{ color: getRiskColor(loc.risk) }}>{loc.risk}%</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: EARLY WARNINGS */}
        {currentTab === "warnings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="panel" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ fontSize: "18px", color: "#ff304f" }}>🚨 Early Warning & Disaster Broadcast Logs</h3>
                  <p style={{ color: "#7f91a8", fontSize: "13px" }}>Dispatches forwarded to NDRF, SDRF, and SMS Disaster Relay</p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => exportAlertsToCSV(alerts)} style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#e2e8f0", fontWeight: "600", cursor: "pointer", fontSize: "13px" }}>📥 Export CSV</button>
                  <button onClick={() => printIncidentReport(alerts)} style={{ padding: "9px 14px", borderRadius: "8px", border: "1px solid rgba(56,189,248,0.3)", background: "rgba(56,189,248,0.1)", color: "#38bdf8", fontWeight: "600", cursor: "pointer", fontSize: "13px" }}>📄 Print / PDF</button>
                  <button onClick={issueEarlyWarning} style={{ padding: "9px 16px", borderRadius: "8px", border: "none", background: "#ff304f", color: "#fff", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>⚡ Emergency Broadcast</button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {alerts.map((al) => (
                  <div key={al.id} style={{ padding: "16px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", borderLeft: `5px solid ${getRiskColor(al.level || al.type)}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "16px" }}>⚠</span>
                        <strong style={{ fontSize: "15px" }}>{al.title || `Landslide Risk Alert - ${al.level}`}</strong>
                        <span style={{ fontSize: "11px", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px", background: getRiskColor(al.level || al.type), color: "#0b111e" }}>{al.level || al.type}</span>
                      </div>
                      <div style={{ color: "#7f91a8", fontSize: "13px", marginTop: "4px" }}>
                        Location: <b style={{ color: "#e2e8f0" }}>{al.location}</b> | Score: <b>{al.score}/100</b> | Rain: <b>{al.rainfall} mm</b>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "12px", color: "#7f91a8" }}>{al.timestamp || al.time || new Date(al.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: "bold" }}>● Broadcast Dispatched</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", color: "#f59e0b" }}>📢 Citizen SOS / Community Ground Reports</h3>
                  <p style={{ color: "#7f91a8", fontSize: "13px" }}>Crowd-sourced telemetry from residents near monitoring stations</p>
                </div>
                <button
                  onClick={() => setShowSosModal(true)}
                  style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid rgba(245,158,11,.4)", background: "rgba(245,158,11,.12)", color: "#f59e0b", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}
                >
                  🚩 Report Ground Condition
                </button>
              </div>

              {sosReports.length === 0 && (
                <p style={{ color: "#5d6873", fontSize: "12px" }}>No citizen reports yet. Ground reports submitted near any location will appear here.</p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {sosReports.map((r) => (
                  <div key={r.id} style={{ padding: "14px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", borderLeft: "5px solid #f59e0b" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "13px" }}>{r.issueType}</strong>
                      <small style={{ color: "#7f91a8" }}>{new Date(r.createdAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</small>
                    </div>
                    <div style={{ color: "#7f91a8", fontSize: "12px", marginTop: "4px" }}>
                      📍 {r.location} • Reported by {r.reporterName}
                    </div>
                    <p style={{ fontSize: "12px", color: "#c7d0d8", margin: "6px 0 0" }}>{r.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: ANALYTICS */}
        {currentTab === "analytics" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "16px" }}>
            <div className="panel" style={{ padding: "20px" }}>
              <h3 style={{ fontSize: "17px", color: "#38bdf8", marginBottom: "6px" }}>Dynamic AI Risk Weightage Breakdown</h3>
              <p style={{ color: "#7f91a8", fontSize: "13px", marginBottom: "20px" }}>Multi-factor weighted contribution matrix for {selected.name}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}><span>Precipitation Saturation (40% Weight)</span><strong>{selected.rainfallScore}%</strong></div>
                  <div className="progress"><span style={{ width: `${selected.rainfallScore}%`, background: "#38bdf8" }}></span></div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}><span>Digital Elevation & Slope Angle (35% Weight)</span><strong>{selected.slopeScore}%</strong></div>
                  <div className="progress"><span style={{ width: `${selected.slopeScore}%`, background: "#ff8a00" }}></span></div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}><span>Geological & Soil Shear Strength (25% Weight)</span><strong>{selected.soilScore}%</strong></div>
                  <div className="progress"><span style={{ width: `${selected.soilScore}%`, background: "#a855f7" }}></span></div>
                </div>
              </div>
            </div>
            <div className="panel" style={{ padding: "20px" }}>
              <h3 style={{ fontSize: "17px", color: "#22c55e", marginBottom: "6px" }}>Live Susceptibility Histogram</h3>
              <p style={{ color: "#7f91a8", fontSize: "13px", marginBottom: "16px" }}>10-frame telemetry window</p>
              <div style={{ height: "160px", display: "flex", alignItems: "end", gap: "8px", paddingBottom: "10px" }}>
                {riskHistory.map((val, idx) => (
                  <div key={idx} style={{ flex: 1, height: `${Math.max(val, 10)}%`, borderRadius: "4px 4px 0 0", background: getRiskColor(val), transition: "height 0.4s ease" }} />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#7f91a8", fontSize: "12px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "8px" }}>
                <span>T - 10 cycles</span>
                <span>Current: <b style={{ color: getRiskColor(liveRiskScore) }}>{liveRiskScore}%</b></span>
                <span>Real-time</span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: HISTORICAL DATA */}
        {currentTab === "history" && (
          <div className="panel" style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "18px", color: "#38bdf8", marginBottom: "6px" }}>Northeastern Region Landslide Event Archive</h3>
            <p style={{ color: "#7f91a8", fontSize: "13px", marginBottom: "16px" }}>Historical trigger points compiled for susceptibility benchmark testing</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", color: "#7f91a8" }}>
                  <th style={{ padding: "10px" }}>Event Date</th>
                  <th style={{ padding: "10px" }}>Location</th>
                  <th style={{ padding: "10px" }}>Precipitation (24h)</th>
                  <th style={{ padding: "10px" }}>Severity</th>
                  <th style={{ padding: "10px" }}>Primary Trigger</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { date: "June 2025", place: "Aizawl District, Mizoram", rain: "210 mm", sev: "CRITICAL", trig: "Heavy Monsoon Infiltration" },
                  { date: "August 2024", place: "NH-29 Kohima, Nagaland", rain: "185 mm", sev: "HIGH", trig: "Slope Undercutting & Silt Failure" },
                  { date: "July 2023", place: "Mangan-Chungthang, Sikkim", rain: "240 mm", sev: "CRITICAL", trig: "Flash Flood & Cloudburst" },
                  { date: "May 2023", place: "Dima Hasao, Assam", rain: "195 mm", sev: "CRITICAL", trig: "Railway Corridor Slope Collapse" },
                  { date: "September 2022", place: "Shillong Bypass, Meghalaya", rain: "140 mm", sev: "MODERATE", trig: "Soil Pore-Pressure Increase" },
                ].map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "12px 10px", color: "#94a3b8" }}>{row.date}</td>
                    <td style={{ padding: "12px 10px", fontWeight: "bold" }}>{row.place}</td>
                    <td style={{ padding: "12px 10px", color: "#38bdf8" }}>{row.rain}</td>
                    <td style={{ padding: "12px 10px" }}><span style={{ fontSize: "11px", fontWeight: "bold", padding: "3px 8px", borderRadius: "4px", background: getRiskColor(row.sev), color: "#0b111e" }}>{row.sev}</span></td>
                    <td style={{ padding: "12px 10px", color: "#94a3b8" }}>{row.trig}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 6: GET MOBILE APP */}
        {currentTab === "mobileapp" && (
          <div className="panel" style={{ padding: "32px", textAlign: "center" }}>
            <div style={{ maxWidth: "480px", margin: "0 auto" }}>
              <div style={{ fontSize: "40px", marginBottom: "8px" }}>📱</div>
              <h3 style={{ fontSize: "20px", marginBottom: "6px" }}>Get LandslideAI on Your Phone</h3>
              <p style={{ color: "#7f91a8", fontSize: "13px", marginBottom: "28px" }}>
                Scan the QR code below with your phone's camera to open LandslideAI and install it as an app — get instant access to live risk maps, evacuation routes, and the SOS button from your home screen.
              </p>

              <div style={{ display: "inline-block", padding: "16px", background: "#fff", borderRadius: "14px", marginBottom: "20px" }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent("https://landslideriskmonitoring.netlify.app/")}`}
                  alt="Scan to download LandslideAI app"
                  width={240}
                  height={240}
                  style={{ display: "block" }}
                />
              </div>

              <p style={{ color: "#42d5ac", fontSize: "12px", fontWeight: "bold", marginBottom: "24px" }}>
                landslideriskmonitoring.netlify.app
              </p>

              <div style={{ textAlign: "left", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "18px 20px" }}>
                <strong style={{ fontSize: "12px", color: "#38bdf8", letterSpacing: "0.5px" }}>HOW TO INSTALL</strong>
                <div style={{ marginTop: "12px", fontSize: "12px", color: "#c7d0d8", lineHeight: "1.7" }}>
                  <strong style={{ color: "#e2e8f0" }}>Android (Chrome):</strong> After the page opens, tap the ⋮ menu → "Add to Home screen" / "Install app".
                  <br /><br />
                  <strong style={{ color: "#e2e8f0" }}>iPhone (Safari):</strong> After the page opens, tap the Share icon → "Add to Home Screen".
                </div>
              </div>
            </div>
          </div>
        )}

        <footer>
          <span>LANDSLIDE AI • SIH26001</span>
          <span>AI-Based Early Warning & Risk Monitoring System</span>
          <span>Prototype v1.0</span>
        </footer>
      </main>

      {/* ================= FLOATING CITIZEN SOS BUTTON ================= */}
      <button
        onClick={() => setShowSosModal(true)}
        title="Report a ground condition (road crack, tilt, muddy water)"
        style={{
          position: "fixed", bottom: "26px", right: "26px", zIndex: 1500,
          width: "58px", height: "58px", borderRadius: "50%", border: "none",
          background: "#f59e0b", color: "#1a1204", fontSize: "22px", fontWeight: "bold",
          boxShadow: "0 6px 20px rgba(245,158,11,0.45)", cursor: "pointer"
        }}
      >
        🚩
      </button>

      {/* ================= MODAL: CITIZEN SOS / COMMUNITY REPORT ================= */}
      {showSosModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex",
          justifyContent: "center", alignItems: "center", zIndex: 9999, backdropFilter: "blur(5px)"
        }}>
          <div style={{
            background: "#131d31", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px",
            width: "400px", maxWidth: "90vw", padding: "24px", color: "#e2e8f0", boxShadow: "0 20px 50px rgba(0,0,0,0.6)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>🚩</span>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#f59e0b" }}>Report Ground Condition</h3>
              </div>
              <button onClick={() => { setShowSosModal(false); setSosSubmitted(false); }} style={{ background: "transparent", border: "none", color: "#7f91a8", fontSize: "18px", cursor: "pointer" }}>✕</button>
            </div>

            <p style={{ fontSize: "12px", color: "#7f91a8", marginBottom: "16px" }}>
              Reporting near <strong style={{ color: "#e2e8f0" }}>{selected.name}, {selected.state}</strong>. Your ground-level input helps validate AI sensor readings.
            </p>

            {sosSubmitted ? (
              <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.35)", color: "#22c55e", fontSize: "13px", textAlign: "center" }}>
                ✓ Report received. Thank you for helping keep your community safe.
              </div>
            ) : (
              <form onSubmit={handleSosSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "#7f91a8", display: "block", marginBottom: "4px" }}>Your Name (optional)</label>
                  <input
                    type="text"
                    placeholder="Anonymous Citizen"
                    value={sosForm.reporterName}
                    onChange={(e) => setSosForm({ ...sosForm, reporterName: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", background: "#0b111e", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", color: "#7f91a8", display: "block", marginBottom: "4px" }}>Issue Type</label>
                  <select
                    value={sosForm.issueType}
                    onChange={(e) => setSosForm({ ...sosForm, issueType: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", background: "#0b111e", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                  >
                    <option>Road Crack</option>
                    <option>Ground Tilt / Movement</option>
                    <option>Muddy Water Discharge</option>
                    <option>Fallen Trees / Blocked Path</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", color: "#7f91a8", display: "block", marginBottom: "4px" }}>Description</label>
                  <textarea
                    placeholder="Describe what you observed..."
                    value={sosForm.description}
                    onChange={(e) => setSosForm({ ...sosForm, description: e.target.value })}
                    rows={3}
                    required
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", background: "#0b111e", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none", resize: "vertical", fontFamily: "inherit" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setShowSosModal(false)}
                    style={{ flex: 1, padding: "10px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "none", color: "#e2e8f0", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sosSubmitting}
                    style={{ flex: 1, padding: "10px", borderRadius: "6px", background: "#f59e0b", border: "none", color: "#1a1204", fontWeight: "bold", cursor: sosSubmitting ? "wait" : "pointer" }}
                  >
                    {sosSubmitting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: ADMIN / AUTHORITY AUTHENTICATION ================= */}
      {showAuthModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex",
          justifyContent: "center", alignItems: "center", zIndex: 9999, backdropFilter: "blur(5px)"
        }}>
          <div style={{
            background: "#131d31", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px",
            width: "380px", padding: "24px", color: "#e2e8f0", boxShadow: "0 20px 50px rgba(0,0,0,0.6)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>🛡️</span>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#38bdf8" }}>Authority Authentication</h3>
              </div>
              <button onClick={() => { setShowAuthModal(false); setLoginError(""); }} style={{ background: "transparent", border: "none", color: "#7f91a8", fontSize: "18px", cursor: "pointer" }}>✕</button>
            </div>

            <p style={{ fontSize: "12px", color: "#7f91a8", marginBottom: "16px" }}>
              Log in with your official NDRF / State Disaster Management credentials to authorize emergency dispatches.
            </p>

            {loginError && (
              <div style={{ padding: "8px 12px", borderRadius: "6px", background: "rgba(255,48,79,0.15)", border: "1px solid #ff304f", color: "#ff304f", fontSize: "12px", marginBottom: "12px" }}>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "#7f91a8", display: "block", marginBottom: "4px" }}>Officer / Authority ID</label>
                <input
                  type="text"
                  placeholder="e.g. NDRF-NER-042"
                  value={loginForm.officerId}
                  onChange={(e) => setLoginForm({ ...loginForm, officerId: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", background: "#0b111e", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#7f91a8", display: "block", marginBottom: "4px" }}>Security Access PIN</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", background: "#0b111e", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => { setShowAuthModal(false); setLoginError(""); }}
                  style={{ flex: 1, padding: "10px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "none", color: "#e2e8f0", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: "10px", borderRadius: "6px", background: "#38bdf8", border: "none", color: "#0b111e", fontWeight: "bold", cursor: "pointer" }}
                >
                  Authenticate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}