import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import TelegramBot from "node-telegram-bot-api";
import axios from "axios";

// Config
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token || "", { polling: false });
const INSTAGRAM_SESSION_ID = process.env.INSTAGRAM_SESSION_ID;

// Helper to fetch following list (Who the target follows)
// Note: Fetching 'followers' is much harder due to volume. 'Following' is usually smaller and more interesting.
// The user asked: "bir kişiyi takip etmiş mi" (Did they follow someone?) -> Following list.
async function getFollowingList(username: string): Promise<string[]> {
  if (!INSTAGRAM_SESSION_ID) {
    throw new Error("Instagram Session ID missing");
  }

  try {
    // First, get the User ID
    const profileUrl = `https://www.instagram.com/${username}/?__a=1&__d=dis`;
    const profileRes = await axios.get(profileUrl, {
      headers: {
        "Cookie": `sessionid=${INSTAGRAM_SESSION_ID}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    
    const userId = profileRes.data.graphql?.user?.id || profileRes.data.id;
    
    if (!userId) throw new Error("User ID not found");

    // Now fetch following
    const followingUrl = `https://www.instagram.com/graphql/query/?query_hash=d04b0a864b4b54837c0d870b0e77e076&variables={"id":"${userId}","include_reel":true,"fetch_mutual":false,"first":50}`;
    
    const res = await axios.get(followingUrl, {
      headers: {
        "Cookie": `sessionid=${INSTAGRAM_SESSION_ID}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });

    const edges = res.data.data.user.edge_follow.edges;
    return edges.map((edge: any) => edge.node.username);

  } catch (error) {
    console.error(`Error fetching instagram for ${username}:`, error);
    return [];
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
        // 1. Get Current List
        const currentFollowing = await getFollowingList(trackedAccount);

        if (currentFollowing.length === 0) {
           // If fetch failed or empty, skip logic but maybe log error
           results.push({ userId: userDoc.id, status: "Failed to fetch or empty" });
           continue;
        }

        // 2. Compare with Snapshot
        const previousFollowing: string[] = lastFollowingSnapshot || [];
        
        // If first run, just save
        if (previousFollowing.length === 0) {
          await userDoc.ref.update({ lastFollowingSnapshot: currentFollowing });
          await bot.sendMessage(telegramChatId, `🔍 ${trackedAccount} takibi başladı! Şu an ${currentFollowing.length} kişiyi takip ediyor.`);
          results.push({ userId: userDoc.id, status: "Initialized" });
          continue;
        }

        // Calculate Diff
        const newFollows = currentFollowing.filter(u => !previousFollowing.includes(u));
        const unfollows = previousFollowing.filter(u => !currentFollowing.includes(u));

        // 3. Notify
        if (newFollows.length > 0) {
          await bot.sendMessage(telegramChatId, `🚨 ${trackedAccount} şu kişileri takip etmeye başladı:\n\n${newFollows.map(u => `• ${u}`).join("\n")}`);
        }

        if (unfollows.length > 0) {
          await bot.sendMessage(telegramChatId, `👀 ${trackedAccount} şu kişileri takipten çıktı:\n\n${unfollows.map(u => `• ${u}`).join("\n")}`);
        }

        // 4. Update Snapshot
        if (newFollows.length > 0 || unfollows.length > 0) {
             await userDoc.ref.update({ lastFollowingSnapshot: currentFollowing });
        }
        
        results.push({ userId: userDoc.id, new: newFollows.length, left: unfollows.length });

      } catch (err) {
        console.error(`Error processing user ${userDoc.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}

