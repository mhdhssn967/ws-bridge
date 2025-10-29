import express from "express";
import http from "http";
// Note: We use the client-side socket.io-client, not the Server class from 'socket.io'
import ioClient from "socket.io-client"; 
import { WebSocketServer } from "ws";
import cors from "cors";

// --- Configuration ---
// IMPORTANT: This URL points to your existing Node.js Socket.IO signaling server
const SIGNALING_SERVER_URL = "https://signaling-server-happymoves.onrender.com";
// The port the bridge will listen on for Unity connections
const PORT = process.env.BRIDGE_PORT || 8090;

const app = express();
app.use(cors());
app.get("/", (req, res) => res.send("✅ WebSocket bridge for Unity is running."));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ---- Handle Unity connections ----
wss.on("connection", (ws, req) => {
    console.log("[Bridge] Unity connected");
    
    // Optional: Implement security check here if a token is required
    // const token = new URL(req.url, `http://localhost`).searchParams.get("token");
    // if (token !== process.env.BRIDGE_SECRET) {
    //     console.warn("[Bridge] Connection blocked: Invalid token.");
    //     ws.close();
    //     return;
    // }

    // Create a new Socket.IO client connection for this specific Unity WebSocket connection
    const socket = ioClient(SIGNALING_SERVER_URL, {
        transports: ["websocket"],
        reconnection: true,
    });

    socket.on("connect", () => {
        console.log(`[Bridge] ${ws._socket.remoteAddress} connected to Socket.IO signaling server`);
    });

    socket.on("disconnect", () => {
        console.log(`[Bridge] ${ws._socket.remoteAddress} disconnected from signaling server`);
    });
    
    // --- Relay Socket.IO messages → Unity (Incoming from other peers/server) ---
    // The Unity client expects: { "type": "event_name", "payload": { ... } }
    const forwardEvents = ["offer", "answer", "ice-candidate", "peer-joined", "peer-left", "joined"];
    forwardEvents.forEach(event =>
        socket.on(event, (data) => {
            // Only send if the Unity connection is open
            if (ws.readyState === ws.OPEN) {
                const message = JSON.stringify({ type: event, payload: data });
                ws.send(message);
                // console.log(`[Bridge] Relayed SIO event '${event}' to Unity: ${message.substring(0, 50)}...`);
            }
        })
    );

    // --- Relay Unity → Socket.IO (Outgoing commands like join, offer, answer) ---
    // Unity sends: { "type": "event_name", "payload": { ... } }
    ws.on("message", (message) => {
        try {
            const msg = JSON.parse(message.toString());

            if (!msg.type || !msg.payload) {
                console.error("[Bridge] Invalid message format from Unity (missing type or payload).");
                return;
            }
            
            // Emit the event to the Socket.IO server using the type and payload from Unity
            socket.emit(msg.type, msg.payload);
            // console.log(`[Bridge] Emitted SIO event '${msg.type}' from Unity: ${JSON.stringify(msg.payload).substring(0, 50)}...`);

        } catch (err) {
            console.error("[Bridge] Error parsing or forwarding message from Unity:", err.message);
        }
    });

    // --- Cleanup ---
    ws.on("close", () => {
        console.log("[Bridge] Unity disconnected. Closing SIO connection.");
        socket.disconnect();
    });
    
    ws.on("error", (err) => {
        console.error("[Bridge] WebSocket error with Unity client:", err.message);
        socket.disconnect();
    });
    
    socket.on("error", (err) => {
        console.error("[Bridge] Socket.IO client error:", err.message);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 [Bridge] Server listening on port ${PORT}.`);
    console.log(`Unity should connect to: ws://localhost:${PORT} (or wss://your-domain.com)`);
});
