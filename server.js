const express = require("express");
const cors = require("cors");
const axios = require("axios");
const admin = require("firebase-admin");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   FIREBASE ADMIN INIT
========================= */

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FB_PROJECT_ID,
    clientEmail: process.env.FB_CLIENT_EMAIL,
    privateKey: process.env.FB_PRIVATE_KEY.replace(/\\n/g, "\n")
  })
});

const db = admin.firestore();

const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

/* =========================
   ROOT
========================= */

app.get("/", (req, res) => {
  res.json({ message: "OTP Backend Ready 🔥" });
});

/* =========================
   SEND OTP
========================= */

app.post("/send-otp", async (req, res) => {
  try {

    let { phone, type } = req.body;

    if (!phone || !type) {
      return res.status(400).json({ error: "Phone & type required" });
    }

    // ===== NORMALISASI NOMOR =====
    phone = phone.replace(/\D/g, "");

    if (phone.startsWith("0")) {
      phone = "62" + phone.substring(1);
    }

    if (!phone.startsWith("62")) {
      phone = "62" + phone;
    }

    if (!/^62[0-9]{8,13}$/.test(phone)) {
      return res.status(400).json({ error: "Nomor tidak valid" });
    }

    const docRef = db.collection("otp_verifications").doc(phone);
    const docSnap = await docRef.get();

    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    if (docSnap.exists) {
      const data = docSnap.data();

      // 🔒 60 detik cooldown
      if (data.lastRequestAt && now - data.lastRequestAt < 60000) {
        return res.status(429).json({
          error: "Tunggu 60 detik sebelum minta OTP lagi"
        });
      }

      // 🔒 Maks 5 per hari
      if (data.dayKey === today && data.requestCount >= 5) {
        return res.status(429).json({
          error: "Maksimal 5 OTP per hari"
        });
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000);

    const newData = {
      otp,
      expireAt: now + 5 * 60 * 1000, // 5 menit
      lastRequestAt: now,
      dayKey: today,
      requestCount:
        docSnap.exists && docSnap.data().dayKey === today
          ? docSnap.data().requestCount + 1
          : 1
    };

    await docRef.set(newData);

    if (type === "wa") {
      await axios.post(
        "https://api.fonnte.com/send",
        {
          target: phone,
          message: `Kode OTP kamu: ${otp}`
        },
        {
          headers: {
            Authorization: process.env.FONNTE_TOKEN
          }
        }
      );
    }

    res.json({ success: true });

  } catch (err) {
    console.log("SEND OTP ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Gagal kirim OTP" });
  }
});

/* =========================
   VERIFY OTP
========================= */

app.post("/verify-otp", async (req, res) => {
  try {

    let { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: "Phone & OTP required" });
    }

    // Normalisasi ulang (anti bypass frontend)
    phone = phone.replace(/\D/g, "");

    if (phone.startsWith("0")) {
      phone = "62" + phone.substring(1);
    }

    if (!phone.startsWith("62")) {
      phone = "62" + phone;
    }

    const docRef = db.collection("otp_verifications").doc(phone);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(400).json({ error: "OTP tidak ditemukan" });
    }

    const data = docSnap.data();

    // ⏰ Expired check
    if (Date.now() > data.expireAt) {
      await docRef.delete();
      return res.status(400).json({ error: "OTP expired" });
    }

    // ❌ Salah
    if (String(data.otp) !== String(otp)) {
      return res.status(400).json({ error: "OTP salah" });
    }

    // ✅ SUCCESS → AUTO DELETE
    await docRef.delete();

    res.json({ success: true });

  } catch (err) {
    console.log("VERIFY OTP ERROR:", err.message);
    res.status(500).json({ error: "Terjadi kesalahan" });
  }
});
   
