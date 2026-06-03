import React, { useState, useEffect, useRef } from "react";
import { speak, stopSpeaking } from "../utils/speech";
import { AssistantMode, Coordinates, SystemStatus, SUPPORTED_LANGUAGES, LanguageOption } from "../types";
import { 
  Eye, 
  BookOpen, 
  DollarSign, 
  MapPin, 
  Mic, 
  MicOff, 
  Loader2, 
  Info, 
  HelpCircle,
  Volume2,
  Navigation
} from "lucide-react";

interface AssistantConsoleProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isModelLoaded: boolean;
  gpsCoords: Coordinates;
  setGpsCoords: React.Dispatch<React.SetStateAction<Coordinates>>;
  selectedLanguage: LanguageOption;
  setSelectedLanguage: (lang: LanguageOption) => void;
}

// Localized in-app status and instruction translations
const localizedStrings: { [key: string]: { [lang: string]: string } } = {
  warmingUp: {
    en: "Camera is still warming up. Please try again in a moment.",
    ur: "کیمرہ ابھی تیار ہو رہا ہے۔ کچھ دیر بعد دوبارہ کوشش کریں۔",
    sr: "کیمرہ ابھی تیار تھیندا پئے، تھوڑی دیر بعد ول کوشش کرو۔",
    pa: "کیمرہ ہلے تیار ہو رہیا اے، نکی جہی دیر بعد دوبارہ کوشش کرو۔",
    zh: "相机仍在启动中，请稍后再试。",
    ps: "کیمره لا تر اوسه پورې چمتو کیږي، مهربانی وکړئ یو څه وخت وروسته هڅه وکړئ.",
    fa: "دوربین هنوز در حال آماده‌سازی است. لطفا لحظه‌ای دیگر دوباره تلاش کنید.",
    ar: "الكاميرا لا تزال قيد التحضير، يرجى المحاولة بعد قليل."
  },
  analyzingNav: {
    en: "Analyzing surroundings, please hold steady.",
    ur: "ارد گرد کے ماحول کا جائزہ لیا جا رہا ہے، براہ کرم کیمرہ سیدھا رکھیں۔",
    sr: "ارد گرد دے ماحول دا جائزہ گھدا ویندا پئے، مہربانی کر تے کیمرہ سدھا رکھو۔",
    pa: "آلے دوالے دا معائنہ کیتا جا رہیا اے، مہربانی کر کے کیمرہ سدھا رکھو۔",
    zh: "正在分析周围环境，请保持相机稳定。",
    ps: "د شاوخوا سیمې تحلیل کول، مهرباني وکړئ باثباته پاتې شئ.",
    fa: "در حال تحلیل محیط اطراف، لطفا دوربین را ثابت نگه دارید.",
    ar: "جاري تحليل البيئة المحيطة، يرجى الحفاظ على ثبات الكاميرا."
  },
  analyzingText: {
    en: "Reading visible text, please hold steady.",
    ur: "تحریری عبارت پڑھی جا رہی ہے، براہ کرم کیمرہ سیدھا رکھیں۔",
    sr: "لکھت پڑھی ویندی پئی ہے، مہربانی کر تے کیمرہ سدھا رکھو۔",
    pa: "لکھت پڑھی جا رہی اے، مہربانی کر کے کیمرہ سدھا رکھو۔",
    zh: "正在读取可见文字，请保持相机稳定。",
    ps: "د متن لوستل، مهرباني وکړئ باثباته پاتې شئ.",
    fa: "در حال خواندن متن，لطفا دوربین را ثابت نگه دارید.",
    ar: "جاري قراءة النص الظاهر، يرجى الحفاظ على ثبات الكاميرا."
  },
  analyzingMoney: {
    en: "Scanning for money currency, please hold steady.",
    ur: "رقم اور کرنسی سکین کی جا رہی ہے، براہ کرم کیمرہ سیدھا رکھیں۔",
    sr: "رقم سکینڈ تھیندی پئی اے، مہربانی کر تے کیمرہ سدھا رکھو۔",
    pa: "رقم تے کرنسی سکین کیتی جا رہی اے، مہربانی کر کے کیمرہ سدھا رکھو۔",
    zh: "正在扫描纸币或硬币，请保持相机稳定。",
    ps: "د پیسو او لوحو سکن کول، مهرباني وکړئ باثباته پاتې شئ.",
    fa: "در حال بررسی اسناد مالی و پول، لطفا دوربین را ثابت نگه دارید.",
    ar: "جاري فحص العملات النقدية، يرجى الحفاظ على ثبات الكاميرا."
  },
  apiError: {
    en: "Sorry, I had an issue analyzing the frame. Let's try again.",
    ur: "معذرت، تصویر کا جائزہ لینے میں پرابلم پیش آئی۔ دوبارہ ٹرائی کریں۔",
    sr: "معذرت، تصویر دا جائزہ گھنݨ وچ مسئلہ پیش آیا ہے، ولوں کوشش کرو۔",
    pa: "معاف کرنا، تصویر دا معائنہ کرن وچ مسئلہ پیش آیا اے۔ دوبارہ کوشش کرو۔",
    zh: "抱歉，分析图像时遇到问题。请再试一次。",
    ps: "بښنه غواړم، د انځور تحلیل کولو کې ستونزه وه. بیا هڅه وکړئ.",
    fa: "متاسفم، در بررسی تصویر مشکلی پیش آمد. دوباره تلاش کنید.",
    ar: "آسف، حدثت مشكلة أثناء تحليل الصورة. لنحاول مرة أخرى."
  },
  locatingGps: {
    en: "Locating via GPS satellites and estimating street address. Please wait.",
    ur: "جی پی ایس کے ذریعے لوکیشن اور گلی کا پتہ لگایا جا رہا ہے۔ انتظار کریں۔",
    sr: "جی پی ایس دے ذریعے تہاڈا پتہ لبھیندے پئے ہیں، تھوڑا انتظار کرو۔",
    pa: "جی پی ایس دے نال تھاں لبھی جا رہی اے۔ مہربانی کر کے انتظار کرو۔",
    zh: "正在通过GPS卫星定位并估算街道地址。请稍候。",
    ps: "د GPS له لارې ځای موندل، مهرباني وکړئ انتظار وکړئ.",
    fa: "در حال ردیابی با جی‌پی‌اس و تخمین آدرس شما. لطفا منتظر بمانید.",
    ar: "جاري تحديد الموقع عبر الأقمار الصناعية وتقدير عنوان الشارع. يرجى الانتظار."
  },
  noLocalGps: {
    en: "Geolocation is not supported by your browser.",
    ur: "آپ کا براؤزر مقام معلوم کرنے کی سہولت سپورٹ نہیں کرتا۔",
    sr: "تہاڈا براؤزر لوکیشن معلوم کرݨ کوں سپورٹ نہیں کریندا۔",
    pa: "تواڈا براؤزر مقام لبھن دی سہولت نہیں دیندا۔",
    zh: "您的浏览器不支持地理定位功能。",
    ps: "ستاسو براوزر د جغرافیایی موقعیت ملاتړ نه کوي.",
    fa: "مرورگر شما از قابلیت مکان‌یابی پشتیبانی نمی‌کند.",
    ar: "متصفحك لا يدعم خاصية تحديد الموقع الجغرافي."
  },
  gpsDenied: {
    en: "GPS access denied. Please verify location permissions are enabled.",
    ur: "جی پی ایس تک رسائی ناکام رہی۔ لوکیشن پرمیشنز چیک کریں۔",
    sr: "جی پی ایس دی اجازت ملݨ وچ مسلہ پیش آیا ہے، پرمیشن چیک کرو۔",
    pa: "جی پی ایس دی رسائی نہیں ملی۔ لوکیشن پرمیشن چیک کرو۔",
    zh: "GPS访问被拒绝。请在浏览器中启用定位权限。",
    ps: "د GPS لاسرسی رد شو. مهرباني وکړئ د موقعیت جواز تایید کړئ.",
    fa: "دسترسی به جی‌پی‌اس رد شد. لطفا مجوز دسترسی به مکان را بررسی کنید.",
    ar: "تم رفض الوصول إلى نظام تحديد المواقع. يرجى تفعيل صلاحية الموقع."
  },
  nearPrefix: {
    en: "You are near",
    ur: "آپ اس وقت قریبی جگہ پر ہیں:",
    sr: "تساں اس وقت نیڑے ہو:",
    pa: "تسی نیڑے ہو:",
    zh: "您当前在：",
    ps: "تاسو نږدې یاست په:",
    fa: "شما در نزدیکی این مکان هستید:",
    ar: "أنت بالقرب من:"
  },
  voiceCommandHeard: {
    en: "Command heard",
    ur: "کمانڈ سنی گئی:",
    sr: "کمانڈ سݨی گئی اے:",
    pa: "کمانڈ سنی گئی اے:",
    zh: "听到命令：",
    ps: "امر واوریدل شو:",
    fa: "فرمان شنیده شد:",
    ar: "تم سماع الأمر:"
  }
};

function getLocText(key: string, langCode: string): string {
  const translations = localizedStrings[key];
  if (!translations) return "";
  return translations[langCode] || translations["en"];
}

export default function AssistantConsole({
  videoRef,
  isModelLoaded,
  gpsCoords,
  setGpsCoords,
  selectedLanguage,
  setSelectedLanguage
}: AssistantConsoleProps) {
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [listening, setListening] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition on Mount / Language change
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = selectedLanguage.langTag;

      rec.onstart = () => {
        setListening(true);
        setSpeechError(null);
        let listeningMsg = "Listening for your voice command...";
        if (selectedLanguage.code === "ur") listeningMsg = "آواز کی ریکارڈنگ شروع ہے، اپنا حکم بولیں...";
        else if (selectedLanguage.code === "sr") listeningMsg = "سرائیکی آواز دا ریکارڈنگ شروع اے، سݨاو اپنا حکم...";
        else if (selectedLanguage.code === "pa") listeningMsg = "بولن لئی ریکارڈنگ جاری اے، کچھ بولو...";
        else if (selectedLanguage.code === "zh") listeningMsg = "正在倾听您的语音指令...";
        else if (selectedLanguage.code === "ar") listeningMsg = "جاري الاستماع لأمرك الصوتي...";
        else if (selectedLanguage.code === "ps") listeningMsg = "ستاسو د قوماندې اورېدو ته چمتو یو...";
        else if (selectedLanguage.code === "fa") listeningMsg = "در حال شنیدن فرمان صوتی شما...";
        
        setResponse(listeningMsg);
      };

      rec.onresult = async (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        const prefix = getLocText("voiceCommandHeard", selectedLanguage.code);
        setResponse(`${prefix} "${transcript}"`);
        speak(`${prefix} ${transcript}.`, true, selectedLanguage.langTag);
        await handleVoiceCommand(transcript);
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== "no-speech") {
          setSpeechError(event.error);
          const errVoice = selectedLanguage.code === "ur" ? "آواز کی شناخت کا وقت ختم ہو گیا یا کوئی خرابی پیش آئی۔" : "Voice recognition timed out or suffered an error.";
          speak(errVoice, true, selectedLanguage.langTag);
        }
        setListening(false);
      };

      rec.onend = () => {
        setListening(false);
      };

      recognitionRef.current = rec;
    } else {
      console.warn("Speech Recognition API is not supported in this browser.");
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [selectedLanguage]);

const buttonTranslations: { [key: string]: { [lang: string]: string } } = {
  describeScene: {
    en: "Describe Scene. Identify surroundings and physical obstacles.",
    ur: "منظر کی تفصیل۔ ارد گرد اور رکاوٹیں پہچاننے کے لئے۔",
    sr: "منظر دی تفصیل۔ ارد گرد دیاں رکاوٹاں سنجاݨݨ کیتے۔",
    pa: "منظر دی تفصیل۔ آلے دوالے دیاں رکاوٹاں لبھن لئی۔",
    zh: "描述场景。识别周围的环境和物理障碍物。",
    ps: "د صحنې توصیف. د شاوخوا او خنډونو پیژندلو لپاره.",
    fa: "توصیف صحنه. جهت شناسایی موانع و محیط اطراف.",
    ar: "وصف المشهد. للتعرف على البيئة والعوائق المادية."
  },
  readText: {
    en: "Read Text. Extract signs, labels, or written documents.",
    ur: "عبارت پڑھیں۔ سائن بورڈ، لیبل یا تحریریں پڑھنے کے لئے۔",
    sr: "لکھت پڑھو۔ بورڈ اور لکھے ہوئے کاغذ سنجاݨݨ کیتے۔",
    pa: "لکھت پڑھو۔ سائن بورڈ یا تحریراں پڑھن لئی۔",
    zh: "读取文字。提取标志、标签或书面文件。",
    ps: "د متن لوستل. د اشارو، لیبلونو، یا لیکل شوو اسنادو لوستلو لپاره.",
    fa: "خواندن متن. جهت خواندن تابلوها، برچسب‌ها یا اسناد نوشته شده.",
    ar: "قراءة النص. لقراءة اللافتات أو الملصقات أو المستندات المكتوبة."
  },
  identifyCash: {
    en: "Identify Cash. Recognize bills, paper money and prices.",
    ur: "پیسے پہچانیں۔ رقم، کاغذی نوٹ اور قیمت جاننے کے لئے۔",
    sr: "پیسے سنجاݨو۔ کاغذی نوٹ اور قیمت پتا کرݨ کیتے۔",
    pa: "پیسے پہچانو۔ نوٹاں تے سکیاں دی سنجان لئی۔",
    zh: "识别钱币。识别纸币、硬币和价格标牌。",
    ps: "د پیسو اټکل. د نوټونو، سکو او قیمتونو د پیژندلو لپاره.",
    fa: "تشخیص پول. جهت شناسایی اسکناس‌ها، سکه‌ها و قیمت‌ها.",
    ar: "تحديد العملة. للتعرف على الأوراق النقدية والأسعار."
  },
  whereAmI: {
    en: "Where Am I. Request street address via satellite GPS.",
    ur: "میرا مقام۔ جی پی ایس کے ذریعے گلی کا پتہ معلوم کریں۔",
    sr: "میڈا مقام۔ جی پی ایس نال گلی دا پتا لبھݨ کیتے۔",
    pa: "میری لوکیشن۔ جی پی ایس نال گلی دا پتہ معلوم کرن لئی۔",
    zh: "我的位置。通过GPS定位获取街道地址。",
    ps: "زما موقعیت. د GPS له لارې د سړک پته غوښتنه وکړئ.",
    fa: "موقعیت من. درخواست آدرس خیابان از طریق جی‌پی‌اس.",
    ar: "موقعي الحالي. لطلب عنوان الشارع عبر نظام تحديد المواقع."
  },
  tapToSpeak: {
    en: "Tap to Speak. Speak active voice command.",
    ur: "بولنے کے لئے دبائیں۔ اپنی آواز میں کمانڈ بولیں۔",
    sr: "ڳالھاوݨ کیتے دٻاو۔ اپنی آواز وچ حکم سݨاو۔",
    pa: "بولن لئی دباؤ۔ اپنی آواز وچ گل کرو۔",
    zh: "选择按住说话。发出语音指令。",
    ps: "د خبرو لپاره کلک کړئ. خپل غږیز امر ووایاست.",
    fa: "دکمه گفتار صوتی. فرمان صوتی خود را بگویید.",
    ar: "اضغط للتحدث. قل أمرك الصوتي الآن."
  },
  tapToComplete: {
    en: "Tap to Complete. Stop listening voice command.",
    ur: "ریکارڈنگ بند کرنے کے لئے دبائیں۔",
    sr: "ریکارڈنگ بند کرݨ کیتے دٻاو۔",
    pa: "ریکارڈنگ بند کرن لئی دباؤ۔",
    zh: "完成说话。停止倾听指令。",
    ps: "د غږ بندولو لپاره کلک کړئ.",
    fa: "توقف ضبط صدا.",
    ar: "انقر للإيقاف. لإيقاف الاستماع الآن."
  },
  helpGuide: {
    en: "Help Instructions. Audio guide of all functions.",
    ur: "مدد گائیڈ۔ تمام آپشنز کی آڈیو ہدایات سننے کے لئے۔",
    sr: "مدد گائیڈ۔ تمام آپشنز دی آڈیو ہدایات سݨݨ کیتے۔",
    pa: "مدد گائیڈ۔ ساریاں سہولتاں دی آڈیو معلومات لئی۔",
    zh: "帮助说明。播放所有功能的声音指南。",
    ps: "د لارښوونې مرسته. د ټولو کارونو غږیز لارښود.",
    fa: "راهنمای صوتی برنامه. راهنمای شنیداری تمام بخش‌ها.",
    ar: "دليل المساعدة. لسماع دليل صوتي لجميع الميزات."
  },
  stopAudio: {
    en: "Mute audio. Stops all speaking immediately.",
    ur: "آواز بند کریں۔ تمام گفتگو فوراً خاموش کرنے کے لئے۔",
    sr: "آواز بند کرو۔ گفتگو فوراً روکݨ کیتے۔",
    pa: "آواز بند کرو۔ ساری گفتگو فوراً خاموش کرن لئی۔",
    zh: "静音。立即关闭所有声音播放。",
    ps: "غږ خاموش کړه. ټولې خبرې سمدلاسه بندول.",
    fa: "بی‌صدا کردن. متوقف کردن فوری پخش صدا.",
    ar: "كتم الصوت. لإيقاف جميع الأصوات فوراً."
  }
};

  // Emulate screen-reader voice description when a button is hovered or focused
  function speakButtonContext(key: string, customText?: string) {
    const lang = selectedLanguage.code;
    const buttonDesc = buttonTranslations[key]?.[lang] || buttonTranslations[key]?.["en"] || customText || key;
    
    let btnPrefix = "Button: ";
    if (lang === "ur" || lang === "sr" || lang === "pa") btnPrefix = "بٹن: ";
    else if (lang === "zh") btnPrefix = "按钮：";
    else if (lang === "fa") btnPrefix = "دکمه: ";
    else if (lang === "ar") btnPrefix = "زر: ";
    else if (lang === "ps") btnPrefix = "تڼۍ: ";

    speak(`${btnPrefix}${buttonDesc}`, false, selectedLanguage.langTag);
  }

  // Capture current live webcam canvas frame as base64 JPEG
  function captureVideoFrame(): string | null {
    const video = videoRef.current;
    if (!video || video.readyState !== 4) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Draw frame onto virtual canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  // Trigger Gemini vision analysis
  async function analyzeScene(mode: AssistantMode) {
    const base64Image = captureVideoFrame();
    if (!base64Image) {
      const errText = getLocText("warmingUp", selectedLanguage.code);
      setResponse(errText);
      speak(errText, true, selectedLanguage.langTag);
      return;
    }

    setLoading(true);
    let taskAnnouncement = "";
    if (mode === "navigation") taskAnnouncement = getLocText("analyzingNav", selectedLanguage.code);
    if (mode === "text") taskAnnouncement = getLocText("analyzingText", selectedLanguage.code);
    if (mode === "money") taskAnnouncement = getLocText("analyzingMoney", selectedLanguage.code);

    setResponse(taskAnnouncement);
    speak(taskAnnouncement, true, selectedLanguage.langTag);

    try {
      const res = await fetch("/api/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          mode: mode,
          locationAddress: gpsCoords.address || undefined,
          langCode: selectedLanguage.code
        }),
      });

      if (!res.ok) {
        throw new Error("Server failed to analyze frame.");
      }

      const data = await res.json();
      const desc = data.description || "I couldn't identify anything in front of you.";
      setResponse(desc);
      speak(desc, true, selectedLanguage.langTag);
    } catch (err: any) {
      console.error(err);
      const errorText = getLocText("apiError", selectedLanguage.code);
      setResponse(errorText);
      speak(errorText, true, selectedLanguage.langTag);
    } finally {
      setLoading(false);
    }
  }

  // Get current live GPS location with Nominatim Reverse Geocoding
  async function fetchLiveLocation() {
    if (!("geolocation" in navigator)) {
      const noGpsVal = getLocText("noLocalGps", selectedLanguage.code);
      setResponse(noGpsVal);
      speak(noGpsVal, true, selectedLanguage.langTag);
      return;
    }

    setLoading(true);
    const locAlert = getLocText("locatingGps", selectedLanguage.code);
    setResponse(locAlert);
    speak(locAlert, true, selectedLanguage.langTag);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lon=${longitude}&lang=${selectedLanguage.code}`);
          const data = await res.json();
          
          const prefix = getLocText("nearPrefix", selectedLanguage.code);
          const spokenAddress = `${prefix} ${data.address}.`;
          
          setGpsCoords({
            latitude,
            longitude,
            address: data.address
          });
          setResponse(spokenAddress + ` (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
          speak(spokenAddress, true, selectedLanguage.langTag);
        } catch (locationErr) {
          const l = selectedLanguage.code;
          let coordinatesSentence = `GPS Coordinates: Latitude ${latitude.toFixed(3)}, Longitude ${longitude.toFixed(3)}.`;
          if (l === "ur") coordinatesSentence = `جی پی ایس مقام: عرض بلد ${latitude.toFixed(3)}، طول بلد ${longitude.toFixed(3)}۔`;
          else if (l === "sr") coordinatesSentence = `جی پی ایس مقام: عرض بلد ${latitude.toFixed(3)}، طول بلد ${longitude.toFixed(3)}۔`;
          else if (l === "pa") coordinatesSentence = `جی پی ایس مقام: عرض بلد ${latitude.toFixed(3)}، طول بلد ${longitude.toFixed(3)}۔`;
          else if (l === "zh") coordinatesSentence = `GPS座标：纬度 ${latitude.toFixed(3)}，经度 ${longitude.toFixed(3)}。`;
          else if (l === "ps") coordinatesSentence = `د GPS همغږي: عرض البلد ${latitude.toFixed(3)}، طول البلد ${longitude.toFixed(3)}۔`;
          else if (l === "fa") coordinatesSentence = `موقعیت جی‌پی‌اس: عرض جغرافیایی ${latitude.toFixed(3)}، طول جغرافیایی ${longitude.toFixed(3)}۔`;
          else if (l === "ar") coordinatesSentence = `إحداثيات نظام تحديد المواقع: خط العرض ${latitude.toFixed(3)}، خط الطول ${longitude.toFixed(3)}.`;

          setGpsCoords({
            latitude,
            longitude,
            address: null
          });
          setResponse(coordinatesSentence);
          speak(coordinatesSentence, true, selectedLanguage.langTag);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("GPS Error:", err);
        const permText = getLocText("gpsDenied", selectedLanguage.code);
        setResponse(permText);
        speak(permText, true, selectedLanguage.langTag);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // Process hands-free Speak commands (speech-to-text input interpreter)
  async function handleVoiceCommand(transcript: string) {
    const t = transcript.toLowerCase();
    
    // Check surroundings
    const isDescribe = t.includes("describe") || t.includes("what is") || t.includes("look") || t.includes("surrounding") ||
      t.includes("دیکھو") || t.includes("جائزہ") || t.includes("معائنہ") || t.includes("کیا ہے") || t.includes("منظر") || t.includes("ماحول") ||
      t.includes("描述") || t.includes("看看") || t.includes("环境") || t.includes("什么") ||
      t.includes("وګوره") || t.includes("صحنه") || t.includes("تحلیل") ||
      t.includes("توصیف") || t.includes("ببین") || t.includes("محیط") || t.includes("اطراف") ||
      t.includes("صف") || t.includes("انظر") || t.includes("محيط") || t.includes("مشهد") || t.includes("ماذا");

    // Check read text
    const isReadText = t.includes("read") || t.includes("text") || t.includes("sign") || t.includes("writing") || t.includes("label") ||
      t.includes("پڑھو") || t.includes("لکھت") || t.includes("عبارت") || t.includes("تحریر") || t.includes("سائن") ||
      t.includes("读") || t.includes("文字") || t.includes("字") || t.includes("牌子") ||
      t.includes("ولوله") || t.includes("متن") || t.includes("لیکنه") ||
      t.includes("بخوان") || t.includes("نوشته") ||
      t.includes("اقرأ") || t.includes("كتابة") || t.includes("لوحة");

    // Check money
    const isIdentifyMoney = t.includes("money") || t.includes("cash") || t.includes("bill") || t.includes("dollar") || t.includes("coin") || t.includes("price") ||
      t.includes("پیسے") || t.includes("رقم") || t.includes("نوٹ") || t.includes("کرنسی") || t.includes("سکّہ") ||
      t.includes("钱") || t.includes("钞票") || t.includes("价格") ||
      t.includes("پیسې") || t.includes("ډالر") ||
      t.includes("پول") || t.includes("اسکناس") || t.includes("قیمت") ||
      t.includes("نقود") || t.includes("مال") || t.includes("سعر") || t.includes("عملة");

    // Check location
    const isLocation = t.includes("where") || t.includes("location") || t.includes("address") || t.includes("gps") || t.includes("here") ||
      t.includes("کہاں") || t.includes("مقام") || t.includes("پتہ") || t.includes("لوکیشن") ||
      t.includes("哪里") || t.includes("位置") || t.includes("地址") ||
      t.includes("چیرته") || t.includes("موقعیت") ||
      t.includes("کجا") || t.includes("آدرس") ||
      t.includes("أين") || t.includes("عنوان");

    // Check mute
    const isMute = t.includes("stop") || t.includes("mute") || t.includes("quiet") || t.includes("shut") ||
      t.includes("روکو") || t.includes("بند") || t.includes("خاموش") ||
      t.includes("停止") || t.includes("安静") || t.includes("静音") ||
      t.includes("بند کړه") ||
      t.includes("توقف") || t.includes("ساکت") ||
      t.includes("اسكت") || t.includes("إيقاف") || t.includes("صمت");

    // Check help
    const isHelp = t.includes("help") || t.includes("instruct") || t.includes("guide") ||
      t.includes("مدد") || t.includes("رہنمائی") || t.includes("ہدایات") ||
      t.includes("帮助") || t.includes("指南") || t.includes("说明") ||
      t.includes("مرسته") || t.includes("لارښود") ||
      t.includes("راهنما") || t.includes("کمک") ||
      t.includes("مساعدة") || t.includes("تعليمات") || t.includes("دليل");

    if (isDescribe) {
      await analyzeScene("navigation");
    } else if (isReadText) {
      await analyzeScene("text");
    } else if (isIdentifyMoney) {
      await analyzeScene("money");
    } else if (isLocation) {
      await fetchLiveLocation();
    } else if (isMute) {
      stopSpeaking();
      const muteConfirm = selectedLanguage.code === "ur" ? "آواز بند کر دی گئی ہے۔"
        : selectedLanguage.code === "sr" ? "آواز بند تھی گئی ہے۔"
        : selectedLanguage.code === "pa" ? "آواز بند ہو گئی اے۔"
        : selectedLanguage.code === "zh" ? "语音已静音。"
        : selectedLanguage.code === "fa" ? "صدا خاموش شد."
        : selectedLanguage.code === "ar" ? "تم كتم الصوت."
        : selectedLanguage.code === "ps" ? "ډاډه غلی شوم."
        : "Audio muted successfully.";
      setResponse(muteConfirm);
    } else if (isHelp) {
      readAppInstructions();
    } else {
      const unsupportedText = selectedLanguage.code === "ur" ? `سمجھ نہیں پایا: "${transcript}"۔ دستیاب احکامات یہ ہیں: منظر، لکھت پڑھیں، پیسے پہچانیں، میں کہاں ہوں۔`
        : selectedLanguage.code === "sr" ? `سمجھ نہیں پایا: "${transcript}"۔ دستیاب احکامات یہ ہیں: منظر، لکھت پڑھو، پیسے پہچاݨو، میں کتھاں ہاں۔`
        : selectedLanguage.code === "pa" ? `سمجھ نہیں آیا: "${transcript}"۔ دستیاب احکامات یہ ہیں: منظر، لکھت پڑھو، پیسے پہچانو۔`
        : selectedLanguage.code === "zh" ? `未识别指令: "${transcript}"。可用指令包括：描述环境、读取文字、识别钱币、我的位置、帮助。`
        : selectedLanguage.code === "ar" ? `لم أفهم: "${transcript}". الأوامر المتاحة هي: صف البيئة، اقرأ النص، رصد العملة، موقعي الحالي، مساعدة.`
        : `I heard: ${transcript}. Available commands are: describe surroundings, read text, identify money, where am I, or help.`;
      setResponse(unsupportedText);
      speak(unsupportedText, true, selectedLanguage.langTag);
    }
  }

  // Trigger mic listening
  function toggleListening() {
    if (!recognitionRef.current) {
      speak("Speech recognition is not supported in this browser. Please use Chrome, Safari or Edge.", true, selectedLanguage.langTag);
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      const stopListeningMsg = selectedLanguage.code === "ur" ? "آواز کا ریکارڈنگ بند ہو گیا ہے۔" : "Command listening stopped.";
      speak(stopListeningMsg, true, selectedLanguage.langTag);
    } else {
      stopSpeaking();
      try {
        recognitionRef.current.start();
        const startListeningMsg = selectedLanguage.code === "ur" ? "سن رہا ہوں۔ سگنل کی ٹون کے بعد اپنا حکم فرمائیں۔" : "Listening. Say your command.";
        speak(startListeningMsg, true, selectedLanguage.langTag);
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        recognitionRef.current.stop();
      }
    }
  }

  // Instructions read-out
  function readAppInstructions() {
    let msg = "";
    if (selectedLanguage.code === "ur") {
      msg = "خوش آمدید۔ یہ بصارت سے محروم افراد کے لیے آواز، کیمرہ اور مقام کا معاون ہے۔ اسکرین پر موجود بٹن یہ ہیں: ایک، منظر کی تفصیل تاکہ آپ رکاوٹیں جان سکیں۔ دو، عبارت پڑھنا تاکہ آپ خطوط پڑھ سکیں۔ تین، پیسے پہچاننا۔ اور چار، میرا مقام تاکہ آپ گلی کا پتہ جان سکیں۔";
    } else if (selectedLanguage.code === "sr") {
      msg = "خوش آمدید۔ اے اکھیں توں معذور بھین بھراواں کیتے آواز، کیمرہ تے جگہ دا مددگار ہے۔ اسکرین تے موجود بٹن اے ہن: ہک، منظر دا جائزہ گھنو تاکہ تساں رکاوٹاں جان سکو۔ ٻہ، لکھت پڑھو۔ ترے، پیسے سنجاݨو۔ تے چار، میڈا مقام تاکہ تساں جگہ پتا معلوم کر سکو۔";
    } else if (selectedLanguage.code === "pa") {
      msg = "خوش آمدید۔ اے اکھاں توں معذور بندیاں لئی ایک لائیو معاون ہے۔ اسکرین تے موجود بٹن اے ہن: ہک، منظر دی تفصیل۔ دو، لکھت پڑھنا۔ ترے، پیسے دی پہچان۔ تے چار، میری لوکیشن۔ پلے بٹن تے دبا کے گل کرو۔";
    } else if (selectedLanguage.code === "zh") {
      msg = "欢迎使用语音相机和位置助手。本应用专为视障盲人用户设计。屏幕上的按钮包括：一、描述场景，识别前方的障碍物。二、读取文字。三、识别钱币。四、我的位置，获取您的街道地址。五、语音控制。";
    } else if (selectedLanguage.code === "fa") {
      msg = "خوش‌آمدید. این یک دستیار صوتی و مکانیاب برای نابینایان عزیز است. دکمه‌های روی صفحه شامل: یک، توصیف صحنه برای درک موانع. دو، خواندن متن. سه، تشخیص پول. چهار، موقعیت من برای یافتن آدرس. پنج، فرامین صوتی است.";
    } else if (selectedLanguage.code === "ps") {
      msg = "ښه راغلاست. دا د نابینا او لید لرونکو خلکو لپاره د غږ، کیمرې او ځای مرستیال دی. په سکرین تڼۍ دا دي: یو، د صحنې توصیف. دوه، د متن لوستل. درې، د پیسو اټکل. څلور، زما موقعیت.";
    } else if (selectedLanguage.code === "ar") {
      msg = "مرحباً بك. هذا هو مساعد الصوت والكاميرا والموقع للمكفوفين وضعاف البصر. الأزرار على الشاشة هي: أولاً، وصف المشهد لمعرفة العوائق. ثانياً، قراءة النص. ثالثاً، تحديد العملة النقدية. رابعاً، موقعي الحالي لمعرفة عنوان الشارع.";
    } else {
      msg = "Welcome to the Voice Camera and Location Assistant. This app is designed for visually impaired and blind users. Hover or press Tab to hear button names. The buttons on your screen are: One. Describe Scene, to tell you what objects and obstacles are in front of you. Two. Read Text, to extract letters and document notes. Three. Identify Money, to determine cash denominations. Four. My Location, to fetch your street address. And Five. Voice Commands, to speak directly. Tell me: describe surroundings, or where am I, and I will handle the rest.";
    }

    setResponse(msg);
    speak(msg, true, selectedLanguage.langTag);
  }

  return (
    <div className="w-full space-y-6">
      {/* Voice Language Selector Section */}
      <div 
        className="w-full bg-[#1E293B] border-4 border-[#334155] rounded-3xl p-5"
        onMouseEnter={() => speak("Voice language selection panel. Tap any of the eight languages below.", false, selectedLanguage.langTag)}
        onFocus={() => speak("Voice language selection panel. Tap any of the eight languages below.", false, selectedLanguage.langTag)}
        tabIndex={0}
      >
        <span className="block text-slate-300 font-mono font-bold text-xs tracking-wider uppercase mb-3 text-start">
          🗣️ Voice Language Selected / زبان کا انتخاب
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isActive = selectedLanguage.code === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => {
                  setSelectedLanguage(lang);
                  
                  // Play beautiful multilingual confirmation voice alerts
                  let confirmSpeech = "";
                  if (lang.code === "en") confirmSpeech = "Voice language set to English.";
                  else if (lang.code === "ur") confirmSpeech = "زبان اردو میں تبدیل کر دی گئی ہے۔";
                  else if (lang.code === "sr") confirmSpeech = "زبان سرائیکی وچ تبدیل تھی گئی ہے۔";
                  else if (lang.code === "pa") confirmSpeech = "بولی پنجابی وچ تبدیل کر دیتی گئی اے۔";
                  else if (lang.code === "zh") confirmSpeech = "语音语言已更改为中文。";
                  else if (lang.code === "ps") confirmSpeech = "د غږ ژبه پښتو ته بدله شوه.";
                  else if (lang.code === "fa") confirmSpeech = "زبان گویا به فارسی تغییر یافت.";
                  else if (lang.code === "ar") confirmSpeech = "تم تغيير لغة الصوت إلى العربية.";
                  
                  setResponse(confirmSpeech);
                  speak(confirmSpeech, true, lang.langTag);
                }}
                onMouseEnter={() => speak(`Language option: ${lang.name}. Native: ${lang.nativeName}`, false, selectedLanguage.langTag)}
                onFocus={() => speak(`Language option: ${lang.name}. Native: ${lang.nativeName}`, false, selectedLanguage.langTag)}
                className={`py-3 px-4 rounded-xl font-bold flex flex-col items-center justify-center transition-all cursor-pointer border-2 shadow ${
                  isActive 
                    ? "bg-[#FDE047] text-black border-white ring-4 ring-yellow-400 font-extrabold" 
                    : "bg-[#0F172A] text-slate-200 border-slate-700 hover:border-slate-500 font-bold"
                }`}
                aria-label={`Set voice to ${lang.name}`}
              >
                <span className="text-sm font-black font-sans">{lang.nativeName}</span>
                <span className="text-[10px] font-semibold opacity-80 uppercase tracking-tight">{lang.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Main Tactile Visual Panel: Status announcements / Subtext outputs */}
      <div 
        id="assistant-response-panel"
        className="w-full bg-[#1E293B] border-4 border-[#334155] hover:border-[#FDE047] rounded-3xl p-6 min-h-[160px] flex flex-col justify-between shadow-2xl transition-colors focus-within:ring-4 focus-within:ring-[#FDE047]"
        tabIndex={0}
        aria-live="polite"
        aria-label="Screen reader announcement screen"
        onMouseEnter={() => speak(`Information screen. Content is: ${response || "Ready. Please trigger a button or speak a command."}`, false, selectedLanguage.langTag)}
        onFocus={() => speak(`Information screen. Content is: ${response || "Ready. Please trigger a button or speak a command."}`, false, selectedLanguage.langTag)}
      >
        <div className="flex items-center justify-between text-slate-400 text-xs font-mono font-bold tracking-widest border-b border-slate-700/60 pb-2">
          <span>AI VOICE STATUS OUTPUT</span>
          <span className="flex items-center space-x-1.5 text-[#FDE047]">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            <span>TTS ONLINE ({selectedLanguage.name})</span>
          </span>
        </div>
        <div className="my-4">
          {loading ? (
            <div className="flex items-center space-x-3 text-[#FDE047]">
              <Loader2 className="w-7 h-7 animate-spin" />
              <p className="text-xl font-black font-sans animate-pulse">{response || "Processing information..."}</p>
            </div>
          ) : (
            <p className="text-2xl font-black font-sans text-[#FDE047] leading-tight text-start">
              {response ? `"${response}"` : "Ready. Click any action button below or speak a command."}
            </p>
          )}
        </div>
        <div className="text-left text-xs font-bold text-slate-400">
          {(gpsCoords.address) ? (
            <span className="text-green-400 font-mono flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block animate-ping"></span>
              Location: {gpsCoords.address}
            </span>
          ) : (
            <span className="text-slate-400 font-mono">Location context available on GPS query</span>
          )}
        </div>
      </div>

      {/* 2. Massive High-Contrast Tactile Button Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
        {/* Describe surroundings button */}
        <button
          onClick={() => analyzeScene("navigation")}
          onMouseEnter={() => speakButtonContext("describeScene")}
          onFocus={() => speakButtonContext("describeScene")}
          className="bg-[#FDE047] hover:bg-yellow-300 active:bg-yellow-500 border-b-8 border-yellow-600 text-black font-black p-6 rounded-3xl flex flex-col items-center justify-center space-y-4 shadow-2xl text-center transform active:translate-y-1 transition-all focus:outline-none focus:ring-4 focus:ring-white h-44 cursor-pointer"
          aria-label="Describe Scene button. Uses artificial intelligence to analyze obstacles and surroundings."
          id="btn-describe-scene"
        >
          <Eye className="w-12 h-12 stroke-[3]" />
          <div className="space-y-1">
            <span className="block text-2xl font-black font-sans uppercase tracking-tight">DESCRIBE SCENE</span>
            <span className="block text-[10px] font-extrabold uppercase opacity-85 font-mono">Detect Obstacles & Hazards</span>
          </div>
        </button>

        {/* Read text button */}
        <button
          onClick={() => analyzeScene("text")}
          onMouseEnter={() => speakButtonContext("readText")}
          onFocus={() => speakButtonContext("readText")}
          className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 border-b-8 border-blue-900 text-white font-black p-6 rounded-3xl flex flex-col items-center justify-center space-y-4 shadow-2xl text-center transform active:translate-y-1 transition-all focus:outline-none focus:ring-4 focus:ring-white h-44 cursor-pointer"
          aria-label="Read Text button. Identifies documents, signs, or any written phrases near you."
          id="btn-read-text"
        >
          <BookOpen className="w-12 h-12 stroke-[3]" />
          <div className="space-y-1">
            <span className="block text-2xl font-black font-sans uppercase tracking-tight">READ TEXT</span>
            <span className="block text-[10px] font-extrabold uppercase opacity-85 font-mono">Recognize Labels & Signs</span>
          </div>
        </button>

        {/* Identify cash/money button */}
        <button
          onClick={() => analyzeScene("money")}
          onMouseEnter={() => speakButtonContext("identifyCash")}
          onFocus={() => speakButtonContext("identifyCash")}
          className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 border-b-8 border-emerald-900 text-white font-black p-6 rounded-3xl flex flex-col items-center justify-center space-y-4 shadow-2xl text-center transform active:translate-y-1 transition-all focus:outline-none focus:ring-4 focus:ring-white h-44 cursor-pointer"
          aria-label="Identify Cash button. Scans for bills, bank items, or pricing labels."
          id="btn-identify-cash"
        >
          <DollarSign className="w-12 h-12 stroke-[3]" />
          <div className="space-y-1">
            <span className="block text-2xl font-black font-sans uppercase tracking-tight">IDENTIFY CASH</span>
            <span className="block text-[10px] font-extrabold uppercase opacity-85 font-mono">Detect Bills & Banknotes</span>
          </div>
        </button>

        {/* Live location buttons */}
        <button
          onClick={fetchLiveLocation}
          onMouseEnter={() => speakButtonContext("whereAmI")}
          onFocus={() => speakButtonContext("whereAmI")}
          className="bg-[#1E293B] hover:bg-slate-700 active:bg-slate-900 border-4 border-[#FDE047] text-white font-black p-6 rounded-3xl flex flex-col items-center justify-center space-y-4 shadow-2xl text-center transform active:translate-y-1 transition-all focus:outline-none focus:ring-4 focus:ring-[#FDE047] h-44 cursor-pointer"
          aria-label="Where Am I button. Performs reverse lookup to speak out the closest street address."
          id="btn-where-am-i"
        >
          <MapPin className="w-12 h-12 text-[#FDE047] stroke-[3] animate-bounce" />
          <div className="space-y-1">
            <span className="block text-2xl font-black font-sans uppercase tracking-tight text-[#FDE047]">WHERE AM I?</span>
            <span className="block text-[10px] font-extrabold uppercase opacity-85 font-mono text-slate-300">Live GPS Address Lookup</span>
          </div>
        </button>
      </div>

      {/* 3. Hands-Free Speech Command Panel - Huge tactile prompt widget */}
      <div className="bg-[#1E293B] border-4 border-dashed border-slate-700 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-6">
        <div className="text-center sm:text-left flex-grow">
          <div className="flex items-center justify-center sm:justify-start space-x-2 text-slate-200">
            <Mic className="w-5 h-5 text-[#FDE047]" />
            <h4 className="text-lg font-black uppercase font-sans tracking-tight">Hands-Free Voice Controls</h4>
          </div>
          <p className="text-slate-400 text-xs mt-1 max-w-md font-bold leading-normal">
            Press the giant microphone to speak commands. You can say: <strong className="text-white">"describe" / "منظر"</strong>, <strong className="text-white">"read text" / "پڑھو"</strong>, <strong className="text-white">"money" / "پیسے"</strong>, <strong className="text-white">"location" / "کہاں"</strong>, or <strong className="text-white">"help" / "مدد"</strong>.
          </p>
        </div>
        
        <button
          onClick={toggleListening}
          onMouseEnter={() => speakButtonContext(listening ? "tapToComplete" : "tapToSpeak")}
          onFocus={() => speakButtonContext(listening ? "tapToComplete" : "tapToSpeak")}
          className={`relative flex items-center justify-center rounded-3xl p-5 w-full sm:w-auto sm:px-8 h-20 shadow-2xl cursor-pointer transform active:scale-95 transition-all text-xl font-black focus:outline-none focus:ring-4 border-b-4 ${
            listening 
              ? "bg-red-650 hover:bg-red-550 text-white border-red-900 focus:ring-red-400" 
              : "bg-[#FDE047] hover:bg-yellow-300 text-black border-yellow-600 focus:ring-white"
          }`}
          aria-label={listening ? "Listening now. Tap to stop." : "Tap to speak command."}
        >
          {listening ? (
            <div className="flex items-center space-x-3">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
              </span>
              <MicOff className="w-6 h-6" />
              <span className="uppercase tracking-wider">TAP TO COMPLETE</span>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Mic className="w-6 h-6 animate-pulse" />
              <span className="uppercase tracking-wider">TAP TO SPEAK</span>
            </div>
          )}
        </button>
      </div>

      {/* 4. Quick Instructional Speech Helper */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={readAppInstructions}
          onMouseEnter={() => speakButtonContext("helpGuide")}
          onFocus={() => speakButtonContext("helpGuide")}
          className="bg-[#1E293B] hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white border-2 border-[#334155] p-4 rounded-xl flex items-center justify-center space-x-2 shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FDE047] text-sm font-extrabold uppercase transition-all"
        >
          <HelpCircle className="w-5 h-5 text-[#FDE047]" />
          <span>HELP GUIDE</span>
        </button>

        <button
          onClick={() => {
            stopSpeaking();
            speak(selectedLanguage.code === "ur" ? "آواز بند ہو گئی ہے۔" : "All voice outputs stopped.", true, selectedLanguage.langTag);
          }}
          onMouseEnter={() => speakButtonContext("stopAudio")}
          onFocus={() => speakButtonContext("stopAudio")}
          className="bg-[#1E293B] hover:bg-slate-700 active:bg-slate-900 text-slate-300 hover:text-white border-2 border-red-900 p-4 rounded-xl flex items-center justify-center space-x-2 shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-extrabold uppercase transition-all animate-none"
        >
          <MicOff className="w-5 h-5 text-red-500" />
          <span>STOP AUDIO (QUIET)</span>
        </button>
      </div>
    </div>
  );
}
