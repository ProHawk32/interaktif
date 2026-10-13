import { WebSocketServer } from "ws";
import { TikTokLiveConnection } from "tiktok-live-connector";

const PORT = Number(process.env.TIKTOK_WS_PORT || 21213);
const HOST = process.env.TIKTOK_WS_HOST || "127.0.0.1";
const server = new WebSocketServer({ host: HOST, port: PORT });
const clients = new Set();
let connection = null;
let currentUsername = "";
let currentStatus = { type: "status", status: "idle", error: "" };
let sequence = 0;

function send(client, payload) {
  if (client.readyState === 1) client.send(JSON.stringify(payload));
}
function broadcast(payload) {
  for (const client of clients) send(client, payload);
}
function status(status, error = "") {
  currentStatus = { type: "status", status, error };
  broadcast(currentStatus);
}
function cleanUser(user = {}) {
  return {
    uniqueId: String(user.uniqueId || user.unique_id || "izleyici"),
    nickname: String(user.nickname || user.uniqueId || user.unique_id || "İzleyici"),
    avatar: user.profilePictureUrl || user.profilePicture?.url?.[0] || "",
  };
}
function eventId(prefix, data) {
  return String(data.msgId || data.messageId || data.id || `${prefix}-${Date.now()}-${++sequence}`);
}
async function stopConnection() {
  const old = connection;
  connection = null;
  currentUsername = "";
  if (old) {
    try { await old.disconnect(); } catch { /* already disconnected */ }
  }
}
async function startConnection(username) {
  const normalized = String(username || "").trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{2,30}$/.test(normalized)) {
    status("error", "Geçerli bir TikTok kullanıcı adı girin (@ işareti olmadan).");
    return;
  }
  if (connection && currentUsername.toLowerCase() === normalized.toLowerCase()) {
    sendStatusToAll();
    return;
  }
  await stopConnection();
  currentUsername = normalized;
  status("connecting");
  const conn = new TikTokLiveConnection(normalized);
  connection = conn;

  conn.on("connected", () => {
    if (connection !== conn) return;
    status("live");
    console.log(`TikTok LIVE connected: @${normalized}`);
  });
  conn.on("disconnected", () => {
    if (connection === conn) status("error", "TikTok LIVE bağlantısı kesildi.");
  });
  conn.on("error", (err) => {
    if (connection === conn) status("error", err?.message || "TikTok bağlantı hatası.");
    console.error("TikTok LIVE error:", err?.message || err);
  });
  conn.on("chat", (data) => {
    if (connection !== conn) return;
    broadcast({
      type: "chat",
      id: eventId("chat", data),
      user: cleanUser(data.user || data),
      text: String(data.comment || ""),
    });
  });
  conn.on("gift", (data) => {
    if (connection !== conn) return;
    // Streak gifts are applied only at their final event to avoid duplicate damage.
    if (Number(data.giftType) === 1 && data.repeatEnd === false) return;
    const repeat = Math.max(1, Number(data.repeatCount) || 1);
    const coins = Math.max(0, Number(data.diamondCount) || 0) * repeat;
    broadcast({
      type: "gift",
      id: eventId("gift", data),
      user: cleanUser(data.user || data),
      giftName: String(data.giftName || data.extendedGiftInfo?.name || "TikTok hediyesi"),
      count: repeat,
      coins,
    });
  });
  conn.on("follow", (data) => {
    if (connection !== conn) return;
    broadcast({
      type: "follow",
      id: eventId("follow", data),
      user: cleanUser(data),
      text: "yayını takip etti ❤️",
    });
  });
  conn.on("like", (data) => {
    if (connection !== conn) return;
    broadcast({
      type: "like",
      id: eventId("like", data),
      user: cleanUser(data),
      count: Number(data.likeCount) || 1,
    });
  });

  try {
    await conn.connect();
  } catch (err) {
    if (connection === conn) status("error", err?.message || "TikTok LIVE açılamadı. Kullanıcı adı ve canlı yayın durumunu kontrol edin.");
    console.error("TikTok LIVE connect failed:", err?.message || err);
  }
}
function sendStatusToAll() {
  broadcast(currentStatus);
}
server.on("connection", (client) => {
  clients.add(client);
  send(client, currentStatus);
  client.on("message", (raw) => {
    let message;
    try { message = JSON.parse(String(raw)); } catch { return; }
    if (message?.type === "connect") void startConnection(message.username);
  });
  client.on("close", () => clients.delete(client));
});
server.on("listening", () => {
  console.log(`TikTok WebSocket bridge listening on ws://${HOST}:${PORT}`);
});
process.on("SIGINT", async () => {
  await stopConnection();
  server.close(() => process.exit(0));
});
process.on("SIGTERM", async () => {
  await stopConnection();
  server.close(() => process.exit(0));
});
