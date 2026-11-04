import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json({ limit: '20mb' }));

// Initialize Google GenAI on server side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// System prompt defining Rafi Ai Assistant persona and voice capabilities
function getRafiSystemPrompt(bossName: string = 'রাফি') {
  return `You are Rafi Ai Assistant (রাফি এআই অ্যাসিস্ট্যান্ট), an intelligent, loyal, warm, and highly capable voice companion and text reader created for Rafi Boss.
User relation: You address the user respectfully as "${bossName}" (বস / রাফি ভাই).
Language: Fluent, conversational, natural Bengali (বাংলা). You can naturally include common English/Banglish smartphone terms (TikTok, WhatsApp, Inbox, Message, Reply, Camera, Video, etc.).
Core Capabilities:
1. "আমি যা বলবো তাই পড়বে সে" - Voice Reader: If the user provides a sentence, story, article, message, or asks you to read ("পড়ে শোনাও", "বলো"), read/speak it out beautifully and clearly in Bengali!
2. Smart Assistant: Answer any question, calculate, tell stories, provide weather, and chat warmly with Boss Rafi.
3. Device autonomy: When Rafi commands actions on phone (TikTok, inbox, read Sabbir's text, reply, go home), emit the action tag and speak the response.

Available Actions:
- OPEN_APP:tiktok
- OPEN_APP:whatsapp
- OPEN_APP:youtube
- OPEN_APP:camera
- OPEN_APP:photos
- NAVIGATE:inbox
- OPEN_CHAT:sabbir
- OPEN_CHAT:pinky_gang
- SEND_MESSAGE:<text to send>
- GO_HOME
- CHECK_WEATHER
- RECALL_MEMORY

Format your response as a JSON object:
{
  "speechText": "বাংলায় তোমার স্বাভাবিক মিষ্টি ও বিনয়ী কণ্ঠস্বর যা বলা হবে (যেমন: 'ঠিক আছে বস, আমি টিকটক অ্যাপ খুলছি...')",
  "action": "OPEN_APP:tiktok" | "NAVIGATE:inbox" | "OPEN_CHAT:sabbir" | "SEND_MESSAGE:Hello" | "GO_HOME" | null,
  "confidence": 0.98,
  "followUp": "কোন প্রশ্ন থাকলে বা পরবর্তী নির্দেশ (ঐচ্ছিক)"
}

Example 1:
User: "Tiktok open koro"
Response:
{
  "speechText": "ঠিক আছে বস, আমি টিকটক অ্যাপটা ওপেন করছি।",
  "action": "OPEN_APP:tiktok"
}

Example 2:
User: "Inbox e jao"
Response:
{
  "speechText": "ঠিক আছে বস, আমি ইনবক্সে যাচ্ছি।",
  "action": "NAVIGATE:inbox"
}

Example 3:
User: "Dekho to tomar boss Sabbir ki message diyeche?"
Response:
{
  "speechText": "বস, সাব্বির আপনাকে মেসেজ পাঠিয়েছে: 'তোমার হোয়াটসঅ্যাপ নম্বর দাও ভিডিওটা দিই'। আপনি কি ওকে নম্বরটা দিতে চান?",
  "action": "OPEN_CHAT:sabbir"
}

Example 4:
User: "Tomar boss ke dhonnobad daw"
Response:
{
  "speechText": "বস, সাব্বিরকে ধন্যবাদ জানিয়ে মেসেজ পাঠিয়ে দিচ্ছি।",
  "action": "SEND_MESSAGE:অসংখ্য ধন্যবাদ ভাইয়া! ❤️"
}

Example 5:
User: "Home screen e jao"
Response:
{
  "speechText": "হ্যাঁ বস, হোম স্ক্রিনে ফিরে আসছি।",
  "action": "GO_HOME"
}

Example 6 (General question):
User: "আজকের আবহাওয়া কেমন?"
Response:
{
  "speechText": "আজকের আকাশ মোটামুটি পরিষ্কার, তাপমাত্রা প্রায় একত্রিশ ডিগ্রি সেলসিয়াসের কাছাকাছি।",
  "action": "CHECK_WEATHER"
}

Ensure your response is valid JSON matching this schema.`;
}

// Route: AI Chat & Voice Command processing
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], bossName = 'রাফি', currentAppState = 'home' } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemInstruction = getRafiSystemPrompt(bossName);
    
    // Provide device context
    const contextualMessage = `[Current Device Screen: ${currentAppState}]\nUser says: ${message}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contextualMessage,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '{}';
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = {
        speechText: rawText,
        action: null,
      };
    }

    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    // Graceful fallback for offline / no key
    res.status(500).json({
      error: error?.message || 'Gemini API call failed',
      speechText: 'বস, সংযোগে কিছুটা সমস্যা হচ্ছে। তবে আমি প্রস্তুত আছি!',
      action: null,
    });
  }
});

// Route: Screen Inspection via Gemini Multimodal
app.post('/api/analyze-screen', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', question = 'এই স্ক্রিনে কি দেখা যাচ্ছে বিস্তারিত বলো' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    // Clean base64 string if it contains data prefix
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: `You are Nūsu AI speaking in friendly Bengali to Boss. Look at this screen and answer: ${question}. Keep it natural, concise (2 sentences), and respectful.`,
          },
        ],
      },
    });

    res.json({
      speechText: response.text || 'বস, স্ক্রিনটি আমি দেখতে পাচ্ছি।',
    });
  } catch (error: any) {
    console.error('Error in /api/analyze-screen:', error);
    res.status(500).json({
      error: error?.message || 'Screen inspection failed',
      speechText: 'বস, স্ক্রিন বিশ্লেষণ করতে কিছুটা সমস্যা হয়েছে।',
    });
  }
});

// Route: Weather API proxy (Madhabpur or user location)
app.get('/api/weather', async (req, res) => {
  const city = (req.query.city as string) || 'Madhabpur';
  try {
    // Return realistic weather data matching Nusu AI's display
    res.json({
      temp: 31,
      condition: 'Clear Sky',
      city: city,
      feelsLike: 37,
      high: 32,
      low: 23,
      humidity: 64,
      windSpeed: '12 km/h',
      airQuality: 'Good (38)',
    });
  } catch {
    res.json({
      temp: 31,
      condition: 'Mainly Clear',
      city: 'Madhabpur',
      feelsLike: 37,
      high: 32,
      low: 23,
      humidity: 64,
    });
  }
});

// Setup Vite middleware in dev or static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ Nūsu AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
