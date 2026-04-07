"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, CheckCircle2, ChevronRight, MessageSquare, Clock, MapPin, Ban, Headphones } from "lucide-react";

interface OrderHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  donationId: string;
  donorId: string;
}

const HELP_OPTIONS = [
  { id: "NGO not responding", label: "NGO not responding", icon: <MessageSquare className="w-5 h-5" /> },
  { id: "Delay in pickup", label: "Delay in pickup", icon: <Clock className="w-5 h-5" /> },
  { id: "Wrong location", label: "Wrong location", icon: <MapPin className="w-5 h-5" /> },
  { id: "Cancel donation", label: "Cancel donation", icon: <Ban className="w-5 h-5" /> },
  { id: "Contact support", label: "Contact support", icon: <Headphones className="w-5 h-5" /> },
];

export const OrderHelpModal = ({ isOpen, onClose, donationId, donorId }: OrderHelpModalProps) => {
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedIssue || !description.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donationId, userId: donorId, issueType: selectedIssue, description: description.trim() }),
      });
      const result = await res.json();
      if (result.success) {
        setIsSuccess(true);
        setTimeout(() => { onClose(); setIsSuccess(false); setSelectedIssue(null); setDescription(""); }, 2200);
      }
    } catch (err) {
      console.error("[SUPPORT-API] Failed", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[999]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 max-h-[90vh] bg-white rounded-t-[2.5rem] shadow-2xl z-[1000] flex flex-col overflow-hidden"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-4 pb-2 shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            <div className="px-6 pb-10 flex-1 overflow-y-auto">
              {isSuccess ? (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-in zoom-in duration-500" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Request Logged</h3>
                  <p className="text-slate-500 text-sm mt-2 font-medium max-w-[240px]">
                    We&apos;ve received your issue report. Our support team will reach out shortly.
                  </p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-8 mt-2">
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">How can we help?</h2>
                      <p className="text-slate-500 text-xs font-semibold mt-1">
                        Mission ID: <span className="font-black text-slate-700">#{donationId.slice(-6).toUpperCase()}</span>
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {!selectedIssue ? (
                    // ── Issue Selection — ALWAYS VISIBLE text ──
                    <div className="space-y-2">
                      {HELP_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setSelectedIssue(opt.id)}
                          className="w-full p-4 rounded-2xl flex items-center justify-between transition-all duration-200 active:scale-[0.98] bg-slate-50 hover:bg-slate-900 border border-slate-200 hover:border-slate-900 group"
                        >
                          <div className="flex items-center gap-3">
                            {/* Icon box — always shows icon, flips on hover */}
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 bg-white border-slate-200 text-slate-600 group-hover:bg-white/10 group-hover:border-transparent group-hover:text-white transition-all duration-200">
                              {opt.icon}
                            </div>
                            {/* Label — ALWAYS dark, flips white on hover */}
                            <span className="text-sm font-bold text-slate-800 group-hover:text-white transition-colors duration-200 text-left">
                              {opt.label}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-white/60 transition-colors duration-200" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    // ── Description Form ──
                    <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0" />
                        <p className="text-indigo-900 text-sm font-bold flex-1">{selectedIssue}</p>
                        <button
                          onClick={() => setSelectedIssue(null)}
                          className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline shrink-0"
                        >
                          Change
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                          Describe the issue
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="E.g. The NGO hasn't arrived for more than 30 minutes..."
                          className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all outline-none resize-none"
                        />
                      </div>

                      <button
                        onClick={handleSubmit}
                        disabled={!description.trim() || isSubmitting}
                        className="w-full h-14 bg-slate-900 rounded-2xl text-white text-sm font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                      >
                        {isSubmitting ? "Submitting..." : "Submit Support Ticket"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
