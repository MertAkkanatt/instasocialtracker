"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTelegramConnected(!!data.telegramChatId);
          if (data.keywords) {
            setKeywords(data.keywords.join(", "));
          }
        }
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
      // Split by comma and clean
      const keywordArray = keywords.split(",").map(k => k.trim()).filter(k => k.length > 0);

      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        keywords: keywordArray,
        updatedAt: new Date()
      }, { merge: true });

      setStatusMessage("Ayarlar kaydedildi! Bu kelimelerle ilgili haberler analiz edilecek.");
    } catch (error) {
      console.error("Save failed", error);
      setStatusMessage("Kaydetme hatası oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const telegramBotName = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "MarketMoodBot";
  // Ensure we have a user UID before generating the link
  const telegramLink = user && user.uid 
    ? `https://t.me/${telegramBotName}?start=${user.uid}` 
    : `https://t.me/${telegramBotName}`;

  if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-lg border border-slate-200">
        <h1 className="text-3xl font-bold mb-2 text-center text-slate-800">MarketMood 📈</h1>
        <p className="text-center text-slate-500 mb-8">Yapay Zeka Destekli Piyasa Duygu Analizi</p>

        {!user ? (
          <div className="text-center">
            <button
              onClick={handleLogin}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 transition font-medium shadow-md"
            >
              Google ile Giriş Yap
            </button>
            <p className="mt-4 text-sm text-slate-400">Haberleri kaçırma, piyasanın nabzını tut.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-center border-b pb-4">
              <span className="text-sm font-medium text-slate-600">{user.displayName}</span>
              <button onClick={() => signOut(auth)} className="text-red-500 text-sm hover:underline">Çıkış</button>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3 text-slate-800">1. Bildirim Ayarı</h2>
              {telegramConnected ? (
                <div className="bg-green-50 text-green-700 p-3 rounded-lg text-center border border-green-200 flex items-center justify-center gap-2">
                  <span>✅</span> <strong>Telegram Bağlandı</strong>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-600 mb-3">
                    Analiz sonuçlarını anlık almak için botu başlatın.
                  </p>
                  <a
                    href={telegramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-sky-500 text-white py-2.5 px-4 rounded-lg text-center hover:bg-sky-600 transition font-medium"
                  >
                    Telegram Botunu Bağla ✈️
                  </a>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3 text-slate-800">2. Takip Listesi</h2>
              <label className="block text-sm text-slate-600 mb-2">
                Takip etmek istediğiniz hisse, coin veya anahtar kelimeler (virgülle ayırın):
              </label>
              <textarea
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Örn: THYAO, ASELSAN, Bitcoin, Altın, Dolar..."
                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] text-slate-700"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-4 w-full bg-slate-800 text-white py-3 px-4 rounded-lg hover:bg-slate-900 transition disabled:opacity-50 font-medium"
              >
                {saving ? "Kaydediliyor..." : "Analizi Başlat"}
              </button>
              {statusMessage && (
                <p className={`mt-3 text-sm text-center ${statusMessage.includes("hatası") ? "text-red-500" : "text-green-600"}`}>
                  {statusMessage}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
