"use client";

/**
 * useWebSocketLocation — NGO side
 * Production-Grade Dual-Stream Monitoring:
 * 1. navigator.geolocation.watchPosition (Primary)
 * 2. setInterval + getCurrentPosition (Secondary Fallback for Background stability)
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { getSocket } from "@/lib/socket";

interface LocationHookOptions {
    donationId: string | null;
    userId: string | null;
    ngoName?: string;
    enabled: boolean;
}

export function useWebSocketLocation({
    donationId,
    userId,
    enabled,
}: LocationHookOptions) {
    const [isConnected, setIsConnected] = useState(false);
    const watchIdRef = useRef<number | null>(null);
    const fallbackIdRef = useRef<NodeJS.Timeout | null>(null);
    const lastEmitRef = useRef<number>(0);
    const lastPosRef = useRef<{ lat: number, lng: number } | null>(null);

    // Config
    const THROTTLE_MS = 2500; // Phase 1: 2-3 second heartbeat
    const MOVEMENT_THRESHOLD = 0.000002; // ~0.2 meters (Detect micro-movements)

    // ── Single Source of Truth Socket (Phase 1, 3) ───────────────────
    useEffect(() => {
        if (!donationId || !enabled) return;

        const socket = getSocket();
        
        const handleJoin = () => {
            console.log("[WS-PRODUCTION] NGO Reclaiming Room:", donationId);
            // PHASE 3: Force Room Join on both connect and reconnect
            socket.emit("join-room", donationId);
            setIsConnected(true);
        };

        const handleDisconnect = () => {
            setIsConnected(false);
        };

        if (socket.connected) handleJoin();

        socket.on("connect", handleJoin);
        socket.on("reconnect", handleJoin);
        socket.on("disconnect", handleDisconnect);

        return () => {
            socket.off("connect", handleJoin);
            socket.off("reconnect", handleJoin);
            socket.off("disconnect", handleDisconnect);
        };
    }, [donationId, enabled]);

    // ── Location Broadcaster (PHASE 2) ──────────────────────────────
    const sendPulse = useCallback((pos: GeolocationPosition) => {
        const now = Date.now();
        // Limit max fire rate to 2 seconds, but NEVER skip based on position distance
        if (now - lastEmitRef.current < 2000) return;

        const { latitude: lat, longitude: lng } = pos.coords;
        lastEmitRef.current = now;

        const socket = getSocket();
        if (socket?.connected && donationId) {
            // Emit strictly the required format
            socket.emit("tracking:location", {
                donationId,
                lat,
                lng,
                timestamp: now
            });
            console.log(`[NGO-LIVE] Status: Streaming Pulse -> ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
    }, [donationId]);

    // ── Dual-Stream GPS Engine (Phase 3 Hardening) ───────────────────
    useEffect(() => {
        if (!enabled || typeof window === 'undefined' || !navigator.geolocation) return;

        console.log("[NGO-PRODUCTION] Starting Dual-Stream GPS (Primary + Heartbeat Fallback)");

        // 1. Primary Stream (watchPosition)
        const watchId = navigator.geolocation.watchPosition(
            (pos) => sendPulse(pos),
            (err) => console.error("[NGO-GPS] Primary Stream Error:", err.message),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
        watchIdRef.current = watchId;

        // 2. Heartbeat Fallback (PHASE 2)
        const fallbackId = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                (pos) => sendPulse(pos),
                (err) => console.warn("[NGO-GPS] Fallback Pulse Failed:", err.message),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
            );
        }, 3000); // 3 seconds always
        fallbackIdRef.current = fallbackId;

        return () => {
            if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
            if (fallbackIdRef.current) clearInterval(fallbackIdRef.current);
        };
    }, [donationId, enabled, sendPulse]);

    // ── Status Emitter (Phase 16) ────────────────────────────────────
    const emitStatus = useCallback(
        (status: string) => {
            const socket = getSocket();
            if (socket?.connected && donationId) {
                // Phase 1: Use ONLY tracking:status
                socket.emit("tracking:status", { 
                    donationId, 
                    status,
                    timestamp: Date.now() 
                });
            }
        },
        [donationId]
    );

    return { emitStatus, isConnected };
}
