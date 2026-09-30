const WebSocket = require("ws");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

const server = https.createServer({
  key: fs.readFileSync(path.join(__dirname, "192.168.0.13+2-key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "192.168.0.13+2.pem")),
}, (req, res) => {
  if (req.url === "/" || req.url === "/portal.html") {
    const filePath = path.join(__dirname, "portal.html");
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("portal.html não encontrado");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
  } else {
    res.writeHead(200);
    res.end("ok");
  }
});

const wss = new WebSocket.Server({ server });
const room = { peers: [] };

wss.on("connection", (ws) => {
  if (room.peers.length >= 2) {
    ws.send(JSON.stringify({ type: "error", message: "sala cheia" }));
    ws.close();
    return;
  }

  room.peers.push(ws);
  const peerId = room.peers.length === 1 ? "A" : "B";
  ws.peerId = peerId;

  console.log(`[server] peer ${peerId} conectou — ${room.peers.length}/2 na sala`);
  ws.send(JSON.stringify({ type: "welcome", peerId, peerCount: room.peers.length }));

  if (room.peers.length === 2) {
    room.peers[0].send(JSON.stringify({ type: "peer-joined" }));
    console.log("[server] sala completa — iniciando sinalização");
  }

  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    console.log(`[server] ${ws.peerId} → ${msg.type}`);
    const other = room.peers.find((p) => p !== ws && p.readyState === WebSocket.OPEN);
    if (other) other.send(JSON.stringify(msg));
  });

  ws.on("close", () => {
    room.peers = room.peers.filter((p) => p !== ws);
    console.log(`[server] peer ${ws.peerId} desconectou — ${room.peers.length}/2 na sala`);
    const remaining = room.peers[0];
    if (remaining && remaining.readyState === WebSocket.OPEN) {
      remaining.send(JSON.stringify({ type: "peer-left" }));
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🔵 Portal HTTPS rodando`);
  console.log(`   Notebook → https://localhost:${PORT}/portal.html`);
  console.log(`   iPad     → https://192.168.0.13:${PORT}/portal.html`);
  console.log(`   WebSocket → wss://192.168.0.13:${PORT}\n`);
});
