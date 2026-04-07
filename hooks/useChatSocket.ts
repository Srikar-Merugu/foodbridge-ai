import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/socket';

interface Message {
  donationId: string;
  sender: 'donor' | 'ngo';
  message: string;
  timestamp: string;
}

export const useChatSocket = (donationId: string, role: 'donor' | 'ngo') => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/${donationId}`);
      const result = await res.json();
      if (result.success) {
        setMessages(result.data);
      }
    } catch (err) {
      console.error("[CHAT-HISTORY] Failed to fetch", err);
    }
  }, [donationId]);

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
      socket.emit("join-room", donationId);
    };

    const onDisconnect = () => setIsConnected(false);

    const onChatMessage = (msg: Message) => {
      if (msg.donationId === donationId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("chat:message", onChatMessage);

    // Initial join if already connected
    if (socket.connected) {
      onConnect();
    }

    fetchHistory();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("chat:message", onChatMessage);
    };
  }, [donationId, fetchHistory]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    const socket = getSocket();
    const msg: Message = {
      donationId,
      sender: role,
      message: text.trim(),
      timestamp: new Date().toISOString(),
    };
    socket.emit("chat:message", msg);
  }, [donationId, role]);

  return { messages, sendMessage, isConnected, messagesEndRef };
};
