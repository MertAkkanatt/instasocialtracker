import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import axios from "axios";
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token || "", { polling: false });
const INSTAGRAM_SESSION_ID = process.env.INSTAGRAM_SESSION_ID;

async function getFollowingList(username: string): Promise<string[]> {
  if (!INSTAGRAM_SESSION_ID) throw new Error("Instagram Session ID missing");

  try {
    const profileUrl = "https://www.instagram.com/api/v1/users/web_profile_info/?username=" + username;
    const headers = {
        "Cookie": "sessionid=" + INSTAGRAM_SESSION_ID,
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36",
        "X-IG-App-ID": "936619743392459",
        "X-ASBD-ID": "198387",
        "X-IG-WWW-Claim": "0",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.instagram.com/" + username + "/",
        "Accept-Language": "en-US,en;q=0.9"
    };

    const profileRes = await axios.get(profileUrl, { headers });
    const userId = profileRes.data.data?.user?.id;
    
    if (!userId) throw new Error("User ID not found");

    const followingUrl = "https://www.instagram.com/graphql/query/?query_hash=d04b0a864b4b54837c0d870b0e77e076&variables=" + encodeURIComponent(JSON.stringify({
      id: userId,
      include_reel: true,
      fetch_mutual: false,
      first: 50
    }));
    
    const res = await axios.get(followingUrl, { 
        headers: { ...headers, "Referer": "https://www.instagram.com/" + username + "/following/" } 
    });

    const edges = res.data.data.user.edge_follow.edges;
    return edges.map((edge: any) => edge.node.username);

  } catch (error: any) {
    console.error("Error fetching instagram for " + username, error.response?.data || error.message);
    throw error;
  }
}

export async function GET() {
  try {
    const usersSnap = await db.collection("users").get();
    const results = [];

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const { trackedAccount, telegramChatId, lastFollowingSnapshot } = userData;

      if (!trackedAccount || !telegramChatId) continue;

      try {
        const currentFollowing = await getFollowingList(trackedAccount);

        if (currentFollowing.length === 0) {
           results.push({ userId: userDoc.id, status: "Empty list fetched" });
           continue;
        }

        const previousFollowing: string[] = lastFollowingSnapshot || [];
        
        if (previousFollowing.length === 0) {
          await userDoc.ref.update({ lastFollowingSnapshot: currentFollowing });
          await bot.sendMessage(telegramChatId, "ğŸ” " + trackedAccount + " takibi baÅŸladÄ±! Åu an " + currentFollowing.length + " kiÅŸiyi takip ediyor.");
          results.push({ userId: userDoc.id, status: "Initialized" });
          continue;
        }

        const newFollows = currentFollowing.filter((u: string) => !previousFollowing.includes(u));
        const unfollows = previousFollowing.filter((u: string) => !currentFollowing.includes(u));

        if (newFollows.length > 0) {
          await bot.sendMessage(telegramChatId, "ğŸš¨ " + trackedAccount + " ÅŸu kiÅŸileri takip etmeye baÅŸladÄ±:\n\n" + newFollows.map((u: string) => "â€¢ " + u).join("\n"));
        }

        if (unfollows.length > 0) {
          await bot.sendMessage(telegramChatId, "ğŸ‘€ " + trackedAccount + " ÅŸu kiÅŸileri takipten Ã§Ä±ktÄ±:\n\n" + unfollows.map((u: string) => "â€¢ " + u).join("\n"));
        }

        if (newFollows.length > 0 || unfollows.length > 0) {
             await userDoc.ref.update({ lastFollowingSnapshot: currentFollowing });
        }
        
        results.push({ userId: userDoc.id, new: newFollows.length, left: unfollows.length });

      } catch (err: any) {
        results.push({ userId: userDoc.id, status: "Failed", error: err.message });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
