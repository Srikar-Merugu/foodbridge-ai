"use client";

/**
 * LiveTrackingMap — Zomato-Grade Geospatial Engine
 * 1. Status-Aware Routing: Dashed (Pickup) vs Solid (Delivery)
 * 2. High-Fidelity Animation: 2.5s Interpolation + Rotation Sync
 * 3. Proximity UX: Auto-zoom & Nearby Indicators
 */

import { useEffect, useState, useRef, useCallback, memo, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, OverlayView, Polyline } from "@react-google-maps/api";
import { getSocket } from "@/lib/socket";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

const MAPS_LIBRARIES: ("places")[] = ["places"];

interface LiveTrackingMapProps {
    donationId: string;
    pickupLat: number;
    pickupLon: number;
    currentStatus?: string;
    destinationLocation?: { lat: number; lng: number };
    initialNgoLocation?: { lat: number; lng: number };
    onTrackingUpdate?: (data: { distance: string; duration: string; isNearby: boolean }) => void;
    onStatusChange?: (status: string) => void;
}

const mapContainerStyle = { width: "100%", height: "100%" };

// Premium Dark Mode Map Style (Zomato-esque)
const ZOMATO_MAP_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
];

export default memo(function LiveTrackingMap({
    donationId,
    pickupLat,
    pickupLon,
    currentStatus,
    destinationLocation,
    initialNgoLocation,
    onTrackingUpdate,
    onStatusChange,
}: LiveTrackingMapProps) {

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: MAPS_LIBRARIES,
    });

    // ── State ──
    const [ngoPos, setNgoPos] = useState<{ lat: number, lng: number } | null>(null);
    const [interpolatedPos, setInterpolatedPos] = useState<{ lat: number, lng: number } | null>(null);
    const [rotation, setRotation] = useState(0);
    const [liveStatus, setLiveStatus] = useState(currentStatus?.toLowerCase() || "accepted");
    const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
    const [shouldFollow, setShouldFollow] = useState(true);

    // ── Refs ──
    const mapRef = useRef<google.maps.Map | null>(null);
    const ngoPosRef = useRef<{ lat: number, lng: number } | null>(null);
    const prevPosRef = useRef<{ lat: number, lng: number } | null>(null);
    const lastLocationTimestamp = useRef<number>(Date.now());
    const lastRouteCalcTime = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);

    // Config
    const INTERPOLATION_DURATION = 2500;
    const ROUT_THROTTLE_MS = 6000;

    const pickupPos = useMemo(() => ({ lat: pickupLat, lng: pickupLon }), [pickupLat, pickupLon]);
    const finalDestPos = useMemo(() => {
        if (destinationLocation?.lat && destinationLocation?.lng) return destinationLocation;
        return { lat: pickupLat + 0.02, lng: pickupLon + 0.02 };
    }, [destinationLocation, pickupLat, pickupLon]);

    // Determine current target based on status
    const currentTarget = useMemo(() => {
        const status = liveStatus.toLowerCase();
        if (['accepted', 'on_the_way', 'arrived'].includes(status)) return pickupPos;
        return finalDestPos;
    }, [liveStatus, pickupPos, finalDestPos]);

    const isPickupPhase = ['accepted', 'on_the_way', 'arrived'].includes(liveStatus.toLowerCase());

    // ── Route Engine ──
    const updateRoute = useCallback(async (origin: { lat: number, lng: number }) => {
        if (!isLoaded || !origin || !currentTarget) return;

        const now = Date.now();
        if (now - lastRouteCalcTime.current < ROUT_THROTTLE_MS) return;

        try {
            const directionsService = new google.maps.DirectionsService();
            const results = await directionsService.route({
                origin,
                destination: currentTarget,
                travelMode: google.maps.TravelMode.DRIVING,
            });
            setDirectionsResponse(results);
            lastRouteCalcTime.current = now;

            if (results.routes[0]?.legs[0] && onTrackingUpdate) {
                const leg = results.routes[0].legs[0];
                onTrackingUpdate({
                    distance: leg.distance?.text || "...",
                    duration: leg.duration?.text || "...",
                    isNearby: (leg.distance?.value || 0) < 500
                });
            }
        } catch (error) {
            console.error("[MAP] Directions Failed", error);
        }
    }, [isLoaded, currentTarget, onTrackingUpdate]);

    // ── Marker Interpolation ──
    const animateMarker = useCallback((newPos: { lat: number, lng: number }) => {
        const startPos = prevPosRef.current || ngoPosRef.current || newPos;
        const startTime = Date.now();

        // Rotation Calculation
        const latDiff = newPos.lat - startPos.lat;
        const lngDiff = newPos.lng - startPos.lng;
        if (Math.abs(latDiff) > 0.000001 || Math.abs(lngDiff) > 0.000001) {
            const angle = Math.atan2(lngDiff, latDiff) * (180 / Math.PI);
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
            
            if (shouldFollow && mapRef.current && typeof google !== 'undefined') {
                const bounds = new google.maps.LatLngBounds();
                bounds.extend(currentTarget);
                bounds.extend(currentPos);
                mapRef.current.fitBounds(bounds, { top: 120, bottom: 200, left: 60, right: 60 });
            }

            if (progress < 1) animationFrameRef.current = requestAnimationFrame(animate);
        };
        animationFrameRef.current = requestAnimationFrame(animate);
    }, [currentTarget, shouldFollow]);

    // ── Socket Logic ──
    useEffect(() => {
        if (!donationId) return;
        const socket = getSocket();

        const syncLocation = (data: { donationId: string; lat: number; lng: number }) => {
            if (data.donationId !== donationId) return;
            lastLocationTimestamp.current = Date.now();
            const newPos = { lat: data.lat, lng: data.lng };
            setNgoPos(newPos);
            if (!ngoPosRef.current) {
                ngoPosRef.current = newPos;
                setInterpolatedPos(newPos);
            } else {
                animateMarker(newPos);
            }
            updateRoute(newPos);
        };

        const syncStatus = (data: { donationId: string; status: string }) => {
            if (data.donationId !== donationId) return;
            setLiveStatus(data.status.toLowerCase());
            onStatusChange?.(data.status);
        };

        socket.on("tracking:location", syncLocation);
        socket.on("tracking:status", syncStatus);
        socket.emit("join-room", donationId);

        return () => {
            socket.off("tracking:location", syncLocation);
            socket.off("tracking:status", syncStatus);
        };
    }, [donationId, animateMarker, updateRoute, onStatusChange]);

    // Initial Bound
    useEffect(() => {
        if (isLoaded && initialNgoLocation && !ngoPosRef.current) {
            const pos = { lat: initialNgoLocation.lat, lng: initialNgoLocation.lng };
            setNgoPos(pos);
            setInterpolatedPos(pos);
            ngoPosRef.current = pos;
            updateRoute(pos);
        }
    }, [isLoaded, initialNgoLocation, updateRoute]);

    if (loadError) return <div className="p-4 text-rose-500 font-black uppercase text-[10px]">Maps Synchronization Failed</div>;
    if (!isLoaded) return <div className="h-full w-full bg-slate-900 animate-pulse flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-700">Connecting Satellite Grid...</div>;

    return (
        <div className="w-full h-full relative">
            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                zoom={16}
                center={ngoPos || currentTarget}
                options={{ disableDefaultUI: true, styles: ZOMATO_MAP_STYLE }}
                onLoad={map => { mapRef.current = map; }}
            >
                {/* 1. ROUTE LINES */}
                {directionsResponse && directionsResponse.routes?.[0]?.overview_path && (
                    <>
                        {isPickupPhase ? (
                            <Polyline
                                path={directionsResponse.routes[0].overview_path}
                                options={{
                                    strokeColor: '#94a3b8',
                                    strokeOpacity: 0,
                                    icons: [{
                                        icon: {
                                            path: 'M 0,-1 0,1',
                                            strokeOpacity: 1,
                                            scale: 3,
                                            strokeWeight: 4
                                        },
                                        offset: '0',
                                        repeat: '20px'
                                    }]
                                }}
                            />
                        ) : (
                            <DirectionsRenderer
                                directions={directionsResponse}
                                options={{
                                    suppressMarkers: true,
                                    polylineOptions: { 
                                        strokeColor: '#10b981',
                                        strokeWeight: 6,
                                        strokeOpacity: 0.8
                                    }
                                }}
                            />
                        )}
                    </>
                )}

                {/* 2. TARGET MARKER (Pickup/Destination) */}
                <Marker 
                    position={currentTarget} 
                    icon={{ 
                        url: isPickupPhase ? 'https://cdn-icons-png.flaticon.com/512/1673/1673188.png' : 'https://cdn-icons-png.flaticon.com/512/619/619153.png', 
                        scaledSize: typeof google !== 'undefined' ? new google.maps.Size(36, 36) : undefined
                    }} 
                />

                {/* 3. PARTNER OVERLAY (THE "GLIDER") */}
                {interpolatedPos && (
                    <OverlayView position={interpolatedPos} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
                        <div 
                            style={{ 
                                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                                transition: 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)'
                            }} 
                            className="relative"
                        >
                            {/* Proximity Pulse */}
                            <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping scale-150" />
                            
                            {/* High-Res Scooter Icon */}
                            <Image 
                                src="https://cdn-icons-png.flaticon.com/512/3063/3063822.png" 
                                alt="NGO Vehicle" 
                                width={54} 
                                height={54} 
                                className="relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]" 
                                unoptimized 
                            />

                            {/* Signal Indicator */}
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 shadow-lg animate-pulse" />
                        </div>
                    </OverlayView>
                )}
            </GoogleMap>

            {/* Float Controls */}
            <div className="absolute right-6 bottom-48 flex flex-col gap-3 z-10">
                <button
                    onClick={() => setShouldFollow(!shouldFollow)}
                    className={cn(
                        "w-12 h-12 rounded-2xl shadow-2xl flex items-center justify-center transition-all active:scale-95 border",
                        shouldFollow ? "bg-emerald-500 border-emerald-400 text-white" : "bg-slate-900/90 border-white/10 text-slate-400"
                    )}
                >
                    <Target className={cn("w-5 h-5", shouldFollow && "animate-pulse")} />
                </button>
            </div>
        </div>
    );
});
