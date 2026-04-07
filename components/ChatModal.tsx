"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, MessageCircle, Mic, MicOff, Play, Pause, Check, CheckCheck, WifiOff } from "lucide-react";
import { useChatSocket } from "@/hooks/useChatSocket";
import { cn } from "@/lib/utils";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  donationId: string;
  partnerName: string;
  role: "donor" | "ngo";
}

// ── Seen Tick Component ──
const SeenTick = ({ seen, isMine }: { seen: boolean; isMine: boolean }) => {
  if (!isMine) return null;
  return seen ? (
    <CheckCheck className="w-3 h-3 text-blue-400 inline-block ml-1" />
  ) : (
    <Check className="w-3 h-3 text-slate-300 inline-block ml-1" />
  );
};

// ── Voice Bubble Player ──
const VoiceBubble = ({ src, isMine }: { src: string; isMine: boolean }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-2xl", isMine ? "bg-indigo-600" : "bg-white border border-slate-100")}>
      <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} />
      <button
        onClick={toggle}
        className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", isMine ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-600")}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className={cn("flex gap-0.5 items-end h-5", isMine ? "text-white/60" : "text-slate-300")}>
        {[3, 5, 7, 4, 6, 8, 4, 5, 3, 7, 6].map((h, i) => (
          <div key={i} className={cn("w-0.5 rounded-full", playing ? "animate-pulse" : "", isMine ? "bg-white/50" : "bg-slate-300")} style={{ height: `${h}px` }} />
        ))}
      </div>
    </div>
  );
};

export const ChatModal = ({ isOpen, onClose, donationId, partnerName, role }: ChatModalProps) => {
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const {
    messages,
    sendMessage,
    sendTyping,
    markSeen,
    isConnected,
    typingUser,
    messagesEndRef,
  } = useChatSocket(donationId, role);

  // ── Mark as seen when modal opens ──
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      markSeen();
    }
  }, [isOpen, messages.length, markSeen]);

  // ── Mark as seen when new messages arrive and modal is open ──
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      const hasUnread = messages.some((m) => m.sender !== role && !m.seen);
      if (hasUnread) markSeen();
    }
  }, [isOpen, messages, markSeen, role]);

  // ── Browser Notification ──
  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last?.sender !== role) {
        if (Notification.permission === "granted") {
          new Notification("FoodBridge", {
            body: `${partnerName}: ${last.message}`,
            icon: "/favicon.ico",
          });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission();
        }
      }
    }
  }, [messages, isOpen, partnerName, role]);

  const handleSend = useCallback(() => {
    if (input.trim()) {
      sendMessage(input);
      setInput("");
    }
  }, [input, sendMessage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    sendTyping();
  };

  // ── Voice Recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        sendMessage(url, "voice");
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("[VOICE] Microphone access denied", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[999]"
          />

          {/* Chat Panel */}
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed bottom-6 right-6 w-[360px] md:w-[400px] h-[600px] max-h-[85vh] bg-white rounded-3xl shadow-2xl z-[1000] flex flex-col overflow-hidden border border-slate-100"
          >
            {/* ── Header ── */}
            <div className="bg-slate-900 px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-black text-sm">
                    {partnerName.charAt(0).toUpperCase()}
                  </div>
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900",
                    isConnected ? "bg-emerald-400" : "bg-slate-500"
                  )} />
                </div>
                <div>
                  <h3 className="text-white font-black text-sm leading-tight">{partnerName.toUpperCase()}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {typingUser ? (
                      <span className="text-emerald-400 animate-pulse">
                        {typingUser === "donor" ? "Donor" : "NGO"} is typing...
                      </span>
                    ) : isConnected ? "Online" : "Connecting..."}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Reconnecting Banner ── */}
            <AnimatePresence>
              {!isConnected && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="overflow-hidden bg-amber-500 shrink-0"
                >
                  <div className="flex items-center justify-center gap-2 py-2">
                    <WifiOff className="w-3 h-3 text-white" />
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">Reconnecting...</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Messages Area ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 overscroll-contain">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    <MessageCircle className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h4 className="text-slate-700 text-sm font-black">No messages yet</h4>
                  <p className="text-slate-400 text-xs font-medium mt-1 max-w-[180px] leading-relaxed">
                    Start the conversation with {partnerName}
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender === role;
                  return (
                    <motion.div
                      key={`${msg.timestamp}-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn("flex flex-col max-w-[80%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}
                    >
                      {/* Bubble */}
                      {msg.type === "voice" ? (
                        <VoiceBubble src={msg.message} isMine={isMe} />
                      ) : (
                        <div className={cn(
                          "px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed",
                          isMe
                            ? "bg-indigo-600 text-white rounded-tr-none"
                            : "bg-white text-slate-800 border border-slate-100 rounded-tl-none shadow-sm"
                        )}>
                          {msg.message}
                        </div>
                      )}

                      {/* Timestamp + Seen */}
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[9px] font-semibold text-slate-400">
                          {formatTime(msg.timestamp)}
                        </span>
                        <SeenTick seen={msg.seen} isMine={isMe} />
                      </div>
                    </motion.div>
                  );
                })
              )}

              {/* Typing Bubble */}
              <AnimatePresence>
                {typingUser && typingUser !== role && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="flex items-end gap-2 mr-auto"
                  >
                    <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                      <div className="flex gap-1 items-center">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input Area ── */}
            <div className="px-3 py-3 bg-white border-t border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                {/* Text Input */}
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-50 rounded-2xl py-3 px-4 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all border border-slate-100"
                />

                {/* Voice Button */}
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all",
                    isRecording
                      ? "bg-red-500 text-white animate-pulse scale-110"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  )}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0 disabled:opacity-40 disabled:bg-slate-300 transition-all active:scale-95"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>

              {/* Recording indicator */}
              <AnimatePresence>
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 mt-2 px-2"
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                      Recording... Release to send
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
