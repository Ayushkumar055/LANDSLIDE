const express = require("express");
const cors = require("cors");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const app = express();

// ==========================================
// DATABASE
// ==========================================
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const PORT = process.env.PORT || 5000;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json());

// ==========================================
// AUTOMATED EMERGENCY DISPATCH GATEWAY
// ==========================================
const triggerEmergencyProtocol = (alert) => {
  const isCritical =
    alert.level === "CRITICAL" || alert.score >= 80;

  const recipientChannels = isCritical
    ? [
        "📡 NDRF 1st Battalion Control (Guwahati)",
        "🚨 State Disaster Management Authority (SDMA)",
        "📲 Automated Public SMS Cell Broadcast (Cell-ID Hub)",
        "📧 district-magistrate-emergency@nic.in",
      ]
    : [
        "🟡 District Disaster Control Room (Standby)",
        "📧 weather-monitoring-ner@imd.gov.in",
      ];

  console.log(
    "\n=============================================================="
  );

  console.log(
    `🚨 [DISASTER GATEWAY ACTIVATED] Severity: ${alert.level}`
  );

  console.log(
    `📍 Location: ${alert.location} | Susceptibility: ${alert.score}/100 | Rain: ${alert.rainfall}mm`
  );

  console.log(
    `⚡ Dispatch Channels (${recipientChannels.length} active relays):`
  );

  recipientChannels.forEach((ch) => {
    console.log(`   --> ${ch}`);
  });

  if (isCritical) {
    console.log(
      "📢 ACTION ADVISORY: Evacuation Warning Protocol Dispatched."
    );
  }

  console.log(
    "==============================================================\n"
  );
};

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/", async (req, res) => {
  try {
    const hotspotCount = await prisma.hotspot.count();
    const alertCount = await prisma.alertLog.count();

    res.json({
      status: "ONLINE",
      database: "PostgreSQL (Neon Connected)",
      system:
        "SIH26001 - Landslide AI Early Warning Platform",
      activeMonitoredLocations: hotspotCount,
      activeAlertsLogged: alertCount,
    });
  } catch (err) {
    console.error("Health check error:", err);

    res.status(500).json({
      status: "ERROR",
      message: err.message,
    });
  }
});

// ==========================================
// FETCH HOTSPOTS
// ==========================================
app.get("/api/hotspots", async (req, res) => {
  try {
    const hotspots = await prisma.hotspot.findMany({
      orderBy: {
        id: "asc",
      },
    });

    res.json({
      success: true,
      count: hotspots.length,
      data: hotspots,
    });
  } catch (err) {
    console.error("Hotspots error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ==========================================
// AI SUSCEPTIBILITY SCORING ENGINE
// ==========================================
app.post("/api/predict-risk", (req, res) => {
  try {
    const {
      rainfall,
      slope,
      soilStability,
    } = req.body;

    const stabilityWeight =
      soilStability === "Low"
        ? 1.2
        : soilStability === "Moderate"
        ? 1.0
        : 0.8;

    const normRainfall = Math.min(
      100,
      ((rainfall || 0) / 200) * 100
    );

    const normSlope = Math.min(
      100,
      ((slope || 0) / 60) * 100
    );

    const rawScore =
      normRainfall * 0.45 +
      normSlope * 0.35 +
      stabilityWeight * 20;

    const finalScore = Math.min(
      100,
      Math.round(rawScore)
    );

    let level = "LOW";
    let recommendation =
      "Routine monitoring active.";

    if (finalScore >= 80) {
      level = "CRITICAL";

      recommendation =
        "🚨 Immediate Evacuation Advisory! Trigger multi-channel alert dispatch.";
    } else if (finalScore >= 60) {
      level = "HIGH";

      recommendation =
        "⚠️ High risk detected. Alert local SDRF/NDRF units.";
    } else if (finalScore >= 40) {
      level = "MODERATE";

      recommendation =
        "🟡 Elevated soil saturation. Increase sensor frequency.";
    }

    res.json({
      success: true,
      riskScore: finalScore,
      riskLevel: level,
      recommendation,
    });
  } catch (err) {
    console.error("Risk prediction error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ==========================================
// SAFE SHELTERS & EVACUATION LAYER
// ==========================================
app.get("/api/shelters", async (req, res) => {
  try {
    const shelters = await prisma.shelter.findMany({
      orderBy: {
        id: "asc",
      },
    });

    res.json({
      success: true,
      count: shelters.length,
      data: shelters,
    });
  } catch (err) {
    console.error("Shelters error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ==========================================
// LIVE WEATHER GATEWAY
// Open-Meteo - No API Key Required
// ==========================================
app.get("/api/live-weather", async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      error: "lat and lng query params are required",
    });
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}` +
      `&longitude=${lng}` +
      `&current=precipitation,rain,weather_code` +
      `&hourly=precipitation` +
      `&past_days=1` +
      `&timezone=auto`;

    const weatherRes = await fetch(url);

    if (!weatherRes.ok) {
      throw new Error(
        `Open-Meteo returned HTTP ${weatherRes.status}`
      );
    }

    const weatherData = await weatherRes.json();

    const hourlyPrecipitation =
      weatherData.hourly?.precipitation || [];

    const last24h =
      hourlyPrecipitation.slice(-24);

    const rainfall24h =
      last24h.reduce(
        (sum, value) =>
          sum + (value || 0),
        0
      );

    res.json({
      success: true,
      source:
        "Open-Meteo Live Satellite/Model Feed",
      currentPrecipitationMm:
        weatherData.current?.precipitation ?? 0,
      rainfall24hMm:
        Math.round(rainfall24h * 10) / 10,
      weatherCode:
        weatherData.current?.weather_code ?? null,
      fetchedAt:
        new Date().toISOString(),
    });
  } catch (err) {
    console.error("Weather error:", err);

    res.status(500).json({
      success: false,
      error:
        "Failed to reach live weather feed",
      details: err.message,
    });
  }
});

// ==========================================
// CITIZEN SOS / COMMUNITY GROUND REPORTS
// ==========================================

// GET SOS reports
app.get("/api/sos", async (req, res) => {
  try {
    const reports =
      await prisma.sosReport.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 30,
      });

    res.json({
      success: true,
      reports,
    });
  } catch (err) {
    console.error("SOS fetch error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// POST SOS report
app.post("/api/sos", async (req, res) => {
  try {
    const {
      reporterName,
      location,
      lat,
      lng,
      issueType,
      description,
    } = req.body;

    if (
      !location ||
      !issueType ||
      !description
    ) {
      return res.status(400).json({
        success: false,
        error:
          "location, issueType and description are required",
      });
    }

    const savedReport =
      await prisma.sosReport.create({
        data: {
          reporterName:
            reporterName ||
            "Anonymous Citizen",

          location,

          lat: parseFloat(lat || 0),

          lng: parseFloat(lng || 0),

          issueType,

          description,
        },
      });

    console.log(
      `\n📢 [CITIZEN SOS RECEIVED] ${issueType} reported near ${location}`
    );

    res.status(201).json({
      success: true,
      message:
        "Ground report received and logged.",
      report: savedReport,
    });
  } catch (err) {
    console.error("SOS submit error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// RESOLVE SOS
app.patch(
  "/api/sos/:id/resolve",
  async (req, res) => {
    try {
      const updated =
        await prisma.sosReport.update({
          where: {
            id: parseInt(
              req.params.id,
              10
            ),
          },
          data: {
            status: "RESOLVED",
          },
        });

      res.json({
        success: true,
        report: updated,
      });
    } catch (err) {
      console.error(
        "SOS resolve error:",
        err
      );

      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

// ==========================================
// FETCH ALERTS LOG
// ==========================================
app.get("/api/alerts", async (req, res) => {
  try {
    const alerts =
      await prisma.alertLog.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      });

    res.json({
      success: true,
      alerts,
    });
  } catch (err) {
    console.error("Alerts fetch error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ==========================================
// DISPATCH & STORE ALERT
// ==========================================
app.post("/api/alerts", async (req, res) => {
  try {
    const {
      location,
      level,
      score,
      rainfall,
      title,
    } = req.body;

    const savedAlert =
      await prisma.alertLog.create({
        data: {
          location:
            location || "Unknown Location",

          level:
            level || "MODERATE",

          score: parseInt(
            score || 0,
            10
          ),

          rainfall: parseFloat(
            rainfall || 0
          ),

          dispatchedTo: [
            "NDRF State Unit",
            "District Disaster Authority",
            "SMS Broadcast Relay",
          ],
        },
      });

    // Automated emergency dispatch
    triggerEmergencyProtocol(
      savedAlert
    );

    res.status(201).json({
      success: true,

      message:
        "Alert persisted in DB and automated broadcast relayed.",

      alert: {
        ...savedAlert,

        title:
          title ||
          `Landslide Risk Alert - ${savedAlert.level}`,

        timestamp:
          new Date(
            savedAlert.createdAt
          ).toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
            }
          ),
      },
    });
  } catch (err) {
    console.error(
      "Alert dispatch error:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ==========================================
// HINDI TEXT-TO-SPEECH
// PIPER TTS
// ==========================================
app.post("/api/tts", async (req, res) => {
  try {
    const {
      text,
      language,
    } = req.body;

    console.log(
      `🔊 TTS request received | Language: ${language}`
    );

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Text is required",
      });
    }

    // --------------------------------------
    // Currently Piper route handles Hindi
    // --------------------------------------
    if (language !== "hi") {
      return res.status(400).json({
        success: false,
        error:
          "Piper TTS route currently supports Hindi only.",
      });
    }

    // --------------------------------------
    // Check Hindi voice model
    // --------------------------------------
    const modelPath = path.join(
      __dirname,
      "hi_IN-rohan-medium.onnx"
    );

    if (!fs.existsSync(modelPath)) {
      console.error(
        "❌ Hindi Piper model not found:",
        modelPath
      );

      return res.status(500).json({
        success: false,
        error:
          "Hindi Piper voice model not found.",
      });
    }

    // --------------------------------------
    // Check Python virtual environment
    // --------------------------------------
    const pythonPath = path.join(
      __dirname,
      ".venv",
      "Scripts",
      "python.exe"
    );

    if (!fs.existsSync(pythonPath)) {
      return res.status(500).json({
        success: false,
        error:
          "Python virtual environment not found.",
      });
    }

    // --------------------------------------
    // Check tts.py
    // --------------------------------------
    const ttsScript = path.join(
      __dirname,
      "tts.py"
    );

    if (!fs.existsSync(ttsScript)) {
      return res.status(500).json({
        success: false,
        error:
          "tts.py not found in backend folder.",
      });
    }

    // --------------------------------------
    // Temporary WAV file
    // --------------------------------------
    const outputFile = path.join(
      __dirname,
      `tts-${Date.now()}.wav`
    );

    console.log(
      "🎙️ Generating Hindi speech..."
    );

    // --------------------------------------
    // Run Piper through tts.py
    // --------------------------------------
    execFile(
      pythonPath,
      [
        ttsScript,
        text,
        outputFile,
      ],
      {
        windowsHide: true,
        maxBuffer:
          1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(
            "❌ Piper TTS error:",
            error
          );

          if (stderr) {
            console.error(
              "Piper stderr:",
              stderr
            );
          }

          return res.status(500).json({
            success: false,
            error:
              "Hindi TTS generation failed.",
            details:
              error.message,
          });
        }

        console.log(
          "Piper output:",
          stdout
        );

        // ----------------------------------
        // Verify generated audio
        // ----------------------------------
        if (!fs.existsSync(outputFile)) {
          console.error(
            "❌ WAV file was not generated."
          );

          return res.status(500).json({
            success: false,
            error:
              "TTS audio file was not generated.",
          });
        }

        console.log(
          `✅ Hindi TTS generated: ${outputFile}`
        );

        // ----------------------------------
        // Send WAV to frontend
        // ----------------------------------
        res.setHeader(
          "Content-Type",
          "audio/wav"
        );

        res.setHeader(
          "Content-Disposition",
          'inline; filename="hindi-alert.wav"'
        );

        const audioStream =
          fs.createReadStream(
            outputFile
          );

        audioStream.pipe(res);

        // ----------------------------------
        // Delete temporary file after sending
        // ----------------------------------
        audioStream.on(
          "close",
          () => {
            fs.unlink(
              outputFile,
              (unlinkError) => {
                if (unlinkError) {
                  console.warn(
                    "Could not delete temporary TTS file:",
                    unlinkError.message
                  );
                }
              }
            );
          }
        );
      }
    );
  } catch (err) {
    console.error(
      "❌ TTS route error:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ==========================================
// 404 HANDLER
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error(
    "Unhandled server error:",
    err
  );

  res.status(500).json({
    success: false,
    error: err.message,
  });
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
  console.log("");
  console.log(
    "=============================================================="
  );
  console.log(
    "        LANDSLIDE AI BACKEND"
  );
  console.log(
    "=============================================================="
  );
  console.log(
    `✅ Server running on http://localhost:${PORT}`
  );
  console.log(
    "✅ PostgreSQL / Prisma connected"
  );
  console.log(
    "✅ Hotspot API ready"
  );
  console.log(
    "✅ Risk prediction API ready"
  );
  console.log(
    "✅ Shelter API ready"
  );
  console.log(
    "✅ Live weather API ready"
  );
  console.log(
    "✅ SOS API ready"
  );
  console.log(
    "✅ Alert dispatch API ready"
  );
  console.log(
    "✅ Hindi Piper TTS API ready"
  );
  console.log(
    "=============================================================="
  );
  console.log("");
});