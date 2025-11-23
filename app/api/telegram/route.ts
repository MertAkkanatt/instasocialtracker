import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token || "", { polling: false });

export async function POST(req: NextRequest) {
  if (!token) {
    return NextResponse.json({ error: "Bot token not found" }, { status: 500 });
  }

  try {
    const update = await req.json();

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text.startsWith("/start")) {
        const parts = text.split(" ");
        if (parts.length > 1) {
          const uid = parts[1];
          
          await db.collection("users").doc(uid).set({
            telegramChatId: chatId.toString()
          }, { merge: true });

          await bot.sendMessage(chatId, "✅ Hesabınız başarıyla bağlandı! Artık analiz bildirimlerini alacaksınız.");
        } else {
          await bot.sendMessage(chatId, "Merhaba! Bu botu kullanmak için web sitemiz üzerinden 'Telegram'ı Bağla' butonuna tıklayınız.");
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram Webhook Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

