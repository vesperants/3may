// src/app/chat/page.tsx
'use client';
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext"; // Adjust path if needed
// Assuming simple components for Header and Input. Replace with your actual imports.
// import ChatHeader from "@/components/ChatHeader";
// import ChatInputArea from "@/components/ChatInputArea";

// --- Mock Components (Replace with your actual components) ---
const ChatHeader = ({ title, userEmail, onSignOut }: { title: string, userEmail: string, onSignOut: () => void }) => (
    <header className="flex items-center justify-between p-4 border-b bg-gray-100">
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{userEmail}</span>
            <button onClick={onSignOut} className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">Sign Out</button>
        </div>
    </header>
);

interface ChatInputAreaProps {
    message: string;
    setMessage: (value: string) => void;
    onSendMessage: (message: string) => Promise<void>;
    isLoading: boolean;
    placeholder?: string;
}
const ChatInputArea = React.forwardRef<HTMLTextAreaElement, ChatInputAreaProps>(
    ({ message, setMessage, onSendMessage, isLoading, placeholder = "Type your message..." }, ref) => {

    const handleSendClick = () => {
        if (message.trim() && !isLoading) {
            onSendMessage(message.trim());
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
            e.preventDefault();
            handleSendClick();
        }
    };

    // Basic auto-resize logic
    useEffect(() => {
        const textarea = ref && 'current' in ref ? ref.current : null;
        if (textarea) {
            textarea.style.height = 'auto'; // Reset height
            textarea.style.height = `${textarea.scrollHeight}px`; // Set to scroll height
        }
    }, [message, ref]);


    return (
        <div className="flex items-end space-x-2"> {/* Use items-end */}
            <textarea
                ref={ref}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-1 border rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-y-auto max-h-32" // Added max-h
                rows={1}
                placeholder={placeholder}
            />
            <button
                onClick={handleSendClick}
                disabled={isLoading || !message.trim()}
                className={`px-4 py-2 rounded-md text-white self-end mb-px ${ // Align button baseline
                    (isLoading || !message.trim())
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
                {isLoading ? (
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                ) : 'Send'}
            </button>
        </div>
    );
});
ChatInputArea.displayName = 'ChatInputArea';
// --- End Mock Components ---


interface Message {
  sender: 'user' | 'bot';
  text: string;
  id: string; // Required for React keys
}

export default function ChatPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState(''); // Input field state
  const [messages, setMessages] = useState<Message[]>([]); // Chat messages
  const [historyLoading, setHistoryLoading] = useState(true); // Loading state for history fetch
  const [isSending, setIsSending] = useState(false); // Loading state for sending message
  const [error, setError] = useState<string | null>(null); // Error message state for display

  const textareaRef = useRef<HTMLTextAreaElement>(null); // Ref for input area
  const messagesEndRef = useRef<HTMLDivElement>(null); // Ref to scroll to bottom


  // --- Authentication Guard ---
  useEffect(() => {
    console.log(`ChatPage Effect (Auth Guard): Auth Loading: ${authLoading}, User: ${user?.uid || 'null'}`);
    if (!authLoading) { // Only check/redirect when auth state is resolved
        if (!user) {
            console.log("ChatPage Effect (Auth Guard): User not logged in. Redirecting to /login.");
            router.replace('/login');
        } else if (!user.emailVerified) {
            // Decide action for unverified email (e.g., redirect or show message)
            console.warn("ChatPage Effect (Auth Guard): User logged in but email not verified. Redirecting to /login (or verification page).");
            // You might redirect to a specific verification page instead
            router.replace('/login');
        } else {
             console.log("ChatPage Effect (Auth Guard): User authenticated and verified.");
        }
    }
  }, [user, authLoading, router]);

  // --- Scroll to Bottom ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Use useLayoutEffect for scrolling after DOM mutations but before paint
  useLayoutEffect(() => {
    // Only scroll if not loading history (prevents jumping on initial load)
    if (!historyLoading) {
        scrollToBottom();
    }
  }, [messages, historyLoading]); // Scroll whenever messages change OR history finishes loading

  // --- Fetch History ---
  const fetchHistory = useCallback(async () => {
    // Ensure user is loaded and verified before fetching
    if (!user || !user.emailVerified || authLoading) {
      console.log("fetchHistory: Skipping fetch - user not ready or verified.");
       // If the user is definitively not logged in after loading, ensure history is clear.
       if(!user && !authLoading) {
           setMessages([]);
           setHistoryLoading(false); // Stop loading if no user
           setError(null);
       }
      return;
    }

    const userId = user.uid; // Capture user ID at the start of the fetch
    console.log(`fetchHistory: Starting for user ${userId}...`);
    setHistoryLoading(true);
    setError(null); // Clear previous errors
    setMessages([]); // Clear existing messages before loading history

    try {
      console.log("fetchHistory: Getting ID token (force refresh)...");
      // Force refresh might be needed if token expired, but can be slower. Use cautiously.
      // const idToken = await user.getIdToken(true);
      const idToken = await user.getIdToken(); // Get current token
      console.log("fetchHistory: Token acquired. Fetching /api/agent/history...");

      const response = await fetch('/api/agent/history', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json', // Good practice, though GET has no body
        },
        cache: 'no-store', // Prevent caching of history requests
      });

      console.log(`fetchHistory: Received response status: ${response.status}`);

      if (!response.ok) {
        let errorMsg = `Failed to fetch history: ${response.statusText} (Status: ${response.status})`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg; // Use 'error' field from history API error structure
            console.error(`fetchHistory: API error response body:`, errorData);
        } catch (_) {
            console.error(`fetchHistory: Could not parse error response body.`);
         }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log(`fetchHistory: Received history data (messages count: ${data.history?.length ?? 0})`);

      if (data.history && Array.isArray(data.history)) {
          // Ensure messages have unique IDs and correct structure
          const formattedHistory: Message[] = data.history.map((msg: any, index: number) => ({
              sender: msg.sender === 'user' ? 'user' : 'bot', // Validate sender
              text: typeof msg.text === 'string' ? msg.text : '[Invalid message content]', // Validate text
              id: msg.id && typeof msg.id === 'string' ? msg.id : `hist-${userId}-${index}-${Date.now()}` // Ensure ID exists and is string
          }));
          setMessages(formattedHistory);
          console.log("fetchHistory: History loaded and set to state.");
      } else {
          console.warn("fetchHistory: Received invalid history data format or empty history field. Setting empty messages.");
          setMessages([]); // Start fresh if no history field or invalid format
      }

    } catch (err) {
      console.error("❌ fetchHistory: Error during fetch operation:", err);
      const errorString = err instanceof Error ? err.message : 'An unknown error occurred while loading history.';
      setError(errorString);
      setMessages([]); // Clear messages on error
    } finally {
      console.log("fetchHistory: Finished.");
      setHistoryLoading(false);
    }
  }, [user, authLoading]); // Depend on user and authLoading

  // Trigger history fetch when user becomes available and verified
  useEffect(() => {
    console.log("ChatPage Effect (History Fetch Trigger): Checking conditions...");
    fetchHistory();
  }, [fetchHistory]); // Rerun fetchHistory if the user object changes


  // --- Send Message ---
  const handleSendMessage = async (userMessageText: string) => {
    if (!user || !user.emailVerified || !userMessageText.trim() || isSending) {
      console.log("handleSendMessage: Skipping - Conditions not met (no user/verified, empty message, or already sending).");
      return;
    }

    const trimmedMessage = userMessageText.trim();
    const userId = user.uid; // Capture user ID
    console.log(`handleSendMessage: Starting for user ${userId} with message: "${trimmedMessage.substring(0,50)}..."`);
    setIsSending(true);
    setError(null); // Clear previous errors on new send attempt

    // Add user message locally immediately for responsiveness
    const newUserMessage: Message = {
      text: trimmedMessage,
      sender: 'user',
      id: `user-${userId}-${Date.now()}` // More unique local ID
    };
    setMessages(prev => [...prev, newUserMessage]);
    setMessage(''); // Clear input field

    // Add a temporary "thinking" message for the bot
    const thinkingMessageId = `bot-thinking-${userId}-${Date.now()}`;
    const thinkingMessage: Message = { text: '...', sender: 'bot', id: thinkingMessageId };
    // Use a state updater function to ensure we're working with the latest messages array
    setMessages(prev => [...prev, thinkingMessage]);


    try {
      console.log("handleSendMessage: Getting ID token...");
      const idToken = await user.getIdToken();
      console.log("handleSendMessage: Token acquired. Posting to /api/agent...");

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      console.log(`handleSendMessage: Received response status: ${response.status}`);

       // --- Remove the "thinking" message ---
       // Use functional update to ensure atomicity with potential rapid state changes
       setMessages(prev => prev.filter(m => m.id !== thinkingMessageId));


      if (!response.ok) {
        let errorMsg = `Agent error: ${response.statusText} (Status: ${response.status})`;
         try {
            const errorData = await response.json();
            // Use 'reply' field from API error structure if available
            errorMsg = errorData.reply && typeof errorData.reply === 'string' ? errorData.reply : errorMsg;
            console.error(`handleSendMessage: API error response body:`, errorData);
         } catch (_) {
            console.error(`handleSendMessage: Could not parse error response body.`);
          }
        throw new Error(errorMsg);
      }

      const data = await response.json();

       // Check if the reply is valid
       const botReplyText = data.reply && typeof data.reply === 'string' ? data.reply : "[Agent returned invalid response]";
       console.log(`handleSendMessage: Received agent reply: "${botReplyText.substring(0,100)}..."`);

      // Add bot reply
      const newBotMessage: Message = {
        text: botReplyText,
        sender: 'bot',
        id: `bot-${userId}-${Date.now()}`
      };
      // Use functional update
       setMessages(prev => [...prev, newBotMessage]);
       console.log("handleSendMessage: Bot reply added to state.");

    } catch (err) {
      console.error("❌ handleSendMessage: Error sending message or receiving reply:", err);
       const errorText = err instanceof Error ? err.message : 'Could not get reply due to an unknown error.';
       setError(errorText); // Set error state to display globally

       // Optionally add an error message directly into the chat as a bot message
       const errorBotMessage: Message = {
         text: `Error: ${errorText}`,
         sender: 'bot',
         id: `bot-error-${userId}-${Date.now()}`
       };
        // Use functional update, ensure thinking message was removed if error happened after removal attempt
       setMessages(prev => {
            const withoutThinking = prev.filter(m => m.id !== thinkingMessageId);
            return [...withoutThinking, errorBotMessage];
       });

    } finally {
      console.log("handleSendMessage: Finished.");
      setIsSending(false);
       // Refocus the textarea after sending/error
       textareaRef.current?.focus();
    }
  };


  // --- Render Logic ---

  // Show main loader during initial auth check OR initial history load
  if (authLoading || (!user && historyLoading)) { // Show loader if auth is loading, or if history is loading and we don't have user context yet
    console.log("ChatPage Render: Auth Loading or Initial History Loading...");
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-gray-600 text-lg flex items-center space-x-2">
            <span className="animate-spin inline-block w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full"></span>
            <span>Loading Chat...</span>
        </div>
      </div>
    );
  }

  // If effect hasn't redirected yet, and user is null/unverified after loading, show minimal state or null
  // This state should be brief as the redirect effect should trigger.
  if (!user || !user.emailVerified) {
     console.log("ChatPage Render: User not ready or verified (post-loading). Rendering null (redirect should be imminent).");
    return (
         <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="text-gray-500">Redirecting...</div>
         </div>
    ); // Render minimal state or null while redirect occurs
  }

  // User is authenticated and verified, show chat interface
  console.log(`ChatPage Render: Rendering chat for user ${user.uid}. History Loading: ${historyLoading}, Sending: ${isSending}`);
  return (
    // Use h-screen and overflow-hidden on the outermost div to contain layout
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      <ChatHeader
        title="Persistent Chat"
        userEmail={user.email || 'User'} // Show user email
        onSignOut={async () => {
          console.log("ChatPage: Sign out button clicked.");
          try {
              await signOut();
              // Redirect logic is handled by the useEffect guard watching the user state
              console.log("ChatPage: Sign out successful, waiting for redirect.");
          } catch (error) {
               console.error("ChatPage: Error during sign out process:", error);
               setError("Failed to sign out. Please try again."); // Show error to user
          }
        }}
      />

      {/* Display Global Error Messages */}
       {error && (
           <div className="p-2 text-center text-sm text-red-700 bg-red-100 border-b border-red-200">
             {error}
           </div>
       )}

      {/* Chat Message Area */}
      {/* flex-1 and overflow-y-auto are key for scrolling */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 mb-2">
        {/* Show history loading indicator inside the chat area */}
        {historyLoading && (
          <div className="flex justify-center items-center py-10">
            <div className="text-gray-500 flex items-center space-x-2">
                 <span className="animate-spin inline-block w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full"></span>
                 <span>Loading history...</span>
             </div>
          </div>
        )}

        {/* Show messages only when history is not loading */}
        {!historyLoading && messages.length === 0 && !error && (
           <div className="flex justify-center items-center h-full">
             <div className="text-gray-400 italic">Conversation history is empty. Send a message to start!</div>
           </div>
        )}

        {!historyLoading && messages.map(m =>
          <div
            key={m.id} // Use the message ID as the key
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`} // Use flex-col for potential timestamp later
          >
            <div className={`inline-block rounded-lg px-3 py-2 max-w-[80%] whitespace-pre-wrap break-words shadow-sm ${ // Adjusted padding/max-width
              m.sender === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-900'
            }`}>
              {/* Render "thinking" indicator specifically */}
              {m.id.startsWith('bot-thinking') ? (
                 <div className="flex space-x-1 items-center h-5 px-2"> {/* Adjusted height/padding */}
                    <span className="block w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-0"></span>
                    <span className="block w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-150"></span>
                    <span className="block w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-300"></span>
                 </div>
              ) : (
                m.text // Render actual message text
              )}
            </div>
             {/* Optional: Timestamp placeholder */}
             {/* <span className={`text-xs text-gray-400 mt-1 ${m.sender === 'user' ? 'mr-1' : 'ml-1'}`}>Just now</span> */}
          </div>
        )}
         {/* Element used to scroll view to the bottom */}
         <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>

      {/* Input Area fixed at the bottom */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <ChatInputArea
          ref={textareaRef}
          message={message}
          setMessage={setMessage}
          onSendMessage={handleSendMessage} // Use the combined handler
          isLoading={isSending} // Pass loading state
          placeholder="Type your message here..."
        />
      </div>
    </div>
  );
}