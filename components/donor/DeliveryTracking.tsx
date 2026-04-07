"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { getRequest } from "@/lib/apiClient";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2,
    Truck,
    Phone,
    MapPin,
    Package,
    Navigation,
    AlertTriangle,
    Timer,
    ChevronUp,
    ChevronDown,
    ShieldCheck,
    Star,
    MessageCircle,
    User
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ChatModal } from "../ChatModal";
import { OrderHelpModal } from "../OrderHelpModal";

const LiveTrackingMap = dynamic(() => import("./LiveTrackingMap"), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-slate-900 animate-pulse flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-700">Initializing Tracking Grid...</div>
});

interface TrackingInfo {
    _id?: string;
    ngoLocation?: { lat: number; lng: number };
    status: 'accepted' | 'on_the_way' | 'arrived' | 'collected' | 'delivered' | 'completed';
    etaMinutes: number | null;
    targetLabel: string;
    ngoId: {
        _id: string;
        name: string;
        email: string;
    };
    ngo: {
        name: string;
        phone: string;
        image?: string;
        rating?: number;
        deliveries?: number;
    } | null;
    donation: {
        foodType: string;
        quantity: string;
        city: string;
        pickupAddress: string;
        latitude?: number;
        longitude?: number;
        donorName: string;
        donorId: string;
    } | null;
    lastUpdated: string;
}

export const DeliveryTracking = ({ donationId }: { donationId: string }) => {
    const [info, setInfo] = useState<TrackingInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [trackingStats, setTrackingStats] = useState({ distance: "", duration: "", isNearby: false });
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Required for createPortal (SSR safety)
    useEffect(() => { setIsMounted(true); }, []);

    const fetchTracking = useCallback(async () => {
        try {
            const result = await getRequest(`/api/donations/track/${donationId}`);
            if (result.success) {
                setInfo(result.data);
                setLastUpdated(new Date());
            } else {
                setError(result.message);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load tracking");
        } finally {
            setLoading(false);
        }
    }, [donationId]);

    useEffect(() => {
        fetchTracking();
        const poll = setInterval(fetchTracking, 10000);
        return () => clearInterval(poll);
    }, [fetchTracking]);

    useEffect(() => {
        if (!lastUpdated) return;
        const check = setInterval(() => {
            const diff = Date.now() - lastUpdated.getTime();
            const socket = getSocket();
            setIsOffline(!socket.connected && diff > 15000);
        }, 5000);
        return () => clearInterval(check);
    }, [lastUpdated]);

    const handleTrackingUpdate = useCallback((stats: { distance: string; duration: string; isNearby: boolean }) => {
        setTrackingStats(stats);
        setLastUpdated(new Date());
    }, []);

    const handleStatusChange = useCallback((newStatus: string) => {
        setInfo(prev => prev ? ({ ...prev, status: newStatus.toLowerCase() as TrackingInfo['status'] }) : null);
        setLastUpdated(new Date());
    }, []);

    const handleShare = async () => {
        const publicUrl = `${window.location.origin}/track/share/${donationId}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: 'Track my FoodBridge Delivery', text: `NGO ${info?.ngo?.name} is on the way!`, url: publicUrl });
            } else {
                await navigator.clipboard.writeText(publicUrl);
                setIsSharing(true);
                setTimeout(() => setIsSharing(false), 2000);
            }
        } catch (err) {
            console.error("Share failed", err);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[700px] bg-slate-950 rounded-[2.5rem] border border-white/5 overflow-hidden">
             <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                <Truck className="absolute inset-0 m-auto w-8 h-8 text-indigo-500 animate-pulse" />
             </div>
             <p className="mt-8 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Syncing Satellite Data</p>
        </div>
    );

    if (error || !info) return (
        <div className="flex items-center justify-center h-[700px] bg-slate-950 rounded-[2.5rem] border border-white/5 p-12 text-center">
            <div className="space-y-4 max-w-xs">
                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
                <h3 className="text-white font-black uppercase tracking-widest text-xs">Tracking Unavailable</h3>
                <p className="text-slate-500 text-[10px] font-bold leading-relaxed">{error || "The mission hasn't started yet."}</p>
            </div>
        </div>
    );

    const stages = [
        { key: 'accepted', label: 'Preparing', icon: <Package /> },
        { key: 'on_the_way', label: 'Collecting', icon: <Truck /> },
        { key: 'collected', label: 'On the way', icon: <Navigation /> },
        { key: 'delivered', label: 'Delivered', icon: <CheckCircle2 /> },
        { key: 'completed', label: 'Finalized', icon: <CheckCircle2 /> }
    ];

    const currentIdx = stages.findIndex(s => s.key === info.status?.toLowerCase());
    const displayStatus = stages[currentIdx]?.label || "Processing";
    const etaText = info.etaMinutes ? `${info.etaMinutes} mins` : trackingStats.duration || "Calculating...";

    return (
        <>
        {/* ── Main tracking card — overflow-hidden stays contained ── */}
        <div className="relative h-[700px] w-full bg-slate-950 rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl flex flex-col font-sans">

            {/* 1. TOP STATUS BAR */}
            <motion.div initial={{ y: -50 }} animate={{ y: 0 }} className="absolute top-6 left-6 right-6 z-30">
                <div className="flex flex-col gap-2">
                    <div className={cn(
                        "rounded-2xl p-4 shadow-2xl border flex items-center justify-between transition-colors duration-500",
                        info.status === 'completed' ? "bg-slate-900/95 border-white/10" : "bg-emerald-600/95 border-emerald-400/20"
                    )}>
                        <div className="flex flex-col">
                            <h2 className="text-white text-base font-black tracking-tight leading-tight">
                                {info.status === 'completed' ? "Mission Finalized" : displayStatus}
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                                {info.status === 'completed' ? (
                                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> Thank you for your contribution
                                    </span>
                                ) : (
                                    <>
                                        <span className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] font-black text-emerald-100 uppercase tracking-widest">
                                            Arriving in {etaText}
                                        </span>
                                        <div className="w-1 h-1 rounded-full bg-white/40" />
                                        <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">On Time</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", info.status === 'completed' ? "bg-white/5" : "bg-white/10")}>
                            {info.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Timer className="w-5 h-5 animate-pulse" />}
                        </div>
                    </div>
                    <div className="flex gap-1 px-1">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className={cn("flex-1 h-1 rounded-full transition-all duration-1000", i <= currentIdx ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-white/10")} />
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* 2. MAP */}
            <div className="flex-1 relative z-0">
                <LiveTrackingMap
                    donationId={donationId}
                    pickupLat={info.donation?.latitude || 0}
                    pickupLon={info.donation?.longitude || 0}
                    currentStatus={info.status}
                    initialNgoLocation={info.ngoLocation}
                    onTrackingUpdate={handleTrackingUpdate}
                    onStatusChange={handleStatusChange}
                />
                <AnimatePresence>
                    {isOffline && (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute top-32 left-1/2 -translate-x-1/2 px-4 py-2 bg-rose-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border border-rose-400">
                            <AlertTriangle className="w-3 h-3" /> GPS Connection Weak
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 3. BOTTOM SHEET */}
            <motion.div animate={{ height: isSheetOpen ? 420 : 180 }} className="bg-white rounded-t-[3rem] shadow-[0_-20px_50px_rgba(0,0,0,0.4)] relative z-20 flex flex-col">
                <button onClick={() => setIsSheetOpen(!isSheetOpen)} className="w-full flex flex-col items-center pt-3 pb-2">
                    <div className="w-12 h-1 bg-slate-200 rounded-full mb-1" />
                    {isSheetOpen ? <ChevronDown className="w-4 h-4 text-slate-300" /> : <ChevronUp className="w-4 h-4 text-slate-300" />}
                </button>

                <div className="px-8 pb-8 flex-1 overflow-hidden">
                    {/* Partner Info */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="relative w-14 h-14">
                                <div className="absolute inset-0 bg-indigo-100 rounded-2xl rotate-6" />
                                <div className="relative w-full h-full bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center overflow-hidden">
                                    <User className="w-8 h-8 text-slate-300" />
                                    {info.ngo?.image && <Image src={info.ngo.image} alt="Partner" fill className="object-cover" />}
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
                                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                                </div>
                            </div>
                            <div>
                                <h4 className="text-slate-900 font-black text-sm tracking-tight">{info.ngo?.name || "Partner NGO"}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded text-emerald-600">
                                        <span className="text-[10px] font-black leading-none">4.9</span>
                                        <Star className="w-2.5 h-2.5 fill-current" />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">120+ Missions Delivered</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <a href={`tel:${info.ngo?.phone}`} className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                <Phone className="w-5 h-5" />
                            </a>
                            <button onClick={() => setIsChatOpen(true)} className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-95">
                                <MessageCircle className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                                    <Package className="w-5 h-5 text-indigo-500" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Batch Content</p>
                                    <h5 className="text-xs font-black text-slate-800">{info.donation?.foodType}</h5>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-black text-indigo-600">{info.donation?.quantity}kg</span>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Verified Asset</p>
                            </div>
                        </div>

                        <AnimatePresence>
                            {isSheetOpen && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-6 pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                            <MapPin className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Delivery Destination</p>
                                            <p className="text-xs font-bold text-slate-600 truncate">{info.donation?.pickupAddress}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <button onClick={() => setIsHelpOpen(true)} className="h-14 bg-slate-900 rounded-2xl text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 active:scale-95 transition-all">
                                            Order Help
                                        </button>
                                        <button onClick={handleShare} className={cn("h-14 rounded-2xl text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all", isSharing ? "bg-emerald-500 shadow-emerald-500/20" : "bg-indigo-600 shadow-indigo-600/20")}>
                                            {isSharing ? "Link Copied!" : "Share Tracking"}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </div>

        {/* ── Modals rendered via Portal OUTSIDE the overflow-hidden container ──
            This is CRITICAL: fixed positioning breaks inside overflow:hidden + transform ancestors.
            Portal renders directly into document.body, ensuring stable position. */}
        {isMounted && createPortal(
            <>
                <ChatModal
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                    donationId={donationId}
                    partnerName={info.ngo?.name || "Partner NGO"}
                    role="donor"
                />
                <OrderHelpModal
                    isOpen={isHelpOpen}
                    onClose={() => setIsHelpOpen(false)}
                    donationId={donationId}
                    donorId={info?.donation?.donorId || ""}
                />
            </>,
            document.body
        )}
        </>
    );
};
