import React, { useRef, useState, useEffect } from "react";
import CameraDetector from "./components/CameraDetector";
import AssistantConsole from "./components/AssistantConsole";
import { speak } from "./utils/speech";
import { Coordinates, SUPPORTED_LANGUAGES, LanguageOption } from "./types";
import { 
  ShieldAlert, 
  Volume2, 
  Accessibility, 
  Moon, 
  Navigation, 
  HelpCircle,
  Eye, 
  Info 
} from "lucide-react";

export default function App() {
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const [isRealtimeAnnounceEnabled, setRealtimeAnnounceEnabled] = useState<boolean>(true);
  const [hasUserInteracted, setHasUserInteracted] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(SUPPORTED_LANGUAGES[0]);
  const [gpsCoords, setGpsCoords] = useState<Coordinates>({
    latitude: null,
    longitude: null,
    address: null
  });

  // Welcome user once they perform their first interaction (bypasses browser autoplay block on TTS)
  useEffect(() => {
    if (hasUserInteracted) {
      speak(
        "Welcome. Voice Camera and Location Assistant is active. Please swipe or tab through screen elements to hear directions. Press and hold any item to activate."
      );
    }
  }, [hasUserInteracted]);

  // Request initial GPS update for local surrounding alerts
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            setGpsCoords({
              latitude,
              longitude,
              address: data.address || null
            });
          } catch (e) {
            setGpsCoords({
              latitude,
              longitude,
              address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            });
          }
        },
        null,
        { enableHighAccuracy: true }
      );
    }
  }, []);

  return (
    <div 
      className="min-h-screen bg-[#0F172A] text-white font-sans flex flex-col justify-between"
      onClick={() => {
        if (!hasUserInteracted) {
          setHasUserInteracted(true);
        }
      }}
    >
      {/* 1. Header with large high-contrast visual cues */}
      <header 
        className="border-b-4 border-[#FDE047] bg-[#1E293B] p-5 sticky top-0 z-50 backdrop-blur-md rounded-b-2xl shadow-xl"
        onMouseEnter={() => speak("Header: Voice Camera and Location Assistant for the Blind", false)}
        onFocus={() => speak("Header: Voice Camera and Location Assistant for the Blind", false)}
        tabIndex={0}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="bg-[#FDE047] text-black p-2.5 rounded-2xl shadow-md border-b-4 border-yellow-600">
              <Accessibility className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                ASSISTIVE VOICE EYE
                <div className="flex items-center gap-1.5 bg-[#0F172A] border border-green-500/30 px-2 py-0.5 rounded">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </div>
                  <span className="text-[10px] font-mono text-green-400 font-black tracking-wider uppercase">
                    YOLO v11n LIVE
                  </span>
                </div>
              </h1>
              <p className="text-xs font-bold text-slate-400 font-mono tracking-wide">
                CAMERA DETECTOR & LOCATION SYSTEM FOR VISUALLY IMPAIRED
              </p>
            </div>
          </div>
          
          {/* Audio confirmation state badge */}
          <div className="flex items-center space-x-3">
            {!hasUserInteracted ? (
              <button 
                onClick={() => setHasUserInteracted(true)}
                className="bg-[#FDE047] hover:bg-yellow-300 text-black font-black text-xs px-5 py-3 rounded-full animate-bounce shadow-lg cursor-pointer border-2 border-white focus:outline-none focus:ring-4 focus:ring-yellow-400"
                aria-label="Click here to activate voice instructions and assistive guidance speaker."
              >
                🔊 ACTIVATE VOICE (TAP HERE)
              </button>
            ) : (
              <span className="bg-[#0F172A] border border-[#334155] text-[#FDE047] text-xs font-bold font-mono px-4 py-2 rounded-full flex items-center gap-1.5 shadow-sm">
                <Volume2 className="w-4 h-4 text-green-500 animate-pulse" />
                <span>ASSISTIVE SOUNDS LIVE</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main content grids */}
      <main className="max-w-6xl w-full mx-auto p-5 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-grow">
        
        {/* Left Side: Camera viewport feedback */}
        <section className="lg:col-span-5 space-y-6 flex flex-col justify-center">
          <CameraDetector
            onModelLoaded={setModelLoaded}
            isRealtimeAnnounceEnabled={isRealtimeAnnounceEnabled}
            setRealtimeAnnounceEnabled={setRealtimeAnnounceEnabled}
            videoRef={videoRef}
            selectedLanguage={selectedLanguage}
          />
          
          {/* Info Card: Direct description on how to operate with sound */}
          <div 
            className="bg-[#1E293B] border-4 border-[#334155] rounded-3xl p-6 text-left text-slate-300 text-sm space-y-3 shadow-2xl"
            onMouseEnter={() => speak("Camera Feed Information panel. Realtime AI identifies physical items on-screen.", false)}
            onFocus={() => speak("Camera Feed Information panel. Realtime AI identifies physical items on-screen.", false)}
            tabIndex={0}
          >
            <div className="flex items-center space-x-2 text-white font-black uppercase text-xs tracking-wider">
              <Info className="w-4 h-4 text-[#FDE047]" />
              <span className="text-slate-400 uppercase font-black tracking-widest">Camera Detector Details</span>
            </div>
            <p className="text-slate-200 leading-snug font-medium">
              We leverage an on-device local <strong className="text-[#FDE047] font-semibold">YOLO-architecture network</strong>. It scans your surround area at 5 Frames Per Second, calling out objects in front of you. 
            </p>
            <p className="text-xs text-[#FDE047] font-mono font-bold uppercase">
              Fully self-contained client-side process. Safe, private, and fast.
            </p>
          </div>
        </section>

        {/* Right Side: Bento tactical giant buttons + Assistant response text */}
        <section className="lg:col-span-7">
          <AssistantConsole
            videoRef={videoRef}
            isModelLoaded={modelLoaded}
            gpsCoords={gpsCoords}
            setGpsCoords={setGpsCoords}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
          />
        </section>

      </main>

      {/* 3. Footer */}
      <footer 
        className="bg-[#1E293B] border-t-4 border-[#334155] p-5 mt-8 text-center text-slate-400 text-xs font-semibold rounded-t-2xl shadow-inner"
        onMouseEnter={() => speak("Footer. Assisted Access Version 2.0", false)}
        onFocus={() => speak("Footer. Assisted Access Version 2.0", false)}
        tabIndex={0}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono">
            &copy; 2026 ASSISTIVE TECHNOLOGY HUB &bull; POWERED BY GEMINI 3.5 &amp; COCO
          </p>
          <div className="flex items-center space-x-4 text-zinc-400">
            <span className="bg-[#0F172A] border border-[#334155] text-slate-300 font-mono font-bold text-xs px-3.5 py-1.5 rounded-xl">
              GPS: {gpsCoords.latitude ? `${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude?.toFixed(4)}` : "ACQUIRING..."}
            </span>
            <span className="bg-[#0F172A] border border-[#334155] text-slate-300 font-mono font-bold text-xs px-3.5 py-1.5 rounded-xl">
              MODEL: {modelLoaded ? "COCO-SSD MOBILE" : "LOADING..."}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
