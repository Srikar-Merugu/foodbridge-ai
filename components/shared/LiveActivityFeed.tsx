"use client";

import React, { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { getRequest } from '@/lib/apiClient';
import { Activity } from '@/types';
import { Button } from '@/components/ui/button';
import { 
    Zap,
    History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';





const emojiMap: Record<Activity['type'], string> = {
    NEW_DONATION: "🍱",
    MISSION_ACCEPTED: "🤝",
    PICKUP_STARTED: "🚚",
    ARRIVED_AT_PICKUP: "📍",
    FOOD_COLLECTED: "📦",
    DELIVERY_COMPLETED: "✅",
    HUNGER_REPORT: "📢"
};

export const LiveActivityFeed = () => {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Fetch initial activity
        const fetchInitialActivity = async () => {
            try {
                const response = await getRequest('/api/analytics/activity');
                if (response.success) {
                    setActivities(response.data);
                }
            } catch (err) {
                console.error("Failed to fetch activities", err);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialActivity();

        // 2. Setup Socket (Global Singleton)
        const socket = getSocket();

        const handleFeedSync = () => {
            console.log("[FEED] Syncing with public activity stream...");
            socket.emit("join-public-feed");
        };

        if (socket.connected) {
            handleFeedSync();
        }

        socket.on("connect", handleFeedSync);

        socket.on("new-activity", (newActivity: Activity) => {
            console.log("[FEED] New activity received:", newActivity);
            setActivities(prev => {
                if (prev.some(a => a._id === newActivity._id)) return prev;
                return [newActivity, ...prev].slice(0, 10);
            });
        });

        return () => {
            socket.off("connect", handleFeedSync);
            socket.off("new-activity");
        };
    }, []);

    if (loading && activities.length === 0) {
        return (
            <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-white/5 rounded-xl border border-white/5" />
                ))}
            </div>
        );
    }

    return (
        <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                <Zap className="w-20 h-20" />
            </div>
            <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                    <h4 className="text-lg font-black tracking-tight">Live Activity Feed</h4>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Live</span>
                    </div>
                </div>

                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {activities.length > 0 ? (
                        activities.map((activity) => (
                            <div 
                                key={activity._id} 
                                className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all group/item animate-in fade-in slide-in-from-right-4 duration-500"
                            >
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-lg border border-white/5 group-hover/item:border-white/20 transition-colors">
                                        {emojiMap[activity.type] || "🔹"}
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-black group-hover/item:text-primary transition-colors">{activity.title}</p>
                                        <p className="text-[9px] font-medium text-slate-400 leading-tight line-clamp-1">{activity.description}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end space-y-1">
                                    <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap">
                                        {formatDistanceToNow(new Date(activity.timestamp))} ago
                                    </span>
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        activity.type === 'DELIVERY_COMPLETED' ? "bg-emerald-500" : 
                                        activity.type === 'HUNGER_REPORT' ? "bg-rose-500" : "bg-primary"
                                    )} />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 space-y-3">
                            <History className="w-8 h-8 text-slate-700 mx-auto opacity-50" />
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">No recent activity detected</p>
                        </div>
                    )}
                </div>

                <Button variant="ghost" className="w-full h-11 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                    View All Activity
                </Button>
            </div>
        </div>
    );
};
