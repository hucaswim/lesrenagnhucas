/* =========================================================
   KONFIGURASI FIREBASE — dipakai oleh dashboard.html
   Ganti semua nilai "ISI_..." dengan data dari proyek Firebase kamu:
   Firebase Console > Project settings (ikon roda gigi) > General
   > "Your apps" > Web app (</>) > "SDK setup and configuration" > Config
   (Detail langkah ada di SETUP-GUIDE.md bagian B)

   Catatan: nilai ini BUKAN password rahasia — keamanan data dijaga oleh
   Firebase Authentication + Firestore Rules (lihat SETUP-GUIDE.md).
   ========================================================= */
window.FIREBASE_CONFIG = {
  apiKey: "ISI_API_KEY",
  authDomain: "ISI_PROJECT_ID.firebaseapp.com",
  projectId: "ISI_PROJECT_ID",
  storageBucket: "ISI_PROJECT_ID.appspot.com",
  messagingSenderId: "ISI_SENDER_ID",
  appId: "ISI_APP_ID"
};
