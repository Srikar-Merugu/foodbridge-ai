"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Truck, MapPin, Package, AlertTriangle, ShieldCheck, Timer } from "lucide-react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

interface PublicTrackingData {
    status: string;
    etaMinutes: number | null;
    ngoLocation: { lat: number; lng: number } | null;
    donation: {
        foodType: string;
        quantity: string;
        city: string;
        latitude: number;
        longitude: number;
    };
    ngo: {
        name: string;
        rating: string;
    } | null;
}

const LiveTrackingMap = dynamic(() => import("@/components/donor/LiveTrackingMap"), {
    ssr: false,
    loading: () => <div className="h-[400px] w-full bg-slate-900 animate-pulse flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-700">Connecting Satellite Grid...</div>
});

export default function PublicTrackingPage() {
    const params = useParams();
    const donationId = params.id as string;
    const [info, setInfo] = useState<PublicTrackingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [trackingStats, setTrackingStats] = useState({ distance: "", duration: "", isNearby: false });

    const fetchPublicTracking = useCallback(async () => {
        try {
            const res = await fetch(`/api/donations/track-public/${donationId}`);
            const result = await res.json();
            if (result.success) {
                setInfo(result.data as PublicTrackingData);
            } else {
                setError(result.message);
            }
        } catch (err: unknown) {
            setError("Failed to load tracking data");
        } finally {
            setLoading(false);
        }
    }, [donationId]);

    useEffect(() => {
        fetchPublicTracking();
        const poll = setInterval(fetchPublicTracking, 10000);
        return () => clearInterval(poll);
    }, [fetchPublicTracking]);

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
             <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <Truck className="absolute inset-0 m-auto w-6 h-6 text-indigo-500 animate-pulse" />
             </div>
             <p className="mt-6 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Syncing Satellite Data</p>
        </div>
    );

    if (error || !info) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8 text-center">
            <div className="space-y-4 max-w-xs">
                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
                <h3 className="text-white font-black uppercase tracking-widest text-xs">Tracking Unavailable</h3>
                <p className="text-slate-500 text-[10px] font-bold leading-relaxed">{error || "This mission link is invalid or has expired."}</p>
            </div>
        </div>
    );

    const stages = [
        { key: 'accepted', label: 'Preparing' },
        { key: 'on_the_way', label: 'Collecting' },
        { key: 'collected', label: 'On the way' },
        { key: 'delivered', label: 'Delivered' },
        { key: 'completed', label: 'Finalized' }
    ];

    const currentIdx = stages.findIndex(s => s.key === info.status?.toLowerCase());
    const displayStatus = stages[currentIdx]?.label || "Processing";
    const etaText = info.etaMinutes ? `${info.etaMinutes} mins` : trackingStats.duration || "Calculating...";

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
            <header className="p-6 pb-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-white font-black text-sm tracking-tight">FoodBridge Public Tracking</h1>
                        <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-0.5">Asset ID: {donationId.slice(-8)}</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col p-6 gap-6">
                {/* Status Bar */}
                <div className={cn(
                    "rounded-2xl p-4 shadow-2xl border flex items-center justify-between",
                    info.status === 'completed' ? "bg-slate-900 border-white/10" : "bg-emerald-600 border-emerald-400/20"
                )}>
                    <div className="flex flex-col">
                        <h2 className="text-white text-base font-black tracking-tight leading-tight">
                            {info.status === 'completed' ? "Mission Finalized" : displayStatus}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            {info.status === 'completed' ? (
                                <span className="text-[9px] font-black text-white/60 uppercase tracking-widest flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                    Mission Accomplished
                                </span>
                            ) : (
                                <span className="text-[9px] font-black text-emerald-100 uppercase tracking-widest">
                                    Arriving in {etaText}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white">
                        {info.status === 'completed' ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <Timer className="w-5 h-5 animate-pulse" />}
                    </div>
                </div>

                {/* Map Interface */}
                <div className="flex-1 min-h-[400px] relative rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl">
                    <LiveTrackingMap
                        donationId={donationId}
                        pickupLat={info.donation?.latitude || 0}
                        pickupLon={info.donation?.longitude || 0}
                        currentStatus={info.status}
                        initialNgoLocation={info.ngoLocation ?? undefined}
                        onTrackingUpdate={(stats) => setTrackingStats(stats)}
                    />
                </div>

                {/* Summary Card */}
                <div className="bg-white rounded-[2rem] p-6 shadow-2xl space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Items Recovered</p>
                            <h4 className="text-sm font-black text-slate-900">{info.donation?.foodType}</h4>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-black text-indigo-600">{info.donation?.quantity}kg</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 flex items-center justify-center rounded-xl text-slate-400">
                           <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Pick up City</p>
                            <h4 className="text-xs font-bold text-slate-700">{info.donation?.city}</h4>
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="w-full h-12 bg-slate-900 rounded-xl flex items-center justify-center gap-2 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                             <ShieldCheck className="w-4 h-4 text-emerald-400" />
                             Verified Donation
                        </div>
                    </div>
                </div>
            </main>

            <footer className="p-8 text-center">
                <p className="text-slate-600 text-[8px] font-black uppercase tracking-widest">Powered by FoodBridge AI Satellites</p>
            </footer>
        </div>
    );
}
