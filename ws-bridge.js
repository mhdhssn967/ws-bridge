// bridge-server.js (Render-friendly version)
import WebSocket, { WebSocketServer } from "ws";
import net from "net";

const PORT = process.env.PORT || 8080;

// Create one TCP server for Unity
const tcpServer = net.createServer();
tcpServer.listen(PORT, () => {
  console.log(`🎮 TCP (Unity) and WS Bridge running on port ${PORT}`);
});

let unitySocket = null;

// Create WebSocket server sharing the same port
const wss = new WebSocketServer({ noServer: true });

// When Render’s HTTP upgrade request happens, attach WS
tcpServer.on("connection", (socket) => {
  // Detect if this is a WebSocket upgrade or a Unity TCP connection
  socket.once("data", (buffer) => {
    const str = buffer.toString();
    if (str.startsWith("GET")) {
      // WebSocket handshake
      socket.unshift(buffer);
      wss.handleUpgrade(socket, socket.request || {}, Buffer.alloc(0), (ws) => {
        wss.emit("connection", ws, socket.request);
      });
    } else {
      console.log("🎮 Unity TCP connected");
      unitySocket = socket;
    }
  });
});

wss.on("connection", (ws) => {
  console.log("🌐 WebSocket client connected (browser)");

  if (!unitySocket) {
    ws.send(JSON.stringify({ error: "Unity not connected yet" }));
    return;
  }

  ws.on("message", (msg) => {
    unitySocket.write(msg.toString().trim() + "\n");
  });

  unitySocket.on("data", (data) => {
    const messages = data.toString().split("\n").filter((m) => m.trim() !== "");
    for (const msg of messages) ws.send(msg);
  });
});
