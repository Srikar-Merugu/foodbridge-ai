"use client";

import { useEffect, useState } from "react";
import { getRequest } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DeliveryStatus } from "./DeliveryStatusUpdater";

interface Delivery {
    _id: string;
    donationId: {
        _id: string;
        foodType: string;
        quantity: number | string;
        pickupAddress: string;
        city: string;
        description?: string;
        verificationCode?: string;
        latitude?: number;
        longitude?: number;
        donorId?: {
            name: string;
            phone: string;
        };
    };
    status: DeliveryStatus;
}

import { Activity, Phone, ExternalLink, ChevronDown, ShieldCheck, MapPin, Truck, MessageCircle } from "lucide-react";
import { DeliveryStatusUpdater } from "./DeliveryStatusUpdater";
import { ChatModal } from "../ChatModal";

export const ActiveDeliveries = ({ refreshKey = 0, variant = "light" }: { refreshKey?: number, variant?: "light" | "dark" }) => {
    const isDark = variant === "dark";
    const [deliveries, setDeliveries] = useState<Delivery[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [activeChat, setActiveChat] = useState<{ id: string; name: string } | null>(null);

    const handleOpenChat = (e: React.MouseEvent, donationId: string, donorName: string) => {
        e.stopPropagation();
        console.log(`[NGO-CHAT] Opening link to Donation: ${donationId} | Partner: ${donorName}`);
        setActiveChat({ id: donationId, name: donorName });
        setIsChatOpen(true);
    };

    const fetchDeliveries = async () => {
        try {
            const result = await getRequest("/api/donations/my-deliveries");
            if (result.success) {
                setDeliveries(result.data.filter((d: Delivery) =>
                    d.status !== 'completed' && d.status !== 'pending' && d.status !== 'rejected'
                ));
            }
        } catch (err) {
            console.error("Failed to fetch active deliveries", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeliveries();
        const interval = setInterval(fetchDeliveries, 30000);
        window.addEventListener('focus', fetchDeliveries);
        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', fetchDeliveries);
        };
    }, [refreshKey]);

    if (loading) return (
        <div className="space-y-4">
            {[1, 2].map(i => (
                <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse border border-white/10" />
            ))}
        </div>
    );

    if (deliveries.length === 0) return (
        <div className="p-10 text-center border-2 border-dashed border-white/10 rounded-3xl bg-white/5">
            <Activity className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Zero Active Mission Payloads</p>
        </div>
    );

    return (
        <div className="space-y-4">
            {deliveries.map((delivery) => (
                <div key={delivery._id} className={cn(
                    "group relative overflow-hidden rounded-2xl border transition-all duration-500",
                    expandedId === delivery._id
                        ? "bg-white border-slate-200 shadow-xl"
                        : isDark
                            ? "bg-white/5 border-white/10 hover:border-white/20"
                            : "bg-white border-slate-200/60 hover:border-primary/20 hover:shadow-md"
                )}>
                    {/* Compact Header */}
                    <div
                        onClick={() => setExpandedId(expandedId === delivery._id ? null : delivery._id)}
                        className="p-5 flex items-center justify-between cursor-pointer"
                    >
                        <div className="flex items-center space-x-4 min-w-0">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center border transition-all shrink-0",
                                expandedId === delivery._id
                                    ? "bg-primary text-white border-primary"
                                    : isDark
                                        ? "bg-white/10 text-white/40 border-white/10"
                                        : "bg-slate-50 text-slate-400 border-slate-100"
                            )}>
                                <Truck className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h4 className={cn(
                                    "text-sm font-black tracking-tight truncate",
                                    (expandedId === delivery._id || !isDark) ? "text-slate-900" : "text-white"
                                )}>
                                    {delivery.donationId?.foodType}
                                </h4>
                                <div className="flex items-center text-[10px] font-black uppercase tracking-widest mt-1 opacity-60">
                                    <span className={(expandedId === delivery._id || !isDark) ? "text-slate-500" : "text-white"}>
                                        {delivery.donationId?.quantity}kg • {(delivery.status as string).replace(/_/g, ' ')}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <ChevronDown className={cn(
                            "w-4 h-4 transition-transform duration-500",
                            expandedId === delivery._id
                                ? "rotate-180 text-slate-400"
                                : isDark ? "text-white/20" : "text-slate-300"
                        )} />
                    </div>

                    {/* Detailed Mission Control View */}
                    {expandedId === delivery._id && (
                        <div className="px-5 pb-6 space-y-6 animate-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Donor Profile Card */}
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">In-Field Donor Context</p>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-primary uppercase">
                                            {delivery.donationId.donorId?.name?.substring(0, 2) || "D"}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-slate-900">{delivery.donationId.donorId?.name || "Donor"}</p>
                                            <div className="flex items-center space-x-2 mt-1">
                                                <Phone className="w-3 h-3 text-primary" />
                                                <p className="text-[10px] font-bold text-slate-500">{delivery.donationId.donorId?.phone || "Private Line"}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t border-slate-200/60 mt-2">
                                        <div className="flex items-start space-x-2">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                            <p className="text-[10px] font-bold text-slate-600 leading-relaxed">
                                                {delivery.donationId?.pickupAddress}, {delivery.donationId?.city}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Mission Actions & Location */}
                                <div className="space-y-3">
                                    {delivery.donationId?.latitude && delivery.donationId?.longitude ? (
                                        <Button
                                            onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation();
                                                window.open(`https://www.google.com/maps?q=${delivery.donationId?.latitude},${delivery.donationId?.longitude}`, '_blank');
                                            }}
                                            variant="outline"
                                            className="w-full h-11 border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-all rounded-xl mt-2"
                                        >
                                            <ExternalLink className="w-4 h-4 mr-2" />
                                            Launch Precision Nav
                                        </Button>
                                    ) : (
                                        <div className="h-11 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            No GPS Coords Found
                                        </div>
                                    )}

                                    {delivery.donationId?.description && (
                                        <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Batch Intelligence</p>
                                            <p className="text-[10px] font-medium text-slate-600 italic leading-relaxed line-clamp-2">
                                                &quot;{delivery.donationId.description}&quot;
                                            </p>
                                        </div>
                                    )}

                                    <Button
                                        onClick={(e) => handleOpenChat(e, delivery.donationId._id, delivery.donationId.donorId?.name || "Donor")}
                                        variant="outline"
                                        className="w-full h-11 border-indigo-200 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all rounded-xl"
                                    >
                                        <MessageCircle className="w-4 h-4 mr-2" />
                                        Message Donor
                                    </Button>
                                </div>
                            </div>

                            {/* Verification Code Box (Visible only after accept) */}
                            {delivery.donationId?.verificationCode && (
                                <div className="bg-slate-900 p-4 rounded-xl flex items-center justify-between border border-white/10">
                                    <div className="flex items-center space-x-2">
                                        <ShieldCheck className="w-4 h-4 text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/60 text-nowrap">Proof of Mission Code</span>
                                    </div>
                                    <span className="text-sm font-black text-primary tracking-[0.2em]">{delivery.donationId.verificationCode}</span>
                                </div>
                            )}

                            {/* Step-by-Step Logistics Updater */}
                            <div className="pt-4 border-t border-slate-100">
                                <DeliveryStatusUpdater
                                    deliveryId={delivery._id}
                                    donationId={delivery.donationId._id}
                                    currentStatus={delivery.status}
                                    onStatusUpdate={() => fetchDeliveries()}
                                />
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
