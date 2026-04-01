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
        if (!donationId || !userId || !enabled) return;

        const socket = getSocket();
        
        const handleJoin = () => {
            console.log("[WS-PRODUCTION] NGO Reclaiming Room:", donationId);
            // Phase 3: Explicit Room Join on (re)connect
            socket.emit("join-room", { donationId });
            setIsConnected(true);
        };

        if (socket.connected) handleJoin();

        socket.on("connect", handleJoin);
        socket.on("reconnect", handleJoin);
        socket.on("disconnect", () => setIsConnected(false));
        socket.on("connect_error", () => setIsConnected(false));

        return () => {
            socket.off("connect", handleJoin);
            socket.off("reconnect", handleJoin);
            socket.off("disconnect");
        };
    }, [donationId, userId, enabled]);

    // ── Location Broadcaster ─────────────────────────────────────────
    const sendPulse = useCallback((pos: GeolocationPosition) => {
        const now = Date.now();
        if (now - lastEmitRef.current < THROTTLE_MS) return;

        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        
        // Skip if position hasn't changed meaningfully (save bandwidth/battery)
        if (lastPosRef.current) {
            const dLat = Math.abs(lat - lastPosRef.current.lat);
            const dLng = Math.abs(lng - lastPosRef.current.lng);
            if (dLat < MOVEMENT_THRESHOLD && dLng < MOVEMENT_THRESHOLD && (now - lastEmitRef.current < 10000)) {
                return; // Only heartbeat every 10s if static
            }
        }

        lastEmitRef.current = now;
        lastPosRef.current = { lat, lng };

        const socket = getSocket();
        if (socket?.connected && donationId) {
            const payload = {
                donationId,
                lat,
                lng,
                accuracy,
                timestamp: now // Production Requirement: uses Date.now()
            };
            // Phase 1: Use ONLY tracking:location
            socket.emit("tracking:location", payload);
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

        // 2. Heartbeat Fallback (Ensures foreground/background stability)
        const fallbackId = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                (pos) => sendPulse(pos),
                (err) => {
                    console.warn("[NGO-GPS] Fallback Pulse Failed:", err.message);
                    // Phase 3: Retry/Restart logic implicitly handled by interval
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
            );
        }, 5000); // Check every 5s
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
