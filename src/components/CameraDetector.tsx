import React, { useEffect, useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { speak } from "../utils/speech";
import { ObjectDetection, LanguageOption } from "../types";
import { Shield, Sparkles, Loader2, Video, Volume2, VolumeX, AlertTriangle, RefreshCw } from "lucide-react";

interface CameraDetectorProps {
  onModelLoaded: (loaded: boolean) => void;
  isRealtimeAnnounceEnabled: boolean;
  setRealtimeAnnounceEnabled: (enabled: boolean) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  selectedLanguage: LanguageOption;
}

export default function CameraDetector({
  onModelLoaded,
  isRealtimeAnnounceEnabled,
  setRealtimeAnnounceEnabled,
  videoRef,
  selectedLanguage
}: CameraDetectorProps) {
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>("Initializing camera and AI...");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const predictionInterval = useRef<NodeJS.Timeout | null>(null);
  const spokenHistory = useRef<{ [key: string]: number }>({}); // Timestamp pool for speech throttle
  const [activeDetections, setActiveDetections] = useState<ObjectDetection[]>([]);
  const isAnalyzing = useRef<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);

  // Initialize TensorFlow and load COCO-SSD Model
  useEffect(() => {
    async function setupAI() {
      try {
        setLoadingStatus("Preparing AI engine...");
        await tf.ready();
        
        // Handle CPU backend fallback if WebGL fails in some environments
        try {
          await tf.setBackend("webgl");
        } catch (bgError) {
          console.warn("WebGL not supported, falling back to CPU backend.", bgError);
          await tf.setBackend("cpu");
        }

        setLoadingStatus("Loading object detection model (COCO-SSD)...");
        const loadedModel = await cocoSsd.load({
          base: "lite_mobilenet_v2", // Faster and lighter model suitable for web browsers and mobile
        });
        
        setModel(loadedModel);
        onModelLoaded(true);
        setLoadingStatus("AI Model loaded successfully.");
        
        const selectLang = selectedLanguage.code;
        let readyMsg = "Object detection ready. Real-time assistant is active.";
        if (selectLang === "ur") readyMsg = "اشیاء کی شناخت کا نظام تیار ہے، لائیو معاون فعال ہے۔";
        else if (selectLang === "sr") readyMsg = "اشیاء سنجاݨݨ دا نظام تیار ہے، لائیو معاون فعال ہے۔";
        else if (selectLang === "pa") readyMsg = "چیزاں دی سنجان دا نظام تیار اے، لائیو معاون فعال ہو گیا اے۔";
        else if (selectLang === "zh") readyMsg = "物体检测已就绪。实时助理已开启。";
        else if (selectLang === "ps") readyMsg = "د شیانو پیژندنه چمتو ده. ریښتیني وخت مرستیال فعال دی.";
        else if (selectLang === "fa") readyMsg = "سیستم تشخیص اشیاء آماده است. دستیار صوتی فعال شد.";
        else if (selectLang === "ar") readyMsg = "نظام رصد الأشياء جاهز. المساعد الفوري نشط الآن.";
        
        speak(readyMsg, true, selectedLanguage.langTag);
      } catch (err: any) {
        console.error("AI Setup Error:", err);
        setErrorMsg("Failed to load object detection. Let's restart. " + err.message);
        setLoadingStatus("Error loading model.");
      }
    }

    setupAI();

    return () => {
      if (predictionInterval.current) {
        clearInterval(predictionInterval.current);
      }
    };
  }, [onModelLoaded]);

  // Request & Bind Camera Stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    async function startCamera() {
      try {
        setErrorMsg(null);
        setCameraActive(false);
        
        // Request user camera specifically emphasizing the rear camera ("environment") if on mobile
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraActive(true);
          };
        }
      } catch (err: any) {
        console.error("Camera access failed:", err);
        setErrorMsg("Camera access denied or unavailable. Please enable camera permission in your browser.");
        
        const selectLang = selectedLanguage.code;
        let camErrorMsg = "Camera access error. Please grant permission in your browser to proceed.";
        if (selectLang === "ur") camErrorMsg = "کیمرہ تک رسائی کی خرابی، براؤزر میں اجازت دیں۔";
        else if (selectLang === "sr") camErrorMsg = "کیمرہ تک رسائی دا مسلہ، براؤزر وچ اجازت ڈیو۔";
        else if (selectLang === "pa") camErrorMsg = "کیمرے دی اجازت نہیں ملی، مہربانی کر کے براؤزر وچ اجازت دیو۔";
        else if (selectLang === "zh") camErrorMsg = "相机访问错误。请在浏览器中授予权限以继续。";
        else if (selectLang === "ps") camErrorMsg = "کیمرې ته د لاسرسي تېروتنه. مهرباني وکړئ لاسرسی خلاص کړئ.";
        else if (selectLang === "fa") camErrorMsg = "خطا در دسترسی به دوربین. لطفا مجوز دسترسی را در مرورگر صادر کنید.";
        else if (selectLang === "ar") camErrorMsg = "خطأ في الوصول إلى الكاميرا. يرجى تفعيل صلاحية الكاميرا في المتصفح.";
        
        speak(camErrorMsg, true, selectedLanguage.langTag);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [videoRef]);

  // Start Predictive loop when model and camera are ready
  useEffect(() => {
    if (!model || !cameraActive) return;

    // Run prediction at throttled local interval (around 4-5 times a second)
    predictionInterval.current = setInterval(() => {
      detectObjects();
    }, 220);

    return () => {
      if (predictionInterval.current) {
        clearInterval(predictionInterval.current);
      }
    };
  }, [model, cameraActive]);

  // Execute Direct Detection
  async function detectObjects() {
    const video = videoRef.current;
    if (!video || !model || isAnalyzing.current || video.readyState !== 4) return;

    try {
      isAnalyzing.current = true;
      const predictions = await model.detect(video);
      isAnalyzing.current = false;

      // Filter reliable detections
      const validDetections = predictions.filter((p) => p.score > 0.48);
      setActiveDetections(validDetections);

      // Perform canvas drawings for bounding boxes
      drawCanvas(validDetections);

      // Generate Voice Announcements if enabled
      if (isRealtimeAnnounceEnabled) {
        processVoiceAlerts(validDetections);
      }
    } catch (err) {
      console.error("Prediction loop outer error:", err);
      isAnalyzing.current = false;
    }
  }

  // Draw detected box outlines
  function drawCanvas(detections: cocoSsd.DetectedObject[]) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas display sizes with stream video sizes
    const width = video.videoWidth;
    const height = video.videoHeight;
    
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    detections.forEach((detection) => {
      const [x, y, w, h] = detection.bbox;
      
      // Draw neon border for accessibility view
      ctx.strokeStyle = "#F59E0B"; // bright orange
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);

      // Draw semi-transparent background fill
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(x, y - 32 > 0 ? y - 32 : 0, w, 32);

      // Draw prediction label with high-contrast font
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 16px Inter, system-ui, sans-serif";
      const confidence = Math.round(detection.score * 100);
      ctx.fillText(`${detection.class} (${confidence}%)`, x + 6, y - 10 > 15 ? y - 10 : 20);
    });
  }

  // Generate Smart Directional and Distance alerts for Blind User helper
  function processVoiceAlerts(detections: cocoSsd.DetectedObject[]) {
    const video = videoRef.current;
    if (!video) return;

    const vWidth = video.videoWidth || 640;
    const vHeight = video.videoHeight || 480;
    const now = Date.now();

    // Global throttle of 3 seconds between any separate real-time object announcements
    const lastRealtime = (window as any).lastRealtimeSpeakTime || 0;
    if (now - lastRealtime < 3000) {
      return;
    }

    // Block real-time automatic warnings if any manual query/guide has been played recently (within 6.5s)
    const lastManual = (window as any).lastManualSpeakTime || 0;
    if (now - lastManual < 6500) {
      return;
    }

    // Block real-time alerts if standard speechSynthesis is currently active
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      return;
    }

    // Multilingual object labels map
    const labelsMap: { [lang: string]: { [label: string]: string } } = {
      en: {
        person: "person",
        chair: "chair",
        table: "table",
        "dining table": "dining table",
        diningtable: "dining table",
        phone: "phone",
        computer: "computer",
        bottle: "bottle",
        cup: "cup",
        bowl: "bowl",
        couch: "couch",
        bed: "bed",
        door: "door",
        bag: "bag",
        purse: "purse",
        luggage: "luggage",
        screen: "screen",
        scissors: "scissors",
        book: "book",
        steps: "steps",
        vehicle: "vehicle",
        bicycle: "bicycle",
        motorcycle: "motorcycle",
        bus: "bus",
        cat: "cat",
        dog: "dog",
        clock: "clock"
      },
      ur: {
        person: "بندہ",
        chair: "کرسی",
        table: "میز",
        "dining table": "کھانے کی میز",
        diningtable: "کھانے کی میز",
        phone: "فون",
        computer: "کمپیوٹر",
        bottle: "بوتل",
        cup: "کپ",
        bowl: "پیالہ",
        couch: "صوفہ",
        bed: "بستر",
        door: "دروازہ",
        bag: "بستہ",
        purse: "پرس",
        luggage: "سامان",
        screen: "اسکرین",
        scissors: "قینچی",
        book: "کتاب",
        steps: "سیڑھیاں",
        vehicle: "گاڑی",
        bicycle: "سائیکل",
        motorcycle: "موٹر سائیکل",
        bus: "بس",
        cat: "بلی",
        dog: "کتا",
        clock: "گھڑی"
      },
      sr: {
        person: "بندہ",
        chair: "کرسی",
        table: "میز",
        "dining table": "کھاوݨ دی میز",
        diningtable: "کھاوݨ دی میز",
        phone: "فون",
        computer: "کمپیوٹر",
        bottle: "بوتل",
        cup: "کپ",
        bowl: "پیالہ",
        couch: "صوفہ",
        bed: "بستر",
        door: "دروازہ",
        bag: "بستہ",
        purse: "لیڈیز پرس",
        luggage: "سامان",
        screen: "ٹی وی اسکرین",
        scissors: "قینچی",
        book: "کتاب",
        steps: "پوڑیاں",
        vehicle: "گاڑی",
        bicycle: "سائیکل",
        motorcycle: "موٹر سائیکل",
        bus: "بس",
        cat: "بلی",
        dog: "کتا",
        clock: "گھڑی"
      },
      pa: {
        person: "بندہ",
        chair: "کرسی",
        table: "میز",
        "dining table": "کھانے والی میز",
        diningtable: "کھانے والی میز",
        phone: "فون",
        computer: "کمپیوٹر",
        bottle: "بوتل",
        cup: "کپ",
        bowl: "پیالہ",
        couch: "صوفہ",
        bed: "بستر",
        door: "دروازہ",
        bag: "بستہ",
        purse: "پرس",
        luggage: "سامان",
        screen: "اسکرین",
        scissors: "قینچی",
        book: "کتاب",
        steps: "پوڑیاں",
        vehicle: "گڈی",
        bicycle: "سائیکل",
        motorcycle: "موٹر سائیکل",
        bus: "بس",
        cat: "بلی",
        dog: "کتا",
        clock: "گھڑی"
      },
      zh: {
        person: "人",
        chair: "椅子",
        table: "桌子",
        "dining table": "餐桌",
        diningtable: "餐桌",
        phone: "电话",
        computer: "电脑",
        bottle: "瓶子",
        cup: "杯子",
        bowl: "碗",
        couch: "沙发",
        bed: "床",
        door: "门",
        bag: "包",
        purse: "手提包",
        luggage: "行李",
        screen: "屏幕",
        scissors: "剪刀",
        book: "书",
        steps: "台阶",
        vehicle: "车辆",
        bicycle: "自行车",
        motorcycle: "摩托车",
        bus: "公交车",
        cat: "猫",
        dog: "狗",
        clock: "钟表"
      },
      ps: {
        person: "سړی",
        chair: "چوکۍ",
        table: "مایز",
        "dining table": "د ډوډۍ خوړلو میز",
        diningtable: "د ډوډۍ خوړلو میز",
        phone: "ټلیفون",
        computer: "کمپیوټر",
        bottle: "بوتل",
        cup: "پیاله",
        bowl: "کاسه",
        couch: "صوفه",
        bed: "بستر",
        door: "دروازه",
        bag: "بکس",
        purse: "لاسي کڅوړه",
        luggage: "سامان",
        screen: "سکرین",
        scissors: "کاشوغه",
        book: "کتاب",
        steps: "امسا",
        vehicle: "موټر",
        bicycle: "سایکل",
        motorcycle: "موټرسایکل",
        bus: "بس",
        cat: "پیشو",
        dog: "سپی",
        clock: "ساعت"
      },
      fa: {
        person: "شخص",
        chair: "صندلی",
        table: "میز",
        "dining table": "میز غذاخوری",
        diningtable: "میز غذاخوری",
        phone: "تلفن همراه",
        computer: "رایانه",
        bottle: "بطری",
        cup: "فنجان",
        bowl: "کاسه",
        couch: "مبل",
        bed: "تخت خواب",
        door: "در",
        bag: "کیف",
        purse: "کیف دستی",
        luggage: "چمدان",
        screen: "صفحه نمایش",
        scissors: "قیچی",
        book: "کتاب",
        steps: "پله",
        vehicle: "خودرو",
        bicycle: "دوچرخه",
        motorcycle: "موتورسیکلت",
        bus: "اتوبوس",
        cat: "گربه",
        dog: "سگ",
        clock: "ساعت"
      },
      ar: {
        person: "شخص",
        chair: "كرسي",
        table: "طاولة",
        "dining table": "طاولة طعام",
        diningtable: "طاولة طعام",
        phone: "هاتف",
        computer: "كمبيوتر",
        bottle: "زجاجة",
        cup: "كوب",
        bowl: "وعاء",
        couch: "أريكة",
        bed: "سرير",
        door: "باب",
        bag: "حقيبة",
        purse: "حقيبة يد",
        luggage: "أمتعة",
        screen: "شاشة",
        scissors: "مقص",
        book: "كتاب",
        steps: "سلالم",
        vehicle: "سيارة",
        bicycle: "دراجة هوائية",
        motorcycle: "دراجة نارية",
        bus: "حافلة",
        cat: "قطة",
        dog: "كلب",
        clock: "ساعة"
      }
    };

    // Helper translation formatter for friendly class labels
    const friendlyLabels: { [key: string]: string } = {
      person: "person",
      chair: "chair",
      table: "table",
      "dining table": "dining table",
      diningtable: "dining table",
      "cell phone": "phone",
      laptop: "computer",
      bottle: "bottle",
      cup: "cup",
      bowl: "bowl",
      couch: "couch",
      bed: "bed",
      door: "door",
      backpack: "bag",
      handbag: "purse",
      suitcase: "luggage",
      tv: "screen",
      scissors: "scissors",
      book: "book",
      stairs: "steps",
      car: "vehicle",
      bicycle: "bicycle",
      motorcycle: "motorcycle",
      bus: "bus",
      cat: "cat",
      dog: "dog",
      clock: "clock"
    };

    // Sort detections by size (largest/closest items first)
    const sortedDetections = [...detections].sort((a, b) => {
      const areaA = a.bbox[2] * a.bbox[3];
      const areaB = b.bbox[2] * b.bbox[3];
      return areaB - areaA;
    });

    const langCode = selectedLanguage.code;

    for (const det of sortedDetections) {
      const rawClass = det.class;
      const baseLabel = friendlyLabels[rawClass] || rawClass;

      // Translate the friendly base label for current language
      const langLabels = labelsMap[langCode] || labelsMap["en"];
      const localizedLabel = langLabels[baseLabel] || baseLabel;

      // Throttle speech checks - don't repeat the same label in 4.5 seconds
      const lastSpoken = spokenHistory.current[baseLabel] || 0;
      if (now - lastSpoken < 4500) {
        continue;
      }

      const [x, y, w, h] = det.bbox;
      const centerX = x + w / 2;
      const boxArea = w * h;
      const totalArea = vWidth * vHeight;
      const areaFraction = boxArea / totalArea;

      // Classify directions
      let type: "close" | "ahead" | "left" | "right" = "ahead";
      if (areaFraction > 0.16) {
        type = "close";
      } else if (centerX < vWidth * 0.35) {
        type = "left";
      } else if (centerX > vWidth * 0.65) {
        type = "right";
      }

      // Sentence translation formatter (Direct & Clear alerts for quick real-time navigation)
      let sentence = "";
      if (langCode === "ur") {
        if (type === "close") sentence = `قریب: ${localizedLabel}`;
        else if (type === "ahead") sentence = `سامنے: ${localizedLabel}`;
        else if (type === "left") sentence = `بائیں: ${localizedLabel}`;
        else sentence = `دائیں: ${localizedLabel}`;
      } 
      else if (langCode === "sr") { // Saraiki
        if (type === "close") sentence = `قریب: ${localizedLabel}`;
        else if (type === "ahead") sentence = `سامݨے: ${localizedLabel}`;
        else if (type === "left") sentence = `کھٻے: ${localizedLabel}`;
        else sentence = `سڄے: ${localizedLabel}`;
      }
      else if (langCode === "pa") { // Punjabi
        if (type === "close") sentence = `قریب: ${localizedLabel}`;
        else if (type === "ahead") sentence = `سامنے: ${localizedLabel}`;
        else if (type === "left") sentence = `کھبے: ${localizedLabel}`;
        else sentence = `سجے: ${localizedLabel}`;
      }
      else if (langCode === "zh") { // Chinese
        if (type === "close") sentence = `靠近：${localizedLabel}`;
        else if (type === "ahead") sentence = `前方：${localizedLabel}`;
        else if (type === "left") sentence = `左边：${localizedLabel}`;
        else sentence = `右边：${localizedLabel}`;
      }
      else if (langCode === "ps") { // Pashto
        if (type === "close") sentence = `نږدې: ${localizedLabel}`;
        else if (type === "ahead") sentence = `مخامخ: ${localizedLabel}`;
        else if (type === "left") sentence = `کیڼ: ${localizedLabel}`;
        else sentence = `ښي: ${localizedLabel}`;
      }
      else if (langCode === "fa") { // Persian
        if (type === "close") sentence = `نزدیک: ${localizedLabel}`;
        else if (type === "ahead") sentence = `روبرو: ${localizedLabel}`;
        else if (type === "left") sentence = `سمت چپ: ${localizedLabel}`;
        else sentence = `سمت راست: ${localizedLabel}`;
      }
      else if (langCode === "ar") { // Arabic
        if (type === "close") sentence = `قريب: ${localizedLabel}`;
        else if (type === "ahead") sentence = `أمامك: ${localizedLabel}`;
        else if (type === "left") sentence = `يسار: ${localizedLabel}`;
        else sentence = `يمين: ${localizedLabel}`;
      }
      else { // English - ultra-direct
        if (type === "close") sentence = `Close: ${localizedLabel}`;
        else if (type === "ahead") sentence = `Ahead: ${localizedLabel}`;
        else if (type === "left") sentence = `Left: ${localizedLabel}`;
        else sentence = `Right: ${localizedLabel}`;
      }

      // Speak with force = true, isManual = false so it triggers instantly and cancels previous stale alerts immediately
      speak(sentence, true, selectedLanguage.langTag, false);
      spokenHistory.current[baseLabel] = now;
      (window as any).lastRealtimeSpeakTime = now;
      break; // Speak only the most dominant object in single frame loop to avoid audio mess
    }
  }

  // Manual reset helper
  async function restartCameraStream() {
    const selectLang = selectedLanguage.code;
    
    let resetMsg = "Resetting system camera.";
    if (selectLang === "ur") resetMsg = "کیمرہ دوبارہ شروع ہو رہا ہے۔";
    else if (selectLang === "sr") resetMsg = "کیمرہ ولوں شروع تھیندا پئے";
    else if (selectLang === "pa") resetMsg = "کیمرہ دوبارہ شروع ہو رہیا اے۔";
    else if (selectLang === "zh") resetMsg = "正在重置系统相机。";
    else if (selectLang === "ps") resetMsg = "کیمره بیا پیل کیږي.";
    else if (selectLang === "fa") resetMsg = "در حال راه‌اندازی مجدد دوربین.";
    else if (selectLang === "ar") resetMsg = "جاري إعادة ضبط كاميرا النظام.";
    
    speak(resetMsg, true, selectedLanguage.langTag);
    setErrorMsg(null);
    setCameraActive(false);
    if (videoRef.current?.srcObject) {
      const prevStream = videoRef.current.srcObject as MediaStream;
      prevStream.getTracks().forEach((track) => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
          
          let successMsg = "Camera stream restarted successfully.";
          if (selectLang === "ur") successMsg = "کیمرہ کامیابی سے بحال ہو گیا ہے۔";
          else if (selectLang === "sr") successMsg = "کیمرہ کامیابی نال بحال تھی گیا ہے۔";
          else if (selectLang === "pa") successMsg = "کیمرہ کامیابی نال بحال ہو گیا اے۔";
          else if (selectLang === "zh") successMsg = "相机视频流已成功重启。";
          else if (selectLang === "ps") successMsg = "کیمره په بریالیتوب سره بیا پیل شوه.";
          else if (selectLang === "fa") successMsg = "دوربین با موفقیت راه‌اندازی شد.";
          else if (selectLang === "ar") successMsg = "تم إعادة تشغيل الكاميرا بنجاح.";
          
          speak(successMsg, true, selectedLanguage.langTag);
        };
      }
    } catch (err) {
      setErrorMsg("Failed to restart camera.");
      
      let failMsg = "Camera failed to restart.";
      if (selectLang === "ur") failMsg = "کیمرہ بحال کرنے میں ناکامی۔";
      else if (selectLang === "sr") failMsg = "کیمرہ بحال کرݨ وچ مسئلہ آیا ہے۔";
      else if (selectLang === "pa") failMsg = "کیمرہ بحال نہیں ہو سکیا۔";
      else if (selectLang === "zh") failMsg = "相机重启失败。";
      else if (selectLang === "ps") failMsg = "کیمره پیل نشوه.";
      else if (selectLang === "fa") failMsg = "راه‌اندازی مجدد دوربین شکست خورد.";
      else if (selectLang === "ar") failMsg = "فشلت إعادة تشغيل الكاميرا.";
      
      speak(failMsg, true, selectedLanguage.langTag);
    }
  }

  return (
    <div id="camera-panel" className="relative group overflow-hidden rounded-3xl bg-black border-4 border-[#334155] hover:border-[#FDE047] transition-colors shadow-2xl aspect-[4/3] md:aspect-[16/12] w-full max-w-2xl mx-auto flex flex-col justify-between">
      {/* Absolute top badge indicators */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex space-x-2">
          <span className="bg-[#FDE047] text-black px-4 py-1.5 rounded-full text-sm font-black flex items-center space-x-1.5 border border-yellow-250 backdrop-blur-sm shadow-md">
            <Video className="w-4 h-4 animate-pulse" />
            <span>VIDEO FEED</span>
          </span>
          {activeDetections.length > 0 && (
            <span className="bg-black/85 text-[#FDE047] px-3.5 py-1.5 rounded-full text-xs font-bold font-mono border border-yellow-500/30 backdrop-blur-sm shadow-sm">
              DETECTING {activeDetections.length} ITEMS
            </span>
          )}
        </div>
        <div className="bg-black/85 px-3 py-1.5 rounded-full border border-[#334155] pointer-events-auto">
          <button
            onClick={() => {
              const nextVal = !isRealtimeAnnounceEnabled;
              setRealtimeAnnounceEnabled(nextVal);
              
              const selectLang = selectedLanguage.code;
              let alertToggleMsg = nextVal ? "Real-time obstacle voice warnings enabled." : "Real-time obstacle warnings muted.";
              if (selectLang === "ur") alertToggleMsg = nextVal ? "سامان اور رکاوٹ کی لائیو وارننگ شروع ہو گئی ہے۔" : "رکاوٹ کی لائیو وارننگ بند کر دی گئی ہے۔";
              else if (selectLang === "sr") alertToggleMsg = nextVal ? "سامان دی لائیو وارننگ شروع تھی گئی ہے۔" : "رکاوٹ دی لائیو وارننگ بند تھی گئی ہے۔";
              else if (selectLang === "pa") alertToggleMsg = nextVal ? "رکاوٹ دیاں لائیو وارننگ شروع ہو گئیاں نیں۔" : "رکاوٹ دیاں لائیو وارننگ بند ہو گئیاں نیں";
              else if (selectLang === "zh") alertToggleMsg = nextVal ? "实时障碍物语音警报已开启。" : "实时警告已静音。";
              else if (selectLang === "ps") alertToggleMsg = nextVal ? "د خنډونو ریښتیني وخت غږیز اخطارونه فعال شول." : "د خنډونو ریښتیني وخت غږیز اخطارونه بند شول.";
              else if (selectLang === "fa") alertToggleMsg = nextVal ? "هشدارهای صوتی موانع فعال شدند." : "هشدارهای صوتی موانع غیرفعال شدند.";
              else if (selectLang === "ar") alertToggleMsg = nextVal ? "تم تفعيل التنبيهات الصوتية الفورية للعوائق." : "تم كتم تنبيهات العوائق الفورية.";
              
              speak(alertToggleMsg, true, selectedLanguage.langTag);
            }}
            className="flex items-center space-x-1 px-1.5 focus:outline-none focus:ring-2 focus:ring-[#FDE047] rounded"
            title="Toggle Voice Alerts"
          >
            {isRealtimeAnnounceEnabled ? (
              <>
                <Volume2 className="w-5 h-5 text-green-400 animate-bounce" />
                <span className="text-[10px] text-green-300 font-bold uppercase tracking-wider">Mute Alerts</span>
              </>
            ) : (
              <>
                <VolumeX className="w-5 h-5 text-zinc-400" />
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Unmute</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Frame Status Overlays */}
      {!model && (
        <div className="absolute inset-0 bg-[#0F172A] flex flex-col items-center justify-center text-center p-6 space-y-4 z-30">
          <Loader2 className="w-14 h-14 text-[#FDE047] animate-spin" />
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-[#FDE047] font-sans tracking-tight">AI & Camera Loading</h3>
            <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">{loadingStatus}</p>
          </div>
        </div>
      )}

      {errorMsg ? (
        <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center text-center p-8 space-y-4 z-30 border-4 border-red-500">
          <AlertTriangle className="w-16 h-16 text-red-500 animate-bounce" />
          <h3 className="text-xl font-bold text-red-400">Hardware Error Details</h3>
          <p className="text-zinc-300 text-sm max-w-md leading-relaxed">{errorMsg}</p>
          <button
            onClick={restartCameraStream}
            className="mt-2 bg-red-800 hover:bg-red-700 active:bg-red-900 border-2 border-red-400 text-white font-bold px-6 py-3.5 rounded-xl flex items-center space-x-2 focus:ring-4 focus:ring-red-400 shadow-md font-sans text-base cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Force Camera Restart</span>
          </button>
        </div>
      ) : (
        /* Video and overlay canvas elements */
        <div className="flex-grow w-full relative bg-[#0F172A] flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover scale-x-100"
            playsInline
            muted
            aria-label="Assistive live camera feed"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
          />
        </div>
      )}

      {/* Aesthetic decorative footing badge overlay */}
      <div className="bg-[#1E293B] border-t-4 border-[#334155] px-5 py-3 text-center z-1 w-full flex items-center justify-between">
        <span className="text-[11px] font-mono tracking-widest text-slate-400 font-bold uppercase">
          Client-Side Tensor Engine Active
        </span>
        <button
          onClick={restartCameraStream}
          className="text-xs text-[#FDE047] hover:text-yellow-300 font-bold flex items-center space-x-1 py-1 px-2.5 bg-[#FDE047]/15 hover:bg-[#FDE047]/25 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FDE047]"
          aria-label="Restart camera feed connection"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reset Camera</span>
        </button>
      </div>
    </div>
  );
}
