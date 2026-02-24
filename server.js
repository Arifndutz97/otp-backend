const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());


const FONNTE_TOKEN = process.env.FONNTE_TOKEN;
app.get("/", (req, res) => {
  res.send("OTP Backend Ready 🔥");
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
console.log("TOKEN TERBACA:", FONNTE_TOKEN);
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

      console.log("FONNTE SUCCESS:", response.data);
    }

    res.json({ success: true });

  } catch (err) {
    console.log("FONNTE ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Gagal kirim WA" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
  console.log("Server running on port " + PORT)
);
