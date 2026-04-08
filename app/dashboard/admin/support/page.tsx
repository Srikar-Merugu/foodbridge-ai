"use client";

import { useEffect, useState } from "react";
import { getRequest, patchRequest } from "@/lib/apiClient";
import Image from "next/image";
import {
    Loader2,
    CheckCircle2,
    User,
    ShieldCheck,
    Eye,
    Calendar,
    Image as ImageIcon,
    Headphones,
    MessageSquare,
    Clock,
    MapPin,
    Ban,
    AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminSupportPage() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const res = await getRequest("/api/admin/support-tickets");
            if (res.success) {
                setTickets(res.data);
            } else {
                setError(res.error || "Failed to load support tickets");
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            setError("An error occurred while fetching support tickets.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const handleResolve = async (ticketId: string) => {
        try {
            setActionLoadingId(ticketId);
            const res = await patchRequest("/api/admin/support-tickets", {
                ticketId,
                status: 'resolved'
            });
            if (res.success) {
                setTickets(prev => prev.map(t => t._id === ticketId ? { ...t, status: 'resolved' } : t));
            } else {
                alert(res.error || "Failed to resolve ticket");
            }
        } catch (err) {
            alert("An error occurred while resolving the ticket.");
        } finally {
            setActionLoadingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-slate-300" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Support Tickets</h2>
                    <p className="text-slate-500 font-bold mt-1">Manage user queries and issues related to active missions.</p>
                </div>
                <div className="flex space-x-2">
                    <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600 font-black text-sm flex items-center shadow-sm">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        {tickets.filter(t => t.status === 'open').length} Open Tickets
                    </div>
                </div>
            </div>

            {error ? (
                <div className="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-100 font-bold text-sm">
                    {error}
                </div>
            ) : tickets.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                    <Headphones className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-slate-400">No Support Queries</h3>
                    <p className="text-slate-500 text-sm mt-2">The support queue is currently empty.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {tickets.map((ticket) => (
                        <SupportTicketCard
                            key={ticket._id}
                            ticket={ticket}
                            onResolve={handleResolve}
                            actionLoading={actionLoadingId === ticket._id}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SupportTicketCard = ({ ticket, onResolve, actionLoading }: { ticket: any; onResolve: (id: string) => void; actionLoading: boolean }) => {
    const isOpen = ticket.status === 'open';
    const donation = ticket.donationId || {};
    const user = ticket.userId || {};

    const getIcon = (type: string) => {
        switch (type) {
            case "NGO not responding": return <MessageSquare className="w-4 h-4" />;
            case "Delay in pickup": return <Clock className="w-4 h-4" />;
            case "Wrong location": return <MapPin className="w-4 h-4" />;
            case "Cancel donation": return <Ban className="w-4 h-4" />;
            default: return <Headphones className="w-4 h-4" />;
        }
    };

    return (
        <div className={cn(
            "bg-white border rounded-2xl overflow-hidden shadow-sm transition-all",
            isOpen ? "border-indigo-200 shadow-indigo-900/5 hover:border-indigo-300"
                : "border-slate-200 opacity-75"
        )}>
            <div className={cn(
                "px-6 py-3 border-b flex items-center justify-between",
                isOpen ? "bg-indigo-50/50 border-indigo-100" : "bg-slate-50/50 border-slate-100"
            )}>
                <div className="flex items-center space-x-3 text-xs font-black uppercase tracking-wider">
                    {isOpen ? (
                        <span className="text-indigo-600 flex items-center gap-2">
                           {getIcon(ticket.issueType)} {ticket.issueType}
                        </span>
                    ) : (
                        <span className="text-emerald-600 flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                        </span>
                    )}
                    <span className="text-slate-400">• ID: {ticket._id.substring(ticket._id.length - 6)}</span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 flex items-center tracking-widest uppercase">
                    <Calendar className="w-3 h-3 mr-1" />
                    {new Date(ticket.createdAt).toLocaleString()}
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                <div className="md:col-span-3">
                    <div className="w-full h-40 bg-slate-100 rounded-xl border-2 border-slate-200 overflow-hidden relative group">
                        {donation.foodImage ? (
                            <Image src={donation.foodImage} alt="Mission Asset" fill className="object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                                <ImageIcon className="w-8 h-8 mb-2" />
                                <span className="text-[10px] font-black uppercase">No Visual</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <a href={donation.foodImage} target="_blank" rel="noopener" className="w-10 h-10 rounded-full bg-white/20 hover:bg-white flex items-center justify-center backdrop-blur-sm transition-colors text-white hover:text-slate-900">
                                <Eye className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-6 space-y-4">
                    <div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">User Description</h4>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                            &quot;{ticket.description}&quot;
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-1">
                                <User className="w-3 h-3 mr-1" /> Reported By
                            </p>
                            <p className="text-xs font-black text-slate-800">{user.name || "Unknown"}</p>
                            <p className="text-[10px] text-slate-500 font-bold">{user.email}</p>
                        </div>
                        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center mb-1">
                                <AlertCircle className="w-3 h-3 mr-1" /> Mission Ref
                            </p>
                            <p className="text-xs font-black text-slate-800">#{donation._id?.substring(donation._id.length - 6).toUpperCase()}</p>
                            <p className="text-[10px] text-slate-500 font-bold">{donation.foodType}</p>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-3 flex flex-col justify-center h-full">
                    {isOpen ? (
                        <button
                            onClick={() => onResolve(ticket._id)}
                            disabled={actionLoading}
                            className="w-full h-12 rounded-xl bg-slate-900 text-white hover:bg-primary transition-all font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Mark Resolved <CheckCircle2 className="w-4 h-4 ml-2" /></>}
                        </button>
                    ) : (
                        <div className="w-full py-4 flex flex-col items-center justify-center text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100">
                            <ShieldCheck className="w-6 h-6 mb-1" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Case Resolved</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
