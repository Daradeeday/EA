require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const trades = [];
const alerts = [];
const statuses = [];

const PORT = process.env.PORT || 3000;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_USER_ID = process.env.LINE_USER_ID;
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

// ------------------------------
// Helpers
// ------------------------------
async function pushLineMessage(text) {
  if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_USER_ID) {
    throw new Error("Missing LINE env vars");
  }

  await axios.post(
    "https://api.line.me/v2/bot/message/push",
    {
      to: LINE_USER_ID,
      messages: [
        {
          type: "text",
          text,
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    }
  );
}

async function sendToGoogleSheet(route, payload) {
  if (!GOOGLE_SCRIPT_URL) return;

  await axios.post(
    GOOGLE_SCRIPT_URL,
    {
      route,
      ...payload,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}


function safePush(arr, item, max = 1000) {
  arr.push(item);
  if (arr.length > max) arr.shift();
}

// ------------------------------
// Routes
// ------------------------------
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "server running" });
});

app.post("/status", async (req, res) => {
  try {
    const payload = { ...req.body, ts: new Date().toISOString() };

    safePush(statuses, payload, 500);

    await sendToGoogleSheet("status", payload);

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /status error:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/trade/open", async (req, res) => {
  try {
    const payload = { ...req.body, ts: new Date().toISOString() };

    safePush(trades, payload, 1000);

    await sendToGoogleSheet("trade_open", payload);

    const msg =
      `เปิดออเดอร์\n` +
      `Symbol: ${payload.symbol}\n` +
      `Type: ${payload.type}\n` +
      `Lot: ${payload.lot}\n` +
      `Entry: ${payload.entry}\n` +
      `SL: ${payload.sl}\n` +
      `TP: ${payload.tp}\n` +
      `Regime: ${payload.regime}`;

    await pushLineMessage(msg);

    res.json({ ok: true });
  } catch (e) {
  console.error("ERROR:", e.response ? e.response.data : e.message);
  res.status(500).json({
    ok: false,
    error: e.message,
    detail: e.response ? e.response.data : null
  });
}
});

app.post("/trade/close", async (req, res) => {
  try {
    const payload = { ...req.body, ts: new Date().toISOString() };

    safePush(trades, payload, 1000);

    await sendToGoogleSheet("trade_close", payload);

    const msg =
      `ปิดออเดอร์\n` +
      `Symbol: ${payload.symbol}\n` +
      `Type: ${payload.type}\n` +
      `Profit: ${payload.profit}\n` +
      `Ticket: ${payload.ticket}`;

    await pushLineMessage(msg);

    res.json({ ok: true });
  } catch (e) {
  console.error("ERROR:", e.response ? e.response.data : e.message);
  res.status(500).json({
    ok: false,
    error: e.message,
    detail: e.response ? e.response.data : null
  });
}
});

app.post("/alert", async (req, res) => {
  try {
    const payload = { ...req.body, ts: new Date().toISOString() };

    safePush(alerts, payload, 1000);

    await sendToGoogleSheet("alert", payload);

    await pushLineMessage(`ALERT\n${payload.message}`);

    res.json({ ok: true });
  } catch (e) {
  console.error("ERROR:", e.response ? e.response.data : e.message);
  res.status(500).json({
    ok: false,
    error: e.message,
    detail: e.response ? e.response.data : null
  });
}
});

app.get("/dashboard/summary", (req, res) => {
  res.json({
    ok: true,
    latestStatus: statuses[statuses.length - 1] || null,
    latestTrades: trades.slice(-20).reverse(),
    latestAlerts: alerts.slice(-20).reverse(),
  });
});

app.post("/webhook", (req, res) => {
  const events = req.body.events || [];
  for (const ev of events) {
    console.log("LINE webhook event:", JSON.stringify(ev, null, 2));
  }
  res.sendStatus(200);
});

app.get("/test-line", async (req, res) => {
  try {
    await pushLineMessage("ทดสอบส่งข้อความจาก server สำเร็จ");
    res.json({ ok: true });
  } catch (e) {
  console.error("ERROR:", e.response ? e.response.data : e.message);
  res.status(500).json({
    ok: false,
    error: e.message,
    detail: e.response ? e.response.data : null
  });
}
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});




