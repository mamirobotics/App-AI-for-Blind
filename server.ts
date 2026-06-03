import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up larger limit for base64 images
app.use(express.json({ limit: "15mb" }));

// Initialize Google Gen AI
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
}) : null;

// API Route: Describe camera frame
app.post("/api/describe", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: "Gemini API Client is not configured. Please add GEMINI_API_KEY in Secrets." });
    }

    const { image, mode, locationAddress, langCode } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image frame provided for analysis." });
    }

    // Map language code to human names
    const languageMap: { [key: string]: string } = {
      en: "English",
      ur: "Urdu",
      sr: "Saraiki",
      pa: "Punjabi",
      zh: "Chinese",
      ps: "Pashto",
      fa: "Persian",
      ar: "Arabic"
    };
    const targetLanguage = languageMap[langCode as string || "en"] || "English";

    // Capture base64 string and extract MIME type and actual base64 payload
    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid image format received." });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    let systemInstruction = `You are a voice assistant for blind and visually impaired people. Your goal is to analyze the camera image and give a concise, descriptive description of what's in front of them, highlighting any obstacles, navigation directions, readable text, or important items. Speak directly and naturally, in 2 to 3 sentences max, as if you are describing it to someone who cannot see. CRITICAL: You MUST write the entire explanation in ${targetLanguage} (${langCode === 'sr' ? 'Saraiki dialect transcription in Arabic-Urdu script' : targetLanguage} script).`;
    
    if (mode === "text") {
      systemInstruction = `You are an assistant for blind and visually impaired people. Focus entirely on reading ANY text, labels, signs, or writing visible in the image. Speak the exact written text clearly. If multiple parts of text are visible, organize them logically. Speak in 2-3 sentences max. If there is no visible text, state clearly that no text is visible. CRITICAL: You MUST write the entire explanation in ${targetLanguage} (${langCode === 'sr' ? 'Saraiki' : targetLanguage} script).`;
    } else if (mode === "money") {
      systemInstruction = `You are an assistant for blind and visually impaired people. Focus entirely on identifying any currency bills, paper money, coins, or price tags in the image. State the currency type and denomination clearly. Mention where they are placed. Speak in 1-2 sentences max. CRITICAL: You MUST write the entire explanation in ${targetLanguage} (${langCode === 'sr' ? 'Saraiki' : targetLanguage} script).`;
    }

    if (locationAddress) {
      systemInstruction += ` The user's current live location is estimated to be near: ${locationAddress}. Mention it briefly if relevant to help them orient themselves.`;
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const textPart = {
      text: mode === "text" ? "Please read out all public signs, labels, documents, or letters visible in this image." : 
            mode === "money" ? "Please check for paper notes, bank bills, coins, or pricing stickers in this frame." :
            "Describe the scene, objects, people, and any potential physical obstacles like walls, chairs, stairs, or doors in front of me.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction,
        temperature: 0.4,
      }
    });

    const descriptionText = response.text || "Could not analyze the scene.";
    res.json({ description: descriptionText.trim() });
  } catch (error: any) {
    console.error("Gemini description error:", error);
    res.status(500).json({ error: error.message || "An error occurred while describing the image." });
  }
});

// API Route: Reverse geocoding proxy using OpenStreetMap's Nominatim (keyless, libre)
app.get("/api/reverse-geocode", async (req, res) => {
  const { lat, lon, lang } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "latitude and longitude are required parameters" });
  }

  try {
    const langCode = lang as string || "en";
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=${langCode}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "VoiceCameraLocationAssistant/1.0 (mamirobotics@gmail.com)"
      }
    });
    
    if (!response.ok) {
      throw new Error("Nominatim server responded with error status");
    }

    const data = await response.json();
    const address = data.display_name || "Unknown address";
    const road = data.address?.road || data.address?.suburb || "";
    const city = data.address?.city || data.address?.town || data.address?.village || "";
    const houseNumber = data.address?.house_number || "";
    
    // Short, simple address formulation for blind speech
    let cleanAddress = "";
    if (road) {
      cleanAddress = `${houseNumber ? houseNumber + ' ' : ''}${road}`;
      if (city) cleanAddress += `, ${city}`;
    } else {
      cleanAddress = address.split(',').slice(0, 3).join(',');
    }

    res.json({ address: cleanAddress || address, detailAddress: address });
  } catch (error: any) {
    console.error("Reverse geocoding error:", error);
    res.json({ address: `${parseFloat(lat as string).toFixed(4)}, ${parseFloat(lon as string).toFixed(4)}` });
  }
});

// Vite middleware setup
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
