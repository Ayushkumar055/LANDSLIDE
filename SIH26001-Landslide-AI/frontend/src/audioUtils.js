/**
 * Emergency Audio Utilities
 * English: Browser Speech Synthesis
 * Hindi: Backend Piper TTS (with automatic browser fallback)
 */

const API_BASE_URL =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:5000"
    : "https://landslide-backend1.onrender.com";

/**
 * Generates an emergency siren using Web Audio API
 */
export const playEmergencySiren = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";

    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.25);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.5);
    osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.75);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 1.0);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 1.2);

    setTimeout(() => {
      ctx.close();
    }, 1500);
  } catch (err) {
    console.error("Audio siren error:", err);
  }
};

/**
 * Speak English emergency advisory using browser voice
 */
const speakEnglish = (locationName, riskLevel, riskScore) => {
  if (!("speechSynthesis" in window)) {
    console.warn("Speech synthesis is not supported.");
    return;
  }

  window.speechSynthesis.cancel();

  const text =
    `Emergency warning. ` +
    `${riskLevel} landslide risk detected in ${locationName}. ` +
    `The risk score is ${riskScore} percent. ` +
    `Please prepare to move to a safe location.`;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const playVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const englishVoice =
      voices.find((voice) => voice.lang === "en-IN") ||
      voices.find((voice) => voice.lang === "en-US") ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));

    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    playVoice();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      playVoice();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }
};

/**
 * Fallback browser TTS for Hindi when backend Piper is unreachable
 */
const speakHindiBrowserFallback = (locationName, riskLevel, riskScore) => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();

  const hindiRisk = {
    LOW: "कम",
    MODERATE: "मध्यम",
    HIGH: "उच्च",
    CRITICAL: "गंभीर",
  };
  const risk = hindiRisk[riskLevel] || riskLevel;

  const utterance = new SpeechSynthesisUtterance();
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const nativeHindiVoice = voices.find(
    (v) =>
      v.lang.toLowerCase().includes("hi") ||
      v.name.toLowerCase().includes("hindi") ||
      v.name.toLowerCase().includes("kalpana") ||
      v.name.toLowerCase().includes("hemant")
  );

  if (nativeHindiVoice) {
    utterance.lang = "hi-IN";
    utterance.voice = nativeHindiVoice;
    utterance.text = `आपातकालीन चेतावनी। ${locationName} में भूस्खलन का ${risk} जोखिम पाया गया है। जोखिम स्कोर ${riskScore} प्रतिशत है। कृपया सुरक्षित स्थान पर जाने की तैयारी करें।`;
  } else {
    // Agar system mein Hindi voice pack na ho toh Indian English voice se Hindi bolwana
    const indianVoice = voices.find(
      (v) => v.lang === "en-IN" || v.name.toLowerCase().includes("india")
    );
    if (indianVoice) utterance.voice = indianVoice;
    utterance.lang = "en-IN";
    utterance.text = `Aapaatkaaleen chetaavani. ${locationName} mein landslide ka ${risk} risk paya gaya hai. Risk score ${riskScore} percent hai. Kripya safe sthaan par jaane ki taiyaari karein.`;
  }

  window.speechSynthesis.speak(utterance);
};

/**
 * Speak Hindi emergency advisory using backend Piper TTS with failover
 */
const speakHindi = async (locationName, riskLevel, riskScore) => {
  const hindiRisk = {
    LOW: "कम",
    MODERATE: "मध्यम",
    HIGH: "उच्च",
    CRITICAL: "गंभीर",
  };

  const risk = hindiRisk[riskLevel] || riskLevel;

  const text =
    `आपातकालीन चेतावनी। ` +
    `${locationName} में भूस्खलन का ${risk} जोखिम पाया गया है। ` +
    `जोखिम स्कोर ${riskScore} प्रतिशत है। ` +
    `कृपया सुरक्षित स्थान पर जाने की तैयारी करें।`;

  try {
    console.log("Requesting Hindi Piper TTS from:", `${API_BASE_URL}/api/tts`);

    // Abort after 4 seconds if Render backend is sleeping
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE_URL}/api/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        language: "hi",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Hindi TTS request failed: ${response.status}`);
    }

    const audioBlob = await response.blob();
    if (audioBlob.size === 0) {
      throw new Error("Received empty audio file.");
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.volume = 1.0;

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };

    await audio.play();
    console.log("Hindi Piper TTS playing successfully.");
  } catch (error) {
    console.warn("Hindi Piper TTS unavailable, switching to browser fallback:", error.message);
    speakHindiBrowserFallback(locationName, riskLevel, riskScore);
  }
};

/**
 * Main emergency advisory function
 * language: "en" | "hi"
 */
export const speakEmergencyAdvisory = async (
  locationName,
  riskLevel,
  riskScore,
  language = "en"
) => {
  const selectedLanguage = String(language || "en").toLowerCase();

  if (selectedLanguage.startsWith("hi")) {
    await speakHindi(locationName, riskLevel, riskScore);
  } else {
    speakEnglish(locationName, riskLevel, riskScore);
  }
};