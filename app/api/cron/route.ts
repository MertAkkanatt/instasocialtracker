import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import Parser from "rss-parser";
import { HfInference } from "@huggingface/inference";
// Use require for node-telegram-bot-api to avoid type errors during build if types are missing
const TelegramBot = require("node-telegram-bot-api");

// --- CONFIG ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_API_KEY; 

// Initialize Services
const bot = new TelegramBot(TELEGRAM_TOKEN || "", { polling: false });
const parser = new Parser();
const hf = new HfInference(HUGGINGFACE_TOKEN); 

// RSS Sources
const RSS_FEEDS = [
  "https://www.bloomberght.com/rss",
  "https://tr.investing.com/rss/news.rss",
  "https://www.donanimhaber.com/rss/tum/",
];

// --- TYPES ---
interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface AnalysisResult {
  label: string; 
  score: number;
}

// --- HELPERS ---
async function fetchLatestNews(): Promise<NewsItem[]> {
  let allNews: NewsItem[] = [];
  
  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const items = feed.items.slice(0, 10).map((item: any) => ({
        title: item.title || "",
        link: item.link || "",
        pubDate: item.pubDate || "",
        source: feed.title || "Unknown Source"
      }));
      allNews = [...allNews, ...items];
    } catch (err) {
      console.error(`RSS Error (${feedUrl}):`, err);
    }
  }
  return allNews;
}

async function analyzeSentiment(text: string): Promise<AnalysisResult> {
  try {
    const result = await hf.textClassification({
      model: "savasy/bert-base-turkish-sentiment-cased",
      inputs: text,
    });

    if (result && result.length > 0) {
      return {
        label: result[0].label, 
        score: result[0].score
      };
    }
    return { label: "neutral", score: 0.5 };
  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return { label: "neutral", score: 0.5 }; 
  }
}

export async function GET() {
  try {
    // 1. Get all news
    const news = await fetchLatestNews();
    if (news.length === 0) {
      return NextResponse.json({ status: "No news fetched" });
    }

    // 2. Get Users
    const usersSnap = await db.collection("users").get();

    // 3. Process Each User
    const results = [];

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const { keywords, telegramChatId, lastNotifiedNews } = userData;

      if (!keywords || !telegramChatId || keywords.length === 0) continue;

      const notifiedLinks: string[] = lastNotifiedNews || [];
      let newNotifiedLinks = [...notifiedLinks];
      let messagesToSend: string[] = [];

      // Filter news
      const relevantNews = news.filter(item => {
        const lowerTitle = item.title.toLowerCase();
        return keywords.some((k: string) => lowerTitle.includes(k.toLowerCase()));
      });

      for (const item of relevantNews) {
        if (newNotifiedLinks.includes(item.link)) continue;

        // Analyze
        const sentiment = await analyzeSentiment(item.title);
        
        let emoji = "😐";
        let sentimentText = "Nötr";
        
        // Thresholds for Turkish model
        if (sentiment.label === "positive" && sentiment.score > 0.6) {
          emoji = "🚀";
          sentimentText = "OLUMLU";
        } else if (sentiment.label === "negative" && sentiment.score > 0.6) {
          emoji = "🔻";
          sentimentText = "OLUMSUZ";
        }

        const msg = `${emoji} **${sentimentText}** Gelişme (%${Math.round(sentiment.score * 100)})\n\n📰 **${item.title}**\n\n🔗 [Haberi Oku](${item.link})`;
        messagesToSend.push(msg);
        newNotifiedLinks.push(item.link);
      }

      if (messagesToSend.length > 0) {
        // Send max 3 messages
        for (const msg of messagesToSend.slice(0, 3)) {
            await bot.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
        }
        
        if (newNotifiedLinks.length > 50) {
            newNotifiedLinks = newNotifiedLinks.slice(-50);
        }
        await userDoc.ref.update({ lastNotifiedNews: newNotifiedLinks });
        
        results.push({ userId: userDoc.id, sent: messagesToSend.length });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Cron Job Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

