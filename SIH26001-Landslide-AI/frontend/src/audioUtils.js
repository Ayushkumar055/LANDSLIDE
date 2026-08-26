/**
 * Generates an oscillating emergency siren sound using Web Audio API
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
  } catch (err) {
    console.error("Audio siren error:", err);
  }
};

/**
 * Speaks an automated emergency advisory using Web Speech API
 */
export const speakEmergencyAdvisory = (locationName, riskLevel, riskScore) => {
  if (!("speechSynthesis" in window)) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const text = `Emergency Warning. ${riskLevel} landslide susceptibility detected in ${locationName}. Multi-factor risk index is ${riskScore} percent. Early evacuation protocol active.`;
  const utterance = new SpeechSynthesisUtterance(text);
  
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  window.speechSynthesis.speak(utterance);
};