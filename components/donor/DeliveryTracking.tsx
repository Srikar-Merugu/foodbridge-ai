"use client";

import { useEffect, useState, useCallback } from "react";
import { getRequest, postRequest } from "@/lib/apiClient";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import {
    CheckCircle2,
    Circle,
    Truck,
    Loader2,
    Phone,
    Mail,
    User,
    MapPin,
    Package,
    Navigation,
    ShieldCheck,
    AlertTriangle,
    Timer
} from "lucide-react";
import dynamic from "next/dynamic";

const LiveTrackingMap = dynamic(() => import("./LiveTrackingMap"), {
    ssr: false,
    loading: () => <div className="h-48 bg-slate-50 animate-pulse rounded-2xl border border-slate-100 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-300">Loading Geospatial Engine...</div>
});

interface TrackingInfo {
    _id?: string;
    ngoLocation?: { lat: number; lng: number };
    status: 'accepted' | 'on_the_way' | 'arrived' | 'collected' | 'delivered' | 'completed';
    ngoId: {
        _id: string;
        name: string;
        email: string;
    };
    ngoProfile: {
        ngoName: string;
        contactPhone: string;
        address: string;
        city: string;
    } | null;
    donation: {
        foodType: string;
        quantity: string;
        city: string;
        pickupAddress: string;
        expiryTime: string;
        latitude?: number;
        longitude?: number;
    } | null;
    pickupTime: string | null;
    deliveryTime: string | null;
    createdAt: string;
    updatedAt: string;
}

export const DeliveryTracking = ({ donationId }: { donationId: string }) => {
    const [info, setInfo] = useState<TrackingInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [isReporting, setIsReporting] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [reportDesc, setReportDesc] = useState("");
    const [reportLoading, setReportLoading] = useState(false);
    const [reportSuccess, setReportSuccess] = useState(false);
    const [trackingStats, setTrackingStats] = useState({ distance: "", duration: "", isNearby: false });
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    const [isTimelineOpen, setIsTimelineOpen] = useState(false);

    const handleReportSubmit = async () => {
        if (!reportReason || !info?.ngoId?._id) return;
        setReportLoading(true);
        try {
            const formData = {
                targetNgoId: info.ngoId._id,
                reason: reportReason,
                description: reportDesc
            };
            const res = await postRequest('/api/ngo/report', formData);
            if (res.success) {
                setReportSuccess(true);
                setTimeout(() => setIsReporting(false), 5000);
            }
        } catch (err) {
            console.error("Failed to report action:", err);
        } finally {
            setReportLoading(false);
        }
    };

    const fetchTracking = async () => {
        try {
            const result = await getRequest(`/api/donations/track/${donationId}`);
            if (result.success) {
                setInfo(result.data);
                setLastUpdated(new Date());
            } else {
                let srvErr = result.message;
                if (srvErr?.includes("SSL") || srvErr?.includes("tls")) {
                    srvErr = "Database Connection Blocked. Please allow 0.0.0.0/0 in MongoDB Atlas Network Access.";
                }
                setError(srvErr);
            }
        } catch (err: unknown) {
            let errorMsg = err instanceof Error ? err.message : "Failed to load tracking info";
            if (errorMsg.includes("SSL") || errorMsg.includes("tls")) {
                errorMsg = "Database Connection Blocked. Please allow 0.0.0.0/0 in MongoDB Atlas Network Access.";
            }
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTracking();
        const poll = setInterval(fetchTracking, 10000);
        return () => clearInterval(poll);
    }, [donationId]);

    useEffect(() => {
        if (!lastUpdated) return;
        const check = setInterval(() => {
            const diff = Date.now() - lastUpdated.getTime();
            const socket = getSocket();
            // PHASE 1: Only mark offline if socket is ACTUALLY disconnected AND 15s elapsed
            setIsOffline(!socket.connected && diff > 15000);
        }, 5000);
        return () => clearInterval(check);
    }, [lastUpdated]);

    const handleTrackingUpdate = useCallback((stats: any) => {
        setTrackingStats(stats);
        setLastUpdated(new Date());
    }, []);

    const handleStatusChange = useCallback((newStatus: string) => {
        setInfo(prev => prev ? ({ ...prev, status: newStatus.toLowerCase() as any }) : null);
        setLastUpdated(new Date());
    }, []);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] bg-slate-50 rounded-[2.5rem] border border-slate-100 italic text-slate-400 text-sm">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center mb-6 animate-bounce">
                <Truck className="w-8 h-8 text-indigo-500" />
            </div>
            <p className="font-black uppercase tracking-[0.2em] text-[10px]">Syncing with Fleet...</p>
        </div>
    );

    if (error || !info) return (
        <div className="p-12 bg-slate-50 rounded-[2.5rem] border border-slate-200 text-slate-400 text-sm text-center font-bold">
            <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-slate-300" />
            {error || "Tracking details will appear once an NGO accepts the batch."}
        </div>
    );

    const ngoName = info.ngoProfile?.ngoName || info.ngoId?.name || "NGO Partner";
    const ngoPhone = info.ngoProfile?.contactPhone || "";

    const steps = [
        { key: 'accepted', label: 'Accepted', desc: 'NGO confirmed', icon: <CheckCircle2 className="w-4 h-4" /> },
        { key: 'on_the_way', label: 'On The Way', desc: 'Heading to you', icon: <Truck className="w-4 h-4" /> },
        { key: 'arrived', label: 'Arrived', desc: 'At your location', icon: <MapPin className="w-4 h-4" /> },
        { key: 'collected', label: 'Collected', desc: 'Items secured', icon: <Package className="w-4 h-4" /> },
        { key: 'delivered', label: 'Delivered', desc: 'At destination', icon: <Package className="w-4 h-4" /> },
        { key: 'completed', label: 'Closed', desc: 'Mission complete', icon: <ShieldCheck className="w-4 h-4" /> }
    ];

    const currentIdx = steps.findIndex(s => s.key === info.status?.toLowerCase());

    return (
        <div className="relative h-[calc(100vh-120px)] sm:h-[700px] w-full bg-slate-950 rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl flex flex-col group">
            
            {/* 1. TOP MAP (Dominant View) */}
            <div className="flex-1 relative">
                <LiveTrackingMap
                    donationId={donationId}
                    pickupLat={info.donation?.latitude || 0}
                    pickupLon={info.donation?.longitude || 0}
                    ngoName={ngoName}
                    destinationAddress={info.donation?.pickupAddress || info.donation?.city || "Donation Point"}
                    initialNgoLocation={info.ngoLocation ? { lat: info.ngoLocation.lat, lng: info.ngoLocation.lng } : undefined}
                    onTrackingUpdate={handleTrackingUpdate}
                    onStatusChange={handleStatusChange}
                    onReconnect={fetchTracking}
                />

                {/* Overlays */}
                <div className="absolute top-6 left-6 right-6 flex flex-col gap-3 pointer-events-none">
                    <div className="self-start px-4 py-2 bg-slate-900/90 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl flex items-center space-x-3 pointer-events-auto">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">
                            {steps[currentIdx]?.label || info.status?.replace(/_/g, ' ')}
                        </span>
                        {isOffline && (
                            <span className="text-[9px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                Connection Weak
                            </span>
                        )}
                    </div>

                    <div className="bg-white rounded-3xl p-4 shadow-2xl border border-slate-100 flex items-center justify-between w-full max-w-sm pointer-events-auto transition-transform hover:scale-[1.02]">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                <Truck className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Operational Partner</p>
                                <h4 className="text-sm font-black text-slate-900 truncate tracking-tight">{ngoName}</h4>
                                <div className="flex items-center space-x-2 mt-1">
                                    <Timer className="w-3 h-3 text-indigo-500" />
                                    <span className="text-[10px] font-bold text-slate-500">{trackingStats.duration || "Calculating..."}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex space-x-2">
                            {ngoPhone && (
                                <a href={`tel:${ngoPhone}`} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                                    <Phone className="w-4 h-4" />
                                </a>
                            )}
                            <button 
                                onClick={() => setIsReporting(!isReporting)}
                                className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            >
                                <AlertTriangle className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-10 left-6 right-6 pointer-events-none flex items-end justify-between">
                     <div className="px-4 py-2 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 text-white flex items-center space-x-4 pointer-events-auto">
                        <div className="flex items-center space-x-1.5">
                            <Navigation className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{trackingStats.distance || "—"}</span>
                        </div>
                        <div className="w-px h-3 bg-white/20" />
                        <span className="text-[9px] font-bold text-white/50 italic">
                            {lastUpdated ? `Live • updated ${Math.floor((Date.now() - lastUpdated.getTime())/1000)}s ago` : 'Connecting...'}
                        </span>
                     </div>
                </div>
            </div>

            {/* 2. BOTTOM DETAILS (Collapsible Sheet) */}
            <div className={cn(
                "bg-white rounded-t-[2.5rem] border-t border-slate-200 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] relative z-20",
                isTimelineOpen ? "h-[450px]" : "h-[90px]"
            )}>
                <button 
                    onClick={() => setIsTimelineOpen(!isTimelineOpen)}
                    className="w-full flex flex-col items-center pt-3 pb-2 transition-colors hover:bg-slate-50/50"
                >
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full mb-2" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {isTimelineOpen ? "Collapse Roadmap" : "View Full Mission Timeline"}
                    </p>
                </button>

                <div className="px-8 pb-8 space-y-8 overflow-y-auto max-h-[350px] no-scrollbar">
                    {!isTimelineOpen && (
                        <div className="flex items-center justify-between mt-2 animate-in fade-in zoom-in-95 duration-500">
                             <div className="flex items-center space-x-2">
                                <Package className="w-4 h-4 text-primary" />
                                <span className="text-xs font-black text-slate-900">{info.donation?.foodType}</span>
                             </div>
                             <div className="flex items-center space-x-1 px-3 py-1 bg-primary/5 rounded-full">
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">{info.donation?.quantity}kg</span>
                             </div>
                        </div>
                    )}

                    <div className={cn(
                        "grid grid-cols-1 gap-6 pt-4 transition-opacity duration-300",
                        !isTimelineOpen && "opacity-0 pointer-events-none h-0 p-0"
                    )}>
                        {steps.map((step, idx) => {
                            const isDone = idx <= currentIdx;
                            const isCurrent = idx === currentIdx;
                            return (
                                <div key={idx} className="flex relative group/step">
                                    {idx < steps.length - 1 && (
                                        <div className={cn(
                                            "absolute left-[15px] top-[30px] w-0.5 h-[calc(100%+24px)] transition-colors duration-1000",
                                            isDone ? "bg-indigo-600/40" : "bg-slate-100"
                                        )} />
                                    )}
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-700 relative z-10",
                                        isDone ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200" : "bg-white border-slate-200 text-slate-300",
                                        isCurrent && "scale-125 ring-4 ring-indigo-100 animate-pulse"
                                    )}>
                                        {step.icon}
                                    </div>
                                    <div className="ml-5 flex-1 pt-0.5">
                                        <div className="flex justify-between items-center">
                                            <h5 className={cn(
                                                "text-[11px] font-black uppercase tracking-widest leading-none",
                                                isDone ? "text-slate-900" : "text-slate-400"
                                            )}>{step.label}</h5>
                                            {isDone && (
                                                <span className="text-[9px] font-bold text-slate-400">
                                                    {idx === 0 ? "Initialised" : "Syncing..."}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-500 mt-1 opacity-60">
                                            {isDone ? step.desc : "Awaiting operational signal..."}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {isReporting && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-500">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Safeguard Report</h3>
                            <button onClick={() => setIsReporting(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <AlertTriangle className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {reportSuccess ? (
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                                </div>
                                <h4 className="text-sm font-black text-slate-900 mb-2">Report Transmitted</h4>
                                <p className="text-xs font-medium text-slate-500">Security team will investigate shortly.</p>
                                <button onClick={() => setIsReporting(false)} className="mt-6 w-full h-11 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest">Close</button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <select 
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-bold focus:ring-2 focus:ring-indigo-100"
                                    value={reportReason}
                                    onChange={(e) => setReportReason(e.target.value)}
                                >
                                    <option value="">Select Insufficiency...</option>
                                    <option value="no_show">Ghosted / No Arrival</option>
                                    <option value="unprofessional">Lack of Protocol</option>
                                    <option value="safety">Safety Violation</option>
                                </select>
                                <textarea 
                                    placeholder="Incident data context..."
                                    className="w-full h-24 bg-slate-50 border border-slate-200 rounded-[1.25rem] p-4 text-xs font-medium focus:ring-2 focus:ring-indigo-100 resize-none"
                                    value={reportDesc}
                                    onChange={(e) => setReportDesc(e.target.value)}
                                />
                                <div className="flex space-x-3 pt-2">
                                    <button onClick={() => setIsReporting(false)} className="flex-1 h-12 text-xs font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                                    <button 
                                        onClick={handleReportSubmit}
                                        disabled={!reportReason || reportLoading}
                                        className="flex-[2] h-12 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-200 disabled:opacity-50 transition-all active:scale-95"
                                    >
                                        {reportLoading ? "Transmitting..." : "Submit Incident"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
