export interface ObjectDetection {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

export type AssistantMode = "navigation" | "text" | "money";

export interface SystemStatus {
  cameraReady: boolean;
  gpsReady: boolean;
  cocoLoded: boolean;
  speechListening: boolean;
}

export interface Coordinates {
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  langTag: string; // SpeechSynthesis language tag
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", langTag: "en-US" },
  { code: "ur", name: "Urdu", nativeName: "اردو", langTag: "ur-PK" },
  { code: "sr", name: "Saraiki", nativeName: "سرائیکی", langTag: "ur-PK" }, // Falls back to Urdu speech voice
  { code: "pa", name: "Punjabi", nativeName: "پنجابی / ਪੰਜਾਬੀ", langTag: "pa-IN" },
  { code: "zh", name: "Chinese", nativeName: "中文", langTag: "zh-CN" },
  { code: "ps", name: "Pashto", nativeName: "پښتو", langTag: "ps-AF" },
  { code: "fa", name: "Persian", nativeName: "فارسی", langTag: "fa-IR" },
  { code: "ar", name: "Arabic", nativeName: "العربية", langTag: "ar-SA" }
];
