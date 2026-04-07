"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, MessageCircle, Clock } from "lucide-react";
import { useChatSocket } from "@/hooks/useChatSocket";
import { cn } from "@/lib/utils";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  donationId: string;
  partnerName: string;
  role: 'donor' | 'ngo';
}

export const ChatModal = ({ isOpen, onClose, donationId, partnerName, role }: ChatModalProps) => {
  const [input, setInput] = useState("");
  const { messages, sendMessage, isConnected, messagesEndRef } = useChatSocket(donationId, role);

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
      setInput("");
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="fixed bottom-6 right-6 left-6 md:left-auto md:w-[400px] h-[600px] max-h-[80vh] bg-white rounded-[2.5rem] shadow-2xl z-[101] flex flex-col overflow-hidden border border-slate-100"
          >
            {/* Header */}
            <div className="bg-slate-900 p-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-black">
                  {partnerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-white font-black text-sm">{partnerName}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-emerald-400" : "bg-slate-500")} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isConnected ? "Online" : "Connecting..."}</span>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    <MessageCircle className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h4 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No messages yet</h4>
                  <p className="text-slate-400 text-[9px] font-bold mt-2 leading-relaxed">Start the conversation with your partner NGO.</p>
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.sender === role;
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i} 
                    className={cn(
                      "flex flex-col max-w-[85%]",
                      isMe ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div className={cn(
                      "p-4 rounded-2xl text-xs font-bold leading-relaxed shadow-sm",
                      isMe ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                    )}>
                      {msg.message}
                    </div>
                    <div className="flex items-center gap-1 mt-1 px-1">
                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                      <span className="text-[8px] font-black text-slate-400 uppercase">{formatTime(msg.timestamp)}</span>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
               <div className="relative">
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..."
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-6 pr-14 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
                  />
                  <button 
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="absolute right-2 top-2 w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white disabled:opacity-50 disabled:bg-slate-300 transition-all active:scale-95"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
               </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
