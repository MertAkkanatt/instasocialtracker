# Social Tracker Kurulum Rehberi

Bu uygulama, belirlediğiniz Instagram hesaplarını takip edip, günlük olarak yeni takip ettikleri veya takipten çıktıkları kişileri Telegram üzerinden size bildirir.

## 1. Firebase Kurulumu
1. [Firebase Console](https://console.firebase.google.com/) adresine gidin ve yeni bir proje oluşturun.
2. **Authentication** menüsüne gidin, "Sign-in method" sekmesinden **Google**'ı etkinleştirin.
3. **Firestore Database** menüsüne gidin ve veritabanını oluşturun.
4. **Project Settings** -> **Service Accounts** sekmesinden "Generate new private key" diyerek admin JSON dosyasını indirin. Bu dosyadaki bilgileri `.env.local` dosyasındaki `FIREBASE_CLIENT_EMAIL` ve `FIREBASE_PRIVATE_KEY` alanlarına yazacaksınız.
5. **Project Settings** -> **General** sekmesinden web uygulaması oluşturun ve `firebaseConfig` bilgilerini `.env.local` içine kopyalayın.

## 2. Telegram Bot Kurulumu
1. Telegram'da `@BotFather`'ı bulun.
2. `/newbot` komutu ile yeni bir bot oluşturun.
3. Size verilen **Token**'ı kopyalayın.
4. Botunuzun kullanıcı adını not edin.

## 3. Instagram Oturumu
Instagram verilerini çekebilmek için geçerli bir oturum gereklidir (fake hesap kullanmanız önerilir).
1. Tarayıcıda Instagram'a giriş yapın.
2. Geliştirici araçlarını açın (F12) -> Application -> Cookies.
3. `sessionid` değerini kopyalayın.

## 4. Çevresel Değişkenler (.env.local)
Proje ana dizininde `.env.local` dosyası oluşturun ve şu bilgileri doldurun:

```env
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Telegram
TELEGRAM_BOT_TOKEN=...
NEXT_PUBLIC_TELEGRAM_BOT_NAME=BotKullaniciAdi

# Instagram
INSTAGRAM_SESSION_ID=...
```

## 5. Dağıtım (Deployment)
Bu proje Vercel üzerinde çalışmak üzere tasarlanmıştır.
1. Projeyi GitHub'a yükleyin.
2. Vercel'de yeni proje oluşturup GitHub reponuzu seçin.
3. Yukarıdaki çevresel değişkenleri Vercel proje ayarlarına ekleyin.
4. `vercel.json` dosyasındaki Cron Job ayarı sayesinde her gün saat 12:00'de otomatik kontrol yapılacaktır.

## 6. Telegram Webhook Ayarı
Projeniz yayınlandıktan sonra (örneğin `https://uygulamam.vercel.app`), Telegram botunun web sitenizle konuşabilmesi için şu komutu tarayıcınızın adres çubuğuna yapıştırın:

`https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://uygulamam.vercel.app/api/telegram`

`<TOKEN>` yerine bot token'ınızı, `https://uygulamam.vercel.app` yerine kendi site adresinizi yazın.

