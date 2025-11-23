import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import { db } from "@/lib/firebaseAdmin";

// Initialize bot instance
const token = process.env.TELEGRAM_BOT_TOKEN;
// We use 'polling: false' because this is a serverless function (webhook mode)
const bot = new TelegramBot(token || "", { polling: false });

export async function POST(req: NextRequest) {
  if (!token) {
    return NextResponse.json({ error: "Bot token not found" }, { status: 500 });
  }

  try {
    const update = await req.json();

    // Handle /start command
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text.startsWith("/start")) {
        // Extract UID from "/start <uid>"
        const parts = text.split(" ");
        if (parts.length > 1) {
          const uid = parts[1];
          
          // Save Chat ID to Firestore
          await db.collection("users").doc(uid).set({
            telegramChatId: chatId.toString()
          }, { merge: true });

          await bot.sendMessage(chatId, "✅ Hesabınız başarıyla bağlandı! Artık Instagram takip bildirimlerini buradan alacaksınız.");
        } else {
          await bot.sendMessage(chatId, "Merhaba! Bu botu kullanmak için uygulamamız üzerinden 'Telegram'ı Bağla' butonuna tıklayınız.");
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram Webhook Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

