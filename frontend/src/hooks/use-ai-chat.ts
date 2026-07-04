'use client';

import { useCallback, useState } from 'react';
import { apiPost } from '@/lib/api';
import { AiChatMessage, AiChatResponse } from '@/lib/module-types';

const MAX_MESSAGES = 10;

export function useAiChat() {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<AiChatResponse['source'] | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);

  const send = useCallback(
    async (content: string, options?: { locale?: string; intent?: string }) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      setLoading(true);
      setError(null);
      const next = [...messages, { role: 'user' as const, content: trimmed }].slice(-MAX_MESSAGES);
      setMessages(next);
      try {
        const res = await apiPost<AiChatResponse>('/ai/chat', {
          messages: next,
          locale: options?.locale,
          intent: options?.intent,
        });
        setMessages(res.messages.slice(-MAX_MESSAGES));
        setLastSource(res.source);
        setLastModel(res.model);
        return res;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send');
        setMessages((m) => m.slice(0, -1));
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [messages],
  );

  const clear = useCallback(() => {
    setMessages([]);
    setLastSource(null);
    setLastModel(null);
  }, []);

  return { messages, loading, error, send, clear, lastSource, lastModel };
}
