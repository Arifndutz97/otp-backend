const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

const FONNTE_TOKEN = process.env.FONNTE_TOKEN;
const otpStore = {};

app.get("/", (req, res) => {
  res.json({ message: "OTP Backend Ready 🔥" });
});

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
otpStore[phone] = {
  otp,
  expires: Date.now() + 5 * 60 * 1000
};

  
  try {
    if (type === "wa") {
      const response = await axios.post(
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

      console.log(response.data);
    }

    res.json({ success: true });

  } catch (err) {
    console.log(err.response?.data || err.message);
    res.status(500).json({ error: "Failed" });
  }
});
app.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;

  const data = otpStore[phone];

  if (!data) {
    return res.status(400).json({ error: "OTP not found" });
  }

  if (Date.now() > data.expires) {
    delete otpStore[phone];
    return res.status(400).json({ error: "OTP expired" });
  }

  if (data.otp != otp) {
    return res.status(400).json({ error: "OTP salah" });
  }

  delete otpStore[phone];

  res.json({ success: true });
});
module.exports = app;
