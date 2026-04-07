"use client";

import React, { useState, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, StandaloneSearchBox } from "@react-google-maps/api";
import { MapPin, Target, Loader2, Navigation, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const libraries: ("places")[] = ["places"];

interface LocationPickerProps {
    onLocationSelect: (location: { lat: number; lng: number; address: string; city?: string; state?: string; pincode?: string }) => void;
    initialLocation?: { lat: number; lng: number; address?: string };
    label?: string;
    className?: string;
}

const mapContainerStyle = {
    width: "100%",
    height: "300px",
    borderRadius: "1.5rem",
};

const defaultCenter = {
    lat: 17.3850, // Default to Hyderabad, India or a neutral center
    lng: 78.4867,
};

export const LocationPicker: React.FC<LocationPickerProps> = ({
    onLocationSelect,
    initialLocation,
    label = "Set Operational Location",
    className
}) => {
    const { isLoaded } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries,
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(
        initialLocation?.lat && initialLocation?.lng ? { lat: initialLocation.lat, lng: initialLocation.lng } : null
    );
    const [address, setAddress] = useState(initialLocation?.address || "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);

    const reverseGeocode = useCallback(async (lat: number, lng: number) => {
        if (typeof google === 'undefined') return;
        const geocoder = new google.maps.Geocoder();
        try {
            const response = await geocoder.geocode({ location: { lat, lng } });
            
            if (response.results && response.results.length > 0) {
                const result = response.results[0];
                const formattedAddress = result.formatted_address;
                const addressComponents = result.address_components;
 
                let city = "";
                let state = "";
                let pincode = "";
 
                addressComponents.forEach(comp => {
                    if (comp.types.includes("locality") || comp.types.includes("sublocality") || comp.types.includes("administrative_area_level_2")) {
                        city = comp.long_name;
                    }
                    if (comp.types.includes("administrative_area_level_1")) {
                        state = comp.long_name;
                    }
                    if (comp.types.includes("postal_code")) {
                        pincode = comp.long_name;
                    }
                });
 
                setAddress(formattedAddress);
                onLocationSelect({ 
                    lat, 
                    lng, 
                    address: formattedAddress, 
                    city: city || "Unknown City", 
                    state: state || "Unknown State", 
                    pincode: pincode || "000000" 
                });
                setError("");
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            } else {
                setError("Location found, but no address resolved. You can still use the pin.");
            }
        } catch (err: unknown) {
            console.error("Google Geocoding failed, trying Nominatim fallback...", err);
            
            // --- Fallback to Nominatim (OpenStreetMap) ---
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
                    { headers: { 'Accept-Language': 'en' } }
                );
                if (!res.ok) throw new Error("OSM Fallback Failed");
                const data = await res.json();
                
                if (data && data.display_name) {
                    const addr = data.address;
                    const formattedAddress = data.display_name;
                    const city = addr?.city || addr?.town || addr?.village || addr?.suburb || addr?.county || "Unknown City";
                    const state = addr?.state || "Unknown State";
                    const pincode = addr?.postcode || "000000";

                    setAddress(formattedAddress);
                    onLocationSelect({ 
                        lat, 
                        lng, 
                        address: formattedAddress, 
                        city, 
                        state, 
                        pincode 
                    });
                    setError("");
                    setSuccess(true);
                    setTimeout(() => setSuccess(false), 3000);
                    return;
                }
            } catch (fallbackErr) {
                console.error("Nominatim fallback also failed:", fallbackErr);
            }

            // If everything fails, handle specific Google Maps error codes original logic
            const errorObj = err as { code?: string; status?: string };
            const status = errorObj?.code || errorObj?.status || "ERROR";
            if (status === "ZERO_RESULTS") {
                setError("No address found for this exact spot. Try moving the pin slightly.");
            } else if (status === "OVER_QUERY_LIMIT") {
                setError("Maps quota exceeded. Using fallback positioning.");
            } else {
                setError("Failed to resolve address. You can still use the marker pin manually.");
            }
        }
    }, [onLocationSelect]);

    const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            setMarkerPos({ lat, lng });
            reverseGeocode(lat, lng);
        }
    }, [reverseGeocode]);

    const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            setMarkerPos({ lat, lng });
            reverseGeocode(lat, lng);
        }
    }, [reverseGeocode]);

    const detectLocation = () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.");
            return;
        }

        setLoading(true);
        setError("");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const pos = { lat, lng };
                setMarkerPos(pos);
                map?.panTo(pos);
                map?.setZoom(17);
                reverseGeocode(lat, lng);
                setLoading(false);
            },
            (err) => {
                console.error("Geolocation error:", err);
                setError("Location access denied. Please select manually on the map.");
                setLoading(false);
            },
            { enableHighAccuracy: true }
        );
    };

    const onPlacesChanged = () => {
        const places = searchBoxRef.current?.getPlaces();
        if (places && places.length > 0) {
            const place = places[0];
            if (place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat();
                const lng = place.geometry.location.lng();
                const pos = { lat, lng };
                setMarkerPos(pos);
                map?.panTo(pos);
                map?.setZoom(17);
                reverseGeocode(lat, lng);
            }
        }
    };

    if (!isLoaded) return (
        <div className="h-[300px] w-full bg-slate-100 dark:bg-slate-800 rounded-3xl flex flex-col items-center justify-center space-y-3 animate-pulse">
            <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Mapping Engine...</p>
        </div>
    );

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center">
                    <MapPin className="w-4 h-4 mr-2 opacity-50 text-primary" />
                    {label}
                </label>
                <button
                    type="button"
                    onClick={detectLocation}
                    disabled={loading}
                    className="flex items-center space-x-1.5 text-primary hover:text-primary/80 transition-colors group"
                >
                    {loading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Target className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-[9px] font-black uppercase tracking-[0.15em]">Use Current Location</span>
                </button>
            </div>

            <div className="relative group rounded-[2rem] overflow-hidden border-2 border-slate-900 dark:border-slate-700 shadow-xl">
                <StandaloneSearchBox
                    onLoad={ref => searchBoxRef.current = ref}
                    onPlacesChanged={onPlacesChanged}
                >
                    <input
                        type="text"
                        placeholder="Search for a location or street name..."
                        className="absolute top-4 left-4 right-4 z-10 h-12 px-6 rounded-2xl bg-white/90 backdrop-blur-md border border-white/20 shadow-2xl font-bold text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    />
                </StandaloneSearchBox>

                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={markerPos || defaultCenter}
                    zoom={markerPos ? 17 : 12}
                    onLoad={map => setMap(map)}
                    onClick={handleMapClick}
                    options={{
                        disableDefaultUI: true,
                        zoomControl: true,
                        styles: [
                            {
                                "featureType": "all",
                                "elementType": "labels.text.fill",
                                "stylers": [{ "color": "#7c93a3" }, { "lightness": "-10" }]
                            }
                        ]
                    }}
                >
                    {markerPos && (
                        <Marker
                            position={markerPos}
                            draggable={true}
                            onDragEnd={handleMarkerDragEnd}
                            animation={google.maps.Animation.DROP}
                        />
                    )}
                </GoogleMap>

                {/* Overlay Feedback */}
                {success && (
                    <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-center">
                        <div className="bg-emerald-500/90 text-white px-4 py-2 rounded-xl backdrop-blur-sm flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Location Synced Successfully</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Address Preview (Read-only) */}
            <div className="space-y-2">
                <div className="relative">
                    <textarea
                        readOnly
                        value={address}
                        placeholder="Selected address will appear here..."
                        className="w-full min-h-[60px] p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300 resize-none leading-relaxed focus:outline-none"
                    />
                    <div className="absolute right-4 bottom-4 opacity-20">
                        <Navigation className="w-4 h-4" />
                    </div>
                </div>
                {error && (
                    <div className="flex items-center space-x-2 p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 animate-in slide-in-from-top-1">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-[10px] font-bold">{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
