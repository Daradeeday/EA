require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const trades = [];
const alerts = [];
const statuses = [];
const path = require("path");
app.use(express.static(path.join(__dirname, "public")));
async function pushLineMessage(text) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const to = process.env.LINE_USER_ID;

    if (!token || !to) {
        throw new Error("Missing LINE env vars");
    }

    await axios.post(
        "https://api.line.me/v2/bot/message/push",
        {
            to,
            messages: [
                {
                    type: "text",
                    text
                }
            ]
        },
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            }
        }
    );
}
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

async function sendToGoogleSheet(route, payload) {
  if (!GOOGLE_SCRIPT_URL) return;

  await axios.post(GOOGLE_SCRIPT_URL, {
    route,
    ...payload
  });
}

app.get("/health", (req, res) => {
    res.json({ ok: true, message: "server running" });
});

app.post("/status", async (req, res) => {
  try {
    const payload = { ...req.body, ts: new Date().toISOString() };
    statuses.push(payload);
    if (statuses.length > 500) statuses.shift();

    await sendToGoogleSheet("status", payload);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/trade/open", async (req, res) => {
    try {
        const payload = { ...req.body, ts: new Date().toISOString() };
        trades.push(payload);
        if (trades.length > 1000) trades.shift();

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
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post("/trade/close", async (req, res) => {
    try {
        const payload = { ...req.body, ts: new Date().toISOString() };
        trades.push(payload);

        const msg =
            `ปิดออเดอร์\n` +
            `Symbol: ${payload.symbol}\n` +
            `Type: ${payload.type}\n` +
            `Profit: ${payload.profit}\n` +
            `Ticket: ${payload.ticket}`;

        await pushLineMessage(msg);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.post("/alert", async (req, res) => {
    try {
        const payload = { ...req.body, ts: new Date().toISOString() };
        alerts.push(payload);
        if (alerts.length > 1000) alerts.shift();

        await pushLineMessage(`ALERT\n${payload.message}`);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.get("/dashboard/summary", (req, res) => {
    res.json({
        ok: true,
        latestStatus: statuses[statuses.length - 1] || null,
        latestTrades: trades.slice(-20).reverse(),
        latestAlerts: alerts.slice(-20).reverse()
    });
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server listening on port ${process.env.PORT || 3000}`);
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
    res.status(500).json({ ok: false, error: e.message });
  }
});





