/**
 * Speak assistant text-to-speech prompt
 */
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string, force = true, langTag = "en-US", isManual = true) {
  if (!("speechSynthesis" in window)) {
    console.warn("Speech synthesis not supported in this browser.");
    return;
  }

  if (isManual) {
    (window as any).lastManualSpeakTime = Date.now();
  }

  if (force) {
    window.speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langTag;
  
  // Set voice options corresponding to the language requested
  const voices = window.speechSynthesis.getVoices();
  let selectedVoice = voices.find((v) => v.lang.toLowerCase() === langTag.toLowerCase());

  // Fallback to searching by language prefix (like 'ur', 'pa', 'zh', 'ar', 'fa')
  if (!selectedVoice) {
    const langPrefix = langTag.split("-")[0].toLowerCase();
    selectedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
  }

  // Fallback to standard US/GB voice if we failed to match language prefix and it is English
  if (!selectedVoice && langTag.startsWith("en")) {
    selectedVoice = voices.find((v) => v.lang.includes("en-US") || v.lang.includes("en-GB"));
  }

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.rate = 1.05; // Perfect rate for visually impaired reading
  utterance.pitch = 1.0;
  
  currentUtterance = utterance;

  utterance.onend = () => {
    if (currentUtterance === utterance) {
      currentUtterance = null;
    }
  };

  utterance.onerror = (e) => {
    console.error("SpeechSynthesis error:", e);
    if (currentUtterance === utterance) {
      currentUtterance = null;
    }
  };

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

export function isSpeaking(): boolean {
  if ("speechSynthesis" in window) {
    return window.speechSynthesis.speaking;
  }
  return false;
}
