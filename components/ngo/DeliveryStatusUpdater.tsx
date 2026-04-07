"use client";

import { useState } from "react";
import { postRequest } from "@/lib/apiClient";
import { CheckCircle2, Truck, Package, Loader2, ShieldCheck, Wifi, WifiOff, MapPin, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWebSocketLocation } from "@/hooks/useWebSocketLocation";
import { useActivityBroadcast } from "@/hooks/useActivityBroadcast";
import { useSession } from "next-auth/react";

export type DeliveryStatus = "pending" | "accepted" | "on_the_way" | "arrived" | "collected" | "delivered" | "completed" | "rejected";

interface StatusStep {
    key: DeliveryStatus;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    color: string;
    wsStatus: string; // WebSocket status string for donors
}

const steps: StatusStep[] = [
    {
        key: "accepted",
        label: "Mission Accepted",
        sublabel: "NGO has confirmed the donation",
        icon: <CheckCircle2 className="w-5 h-5" />,
        color: "bg-indigo-50 text-indigo-600 border-indigo-200",
        wsStatus: "ACCEPTED",
    },
    {
        key: "on_the_way",
        label: "On The Way",
        sublabel: "Team is heading to your location",
        icon: <Truck className="w-5 h-5" />,
        color: "bg-amber-50 text-amber-600 border-amber-200",
        wsStatus: "ON_THE_WAY",
    },
    {
        key: "arrived",
        label: "Arrived at Pickup",
        sublabel: "Team is at the donor's location",
        icon: <MapPin className="w-5 h-5" />,
        color: "bg-blue-50 text-blue-600 border-blue-200",
        wsStatus: "ARRIVED",
    },
    {
        key: "collected",
        label: "Food Collected",
        sublabel: "Items received and secured",
        icon: <Package className="w-5 h-5" />,
        color: "bg-purple-50 text-purple-600 border-purple-200",
        wsStatus: "COLLECTED",
    },
    {
        key: "delivered",
        label: "Arrived at Destination",
        sublabel: "Food has reached the destination",
        icon: <Package className="w-5 h-5" />,
        color: "bg-emerald-50 text-emerald-600 border-emerald-200",
        wsStatus: "DELIVERED",
    },
    {
        key: "completed",
        label: "Mission Completed",
        sublabel: "Verification and distribution complete",
        icon: <ShieldCheck className="w-5 h-5" />,
        color: "bg-emerald-500 text-white border-emerald-600",
        wsStatus: "COMPLETED",
    },
];

const nextStatus: Record<DeliveryStatus, DeliveryStatus | null> = {
    pending: "accepted",
    accepted: "on_the_way",
    on_the_way: "arrived",
    arrived: "collected",
    collected: "delivered",
    delivered: "completed",
    completed: null,
    rejected: null,
};

const nextLabel: Record<DeliveryStatus, string> = {
    pending: "Confirm Acceptance",
    accepted: "Start Pickup Mission",
    on_the_way: "Confirm Arrival at Donor",
    arrived: "Confirm Food Collection",
    collected: "Confirm Final Delivery",
    delivered: "Finalize & Complete Mission",
    completed: "Mission Complete",
    rejected: "Mission Terminated",
};

export const DeliveryStatusUpdater = ({
    deliveryId,
    currentStatus,
    onStatusUpdate,
    donationId,
}: {
    deliveryId: string;
    currentStatus: DeliveryStatus;
    onStatusUpdate?: (newStatus: DeliveryStatus) => void;
    donationId?: string;
}) => {
    const { broadcastActivity } = useActivityBroadcast();
    const { data: session } = useSession();
    const [status, setStatus] = useState<DeliveryStatus>(currentStatus);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // ── WebSocket location streaming (Zomato Grade: Track until Drop-off) ──────────────────
    const isTrackingActive = ["on_the_way", "arrived", "collected", "delivered"].includes(status);
    const { emitStatus, isConnected } = useWebSocketLocation({
        donationId: donationId || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        userId: (session?.user as any)?.id || null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ngoName: (session?.user as any)?.name || "NGO Partner",
        enabled: isTrackingActive,
    });

    const currentStepIdx = steps.findIndex(s => s.key === status);

    const handleUpdate = async (next: DeliveryStatus) => {
        if (!next) return;

        setLoading(true);
        setError("");
        try {
            const result = await postRequest("/api/donations/update-status", {
                deliveryId,
                status: next,
            });
            if (result.success) {
                setStatus(next);
                // Broadcast status to donor via WebSocket instantly
                const nextStep = steps.find(s => s.key === next);
                if (nextStep) emitStatus(nextStep.wsStatus);

                // --- Feature 6: Real-time Activity Broadcast ---
                if (next === 'on_the_way') {
                    broadcastActivity({
                        type: "PICKUP_STARTED",
                        title: "Pickup Started",
                        description: `A rescue vehicle is on the way for a pickup mission`,
                        id: deliveryId
                    });
                } else if (next === 'arrived') {
                    broadcastActivity({
                        type: "ARRIVED_AT_PICKUP",
                        title: "NGO Arrived",
                        description: `Rescue team has arrived at the pickup location`,
                        id: deliveryId
                    });
                } else if (next === 'collected') {
                    broadcastActivity({
                        type: "FOOD_COLLECTED",
                        title: "Food Assets Collected",
                        description: `Donation items have been secured and are in transit`,
                        id: deliveryId
                    });
                } else if (next === 'completed' || next === 'delivered') {
                    broadcastActivity({
                        type: "DELIVERY_COMPLETED",
                        title: "Food Delivered",
                        description: `Successfully delivered food assets to the destination`,
                        id: deliveryId
                    });
                }

                setSuccess(`Status updated to "${steps.find(s => s.key === next)?.label}"!`);
                setTimeout(() => setSuccess(""), 3000);
                onStatusUpdate?.(next);
            } else {
                setError(result.message || "Update failed");
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to update status");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery Status</p>

            {/* Timeline */}
            <div className="space-y-3">
                {steps.map((step, idx) => {
                    const isDone = idx <= currentStepIdx;
                    const isCurrent = idx === currentStepIdx;

                    return (
                        <div key={step.key} className="flex items-center space-x-3">
                            <div className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center border transition-all shrink-0",
                                isDone ? step.color : "bg-slate-50 text-slate-300 border-slate-100",
                                isCurrent && "ring-2 ring-offset-1 ring-primary/30"
                            )}>
                                {step.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                    <p className={cn(
                                        "text-xs font-black uppercase tracking-widest",
                                        isDone ? "text-slate-900" : "text-slate-400"
                                    )}>{step.label}</p>
                                    {isCurrent && (step.key === 'on_the_way' || step.key === 'arrived') && (
                                        <div className="flex items-center space-x-1 px-2 py-0.5 bg-emerald-500 rounded text-[8px] font-black text-white animate-pulse">
                                            <Wifi className="w-2.5 h-2.5" />
                                            <span>LIVE WS</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium">{step.sublabel}</p>
                            </div>
                            {isCurrent && (
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                            )}
                            {isDone && !isCurrent && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* WebSocket Sync Status */}
            {isTrackingActive && (
                <div className={cn(
                    "p-3 border rounded-xl flex items-center justify-between transition-all",
                    isConnected
                        ? "bg-indigo-50 border-indigo-100"
                        : "bg-amber-50 border-amber-100 animate-pulse"
                )}>
                    <div className="flex items-center space-x-2">
                        {isConnected ? (
                            <>
                                <Wifi className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Live Sync Active</span>
                            </>
                        ) : (
                            <>
                                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none">Signal Dropped</span>
                                    <span className="text-[8px] font-bold text-amber-500/70 uppercase tracking-wider mt-0.5">Attempting to Restore...</span>
                                </div>
                            </>
                        )}
                    </div>
                    {!isConnected && (
                        <button 
                            onClick={() => window.location.reload()} 
                            className="px-2 py-1 bg-amber-600 text-white text-[8px] font-black uppercase tracking-widest rounded-md hover:bg-amber-700 transition-colors"
                        >
                            Hard Reset
                        </button>
                    )}
                    {isConnected && <span className="text-[9px] font-bold text-slate-400">Real-time • 2.5s</span>}
                </div>
            )}

            {/* Error/Success */}
            {error && <p className="text-[11px] text-rose-600 font-bold">{error}</p>}
            {success && <p className="text-[11px] text-emerald-600 font-bold">{success}</p>}

            {/* Action Button */}
            {nextStatus[status] ? (
                <Button
                    onClick={() => handleUpdate(nextStatus[status]!)}
                    disabled={loading}
                    className="w-full h-12 bg-white border-2 border-primary text-primary hover:bg-primary hover:text-white font-black text-xs uppercase tracking-[0.2em] transition-all rounded-xl shadow-lg active:scale-95 group"
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <div className="flex items-center">
                            <span>{nextLabel[status]}</span>
                            <ArrowUpRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </div>
                    )}
                </Button>
            ) : status === 'completed' ? (
                <div className="flex items-center justify-center p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" />
                    <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Mission Complete</span>
                </div>
            ) : (
                <div className="flex items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <Loader2 className="w-4 h-4 text-slate-300 animate-spin mr-2" />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Initialising Mission...</span>
                </div>
            )}
        </div>
    );
};
