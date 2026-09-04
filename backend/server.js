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

const prisma = new PrismaClient({
  adapter,
});

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
    alert.level === "CRITICAL" ||
    alert.score >= 80;

  const recipientChannels = isCritical
    ? [
        "National Disaster Response Force (NDRF)",
        "State Disaster Management Authority (SDMA)",
        "District Disaster Management Authority (DDMA)",
        "Automated Public Alert Broadcast System",
      ]
    : [
        "District Disaster Control Room",
        "State Disaster Monitoring Authority",
      ];

  console.log("");
  console.log(
    "=============================================================="
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

  recipientChannels.forEach((channel) => {
    console.log(`   --> ${channel}`);
  });

  if (isCritical) {
    console.log(
      "📢 ACTION ADVISORY: Evacuation Warning Protocol Dispatched."
    );
  }

  console.log(
    "=============================================================="
  );

  console.log("");
};

// ==========================================
// SOS → ROAD CONNECTIVITY AUTOMATION
// ==========================================

// Calculate distance between two coordinates

const calculateDistance = (
  lat1,
  lng1,
  lat2,
  lng2
) => {
  const earthRadius = 6371;

  const dLat =
    ((lat2 - lat1) * Math.PI) / 180;

  const dLng =
    ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos(
      (lat1 * Math.PI) / 180
    ) *
      Math.cos(
        (lat2 * Math.PI) / 180
      ) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadius * c;
};

// Find nearest road and update it

const updateRoadFromSosReport = async (
  lat,
  lng,
  issueType,
  description,
  location
) => {
  try {
    const reportText =
      `${issueType} ${description}`.toLowerCase();

    const roadKeywords = [
      "road",
      "crack",
      "cracks",
      "blocked",
      "blockage",
      "landslide",
      "traffic",
      "connectivity",
      "collapse",
      "collapsed",
      "bridge",
      "damage",
    ];

    const isRoadRelated =
      roadKeywords.some((keyword) =>
        reportText.includes(keyword)
      );

    if (!isRoadRelated) {
      return {
        updated: false,
        reason: "Report is not road-related",
      };
    }

    const roads =
      await prisma.road.findMany();

    if (roads.length === 0) {
      return {
        updated: false,
        reason: "No monitored roads available",
      };
    }

    let nearestRoad = null;

    let shortestDistance = Infinity;

    for (const road of roads) {
      const distance =
        calculateDistance(
          lat,
          lng,
          road.lat,
          road.lng
        );

      if (distance < shortestDistance) {
        shortestDistance = distance;

        nearestRoad = road;
      }
    }

    const MAX_DISTANCE_KM = 30;

    if (
      !nearestRoad ||
      shortestDistance > MAX_DISTANCE_KM
    ) {
      return {
        updated: false,

        reason:
          "No monitored road found within 30 KM",

        distanceKm:
          Math.round(
            shortestDistance * 100
          ) / 100,
      };
    }

    let newStatus = "RESTRICTED";

    let newRiskLevel = "HIGH";

    const criticalKeywords = [
      "blocked",
      "completely blocked",
      "road closed",
      "collapse",
      "collapsed",
      "impassable",
      "completely damaged",
    ];

    const isCritical =
      criticalKeywords.some((keyword) =>
        reportText.includes(keyword)
      );

    if (isCritical) {
      newStatus = "BLOCKED";

      newRiskLevel = "CRITICAL";
    }

    const updatedRoad =
      await prisma.road.update({
        where: {
          id: nearestRoad.id,
        },

        data: {
          status: newStatus,

          riskLevel: newRiskLevel,

          description:
            `AUTO-UPDATED FROM SOS REPORT: ${description}`,
        },
      });

    console.log("");

    console.log(
      "=============================================================="
    );

    console.log(
      "🛣️ ROAD CONNECTIVITY AUTO-UPDATE"
    );

    console.log(
      `📍 Report Location: ${location}`
    );

    console.log(
      `🛣️ Nearest Road: ${updatedRoad.name}`
    );

    console.log(
      `📏 Distance: ${shortestDistance.toFixed(
        2
      )} KM`
    );

    console.log(
      `🚦 Status: ${updatedRoad.status}`
    );

    console.log(
      "=============================================================="
    );

    console.log("");

    return {
      updated: true,

      road: updatedRoad,

      distanceKm:
        Math.round(
          shortestDistance * 100
        ) / 100,
    };
  } catch (error) {
    console.error(
      "Road automation error:",
      error
    );

    return {
      updated: false,

      reason: error.message,
    };
  }
};

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", async (req, res) => {
  try {
    const hotspotCount =
      await prisma.hotspot.count();

    const alertCount =
      await prisma.alertLog.count();

    res.json({
      status: "ONLINE",

      database:
        "PostgreSQL (Neon Connected)",

      system:
        "SIH26001 - Landslide AI Early Warning Platform",

      activeMonitoredLocations:
        hotspotCount,

      activeAlertsLogged:
        alertCount,
    });
  } catch (err) {
    console.error(
      "Health check error:",
      err
    );

    res.status(500).json({
      status: "ERROR",

      message: err.message,
    });
  }
});

// ==========================================
// FETCH HOTSPOTS
// ==========================================

app.get(
  "/api/hotspots",
  async (req, res) => {
    try {
      const hotspots =
        await prisma.hotspot.findMany({
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
      console.error(
        "Hotspots error:",
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
// NORMAL RISK PREDICTION
// ==========================================

app.post(
  "/api/predict-risk",
  (req, res) => {
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

      const normRainfall =
        Math.min(
          100,
          ((rainfall || 0) / 200) * 100
        );

      const normSlope =
        Math.min(
          100,
          ((slope || 0) / 60) * 100
        );

      const rawScore =
        normRainfall * 0.45 +
        normSlope * 0.35 +
        stabilityWeight * 20;

      const finalScore =
        Math.min(
          100,
          Math.round(rawScore)
        );

      let level = "LOW";

      let recommendation =
        "Routine monitoring active.";

      if (finalScore >= 80) {
        level = "CRITICAL";

        recommendation =
          "Immediate evacuation advisory recommended.";
      } else if (finalScore >= 60) {
        level = "HIGH";

        recommendation =
          "High risk detected. Alert emergency authorities.";
      } else if (finalScore >= 40) {
        level = "MODERATE";

        recommendation =
          "Elevated risk. Increase monitoring frequency.";
      }

      res.json({
        success: true,

        riskScore: finalScore,

        riskLevel: level,

        recommendation,
      });
    } catch (err) {
      console.error(
        "Risk prediction error:",
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
// MACHINE LEARNING RISK PREDICTION
// ==========================================

app.post(
  "/api/ml-predict-risk",
  (req, res) => {
    try {
      const {
        rainfall,
        slope,
        soil_moisture,
        elevation,
      } = req.body;

      if (
        rainfall === undefined ||
        slope === undefined ||
        soil_moisture === undefined ||
        elevation === undefined
      ) {
        return res.status(400).json({
          success: false,

          error:
            "rainfall, slope, soil_moisture and elevation are required",
        });
      }

      // ML environment Python path
      const pythonPath =
        path.join(
          __dirname,
          "ml_env",
          "Scripts",
          "python.exe"
        );

      // ML prediction script path
      const predictionScript =
        path.join(
          __dirname,
          "ml",
          "predict.py"
        );

      if (
        !fs.existsSync(pythonPath)
      ) {
        return res.status(500).json({
          success: false,

          error:
            `ML Python environment not found: ${pythonPath}`,
        });
      }

      if (
        !fs.existsSync(
          predictionScript
        )
      ) {
        return res.status(500).json({
          success: false,

          error:
            `ML prediction script not found: ${predictionScript}`,
        });
      }

      const inputData =
        JSON.stringify({
          rainfall:
            Number(rainfall),

          slope:
            Number(slope),

          soil_moisture:
            Number(soil_moisture),

          elevation:
            Number(elevation),
        });

      console.log("");
      console.log(
        "🤖 ML PREDICTION REQUEST RECEIVED"
      );

      console.log(
        "Input:",
        inputData
      );

      execFile(
        pythonPath,

        [
          predictionScript,
          inputData,
        ],

        {
          windowsHide: true,

          maxBuffer:
            1024 * 1024,
        },

        (
          error,
          stdout,
          stderr
        ) => {
          if (error) {
            console.error(
              "ML prediction process error:",
              error
            );

            if (stderr) {
              console.error(
                "Python stderr:",
                stderr
              );
            }

            return res
              .status(500)
              .json({
                success: false,

                error:
                  "Machine learning prediction failed",

                details:
                  stderr ||
                  error.message,
              });
          }

          try {
            const cleanOutput =
              stdout.trim();

            const result =
              JSON.parse(
                cleanOutput
              );

            console.log(
              "🤖 ML Prediction Result:",
              result
            );

            return res.json(
              result
            );
          } catch (parseError) {
            console.error(
              "Invalid ML output:",
              stdout
            );

            return res
              .status(500)
              .json({
                success: false,

                error:
                  "Invalid response received from ML model",

                details:
                  stdout,
              });
          }
        }
      );
    } catch (err) {
      console.error(
        "ML API error:",
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
// SAFE SHELTERS
// ==========================================

app.get(
  "/api/shelters",
  async (req, res) => {
    try {
      const shelters =
        await prisma.shelter.findMany({
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
      console.error(
        "Shelters error:",
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
// ROAD CONNECTIVITY MONITORING
// ==========================================

// GET ALL ROADS

app.get(
  "/api/roads",
  async (req, res) => {
    try {
      const roads =
        await prisma.road.findMany({
          orderBy: {
            id: "asc",
          },
        });

      res.json({
        success: true,

        count: roads.length,

        data: roads,
      });
    } catch (err) {
      console.error(
        "Roads fetch error:",
        err
      );

      res.status(500).json({
        success: false,

        error: err.message,
      });
    }
  }
);

// GET SINGLE ROAD

app.get(
  "/api/roads/:id",
  async (req, res) => {
    try {
      const roadId =
        parseInt(
          req.params.id,
          10
        );

      if (
        Number.isNaN(roadId)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid road ID",
          });
      }

      const road =
        await prisma.road.findUnique({
          where: {
            id: roadId,
          },
        });

      if (!road) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Road not found",
          });
      }

      res.json({
        success: true,

        data: road,
      });
    } catch (err) {
      console.error(
        "Road fetch error:",
        err
      );

      res.status(500).json({
        success: false,

        error: err.message,
      });
    }
  }
);

// UPDATE ROAD STATUS

app.patch(
  "/api/roads/:id/status",
  async (req, res) => {
    try {
      const roadId =
        parseInt(
          req.params.id,
          10
        );

      const {
        status,
        riskLevel,
        description,
      } = req.body;

      const validStatuses = [
        "OPEN",
        "RESTRICTED",
        "BLOCKED",
      ];

      const validRiskLevels = [
        "LOW",
        "MODERATE",
        "HIGH",
        "CRITICAL",
      ];

      if (
        Number.isNaN(roadId)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid road ID",
          });
      }

      if (
        status &&
        !validStatuses.includes(
          status
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid road status",
          });
      }

      if (
        riskLevel &&
        !validRiskLevels.includes(
          riskLevel
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid risk level",
          });
      }

      const road =
        await prisma.road.update({
          where: {
            id: roadId,
          },

          data: {
            ...(status && {
              status,
            }),

            ...(riskLevel && {
              riskLevel,
            }),

            ...(description !==
              undefined && {
              description,
            }),
          },
        });

      res.json({
        success: true,

        message:
          "Road connectivity status updated successfully.",

        data: road,
      });
    } catch (err) {
      console.error(
        "Road update error:",
        err
      );

      if (
        err.code === "P2025"
      ) {
        return res
          .status(404)
          .json({
            success: false,

            error:
              "Road not found",
          });
      }

      res.status(500).json({
        success: false,

        error: err.message,
      });
    }
  }
);

// ==========================================
// LIVE WEATHER API
// ==========================================

app.get(
  "/api/live-weather",
  async (req, res) => {
    const {
      lat,
      lng,
    } = req.query;

    if (!lat || !lng) {
      return res
        .status(400)
        .json({
          success: false,

          error:
            "lat and lng query params are required",
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

      const weatherRes =
        await fetch(url);

      if (!weatherRes.ok) {
        throw new Error(
          `Open-Meteo returned HTTP ${weatherRes.status}`
        );
      }

      const weatherData =
        await weatherRes.json();

      const hourlyPrecipitation =
        weatherData.hourly
          ?.precipitation || [];

      const last24h =
        hourlyPrecipitation.slice(
          -24
        );

      const rainfall24h =
        last24h.reduce(
          (sum, value) =>
            sum + (value || 0),
          0
        );

      res.json({
        success: true,

        source:
          "Open-Meteo Live Weather Feed",

        currentPrecipitationMm:
          weatherData.current
            ?.precipitation ?? 0,

        rainfall24hMm:
          Math.round(
            rainfall24h * 10
          ) / 10,

        weatherCode:
          weatherData.current
            ?.weather_code ?? null,

        fetchedAt:
          new Date().toISOString(),
      });
    } catch (err) {
      console.error(
        "Weather error:",
        err
      );

      res.status(500).json({
        success: false,

        error:
          "Failed to reach live weather feed",

        details:
          err.message,
      });
    }
  }
);

// ==========================================
// CITIZEN SOS REPORTS
// ==========================================

// GET SOS REPORTS

app.get(
  "/api/sos",
  async (req, res) => {
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
      console.error(
        "SOS fetch error:",
        err
      );

      res.status(500).json({
        success: false,

        error: err.message,
      });
    }
  }
);

// POST SOS REPORT

app.post(
  "/api/sos",
  async (req, res) => {
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
        return res
          .status(400)
          .json({
            success: false,

            error:
              "location, issueType and description are required",
          });
      }

      const latitude =
        parseFloat(lat);

      const longitude =
        parseFloat(lng);

      if (
        Number.isNaN(
          latitude
        ) ||
        Number.isNaN(
          longitude
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Valid latitude and longitude are required",
          });
      }

      const savedReport =
        await prisma.sosReport.create({
          data: {
            reporterName:
              reporterName ||
              "Anonymous Citizen",

            location,

            lat: latitude,

            lng: longitude,

            issueType,

            description,
          },
        });

      console.log("");

      console.log(
        `📢 [CITIZEN SOS RECEIVED] ${issueType} near ${location}`
      );

      const roadUpdate =
        await updateRoadFromSosReport(
          latitude,
          longitude,
          issueType,
          description,
          location
        );

      res.status(201).json({
        success: true,

        message:
          "Ground report received and logged.",

        report:
          savedReport,

        roadConnectivityUpdate:
          roadUpdate,
      });
    } catch (err) {
      console.error(
        "SOS submit error:",
        err
      );

      res.status(500).json({
        success: false,

        error: err.message,
      });
    }
  }
);

// RESOLVE SOS REPORT

app.patch(
  "/api/sos/:id/resolve",
  async (req, res) => {
    try {
      const reportId =
        parseInt(
          req.params.id,
          10
        );

      if (
        Number.isNaN(
          reportId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Invalid SOS report ID",
          });
      }

      const updated =
        await prisma.sosReport.update({
          where: {
            id: reportId,
          },

          data: {
            status:
              "RESOLVED",
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
// FETCH ALERTS
// ==========================================

app.get(
  "/api/alerts",
  async (req, res) => {
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
      console.error(
        "Alerts fetch error:",
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
// DISPATCH ALERT
// ==========================================

app.post(
  "/api/alerts",
  async (req, res) => {
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
              location ||
              "Unknown Location",

            level:
              level ||
              "MODERATE",

            score:
              parseInt(
                score || 0,
                10
              ),

            rainfall:
              parseFloat(
                rainfall || 0
              ),

            dispatchedTo: [
              "NDRF State Unit",
              "District Disaster Authority",
              "SMS Broadcast Relay",
            ],
          },
        });

      triggerEmergencyProtocol(
        savedAlert
      );

      res.status(201).json({
        success: true,

        message:
          "Alert persisted and emergency protocol processed.",

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
  }
);

// ==========================================
// HINDI TEXT TO SPEECH
// ==========================================

app.post(
  "/api/tts",
  async (req, res) => {
    try {
      const {
        text,
        language,
      } = req.body;

      if (!text) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Text is required",
          });
      }

      if (
        language !== "hi"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error:
              "Piper TTS route currently supports Hindi only.",
          });
      }

      const modelPath =
        path.join(
          __dirname,
          "hi_IN-rohan-medium.onnx"
        );

      if (
        !fs.existsSync(
          modelPath
        )
      ) {
        return res
          .status(500)
          .json({
            success: false,

            error:
              "Hindi Piper voice model not found.",
          });
      }

      const pythonPath =
        path.join(
          __dirname,
          ".venv",
          "Scripts",
          "python.exe"
        );

      if (
        !fs.existsSync(
          pythonPath
        )
      ) {
        return res
          .status(500)
          .json({
            success: false,

            error:
              "Python virtual environment not found.",
          });
      }

      const ttsScript =
        path.join(
          __dirname,
          "tts.py"
        );

      if (
        !fs.existsSync(
          ttsScript
        )
      ) {
        return res
          .status(500)
          .json({
            success: false,

            error:
              "tts.py not found in backend folder.",
          });
      }

      const outputFile =
        path.join(
          __dirname,
          `tts-${Date.now()}.wav`
        );

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

        (
          error,
          stdout,
          stderr
        ) => {
          if (error) {
            console.error(
              "Piper TTS error:",
              error
            );

            if (stderr) {
              console.error(
                "Piper stderr:",
                stderr
              );
            }

            return res
              .status(500)
              .json({
                success: false,

                error:
                  "Hindi TTS generation failed.",

                details:
                  error.message,
              });
          }

          if (
            !fs.existsSync(
              outputFile
            )
          ) {
            return res
              .status(500)
              .json({
                success: false,

                error:
                  "TTS audio file was not generated.",
              });
          }

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

          audioStream.on(
            "close",
            () => {
              fs.unlink(
                outputFile,
                (
                  unlinkError
                ) => {
                  if (
                    unlinkError
                  ) {
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
        "TTS route error:",
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
// 404 HANDLER
// ==========================================

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,

      error:
        `Route not found: ${req.method} ${req.originalUrl}`,
    });
  }
);

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      err
    );

    res.status(
      err.status || 500
    ).json({
      success: false,

      error:
        err.message ||
        "Internal server error",
    });
  }
);

// ==========================================
// START SERVER
// ==========================================

app.listen(
  PORT,
  () => {
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
      "✅ Normal risk prediction API ready"
    );

    console.log(
      "✅ Machine Learning prediction API ready"
    );

    console.log(
      "✅ Shelter API ready"
    );

    console.log(
      "✅ Road connectivity API ready"
    );

    console.log(
      "✅ SOS → Road automation ready"
    );

    console.log(
      "✅ Live weather API ready"
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
  }
);