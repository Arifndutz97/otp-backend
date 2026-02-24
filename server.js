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

  let { phone, type } = req.body;

  if (!phone || !type) {
    return res.status(400).json({ error: "Phone & type required" });
  }

  if (phone.startsWith("0")) {
    phone = "62" + phone.substring(1);
  }

  if (phone.startsWith("+")) {
    phone = phone.substring(1);
  }

  const otp = Math.floor(100000 + Math.random() * 900000);
  const expireAt = Date.now() + 5 * 60 * 1000;

  await db.collection("otp_verifications").doc(phone).set({
    otp,
    expireAt,
    verified: false
  });

  try {

    if (type === "wa") {
      await axios.post(
        "https://api.fonnte.com/send",
        {
          target: phone,
          message: `Kode OTP kamu: ${otp}`
        },
        {
          headers: {
            Authorization: FONNTE_TOKEN
          }
        }
      );
    }

    res.json({ success: true });

  } catch (err) {
    console.log(err.response?.data || err.message);
    res.status(500).json({ error: "Failed sending OTP" });
  }
});

/* =========================
   VERIFY OTP
========================= */

app.post("/verify-otp", async (req, res) => {

  let { phone, otp } = req.body;

  if (phone.startsWith("+")) {
    phone = phone.substring(1);
  }

  const doc = await db.collection("otp_verifications").doc(phone).get();

  if (!doc.exists) {
    return res.status(400).json({ error: "OTP not found" });
  }

  const data = doc.data();

  if (Date.now() > data.expireAt) {
    return res.status(400).json({ error: "OTP expired" });
  }

  if (String(data.otp) !== String(otp)) {
    return res.status(400).json({ error: "OTP salah" });
  }

  await db.collection("otp_verifications")
    .doc(phone)
    .update({ verified: true });

  res.json({ success: true });

});

module.exports = app;
