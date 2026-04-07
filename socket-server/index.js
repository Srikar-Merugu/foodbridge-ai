const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(cors());

app.get("/", (req, res) => {
    res.send("FoodBridge Live Tracking Socket Server is running! 🚀");
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ["polling", "websocket"],
    connectTimeout: 10000,
    pingInterval: 10000,
    pingTimeout: 5000,
});

// ── MongoDB Persistence ──
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.warn("⚠️  WARNING: MONGODB_URI not found. Running without DB persistence.");
} else {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log("✅ Socket Server connected to MongoDB"))
        .catch(err => console.error("❌ MongoDB Connection Error:", err));
}

// Memory caches
const lastKnownPositions = new Map();
const lastKnownStatuses = new Map();

// ── Typing timeout tracker (auto-clear typing after 3 seconds of inactivity) ──
const typingTimers = new Map();

io.on("connection", (socket) => {
    console.log(`[SOCKET] Connected: ${socket.id} (${socket.conn.transport.name})`);

    // ─── ROOM JOIN ───
    socket.on("join-room", (donationId) => {
        if (!donationId) return;
        const room = typeof donationId === "object" ? donationId.donationId : donationId;
        socket.join(room);
        console.log(`[SOCKET] JOIN-ROOM: ${socket.id} → ${room}`);

        if (lastKnownPositions.has(room)) {
            socket.emit("tracking:location", lastKnownPositions.get(room));
        }
        if (lastKnownStatuses.has(room)) {
            socket.emit("tracking:status", {
                donationId: room,
                status: lastKnownStatuses.get(room),
                source: "server_sync"
            });
        }
    });

    // ─── TRACKING EVENTS ───
    socket.on("tracking:location", async (data) => {
        const { donationId, lat, lng } = data;
        if (!donationId || !lat || !lng) return;

        lastKnownPositions.set(donationId, data);
        io.to(donationId).emit("tracking:location", data);

        try {
            await mongoose.connection.db.collection("donations").updateOne(
                { _id: new mongoose.Types.ObjectId(donationId) },
                { $set: { liveLatitude: lat, liveLongitude: lng, liveLocationUpdatedAt: new Date() } }
            );
        } catch (err) {
            console.error(`[DB-ERROR] Location persist failed for ${donationId}:`, err.message);
        }
    });

    socket.on("tracking:status", async (data) => {
        const { donationId, status } = data;
        if (!donationId || !status) return;

        console.log(`[SOCKET] STATUS: ${donationId} → ${status}`);
        lastKnownStatuses.set(donationId, status);
        io.to(donationId).emit("tracking:status", data);

        try {
            await mongoose.connection.db.collection("donations").updateOne(
                { _id: new mongoose.Types.ObjectId(donationId) },
                { $set: { status: status.toLowerCase() } }
            );
        } catch (err) {
            console.error(`[DB-ERROR] Status persist failed for ${donationId}:`, err.message);
        }
    });

    socket.on("tracking:stop", (data) => {
        if (data?.donationId) {
            socket.leave(data.donationId);
            console.log(`[SOCKET] STOP: ${socket.id} left ${data.donationId}`);
        }
    });

    // ─── PUBLIC FEED ───
    socket.on("join-public-feed", () => socket.join("public-feed"));
    socket.on("broadcast-activity", (activity) => io.to("public-feed").emit("new-activity", activity));

    // ─── CHAT: MESSAGE ───
    socket.on("chat:message", async (data) => {
        const { donationId, sender, message, type = "text", timestamp } = data;
        if (!donationId || !sender || !message) return;

        console.log(`[CHAT] ${sender} in ${donationId}: "${message.substring(0, 30)}"`);

        const savedData = { donationId, sender, message, type, seen: false, timestamp: timestamp || new Date().toISOString() };

        // Broadcast to EVERYONE in the room (including sender for echo confirmation)
        io.to(donationId).emit("chat:message", savedData);

        try {
            await mongoose.connection.db.collection("chatmessages").insertOne({
                donationId: new mongoose.Types.ObjectId(donationId),
                sender,
                message,
                type,
                seen: false,
                timestamp: new Date(timestamp || Date.now()),
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        } catch (err) {
            console.error(`[DB-ERROR] Chat persist failed for ${donationId}:`, err.message);
        }
    });

    // ─── CHAT: TYPING INDICATOR ───
    socket.on("chat:typing", ({ donationId, sender }) => {
        if (!donationId || !sender) return;

        // Broadcast to everyone EXCEPT the sender
        socket.to(donationId).emit("chat:typing", sender);

        // Auto-clear typing after 3s of no new typing events
        const key = `${donationId}:${sender}`;
        if (typingTimers.has(key)) clearTimeout(typingTimers.get(key));
        const timer = setTimeout(() => {
            socket.to(donationId).emit("chat:typing", null);
            typingTimers.delete(key);
        }, 3000);
        typingTimers.set(key, timer);
    });

    // ─── CHAT: SEEN STATUS ───
    socket.on("chat:seen", async ({ donationId, seenBy }) => {
        if (!donationId || !seenBy) return;

        console.log(`[CHAT-SEEN] ${seenBy} read all in ${donationId}`);

        // Broadcast seen event to room
        io.to(donationId).emit("chat:seen", { donationId, seenBy });

        // Persist seen status to DB
        try {
            const senderOfMessages = seenBy === "donor" ? "ngo" : "donor";
            await mongoose.connection.db.collection("chatmessages").updateMany(
                { donationId: new mongoose.Types.ObjectId(donationId), sender: senderOfMessages, seen: false },
                { $set: { seen: true, updatedAt: new Date() } }
            );
        } catch (err) {
            console.error(`[DB-ERROR] Seen update failed for ${donationId}:`, err.message);
        }
    });

    socket.on("disconnect", (reason) => {
        console.log(`[SOCKET] Disconnected: ${socket.id} (${reason})`);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`\n🚀 FoodBridge Socket Server on port ${PORT}`);
    console.log(`📡 Events: join-room | tracking:* | chat:message | chat:typing | chat:seen\n`);
});
