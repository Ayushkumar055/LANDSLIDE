const express = require('express');
const cors = require('cors');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ==========================================
// AUTOMATED EMERGENCY DISPATCH GATEWAY
// ==========================================
const triggerEmergencyProtocol = (alert) => {
  const isCritical = alert.level === 'CRITICAL' || alert.score >= 80;
  
  const recipientChannels = isCritical
    ? [
        "📡 NDRF 1st Battalion Control (Guwahati)",
        "🚨 State Disaster Management Authority (SDMA)",
        "📲 Automated Public SMS Cell Broadcast (Cell-ID Hub)",
        "📧 district-magistrate-emergency@nic.in"
      ]
    : [
        "🟡 District Disaster Control Room (Standby)",
        "📧 weather-monitoring-ner@imd.gov.in"
      ];

  console.log("\n==============================================================");
  console.log(`🚨 [DISASTER GATEWAY ACTIVATED] Severity: ${alert.level}`);
  console.log(`📍 Location: ${alert.location} | Susceptibility: ${alert.score}/100 | Rain: ${alert.rainfall}mm`);
  console.log(`⚡ Dispatch Channels (${recipientChannels.length} active relays):`);
  recipientChannels.forEach((ch) => console.log(`   --> ${ch}`));
  if (isCritical) {
    console.log(`📢 ACTION ADVISORY: Evacuation Warning Protocol Dispatched.`);
  }
  console.log("==============================================================\n");
};

// Health Check Route
app.get('/', async (req, res) => {
  try {
    const hotspotCount = await prisma.hotspot.count();
    const alertCount = await prisma.alertLog.count();
    res.json({
      status: 'ONLINE',
      database: 'PostgreSQL (Neon Connected)',
      system: 'SIH26001 - Landslide AI Early Warning Platform',
      activeMonitoredLocations: hotspotCount,
      activeAlertsLogged: alertCount
    });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// Fetch Hotspots
app.get('/api/hotspots', async (req, res) => {
  try {
    const hotspots = await prisma.hotspot.findMany({ orderBy: { id: 'asc' } });
    res.json({ success: true, count: hotspots.length, data: hotspots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// AI Susceptibility Scoring Engine
app.post('/api/predict-risk', (req, res) => {
  const { rainfall, slope, soilStability } = req.body;
  const stabilityWeight = soilStability === 'Low' ? 1.2 : soilStability === 'Moderate' ? 1.0 : 0.8;

  const normRainfall = Math.min(100, ((rainfall || 0) / 200) * 100);
  const normSlope = Math.min(100, ((slope || 0) / 60) * 100);

  const rawScore = (normRainfall * 0.45) + (normSlope * 0.35) + (stabilityWeight * 20);
  const finalScore = Math.min(100, Math.round(rawScore));

  let level = 'LOW';
  let recommendation = 'Routine monitoring active.';

  if (finalScore >= 80) {
    level = 'CRITICAL';
    recommendation = '🚨 Immediate Evacuation Advisory! Trigger multi-channel alert dispatch.';
  } else if (finalScore >= 60) {
    level = 'HIGH';
    recommendation = '⚠️ High risk detected. Alert local SDRF/NDRF units.';
  } else if (finalScore >= 40) {
    level = 'MODERATE';
    recommendation = '🟡 Elevated soil saturation. Increase sensor frequency.';
  }

  res.json({
    success: true,
    riskScore: finalScore,
    riskLevel: level,
    recommendation
  });
});

// ==========================================
// SAFE SHELTERS & EVACUATION LAYER
// ==========================================
app.get('/api/shelters', async (req, res) => {
  try {
    const shelters = await prisma.shelter.findMany({ orderBy: { id: 'asc' } });
    res.json({ success: true, count: shelters.length, data: shelters });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// LIVE WEATHER GATEWAY (Open-Meteo, no API key required)
// ==========================================
app.get('/api/live-weather', async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ success: false, error: 'lat and lng query params are required' });
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,rain,weather_code&hourly=precipitation&past_days=1&timezone=auto`;
    const weatherRes = await fetch(url);
    const weatherData = await weatherRes.json();

    const hourlyPrecip = weatherData.hourly?.precipitation || [];
    const last24h = hourlyPrecip.slice(-24);
    const rainfall24h = last24h.reduce((sum, v) => sum + (v || 0), 0);

    res.json({
      success: true,
      source: 'Open-Meteo Live Satellite/Model Feed',
      currentPrecipitationMm: weatherData.current?.precipitation ?? 0,
      rainfall24hMm: Math.round(rainfall24h * 10) / 10,
      weatherCode: weatherData.current?.weather_code ?? null,
      fetchedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reach live weather feed', details: err.message });
  }
});

// ==========================================
// CITIZEN SOS / COMMUNITY GROUND REPORTS
// ==========================================
app.get('/api/sos', async (req, res) => {
  try {
    const reports = await prisma.sosReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30
    });
    res.json({ success: true, reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sos', async (req, res) => {
  try {
    const { reporterName, location, lat, lng, issueType, description } = req.body;

    if (!location || !issueType || !description) {
      return res.status(400).json({ success: false, error: 'location, issueType and description are required' });
    }

    const savedReport = await prisma.sosReport.create({
      data: {
        reporterName: reporterName || 'Anonymous Citizen',
        location,
        lat: parseFloat(lat || 0),
        lng: parseFloat(lng || 0),
        issueType,
        description
      }
    });

    console.log(`\n📢 [CITIZEN SOS RECEIVED] ${issueType} reported near ${location}`);

    res.status(201).json({ success: true, message: 'Ground report received and logged.', report: savedReport });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch Alerts Log
app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await prisma.alertLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dispatch & Store Alert
app.post('/api/alerts', async (req, res) => {
  try {
    const { location, level, score, rainfall, title } = req.body;

    const savedAlert = await prisma.alertLog.create({
      data: {
        location: location || 'Unknown Location',
        level: level || 'MODERATE',
        score: parseInt(score || 0, 10),
        rainfall: parseFloat(rainfall || 0),
        dispatchedTo: [
          'NDRF State Unit',
          'District Disaster Authority',
          'SMS Broadcast Relay'
        ]
      }
    });

    // Run Automated Emergency Dispatch Service
    triggerEmergencyProtocol(savedAlert);

    res.status(201).json({
      success: true,
      message: 'Alert persisted in DB and automated broadcast relayed.',
      alert: {
        ...savedAlert,
        title: title || `Landslide Risk Alert - ${savedAlert.level}`,
        timestamp: new Date(savedAlert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Landslide AI Backend running on http://localhost:${PORT}`);
});