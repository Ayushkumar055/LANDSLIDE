/**
 * Emergency Audio Utilities
 * English: Browser Speech Synthesis
 * Hindi: Backend Piper TTS
 */

const API_BASE_URL = "http://localhost:5000";

/**
 * Generates an emergency siren using Web Audio API
 */
export const playEmergencySiren = () => {
  try {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";

    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      1400,
      ctx.currentTime + 0.25
    );
    osc.frequency.exponentialRampToValueAtTime(
      800,
      ctx.currentTime + 0.5
    );
    osc.frequency.exponentialRampToValueAtTime(
      1400,
      ctx.currentTime + 0.75
    );
    osc.frequency.exponentialRampToValueAtTime(
      800,
      ctx.currentTime + 1.0
    );

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.01,
      ctx.currentTime + 1.2
    );

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

  const voices = window.speechSynthesis.getVoices();

  const englishVoice =
    voices.find((voice) => voice.lang === "en-IN") ||
    voices.find((voice) => voice.lang === "en-US") ||
    voices.find((voice) =>
      voice.lang.toLowerCase().startsWith("en")
    );

  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  console.log("Speaking English alert:", text);

  window.speechSynthesis.speak(utterance);
};


/**
 * Speak Hindi emergency advisory using backend Piper TTS
 */
const speakHindi = async (
  locationName,
  riskLevel,
  riskScore
) => {
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
    console.log("Requesting Hindi Piper TTS:", text);

    const response = await fetch(
      `${API_BASE_URL}/api/tts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          language: "hi",
        }),
      }
    );

    if (!response.ok) {
      throw new Error(
        `Hindi TTS request failed: ${response.status}`
      );
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
    console.error("Hindi Piper TTS error:", error);
  }
};


/**
 * Main emergency advisory function
 *
 * language:
 * "en" = English browser voice
 * "hi" = Hindi Piper backend voice
 */
export const speakEmergencyAdvisory = async (
  locationName,
  riskLevel,
  riskScore,
  language = "en"
) => {

  const selectedLanguage = String(
    language || "en"
  ).toLowerCase();

  if (selectedLanguage.startsWith("hi")) {

    await speakHindi(
      locationName,
      riskLevel,
      riskScore
    );

  } else {

    speakEnglish(
      locationName,
      riskLevel,
      riskScore
    );
  }
};