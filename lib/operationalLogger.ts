import { io } from "socket.io-client";
import OperationalLog from "@/models/OperationalLog";
import dbConnect from "@/lib/db";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "https://foodbridge-ai-nk8s.onrender.com";

export const logOperationalActivity = async (data: {
    title: string;
    description: string;
    type: 'route' | 'compliance' | 'milestone' | 'mission';
    userId: string;
    ngoId?: string;
}) => {
    try {
        await dbConnect();
        
        // 1. Persist to DB
        const log = await OperationalLog.create(data);
        
        // 2. Emit to Socket Server for real-time UI refresh
        const socket = io(SOCKET_URL, {
            transports: ["polling"], // Polling is safer for one-off emits from serverless
            reconnection: false
        });

        socket.on("connect", () => {
            socket.emit("broadcast-activity", {
                ...data,
                _id: log._id,
                createdAt: log.createdAt
            });
            
            // Give it a tiny bit of time to emit before disconnecting
            setTimeout(() => socket.disconnect(), 1000);
        });

        return log;
    } catch (err) {
        console.error("[OPERATIONAL-LOGGER] Failed to log activity:", err);
        return null;
    }
};
