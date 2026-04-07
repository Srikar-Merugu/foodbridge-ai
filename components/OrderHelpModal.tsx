"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, CheckCircle2, ChevronRight, MessageSquare, Clock, MapPin, Ban, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  donationId: string;
  donorId: string;
}

const HELP_OPTIONS = [
  { id: 'NGO not responding', label: 'NGO not responding', icon: <MessageSquare /> },
  { id: 'Delay in pickup', label: 'Delay in pickup', icon: <Clock /> },
  { id: 'Wrong location', label: 'Wrong location', icon: <MapPin /> },
  { id: 'Cancel donation', label: 'Cancel donation', icon: <Ban /> },
  { id: 'Contact support', label: 'Contact support', icon: <Headphones /> },
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
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donationId,
          userId: donorId,
          issueType: selectedIssue,
          description: description.trim()
        }),
      });

      const result = await res.json();
      if (result.success) {
        setIsSuccess(true);
        setTimeout(() => {
          onClose();
          setIsSuccess(false);
          setSelectedIssue(null);
          setDescription("");
        }, 2000);
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
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed bottom-0 left-0 right-0 max-h-[90vh] bg-white rounded-t-[3rem] shadow-2xl z-[101] flex flex-col overflow-hidden"
          >
            {/* Drag Handle */}
            <div className="w-full flex flex-col items-center pt-4 pb-2">
                <div className="w-12 h-1 bg-slate-200 rounded-full" />
            </div>

            <div className="px-8 pb-10 flex-1 overflow-y-auto">
              {isSuccess ? (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-in zoom-in duration-500" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Request Logged</h3>
                  <p className="text-slate-500 text-sm mt-2 font-medium max-w-[240px]">We've received your issue report. Our support team will reach out shortly.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">How can we help?</h2>
                      <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest leading-none">Mission Support ID: {donationId.slice(-6)}</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {!selectedIssue ? (
                    <div className="space-y-3">
                      {HELP_OPTIONS.map((opt) => (
                        <button 
                          key={opt.id}
                          onClick={() => setSelectedIssue(opt.id)}
                          className="w-full group bg-slate-50 hover:bg-slate-900 border border-slate-100/50 hover:border-slate-900 p-5 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white group-hover:bg-white/10 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                              {opt.icon}
                            </div>
                            <span className="text-sm font-black text-slate-700 group-hover:text-white transition-colors">{opt.label}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-4">
                           <AlertCircle className="w-5 h-5 text-indigo-500" />
                           <p className="text-indigo-900 text-xs font-black">Issue: {selectedIssue}</p>
                           <button onClick={() => setSelectedIssue(null)} className="ml-auto text-[10px] font-black text-indigo-500 uppercase tracking-widest underline">Change</button>
                        </div>
                        
                        <div className="space-y-2">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Describe what's happening</label>
                            <textarea 
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="E.g. The NGO hasn't arrived for more than 30 minutes..."
                              className="w-full h-32 bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:border-indigo-500/30 transition-all outline-none resize-none"
                            />
                        </div>

                        <button 
                          onClick={handleSubmit}
                          disabled={!description.trim() || isSubmitting}
                          className="w-full h-16 bg-slate-900 rounded-2xl text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all disabled:bg-slate-200 disabled:shadow-none"
                        >
                          {isSubmitting ? "Submitting Ticket..." : "Submit Support Ticket"}
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
