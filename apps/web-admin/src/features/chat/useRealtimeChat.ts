import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtime } from '@/shared/realtime/RealtimeProvider';
import type { ChatMessage } from '@/shared/store/chat';

/**
 * Wires the open chat to the realtime gateway (frozen contract events): joins
 * the active conversation room, appends inbound messages LIVE, reflects read
 * receipts / typing / presence — all by updating the same react-query caches
 * the UI already renders. Returns whether the OTHER party is typing in the
 * active conversation, plus an emitter for our own typing state.
 *
 * We keep sending messages over REST (optimistic), and the gateway ALSO
 * broadcasts them here; the optimistic-echo reconciliation below prevents a
 * brief duplicate when our own message comes back over the socket.
 */
export function useRealtimeChat(activeConversationId: string | null | undefined) {
  const { socket } = useRealtime();
  const queryClient = useQueryClient();
  const [typingConvs, setTypingConvs] = useState<Record<string, boolean>>({});
  const typingTimers = useRef<Record<string, number>>({});

  // Join/leave the active conversation room so its live events reach us.
  useEffect(() => {
    if (!socket || !activeConversationId) return;
    socket.emit('chat:join', { conversationId: activeConversationId });
    return () => {
      socket.emit('chat:leave', { conversationId: activeConversationId });
    };
  }, [socket, activeConversationId]);

  useEffect(() => {
    if (!socket) return;

    const onMessage = ({
      conversationId,
      message,
    }: {
      conversationId: string;
      message: ChatMessage;
    }) => {
      queryClient.setQueryData<ChatMessage[]>(['chat', 'messages', conversationId], (old) => {
        if (!old) return old; // thread not loaded — the list invalidation below refetches
        if (old.some((m) => m.id === message.id)) return old; // already have it
        // Reconcile our own optimistic echo: drop a still-"sending" copy of the
        // same message from us — the server's real one replaces it.
        const withoutOptimistic = old.filter(
          (m) =>
            !(
              m.status === 'sending' &&
              m.senderId === message.senderId &&
              m.kind === message.kind &&
              (m.text ?? '') === (message.text ?? '') &&
              (m.url ?? '') === (message.url ?? '')
            ),
        );
        return [...withoutOptimistic, message];
      });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    };

    const onRead = ({ conversationId }: { conversationId: string; readerId: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
    };

    const onTyping = ({
      conversationId,
      isTyping,
    }: {
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      setTypingConvs((prev) => ({ ...prev, [conversationId]: isTyping }));
      window.clearTimeout(typingTimers.current[conversationId]);
      if (isTyping) {
        // Safety net: auto-clear if the "stopped typing" event never arrives.
        typingTimers.current[conversationId] = window.setTimeout(() => {
          setTypingConvs((prev) => ({ ...prev, [conversationId]: false }));
        }, 4000);
      }
    };

    const onPresence = () => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:read', onRead);
    socket.on('chat:typing', onTyping);
    socket.on('presence:update', onPresence);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:read', onRead);
      socket.off('chat:typing', onTyping);
      socket.off('presence:update', onPresence);
    };
  }, [socket, queryClient]);

  const emitTyping = (conversationId: string, isTyping: boolean) => {
    socket?.emit('chat:typing', { conversationId, isTyping });
  };

  return {
    typing: activeConversationId ? !!typingConvs[activeConversationId] : false,
    emitTyping,
  };
}
