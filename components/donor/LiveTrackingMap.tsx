"use client";

/**
 * LiveTrackingMap — Production-Grade Donor Tracking
 * 1. Interpolation: 2.5s requestAnimationFrame glide
 * 2. Fallback: 10s HTTP Polling if Socket Disconnected
 * 3. Health: 10s lastLocationTimestamp "Signal Dropped" logic
 */

import { useEffect, useState, useRef, useCallback, memo, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, OverlayView } from "@react-google-maps/api";
import { getSocket } from "@/lib/socket";
import { Loader2, Target, Crosshair, MapPin, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { getRequest } from "@/lib/apiClient";

const MAPS_LIBRARIES: ("places")[] = ["places"];

interface LiveTrackingMapProps {
    donationId: string;
    pickupLat: number;
    pickupLon: number;
    currentStatus?: string;
    ngoName?: string;
    destinationAddress?: string;
    onTrackingUpdate?: (data: { distance: string; duration: string; isNearby: boolean }) => void;
    onStatusChange?: (status: string) => void;
    onReconnect?: () => void;
}

const mapContainerStyle = { width: "100%", height: "100%" };

const SILVER_MAP_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
];

export default memo(function LiveTrackingMap({
    donationId,
    pickupLat,
    pickupLon,
    currentStatus,
    ngoName: propNgoName,
    destinationAddress,
    onTrackingUpdate,
    onStatusChange,
    onReconnect,
}: LiveTrackingMapProps) {
    const { data: session } = useSession();

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: MAPS_LIBRARIES,
    });

    // ── State ──
    const [ngoPos, setNgoPos] = useState<{ lat: number, lng: number } | null>(null);
    const [interpolatedPos, setInterpolatedPos] = useState<{ lat: number, lng: number } | null>(null);
    const [rotation, setRotation] = useState(0);
    const [connected, setConnected] = useState(false);
    const [isSignalDropped, setIsSignalDropped] = useState(false);
    const [liveStatus, setLiveStatus] = useState(currentStatus?.toUpperCase() || "ACCEPTED");
    const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
    const [shouldFollow, setShouldFollow] = useState(true);

    // ── Refs ──
    const mapRef = useRef<google.maps.Map | null>(null);
    const ngoPosRef = useRef<{ lat: number, lng: number } | null>(null);
    const prevPosRef = useRef<{ lat: number, lng: number } | null>(null);
    const lastLocationTimestamp = useRef<number>(Date.now());
    const lastRouteCalcTime = useRef<number>(0);
    const lastRoutePos = useRef<{ lat: number, lng: number } | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Config
    const INTERPOLATION_DURATION = 2500;
    const SIGNAL_DROP_TIMEOUT = 10000;
    const ROUTE_THROTTLE_MS = 8000;
    const MOVEMENT_THRESHOLD_METERS = 20;

    const pickupPos = useMemo(() => ({ lat: pickupLat, lng: pickupLon }), [pickupLat, pickupLon]);

    // ── Helper: Haversine ──
    const getDistance = (p1: { lat: number, lng: number }, p2: { lat: number, lng: number }) => {
        const R = 6371e3;
        const φ1 = p1.lat * Math.PI/180;
        const φ2 = p2.lat * Math.PI/180;
        const Δφ = (p2.lat-p1.lat) * Math.PI/180;
        const Δλ = (p2.lng-p1.lng) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };

    // ── Route Engine (Phase 12, 13) ──
    const updateRoute = useCallback(async (origin: { lat: number, lng: number }) => {
        if (!isLoaded || !origin || !pickupPos) return;

        const now = Date.now();
        const distMoved = lastRoutePos.current ? getDistance(lastRoutePos.current, origin) : 999;
        
        // Phase 12: 20m / 8s Throttle
        if (distMoved < MOVEMENT_THRESHOLD_METERS && (now - lastRouteCalcTime.current < ROUTE_THROTTLE_MS)) return;

        // Phase 17 Hardening: Prevent ZERO_RESULTS infinite calculating when perfectly converged
        const distToPickup = getDistance(origin, pickupPos);
        if (distToPickup < 50) {
            setDirectionsResponse(null);
            if (onTrackingUpdate) {
                onTrackingUpdate({ distance: "Nearby", duration: "< 1 min", isNearby: true });
            }
            lastRouteCalcTime.current = now;
            lastRoutePos.current = origin;
            return;
        }

        try {
            // Hardening (Phase 12): Straight line logic implicitly handled by Directions if too close
            const directionsService = new google.maps.DirectionsService();
            const results = await directionsService.route({
                origin,
                destination: pickupPos,
                travelMode: google.maps.TravelMode.DRIVING,
            });
            setDirectionsResponse(results);
            lastRouteCalcTime.current = now;
            lastRoutePos.current = origin;

            if (results.routes[0]?.legs[0] && onTrackingUpdate) {
                const leg = results.routes[0].legs[0];
                onTrackingUpdate({
                    distance: leg.distance?.text || "...",
                    duration: leg.duration?.text || "...",
                    isNearby: (leg.distance?.value || 0) < 500
                });
            }
        } catch (error) {
            console.error("Directions Error:", error);
        }
    }, [isLoaded, pickupPos, onTrackingUpdate]);

    // ── Interpolation Engine (Phase 11) ──
    const animateMarker = useCallback((newPos: { lat: number, lng: number }) => {
        const startPos = prevPosRef.current || ngoPosRef.current || newPos;
        const startTime = Date.now();

        // Calculate Rotation
        if (Math.abs(newPos.lat - startPos.lat) > 0.000001) {
            const angle = Math.atan2(newPos.lng - startPos.lng, newPos.lat - startPos.lat) * 180 / Math.PI;
            setRotation(angle);
        }

        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / INTERPOLATION_DURATION, 1);
            const currentPos = {
                lat: startPos.lat + (newPos.lat - startPos.lat) * progress,
                lng: startPos.lng + (newPos.lng - startPos.lng) * progress
            };
            setInterpolatedPos(currentPos);
            prevPosRef.current = currentPos;
            
            // Map Camera Follow (Phase 14)
            if (shouldFollow && mapRef.current && typeof google !== 'undefined') {
                const bounds = new google.maps.LatLngBounds();
                bounds.extend(pickupPos);
                bounds.extend(currentPos);
                mapRef.current.fitBounds(bounds, { top: 100, bottom: 250, left: 50, right: 50 });
            }

            if (progress < 1) animationFrameRef.current = requestAnimationFrame(animate);
        };
        animationFrameRef.current = requestAnimationFrame(animate);
    }, [pickupPos, shouldFollow]);

    // ── Phase 4, 7, 8: Socket Logic ──
    useEffect(() => {
        if (!donationId) return;
        const socket = getSocket();

        const syncLocation = (data: any) => {
            if (data.donationId !== donationId) return;
            lastLocationTimestamp.current = Date.now();
            setIsSignalDropped(false);

            const newPos = { lat: data.lat, lng: data.lng };
            setNgoPos(newPos);
            if (!ngoPosRef.current) {
                ngoPosRef.current = newPos;
                setInterpolatedPos(newPos);
                prevPosRef.current = newPos;
            } else {
                animateMarker(newPos);
            }
            updateRoute(newPos);
        };

        const syncStatus = (data: any) => {
            if (data.donationId !== donationId) return;
            setLiveStatus(data.status.toUpperCase());
            onStatusChange?.(data.status);
        };

        const handleConnect = () => {
            socket.emit("join-room", donationId);
            setConnected(true);
            onReconnect?.();
        };

        socket.on("connect", handleConnect);
        socket.on("reconnect", handleConnect);
        socket.on("tracking:location", syncLocation);
        socket.on("tracking:status", syncStatus);
        if (socket.connected) handleConnect();

        return () => {
            socket.off("connect", handleConnect);
            socket.off("reconnect", handleConnect);
            socket.off("tracking:location", syncLocation);
            socket.off("tracking:status", syncStatus);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [donationId, animateMarker, updateRoute, onStatusChange, onReconnect]);

    // ── Phase 9: Signal Monitor ──
    useEffect(() => {
        const timer = setInterval(() => {
            if (Date.now() - lastLocationTimestamp.current > SIGNAL_DROP_TIMEOUT) {
                setIsSignalDropped(true);
            }
        }, 2000);
        return () => clearInterval(timer);
    }, []);

    // ── Phase 10: Fallback Polling ──
    useEffect(() => {
        const poll = async () => {
            const socket = getSocket();
            if (!socket.connected || isSignalDropped) {
                console.log("[FALLBACK-POLL] Syncing state from DB...");
                try {
                    const res = await getRequest(`/api/donations/track/${donationId}`);
                    if (res.success && res.data.ngoLocation) {
                        const newPos = { 
                            lat: res.data.ngoLocation.lat, 
                            lng: res.data.ngoLocation.lng 
                        };
                        lastLocationTimestamp.current = Date.now();
                        setIsSignalDropped(false);
                        setNgoPos(newPos);
                        if (!ngoPosRef.current) {
                            ngoPosRef.current = newPos;
                            setInterpolatedPos(newPos);
                        } else {
                            animateMarker(newPos);
                        }
                    }
                } catch (e) { console.error("[FALLBACK] API Failed", e); }
            }
        };
        const interval = setInterval(poll, 10000);
        return () => clearInterval(interval);
    }, [donationId, isSignalDropped, animateMarker]);

    if (loadError) return <div className="p-4 text-rose-500 font-bold">Maps Error</div>;

    return (
        <div className="w-full h-full relative">
            {isSignalDropped && (
                <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-500 text-center">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl space-y-4 max-w-[280px]">
                        <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
                            <WifiOff className="w-7 h-7 text-rose-600 animate-pulse" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-black uppercase text-slate-900 dark:text-white">Signal Dropped</h3>
                            <p className="text-[10px] font-black text-rose-500 uppercase leading-normal">Optimizing secure channel... Auto-Syncing via DB pulses.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="h-full w-full rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-2xl relative z-0">
                {!isLoaded ? (
                    <div className="h-full w-full bg-slate-50 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        zoom={15}
                        center={ngoPos || pickupPos}
                        options={{ disableDefaultUI: true, styles: SILVER_MAP_STYLE }}
                        onLoad={map => { mapRef.current = map; }}
                    >
                        {directionsResponse && (
                            <DirectionsRenderer
                                directions={directionsResponse}
                                options={{
                                    suppressMarkers: true,
                                    polylineOptions: { 
                                        strokeColor: '#4F46E5', 
                                        strokeWeight: 6, // Phase 12
                                        strokeOpacity: 0.9 
                                    }
                                }}
                            />
                        )}

                        <Marker 
                            position={pickupPos} 
                            icon={{ 
                                url: 'https://cdn-icons-png.flaticon.com/512/619/619153.png', 
                                scaledSize: new google.maps.Size(40, 40) 
                            }} 
                        />

                        {interpolatedPos && (
                            <OverlayView position={interpolatedPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                                <div 
                                    style={{ 
                                        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                                        transition: 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
                                    }} 
                                    className="relative"
                                >
                                    {/* Phase 15: Pulsing Gloom Effect */}
                                    <div className="absolute inset-x-0 top-0 bottom-0 bg-indigo-500/30 rounded-full animate-ping scale-150" />
                                    <Image 
                                        src="https://cdn-icons-png.flaticon.com/512/3063/3063822.png" 
                                        alt="NGO Vehicle" 
                                        width={48} 
                                        height={48} 
                                        className="relative z-10 drop-shadow-2xl" 
                                        unoptimized 
                                    />
                                </div>
                            </OverlayView>
                        )}
                    </GoogleMap>
                )}
            </div>

            {/* Controls */}
            <div className="absolute right-6 bottom-32 flex flex-col space-y-4 z-10">
                <button
                    onClick={() => setShouldFollow(!shouldFollow)}
                    className={cn(
                        "w-12 h-12 rounded-2xl shadow-xl flex items-center justify-center transition-all active:scale-90",
                        shouldFollow ? "bg-indigo-600 text-white" : "bg-white text-slate-400"
                    )}
                >
                    <Crosshair className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
});
