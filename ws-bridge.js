import net from "net";
import WebSocket from "ws";

const TCP_PORT = 10000; // Unity connects here
const WS_URL = "wss://ws-bridge.onrender.com"; // your Render signaling bridge

// === TCP SERVER (for Unity) ===
const tcpServer = net.createServer((unitySocket) => {
  console.log("🟢 Unity connected via TCP");

  // Connect to WebSocket bridge
  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log("🌐 Connected to WebSocket bridge");
  });

  ws.on("message", (msg) => {
    // Forward messages from WS → Unity
    try {
      const text = msg.toString().trim();
      if (text) {
        unitySocket.write(text + "\n");
        console.log("➡️ WS → Unity:", text.slice(0, 80));
      }
    } catch (err) {
      console.error("Error forwarding to Unity:", err);
    }
  });

  unitySocket.on("data", (data) => {
    // Forward messages from Unity → WS
    const messages = data.toString().split("\n").filter(Boolean);
    for (const msg of messages) {
      try {
        ws.send(msg);
        console.log("⬅️ Unity → WS:", msg.slice(0, 80));
      } catch (err) {
        console.error("Error forwarding to WS:", err);
      }
    }
  });

  unitySocket.on("close", () => {
    console.log("🔴 Unity TCP disconnected");
    ws.close();
  });

  unitySocket.on("error", (err) => {
    console.error("Unity TCP error:", err);
    ws.close();
  });

  ws.on("close", () => {
    console.log("🔴 WebSocket closed");
    unitySocket.destroy();
  });
});

tcpServer.listen(TCP_PORT, () => {
  console.log(`🚀 TCP–WS bridge listening on port ${TCP_PORT}`);
});
