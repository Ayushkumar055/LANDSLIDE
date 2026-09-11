// ================= EMERGENCY SIREN BEEP =================
export const playEmergencySiren = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    console.warn("Audio Context beep error:", err);
  }
};

// ================= DUAL HINDI & ENGLISH SPEECH BROADCAST =================
export const speakEmergencyAdvisory = (locationName, level, score, currentLang = "en") => {
  if (!("speechSynthesis" in window)) {
    console.warn("Speech Synthesis not supported in this browser.");
    return;
  }

  // Cancel any ongoing or stuck speech
  window.speechSynthesis.cancel();

  const isHindi = currentLang === "hi" || currentLang?.startsWith("hi");

  let message = "";
  if (isHindi) {
    message = `चेतावनी! ${locationName} में भूस्खलन का खतरा ${level} स्तर पर है। जोखिम स्कोर ${score} प्रतिशत है। कृपया सुरक्षित स्थान पर जाएं।`;
  } else {
    message = `Emergency Alert! Landslide threat level at ${locationName} is ${level}, with a risk score of ${score} percent. Immediate precaution and evacuation advised.`;
  }

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 0.92;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const configureVoiceAndPlay = () => {
    const voices = window.speechSynthesis.getVoices();

    if (isHindi) {
      utterance.lang = "hi-IN";
      const hindiVoice = voices.find(
        (v) => v.lang === "hi-IN" || v.lang.startsWith("hi") || v.name.toLowerCase().includes("hindi")
      );

      if (hindiVoice) {
        utterance.voice = hindiVoice;
      } else {
        // Fallback agar PC me Devanagari voice package na ho
        utterance.lang = "en-IN";
        utterance.text = `Chetavani! ${locationName} mein landslide threat level ${level} hai. Risk score ${score} percent hai. Kripya safe area ki taraf jayein.`;
      }
    } else {
      // Clean English Pronunciation (en-IN, en-US, en-GB)
      utterance.lang = "en-US";
      const englishVoice = voices.find(
        (v) => v.lang === "en-US" || v.lang === "en-GB" || v.lang === "en-IN" || v.lang.startsWith("en")
      );
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
    }

    // Beep sound ke baad clearly bolna shuru kare
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 280);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    configureVoiceAndPlay();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      configureVoiceAndPlay();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }
};