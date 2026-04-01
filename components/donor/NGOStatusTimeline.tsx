"use client";

import React from 'react';
import { cn } from "@/lib/utils";
import { 
    CheckCircle2, 
    Truck, 
    MapPin, 
    Package, 
    ShieldCheck,
    Circle
} from "lucide-react";

interface TimelineStep {
    key: string;
    label: string;
    desc: string;
    icon: React.ReactNode;
}

const steps: TimelineStep[] = [
    { key: 'accepted', label: 'Accepted', desc: 'NGO confirmed mission', icon: <CheckCircle2 className="w-4 h-4" /> },
    { key: 'on_the_way', label: 'On The Way', desc: 'NGO is heading to pickup', icon: <Truck className="w-4 h-4" /> },
    { key: 'arrived', label: 'Arrived', desc: 'NGO at your location', icon: <MapPin className="w-4 h-4" /> },
    { key: 'collected', label: 'Collected', desc: 'Food items secured', icon: <Package className="w-4 h-4" /> },
    { key: 'delivered', label: 'Delivered', desc: 'Reached destination', icon: <Package className="w-4 h-4" /> },
    { key: 'completed', label: 'Mission Closed', desc: 'Successfully delivered', icon: <ShieldCheck className="w-4 h-4" /> }
];

export default function NGOStatusTimeline({ currentStatus }: { currentStatus: string }) {
    const statusLower = currentStatus.toLowerCase();
    const currentIdx = steps.findIndex(s => s.key === statusLower);

    return (
        <div className="space-y-6">
            {steps.map((step, idx) => {
                const isDone = idx <= currentIdx;
                const isCurrent = idx === currentIdx;
                
                return (
                    <div key={idx} className="flex relative group">
                        {idx < steps.length - 1 && (
                            <div className={cn(
                                "absolute left-[15px] top-[30px] w-0.5 h-[calc(100%+24px)] transition-colors duration-1000",
                                isDone ? "bg-indigo-600/40" : "bg-slate-100"
                            )} />
                        )}
                        
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-700 relative z-10",
                            isDone ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-white border-slate-200 text-slate-300",
                            isCurrent && "scale-110 ring-4 ring-indigo-100 animate-pulse"
                        )}>
                            {isDone ? step.icon : <Circle className="w-3 h-3 fill-current" />}
                        </div>

                        <div className="ml-5 flex-1 pt-0.5">
                            <div className="flex justify-between items-center">
                                <h5 className={cn(
                                    "text-[10px] font-black uppercase tracking-widest leading-none",
                                    isDone ? "text-slate-900" : "text-slate-400"
                                )}>
                                    {step.label}
                                </h5>
                                {isCurrent && (
                                    <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-600 animate-ping" />
                                )}
                            </div>
                            <p className={cn(
                                "text-[10px] font-bold mt-1.5 leading-relaxed tracking-tight",
                                isDone ? "text-slate-500" : "text-slate-300 italic"
                            )}>
                                {isDone ? step.desc : "Awaiting signal..."}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
