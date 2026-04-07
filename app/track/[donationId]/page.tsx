"use client";

/**
 * Tracking Page — Zomato/Blinkit Production Standard
 * 1. 60vh Mobile Viewport Split
 * 2. Phase 5: Pre-mount Initial Sync (API First)
 * 3. Real-time Status & ETA Hubs
 */

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, ArrowLeft, Phone, MapPin, Clock, ShieldCheck, Navigation, AlertCircle } from "lucide-react";
import { getRequest } from "@/lib/apiClient";
import { getSocket } from "@/lib/socket";
import NGOStatusTimeline from "@/components/donor/NGOStatusTimeline";
import FeedbackModal from "@/components/donor/FeedbackModal";

// Dynamic map for zero-latency load of shell
const LiveTrackingMap = dynamic(() => import("@/components/donor/LiveTrackingMap"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Satellite Data...</p>
        </div>
    )
});

export default function TrackDonationPage() {
    const params = useParams();
    const donationId = (params?.donationId as string) || "";
    
    if (!params) return null;

    useSession();
    const router = useRouter();

    // -- State --
    const [loading, setLoading] = useState(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [initialData, setInitialData] = useState<any>(null);
    const [trackingStats, setTrackingStats] = useState({ distance: "...", duration: "...", isNearby: false });
    const [currentStatus, setCurrentStatus] = useState<string>("accepted");
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

    const handleTrackingUpdate = useCallback((stats: { distance: string; duration: string; isNearby: boolean }) => setTrackingStats(stats), []);
    const handleStatusChange = useCallback((s: string) => setCurrentStatus(s.toLowerCase()), []);

    const fetchInitialState = useCallback(async () => {
        try {
            const res = await getRequest(`/api/donations/track/${donationId}`);
            if (res.success) {
                setInitialData(res.data);
                setCurrentStatus((res.data.status || 'accepted').toLowerCase());
                setLoading(false);
                return true;
            }
        } catch (err) {
            console.error("[TRACK-API] Sync Error:", err);
        }
        return false;
    }, [donationId]);

    // ── Senior Orchestration: Dual-Channel Sync (Socket + Polling) ──
    useEffect(() => {
        if (!donationId) return;

        // 1. Initial Load
        fetchInitialState();

        // 2. Socket Management (Requirement #8, #11)
        const socket = getSocket();
        let pollInterval: NodeJS.Timeout | null = null;

        const startPolling = () => {
            if (pollInterval) return;
            console.log("[SYNC] Socket offline. Activating 10s Polling Fallback...");
            pollInterval = setInterval(fetchInitialState, 10000);
        };

        const stopPolling = () => {
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
                console.log("[SYNC] Socket online. Polling deactivated.");
            }
        };

        const onReconnect = () => {
            console.log("[SYNC] Reconnected. Re-syncing state...");
            socket.emit("join-room", donationId);
            fetchInitialState(); 
            stopPolling();
        };

        socket.on("connect", stopPolling);
        socket.on("reconnect", onReconnect);
        socket.on("disconnect", startPolling);

        // Initial check
        if (!socket.connected) startPolling();

        return () => {
            socket.off("connect", stopPolling);
            socket.off("reconnect", onReconnect);
            socket.off("disconnect", startPolling);
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [donationId, fetchInitialState]);

    if (loading || !initialData) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 space-y-6">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin" />
                    <Navigation className="absolute inset-0 m-auto w-8 h-8 text-indigo-600 animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                    <h2 className="text-base font-black uppercase tracking-tighter text-slate-900">Establishing Secure Link</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phase 5 Initial Data Syncing...</p>
                </div>
            </div>
        );
    }

    const { donation, ngo } = initialData;

    return (
        <div className="fixed inset-0 bg-slate-50 flex flex-col md:flex-row overflow-hidden">
            {/* Header / App Bar */}
            <div className="absolute top-0 left-0 right-0 z-30 p-4 pointer-events-none">
                <div className="max-w-5xl mx-auto flex justify-between items-start">
                    <button 
                        onClick={() => router.back()}
                        className="p-3 bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl pointer-events-auto active:scale-95 transition-all border border-white"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    
                    {/* Top Status Banner (Phase 17) */}
                    <div className="px-5 py-2.5 bg-slate-900/90 backdrop-blur-xl rounded-full shadow-2xl pointer-events-auto border border-slate-800 flex items-center space-x-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white leading-none">
                            {currentStatus.replace(/_/g, ' ')}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Map Section (60vh on Mobile, Phase 17) ──────────────────── */}
            <div className="h-[55vh] md:h-screen md:w-3/5 lg:w-2/3 relative z-10 transition-all duration-700">
                {donation && (
                    <LiveTrackingMap
                        donationId={donationId}
                        pickupLat={donation.latitude || 0}
                        pickupLon={donation.longitude || 0}
                        currentStatus={currentStatus}
                        initialNgoLocation={initialData.ngoLocation?.lat ? { lat: initialData.ngoLocation.lat, lng: initialData.ngoLocation.lng } : undefined}
                        onTrackingUpdate={handleTrackingUpdate}
                        onStatusChange={handleStatusChange}
                    />
                )}
            </div>

            {/* ── Info Panels (Bottom Hub on Mobile, Phase 17) ──────────────── */}
            <div className="flex-1 bg-white md:w-2/5 lg:w-1/3 shadow-[0_-25px_60px_-15px_rgba(0,0,0,0.15)] md:shadow-none rounded-t-[3rem] md:rounded-none z-20 flex flex-col overflow-hidden relative border-t border-slate-100 md:border-none transition-transform duration-500">
                {/* Visual Puller for Mobile */}
                <div className="w-16 h-1.5 bg-slate-200 rounded-full mx-auto mt-5 mb-2 md:hidden" />
                
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 scroll-smooth">
                    {/* ETA Hub */}
                    <div className="grid grid-cols-2 gap-5">
                        <div className="bg-indigo-50/80 backdrop-blur-sm p-5 rounded-[2rem] border border-indigo-100/50 shadow-inner group">
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center">
                                <Clock className="w-2.5 h-2.5 mr-1.5" /> Arriving in
                            </p>
                            <div className="flex items-baseline space-x-1.5">
                                <span className="text-2xl font-black text-indigo-900 leading-none">
                                    {trackingStats.duration?.includes(' ') ? trackingStats.duration.split(' ')[0] : trackingStats.duration || "..."}
                                </span>
                                <span className="text-[10px] font-black text-indigo-900 uppercase tracking-tighter opacity-70">
                                    {trackingStats.duration?.includes(' ') ? trackingStats.duration.split(' ')[1] : "min"}
                                </span>
                            </div>
                        </div>
                        <div className="bg-slate-50/80 backdrop-blur-sm p-5 rounded-[2rem] border border-slate-100 shadow-inner">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center">
                                <Navigation className="w-2.5 h-2.5 mr-1.5" /> Distant
                            </p>
                            <h3 className="text-2xl font-black text-slate-900 leading-none tracking-tight">{trackingStats.distance}</h3>
                        </div>
                    </div>

                    {/* NGO Details */}
                    <div className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-[2rem] shadow-xl shadow-slate-200/40 group hover:border-indigo-200 transition-colors">
                        <div className="flex items-center space-x-5">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-100">
                                {ngo?.name?.[0] || 'N'}
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 text-sm uppercase tracking-tighter leading-none mb-2">{ngo?.name || 'NGO Partner'}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center tracking-widest opacity-80">
                                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> Top Rated
                                </p>
                            </div>
                        </div>
                        <a href={`tel:${ngo?.phone}`} className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl active:scale-90 transition-all hover:bg-indigo-600 hover:text-white shadow-lg shadow-indigo-50">
                            <Phone className="w-5 h-5" />
                        </a>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Mission Progress</h4>
                            <div className="flex items-center space-x-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Live Syncing</span>
                            </div>
                        </div>
                        <NGOStatusTimeline currentStatus={currentStatus} />
                    </div>

                    {/* Donation Info Card */}
                    <div className="p-6 bg-slate-50/50 rounded-[2.5rem] border border-slate-100/50 space-y-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Mission Target</p>
                        <div className="flex space-x-4 items-start">
                            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                                <MapPin className="w-5 h-5 text-rose-500" />
                            </div>
                            <div>
                                <h4 className="text-[11px] font-black text-slate-900 uppercase mb-1 leading-tight">{donation.foodType}</h4>
                                <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-tight opacity-70">
                                    {donation.pickupAddress}, {donation.city}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Action (Phase 17) */}
                <div className="p-8 bg-white border-t border-slate-50">
                    <button 
                        onClick={() => setIsFeedbackOpen(true)}
                        disabled={currentStatus.toLowerCase() !== 'delivered'}
                        className="w-full py-5 bg-slate-900 disabled:bg-slate-50 disabled:text-slate-300 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 active:scale-[0.98] transition-all flex items-center justify-center space-x-3"
                    >
                        <span>{currentStatus.toLowerCase() === 'delivered' ? 'Rate Mission Experience' : 'Monitoring Active Service'}</span>
                    </button>
                    <div className="mt-5 flex items-center justify-center space-x-2">
                        <AlertCircle className="w-3 h-3 text-slate-300" />
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">
                            Encryption: Dual-Channel Socket + API
                        </p>
                    </div>
                </div>
            </div>

            <FeedbackModal 
                isOpen={isFeedbackOpen} 
                onClose={() => setIsFeedbackOpen(false)} 
                donationId={donationId} 
            />
        </div>
    );
}
