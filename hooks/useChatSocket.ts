import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/socket';

export interface ChatMessage {
  donationId: string;
  sender: 'donor' | 'ngo';
  message: string;
  type: 'text' | 'voice';
  seen: boolean;
  timestamp: string;
}

export const useChatSocket = (donationId: string, role: 'donor' | 'ngo') => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auto scroll to bottom ──
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── Fetch message history ──
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/${donationId}`);
      const result = await res.json();
      if (result.success) {
        setMessages(result.data);
      }
    } catch (err) {
      console.error('[CHAT-HISTORY] Failed to fetch', err);
    }
  }, [donationId]);

  // ── Socket lifecycle ──
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('join-room', donationId);
      console.log(`[CHAT-HOOK] Joined room: ${donationId} as ${role}`);
    };

    const onDisconnect = () => setIsConnected(false);

    const onChatMessage = (msg: ChatMessage) => {
      console.log(`[CHAT-RECEIVE] ${msg.sender}: ${msg.message}`);
      if (msg.donationId === donationId) {
        setMessages((prev) => {
          // Deduplicate by timestamp+sender
          const isDuplicate = prev.some(
            (m) => m.timestamp === msg.timestamp && m.sender === msg.sender
          );
          return isDuplicate ? prev : [...prev, msg];
        });
      }
    };

    const onTyping = (sender: string | null) => {
      if (sender && sender !== role) {
        setTypingUser(sender);
        // Auto-clear typing indicator after 3.5s (server clears at 3s)
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3500);
      } else {
        setTypingUser(null);
      }
    };

    const onSeen = ({ seenBy }: { donationId: string; seenBy: string }) => {
      if (seenBy !== role) {
        // Mark my sent messages as seen by the other party
        setMessages((prev) =>
          prev.map((m) => (m.sender === role ? { ...m, seen: true } : m))
        );
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('chat:message', onChatMessage);
    socket.on('chat:typing', onTyping);
    socket.on('chat:seen', onSeen);

    if (socket.connected) onConnect();

    fetchHistory();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('chat:message', onChatMessage);
      socket.off('chat:typing', onTyping);
      socket.off('chat:seen', onSeen);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [donationId, role, fetchHistory]);

  // ── Send text message ──
  const sendMessage = useCallback(
    (text: string, type: 'text' | 'voice' = 'text') => {
      if (!text.trim()) return;
      const socket = getSocket();
      const msg: ChatMessage = {
        donationId,
        sender: role,
        message: text.trim(),
        type,
        seen: false,
        timestamp: new Date().toISOString(),
      };
      socket.emit('chat:message', msg);
    },
    [donationId, role]
  );

  // ── Send typing indicator (debounced — call on every keystroke) ──
  const sendTyping = useCallback(() => {
    const socket = getSocket();
    socket.emit('chat:typing', { donationId, sender: role });
  }, [donationId, role]);

  // ── Mark messages as seen ──
  const markSeen = useCallback(() => {
    const socket = getSocket();
    socket.emit('chat:seen', { donationId, seenBy: role });
    // Also mark locally — incoming messages are now seen
    setMessages((prev) =>
      prev.map((m) => (m.sender !== role ? { ...m, seen: true } : m))
    );
  }, [donationId, role]);

  return { messages, sendMessage, sendTyping, markSeen, isConnected, typingUser, messagesEndRef };
};
