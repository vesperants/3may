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

import ChatHeader from '@/components/ChatHeader';
import ChatInputArea from '@/components/ChatInputArea';
import ChatShelf from '@/components/ChatShelf';
import ChatMessageList from '@/components/ChatMessageList';
import { Case } from '@/components/CaseResultList';
import { formatSelectedCasesQuery } from '@/services/caseParser';

/* ---------- types ---------- */
interface Message {
  sender: 'user' | 'bot';
  text: string;
  id: string;
  timestamp: Date;
  cases?: Case[];
  selectedCases?: Case[];
  wordsBatches?: string[][];
}

interface ConversationMeta {
  id: string;
  title: string;
  updatedAt?: string;
}

// Define an interface for agent request body
interface AgentRequestBody {
  message: string;
  cid: string;
  selectedCaseIds?: string[];
}

/* ------------------------------------------------------------------ */
export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
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
  
  // Debug state to track loading process
  const [loadingState, setLoadingState] = useState('initializing');

  const [selectedCases, setSelectedCases] = useState<{messageId: string, cases: Case[]} | null>(null);

  /* refs */
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const convLoaded = useRef(false);
  const stopTypingRef = useRef(false);

  /* helper fetch */
  const authFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    if (!user) {
      console.error('authFetch called with no user');
      throw new Error('Authentication required');
    }
    
    try {
      console.log(`authFetch: Fetching ${url}`);
      const token = await user.getIdToken();
      
      if (!token) {
        console.error('Failed to get ID token');
        throw new Error('Authentication token error');
      }
      
      return fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      });
    } catch (error) {
      console.error('authFetch error:', error);
      throw error;
    }
  }, [user]);

  /* load conversations once */
  const loadConversations = useCallback(async () => {
    if (!user || convLoaded.current) return;
    
    setLoadingState('loading-conversations');
    try {
      const res = await authFetch('/api/agent/conversations');
      if (!res.ok) { 
        setError('conv list error'); 
        setLoadingState('error-loading-conversations');
        return; 
      }
      
      const list: ConversationMeta[] = (await res.json()).conversations || [];
      setConversationList(list);

      if (!list.length) {
        setLoadingState('creating-conversation');
        await createConversation();
      }
      else {
        setActiveCid(prev => prev ?? list[0].id);
      }

      convLoaded.current = true;
      setLoadingState('conversations-loaded');
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
      setLoadingState('error-loading-conversations');
    }
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
    if (!user || !activeCid) {
      console.log("fetchHistory: Missing user or activeCid");
      return;
    }
    
    if (historyLoading) {
      console.log("fetchHistory: Already loading history");
      return;
    }
    
    console.log(`fetchHistory: Starting to fetch history for cid=${activeCid}`);
    setHistoryLoading(true);
    setMessages([]);
    setLoadingState('loading-history');
    
    try {
      const res = await authFetch(`/api/agent/history?cid=${encodeURIComponent(activeCid)}`);
      
      if (!res.ok) {
        throw new Error(`History request failed with status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log(`fetchHistory: Received ${data.history?.length || 0} messages`);
      
      // Convert history items to Message format with proper timestamps
      const history = (data.history || []).map((item: { sender: string; text: string; id: string; timestamp?: string }) => ({
        ...item,
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date()
      }));
      
      setMessages(history);
      setLoadingState('history-loaded');
    } catch (e) { 
      console.error("fetchHistory error:", e);
      setError(e instanceof Error ? e.message : 'Failed to load conversation history'); 
      setLoadingState('history-error');
    } finally { 
      setHistoryLoading(false);
    }
  }, [user, activeCid, authFetch]);

  /* send user message */
  const handleSendMessage = async (txt: string) => {
    if (!user || !activeCid || !txt.trim() || isSending) return;

    const clean = txt.trim();
    setIsSending(true); setError(null);
    const now = new Date();

    // Add the user message to the chat
    const userMsgId = `u-${Date.now()}`;
    setMessages(p => [
      ...p,
      { sender: 'user', text: clean, id: userMsgId, timestamp: now },
    ]);
    setInputMsg('');

    // Default behavior for all messages
    const thinkingId = `thinking-${Date.now()}`;
    setMessages(p => [
      ...p,
      { sender: 'bot', text: '...', id: thinkingId, timestamp: now },
    ]);

    try {
      // Prepare request body with message and conversation ID
      const requestBody: AgentRequestBody = { message: clean, cid: activeCid };

      // Find if there are any selected cases to include
      const messageWithSelectedCases = [...messages].reverse().find(
        msg => msg.sender === 'bot' && msg.selectedCases && msg.selectedCases.length > 0
      );
      
      if (messageWithSelectedCases?.selectedCases?.length) {
        // Include the selected case IDs in the request
        requestBody.selectedCaseIds = messageWithSelectedCases.selectedCases.map(c => c.id);
        console.log('====== SELECTED CASES DEBUG ======');
        console.log('Found message with selected cases:', messageWithSelectedCases.id);
        console.log('Selected cases IDs:', requestBody.selectedCaseIds);
        console.log('Selected cases data:', JSON.stringify(messageWithSelectedCases.selectedCases));
        console.log('User query:', clean);
        
        // Add more detailed logging with case titles
        if (messageWithSelectedCases.selectedCases.length > 0) {
          console.log('Selected case details:');
          messageWithSelectedCases.selectedCases.forEach((c, i) => {
            console.log(`${i+1}. ID: ${c.id}, Title: ${c.title}`);
          });
        }
        console.log('==================================')
      } else {
        console.log('====== NO SELECTED CASES ======');
        console.log('No selected cases found in recent messages');
        console.log('Total messages:', messages.length);
        // Log the last 3 messages to help debug
        const lastMessages = messages.slice(-3);
        console.log('Last 3 messages:');
        lastMessages.forEach((msg, i) => {
          console.log(`Message ${i+1}:`, {
            id: msg.id,
            sender: msg.sender,
            hasSelectedCases: !!msg.selectedCases,
            selectedCount: msg.selectedCases?.length || 0
          });
        });
        console.log('==============================')
      }

      // Send the request to the backend
      const res = await authFetch('/api/agent', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      setMessages(p => p.filter(m => m.id !== thinkingId));

      if (!res.ok) throw new Error('agent error');
      const data = await res.json();
      
      // Log the raw response for debugging
      console.log('==== BOT RESPONSE START ====');
      console.log('Response type:', typeof data.reply);
      console.log('Response raw content:', data.reply);
      try {
        // Check if it's valid JSON
        if (typeof data.reply === 'string' && (data.reply.startsWith('{') || data.reply.includes('"type":'))) {
          console.log('Attempting to parse as JSON...');
          const jsonData = JSON.parse(data.reply);
          console.log('Successfully parsed as JSON:', jsonData);
        }
      } catch (error) {
        console.log('Not valid JSON:', error);
      }
      console.log('==== BOT RESPONSE END ====');
      
      setMessages(p => [
        ...p,
        { sender: 'bot', text: data.reply, id: `b-${Date.now()}`, timestamp: new Date() },
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

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setMessages(p => p.filter(m => m.id !== thinkingId));
    } finally {
      setIsSending(false);
    }
  };

  /* scroll */
  useLayoutEffect(() => {
    if (!historyLoading) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, historyLoading]);

  /* Helper for debugging */
  useEffect(() => {
    console.log(`Chat page loading state: ${loadingState}`);
  }, [loadingState]);

  /* effects */
  useEffect(() => { 
    if (authLoading) {
      setLoadingState('auth-loading');
      return;
    }
    
    if (!user) {
      setLoadingState('no-user');
      router.replace('/login');
      return;
    }
    
    if (!user.emailVerified) {
      setLoadingState('email-not-verified');
      router.replace('/login');
      return;
    }
    
    setLoadingState('auth-complete');
    loadConversations();
  }, [authLoading, user, router, loadConversations]);

  /* fetch history - only when we have an active conversation */
  useEffect(() => { 
    if (activeCid) {
      setLoadingState('fetching-history');
      fetchHistory();
    }
  }, [activeCid, fetchHistory]);

  /* Create timeout to prevent infinite loading */
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (historyLoading) {
        console.log('History loading taking too long, forcing state to complete');
        setHistoryLoading(false);
        setLoadingState('history-timeout');
      }
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timeoutId);
  }, [historyLoading]);

  /* Handle case selection */
  const handleCaseSelection = (messageId: string, cases: Case[]) => {
    if (cases.length > 0) {
      setSelectedCases({ messageId, cases });
    } else {
      setSelectedCases(null);
    }
  };

  /* Create a query from selected cases */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const submitSelectedCasesQuery = () => {
    if (selectedCases?.cases.length) {
      const query = formatSelectedCasesQuery(selectedCases.cases);
      if (query) {
        handleSendMessage(query);
        setSelectedCases(null);
      }
    }
  };

  /* ---------------------------- UI --------------------------- */
  
  // Show different loading states
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 text-gray-600">
        Authenticating...
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 text-gray-600">
        Please log in to continue
      </div>
    );
  }
  
  if (historyLoading && loadingState === 'loading-history') {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <div className="relative">
          <ChatHeader title="Stirsat">
            {/* Optional children content */}
          </ChatHeader>
        </div>
        
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center p-4">
            <p className="text-gray-600 mb-2">Loading conversation history...</p>
            <div className="w-8 h-8 border-t-2 border-blue-500 rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* header */}
      <div>
        <button
          onClick={() => setShelfOpen(o => !o)}
          aria-label="Open conversations"
          className="fixed left-3 top-3 z-[1001] rounded p-2 text-gray-600 transition hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        >
          {/* Optional children content */}
        </ChatHeader>
      </div>

      {error && (
        <div className="bg-red-100 p-2 text-center text-sm text-red-700">
          {error}
          <button 
            className="ml-2 underline text-red-800"
            onClick={() => {
              setError(null);
              if (activeCid) fetchHistory();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-50 p-1 text-xs text-gray-500 text-center">
          State: {loadingState} | History loading: {historyLoading ? 'true' : 'false'} | Messages: {messages.length}
        </div>
      )}

      {/* messages */}
      <div className="flex flex-1 flex-col items-center justify-end px-2 relative">
        <div className="mx-auto w-full max-w-[920px] flex-1 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto py-4 pb-[100px]">
            {activeCid && !historyLoading && messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No messages yet. Start a conversation!
              </div>
            )}
            
            {!historyLoading && messages.length > 0 && (
              <ChatMessageList
                chatHistory={messages}
                isBotReplying={isSending}
                stopTypingRef={stopTypingRef}
                chatContainerRef={bottomRef}
                onCaseSelection={handleCaseSelection}
                onCaseSelectionSubmit={(messageId, cases) => {
                  if (cases.length > 0) {
                    const query = formatSelectedCasesQuery(cases);
                    if (query) {
                      handleSendMessage(query);
                      setSelectedCases(null);
                    }
                  }
                }}
              />
            )}

            <div ref={bottomRef} className="h-px" />
          </div>

          {/* input */}
          <div className="fixed bottom-6 left-0 right-0 py-4">
            <div className="absolute inset-0 bg-white"></div>
            <div className="mx-auto w-full max-w-[920px] px-4 relative">
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