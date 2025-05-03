'use client';
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

import ChatHeader    from '@/components/ChatHeader';
import ChatInputArea from '@/components/ChatInputArea';
import ChatShelf     from '@/components/ChatShelf';

/* ---------- types ---------- */
interface Message {
  sender: 'user' | 'bot';
  text: string;
  id: string;
}
interface ConversationMeta {
  id: string;
  title: string;
  updatedAt?: string;
}

/* ------------------------------------------------------------------ */
export default function ChatPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  /* state */
  const [conversationList, setConversationList] = useState<ConversationMeta[]>([]);
  const [activeCid, setActiveCid] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShelfOpen, setShelfOpen] = useState(false);
  const [inputMsg, setInputMsg] = useState('');

  /* refs */
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const convLoaded  = useRef(false);

  /* helper fetch */
  const authFetch = async (url: string, init: RequestInit = {}) => {
    if (!user) throw new Error('no user');
    const token = await user.getIdToken();
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
  };

  /* load conversations once */
  const loadConversations = useCallback(async () => {
    if (!user || convLoaded.current) return;
    const res = await authFetch('/api/agent/conversations');
    if (!res.ok) { setError('conv list error'); return; }
    const list: ConversationMeta[] = (await res.json()).conversations || [];
    setConversationList(list);

    if (!list.length) await createConversation();
    else setActiveCid(prev => prev ?? list[0].id);

    convLoaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* create conversation */
  const createConversation = useCallback(async () => {
    if (!user) return;
    const res = await authFetch('/api/agent/conversations', { method: 'POST' });
    if (!res.ok) { setError('create conv error'); return; }
    const data = await res.json();
    const meta: ConversationMeta = { id: data.id, title: data.title };
    setConversationList(p => [meta, ...p]);
    setActiveCid(meta.id);
  }, [user]);

  /* delete conversation */
  const deleteConversation = useCallback(async (cid: string) => {
    if (!user) return;
    const res = await authFetch(`/api/agent/conversations/${cid}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) { setError('delete conv error'); return; }
    setConversationList(p => p.filter(c => c.id !== cid));
    if (activeCid === cid) { setActiveCid(null); setMessages([]); }
  }, [user, activeCid]);

  /* fetch history */
  const fetchHistory = useCallback(async () => {
    if (!user || !activeCid || historyLoading) return;
    setHistoryLoading(true);
    setMessages([]);
    try {
      const res = await authFetch(`/api/agent/history?cid=${encodeURIComponent(activeCid)}`);
      if (!res.ok) throw new Error('history error');
      const data = await res.json();
      setMessages(data.history || []);
    } catch (e: any) { setError(e.message); }
    finally { setHistoryLoading(false); }
  }, [user, activeCid]);

  /* send user message */
  const handleSendMessage = async (txt: string) => {
    if (!user || !activeCid || !txt.trim() || isSending) return;

    const clean = txt.trim();
    setIsSending(true); setError(null);

    const thinkingId = `thinking-${Date.now()}`;
    setMessages(p => [
      ...p,
      { sender: 'user', text: clean, id: `u-${Date.now()}` },
      { sender: 'bot',  text: '...', id: thinkingId },
    ]);
    setInputMsg('');

    try {
      const res = await authFetch('/api/agent', {
        method: 'POST',
        body: JSON.stringify({ message: clean, cid: activeCid }),
      });
      setMessages(p => p.filter(m => m.id !== thinkingId));

      if (!res.ok) throw new Error('agent error');
      const data = await res.json();
      setMessages(p => [
        ...p,
        { sender: 'bot', text: data.reply, id: `b-${Date.now()}` },
      ]);

      /* refresh conversation title locally if still placeholder */
      setConversationList(list =>
        list.map(c =>
          c.id === activeCid &&
          (c.title.startsWith('New Chat') || c.title.startsWith('Untitled'))
            ? { ...c, title: clean.slice(0, 30) }
            : c,
        ),
      );

    } catch (e: any) { setError(e.message); }
    finally { setIsSending(false); textareaRef.current?.focus(); }
  };

  /* scroll */
  useLayoutEffect(() => {
    if (!historyLoading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, historyLoading]);

  /* effects */
  useEffect(() => { if (!authLoading && user) loadConversations(); },
    [authLoading, user, loadConversations]);

  useEffect(() => { if (activeCid) fetchHistory(); }, [activeCid, fetchHistory]);

  useEffect(() => { if (!authLoading && (!user || !user.emailVerified)) router.replace('/login'); },
    [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 text-gray-600">
        Loading…
      </div>
    );
  }

  const inputDisabled = isSending || !activeCid;

  /* ---------------------------- UI --------------------------- */
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* header */}
      <div className="relative">
        <button
          onClick={() => setShelfOpen(o => !o)}
          aria-label="Open conversations"
          className="absolute left-3 top-3 z-20 rounded p-2 text-gray-600 transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <ChatHeader
          title="Stirsat"                    
          userEmail={user?.email || ''}
          onSignOut={signOut}
          onProfileClick={() => {}}
          onEditProfile={() => {}}
          isShelfOpen={isShelfOpen}
          avatarButtonRef={React.createRef<HTMLButtonElement>()}
        />
      </div>

      {error && (
        <div className="bg-red-100 p-2 text-center text-sm text-red-700">{error}</div>
      )}

      {/* messages */}
      <div className="flex flex-1 flex-col items-center justify-end px-2">
        <div className="mx-auto flex w-full max-w-[920px] flex-1 flex-col">
          <div className="flex-1 overflow-y-auto py-4 pb-[100px]">
            {historyLoading && (
              <div className="text-center text-gray-500">Loading history…</div>
            )}

            {!historyLoading &&
              messages.map(m => (
                <div
                  key={m.id}
                  className={`mb-2 flex ${
                    m.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <span
                    className={`inline-block max-w-[80%] whitespace-pre-wrap break-words rounded-lg px-4 py-2 shadow-sm ${
                      m.sender === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    {m.id.startsWith('thinking-') ? '…' : m.text}
                  </span>
                </div>
              ))}

            <div ref={bottomRef} className="h-px" />
          </div>

          {/* input */}
          <div className="fixed bottom-0 left-0 right-0 border-t bg-gray-50 py-4">
            <div className="mx-auto w-full max-w-[920px] px-4">
              <ChatInputArea
                ref={textareaRef}
                message={inputMsg}
                setMessage={setInputMsg}
                selectedFiles={[]}
                removeSelectedFile={() => {}}
                handleFileChange={() => {}}
                placeholder="Type your message…"
                onUserSend={handleSendMessage}
                onBotReply={() => {}}
                isLoading={inputDisabled}
              />
            </div>
          </div>
        </div>
      </div>

      {/* shelf */}
      <ChatShelf
        isOpen={isShelfOpen}
        onClose={() => setShelfOpen(false)}
        conversationList={conversationList}
        activeConversationId={activeCid}
        onSelectConversation={id => setActiveCid(id)}
        onNewConversation={createConversation}
        onDeleteConversation={deleteConversation}
      />
    </div>
  );
}