"use client";

import { useState } from 'react';
import { Star, CheckCircle2, X, MessageSquare, ShieldCheck, Heart } from 'lucide-react';
import { cn } from "@/lib/utils";
import { postRequest } from '@/lib/apiClient';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    donationId: string;
}

export default function FeedbackModal({ isOpen, onClose, donationId }: FeedbackModalProps) {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {
        if (rating === 0) return;
        setLoading(true);
        try {
            // Simplified feedback submission
            const res = await postRequest('/api/donations/feedback', {
                donationId,
                rating,
                comment
            });
            if (res.success) {
                setSuccess(true);
                setTimeout(onClose, 3000);
            }
        } catch (err) {
            console.error("Feedback failed:", err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white rounded-[2.5rem] p-10 shadow-2xl relative border border-slate-100 animate-in zoom-in-95 duration-500">
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {success ? (
                    <div className="text-center py-6 space-y-6">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <ShieldCheck className="w-10 h-10 text-emerald-600" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-slate-900 uppercase">Impact Verified!</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your feedback helps us optimize the rescue network.</p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest"
                        >
                            Return to Hub
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="text-center space-y-2">
                            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Heart className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Rate the Rescue</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Service Excellence Analysis</p>
                        </div>

                        <div className="flex justify-center space-x-3">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className="transition-transform active:scale-90"
                                >
                                    <Star 
                                        className={cn(
                                            "w-8 h-8 transition-colors",
                                            star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-100 fill-slate-100"
                                        )}
                                    />
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center">
                                <MessageSquare className="w-3 h-3 mr-1.5" /> Comments (Optional)
                            </label>
                            <textarea
                                placeholder="How was the professional experience?"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                className="w-full h-32 bg-slate-50 border border-slate-100 rounded-[1.5rem] p-5 text-xs font-bold focus:ring-4 focus:ring-indigo-50 transition-all resize-none outline-none"
                            />
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={rating === 0 || loading}
                            className="w-full py-5 bg-indigo-600 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                        >
                            {loading ? "Syncing..." : "Verify Experience"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
