const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(cors());

// Basic health check
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
    console.warn("⚠️  WARNING: MONGODB_URI not found in .env. Socket server will run without DB persistence.");
} else {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log("✅ Socket Server connected to MongoDB Persistence Layer"))
        .catch(err => {
            console.error("❌ MongoDB Connection Error:", err);
            // In production, we might want to continue even if DB fails, but log it clearly
        });
}

// Memory Cache (Instant Join Sync)
const lastKnownPositions = new Map();
const lastKnownStatuses = new Map();

io.on("connection", (socket) => {
    console.log(`[SOCKET] User connected: ${socket.id} (Transport: ${socket.conn.transport.name})`);

    // --- PHASE 1: Room Join ---
    socket.on("join-room", (donationId) => {
        if (!donationId) return;
        const room = typeof donationId === 'object' ? donationId.donationId : donationId;
        socket.join(room);
        console.log(`[SOCKET] JOIN-ROOM: ${socket.id} -> ${room}`);
        
        // Sync last known state from memory for zero-latency join
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

    // --- PHASE 2: Production Tracking Events ---
    socket.on("tracking:location", async (data) => {
        const { donationId, lat, lng } = data;
        if (!donationId || !lat || !lng) return;

        // 1. Broadcast to donor instantly
        lastKnownPositions.set(donationId, data);
        io.to(donationId).emit("tracking:location", data);

        // 2. Persist to Database (Hardening)
        try {
            await mongoose.connection.db.collection('donations').updateOne(
                { _id: new mongoose.Types.ObjectId(donationId) },
                { 
                    $set: { 
                        liveLatitude: lat, 
                        liveLongitude: lng,
                        liveLocationUpdatedAt: new Date()
                    } 
                }
            );
        } catch (err) {
            console.error(`[DB-ERROR] Failed to persist location for ${donationId}:`, err.message);
        }
    });

    socket.on("tracking:status", async (data) => {
        const { donationId, status } = data;
        if (!donationId || !status) return;

        console.log(`[SOCKET] STATUS_UPDATE: ${donationId} -> ${status}`);
        lastKnownStatuses.set(donationId, status);
        io.to(donationId).emit("tracking:status", data);

        // Persist status change (Sync fallback)
        try {
            await mongoose.connection.db.collection('donations').updateOne(
                { _id: new mongoose.Types.ObjectId(donationId) },
                { $set: { status: status.toLowerCase() } }
            );
        } catch (err) {
            console.error(`[DB-ERROR] Failed to persist status for ${donationId}:`, err.message);
        }
    });

    socket.on("tracking:stop", (data) => {
        if (data?.donationId) {
            socket.leave(data.donationId);
            console.log(`[SOCKET] TRACKING:STOP: ${socket.id} left ${data.donationId}`);
        }
    });

    // --- Public Feed (Admin Dashboard Sync) ---
    socket.on("join-public-feed", () => {
        socket.join("public-feed");
    });

    socket.on("broadcast-activity", (activity) => {
        io.to("public-feed").emit("new-activity", activity);
    });

    socket.on("disconnect", (reason) => {
        console.log(`[SOCKET] User disconnected: ${socket.id} (Reason: ${reason})`);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`\n🚀 Hardened Socket Server running on port ${PORT}`);
    console.log(`🔗 Persistence Layer: MongoDB Active\n`);
});
