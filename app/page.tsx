"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [targetUsername, setTargetUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Listen to user document for real-time updates
        const userRef = doc(db, "users", currentUser.uid);
        const unsubDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTelegramConnected(!!data.telegramChatId);
            if (data.trackedAccount) {
              setTargetUsername(data.trackedAccount);
            }
          }
        });
        return () => unsubDoc();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setStatusMessage("");

    try {
      // Clean the input to get just the username
      let username = targetUsername.trim();
      if (username.includes("instagram.com/")) {
        username = username.split("instagram.com/")[1].split("/")[0];
      }
      username = username.replace("@", "");

      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        trackedAccount: username,
        updatedAt: new Date()
      }, { merge: true });

      setStatusMessage("Başarıyla kaydedildi! Takip başlıyor.");
      setTargetUsername(username);
    } catch (error) {
      console.error("Save failed", error);
      setStatusMessage("Kaydetme hatası oluştu.");
    } finally {
      setSaving(false);
    }
  };

  // Generate Telegram Deep Link
  // You need to set NEXT_PUBLIC_TELEGRAM_BOT_NAME in env
  const telegramBotName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "MyTrackerBot";
  // Ensure we have a user UID before generating the link
  const telegramLink = user && user.uid 
    ? `https://t.me/${telegramBotName}?start=${user.uid}` 
    : "https://t.me/" + telegramBotName;

  if (loading) return <div className="p-8">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Instagram Takipçisi</h1>

        {!user ? (
          <button
            onClick={handleLogin}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition"
          >
            Google ile Giriş Yap
          </button>
        ) : (
          <div className="space-y-6">
            <div className="text-center text-sm text-gray-600">
              Hoşgeldin, {user.displayName}
              <button onClick={() => signOut(auth)} className="text-red-500 ml-2 underline">Çıkış</button>
            </div>

            <div className="border-t pt-4">
              <h2 className="text-lg font-semibold mb-2">1. Adım: Telegram Bağlantısı</h2>
              {telegramConnected ? (
                <div className="bg-green-100 text-green-800 p-2 rounded text-center">
                  ✅ Telegram Bağlandı
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Bildirimleri alabilmek için Telegram botunu başlatmalısınız.
                  </p>
                  <a
                    href={telegramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-blue-400 text-white py-2 px-4 rounded text-center hover:bg-blue-500"
                  >
                    Telegram Botunu Başlat
                  </a>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h2 className="text-lg font-semibold mb-2">2. Adım: Hesabı Belirle</h2>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Takip edilecek Instagram Linki veya Kullanıcı Adı
              </label>
              <input
                type="text"
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                placeholder="https://instagram.com/elonmusk"
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              />
              <button
                onClick={handleSave}
                disabled={saving || !targetUsername}
                className="mt-3 w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Takibi Başlat"}
              </button>
              {statusMessage && (
                <p className="mt-2 text-sm text-center text-green-600">{statusMessage}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
