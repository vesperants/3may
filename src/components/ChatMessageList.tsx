// src/app/components/ChatMessageList.tsx
import React, { useEffect } from 'react';
import styles from '@/app/chat/chat.module.css'; // Shared chat styles (user/bot bubbles, etc.)
import listStyles from './ChatMessageList.module.css'; // Component-specific styles

// Shared chat message model (align with page.tsx)
interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  id?: string;
  wordsBatches?: any; // For bot message batching/fading, optional
}

interface ChatMessageListProps {
  chatHistory: ChatMessage[];
  showCanvas?: boolean;
  isBotReplying: boolean;
  stopTypingRef: React.RefObject<boolean>;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  renderBotMessage?: (msg: ChatMessage) => React.ReactNode;
}

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  chatHistory,
  showCanvas = false,
  isBotReplying,
  stopTypingRef,
  chatContainerRef,
  renderBotMessage
}) => {
  // Scroll to the bottom on new message
  useEffect(() => {
    if (chatContainerRef?.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isBotReplying, chatContainerRef]);

  const messageWrapperClass = `
    ${listStyles.messageWrapper}
    ${showCanvas ? listStyles.messageWrapperCanvas : ''}
  `;

  return (
    <div ref={chatContainerRef} className={listStyles.scrollContainer}>
      <div className={messageWrapperClass.trim()}>
        {chatHistory.map((chat, index) => {
          const isUser = chat.sender === 'user';
          const messageRowClass = `
            ${listStyles.messageRow}
            ${isUser ? listStyles.messageRowUser : listStyles.messageRowBot}
          `;

          return (
            <div key={chat.id || index} className={messageRowClass.trim()}>
              <div className={isUser ? styles.userMessageBubble : styles.botMessageBubble}>
                {isUser ? (
                  <span>{chat.text}</span>
                ) : renderBotMessage ? (
                  renderBotMessage(chat)
                ) : (
                  <span>{chat.text}</span>
                )}
              </div>
            </div>
          );
        })}
        {/* Typing indicator */}
        {isBotReplying && !stopTypingRef.current && chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.sender === 'bot' && (
          <div className={listStyles.typingIndicatorWrapper}>
            <p className={`${styles.messageText} ${listStyles.typingIndicatorText}`}>
              Typing...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessageList;