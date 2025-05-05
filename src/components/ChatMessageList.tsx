// src/app/components/ChatMessageList.tsx
import React, { useEffect } from 'react';
import styles from '@/app/chat/chat.module.css'; // Shared chat styles (user/bot bubbles, etc.)
import listStyles from './ChatMessageList.module.css'; // Component-specific styles
import CaseResultList, { Case } from './CaseResultList';
import { isCaseSearchResult, parseCaseResults, MESSAGE_TYPES } from '@/services/caseParser';

// Shared chat message model (align with page.tsx)
interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  id?: string;
  wordsBatches?: string[][]; // For bot message batching/fading, optional
  cases?: Case[]; // For storing parsed case results
  selectedCases?: Case[]; // For storing selected cases
}

interface ChatMessageListProps {
  chatHistory: ChatMessage[];
  showCanvas?: boolean;
  isBotReplying: boolean;
  stopTypingRef: React.RefObject<boolean>;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  renderBotMessage?: (msg: ChatMessage) => React.ReactNode;
  onCaseSelection?: (messageId: string, selectedCases: Case[]) => void;
  onCaseSelectionSubmit?: (messageId: string, selectedCases: Case[]) => void;
}

// Define a type for the structured case search response
interface CaseSearchResponse {
  type: string;
  text?: string;
  data?: {
    cases?: Case[];
    query?: string;
    totalCount?: number;
    nextPageToken?: string | null;
  };
}

// Helper function to try extracting JSON from text that might be enclosed in markdown or have other formatting
const tryExtractJSON = (text: string): CaseSearchResponse | null => {
  // First try direct parsing
  try {
    if (typeof text === 'string') {
      const json = JSON.parse(text);
      console.log('DEBUG - Successfully parsed JSON directly');
      return json;
    }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    console.log('DEBUG - Direct JSON parsing failed, trying extraction methods');
  }
  
  // Check if it's wrapped in markdown code blocks
  if (text.includes('```json') && text.includes('```')) {
    try {
      const start = text.indexOf('```json') + 7;
      const end = text.indexOf('```', start);
      if (start > 7 && end > start) {
        const jsonStr = text.substring(start, end).trim();
        const json = JSON.parse(jsonStr);
        console.log('DEBUG - Successfully extracted JSON from markdown code block');
        return json;
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      console.log('DEBUG - Failed to extract JSON from markdown');
    }
  } else if (text.includes('```') && text.includes('```')) {
    // Try with just ``` without the json part
    try {
      const start = text.indexOf('```') + 3;
      const end = text.indexOf('```', start);
      if (start > 3 && end > start) {
        const jsonStr = text.substring(start, end).trim();
        const json = JSON.parse(jsonStr);
        console.log('DEBUG - Successfully extracted JSON from generic code block');
        return json;
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      console.log('DEBUG - Failed to extract JSON from generic code block');
    }
  }
  
  // Check for a string with escaped quotes
  if (text.startsWith('"') && text.endsWith('"') && text.includes('\\"')) {
    try {
      const unescaped = text.slice(1, -1).replace(/\\"/g, '"');
      const json = JSON.parse(unescaped);
      console.log('DEBUG - Successfully extracted JSON from escaped string');
      return json;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      console.log('DEBUG - Failed to extract JSON from escaped string');
    }
  }
  
  // Look for JSON-like patterns in the text
  try {
    const jsonPattern = /{[\s\S]*?"type"[\s\S]*?}/g;
    const matches = text.match(jsonPattern);
    if (matches && matches.length > 0) {
      for (const match of matches) {
        try {
          const json = JSON.parse(match);
          console.log('DEBUG - Found and extracted embedded JSON object');
          return json;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          // Try next match
        }
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    console.log('DEBUG - Failed to find JSON-like patterns');
  }
  
  return null;
};

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  chatHistory,
  showCanvas = false,
  isBotReplying,
  stopTypingRef,
  chatContainerRef,
  renderBotMessage,
  onCaseSelection,
  onCaseSelectionSubmit
}) => {
  // Scroll to the bottom on new message
  useEffect(() => {
    if (chatContainerRef?.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isBotReplying, chatContainerRef]);

  // Parse case search results when bot messages are received
  useEffect(() => {
    chatHistory.forEach(message => {
      if (message.sender === 'bot') {
        console.log('DEBUG - Processing bot message:', message.id);
        console.log('DEBUG - Raw message text:', message.text);
        
        // First try to extract any JSON in the text
        const extractedJson = tryExtractJSON(message.text);
        
        if (extractedJson && extractedJson.type === MESSAGE_TYPES.CASE_SEARCH_RESULTS) {
          console.log('DEBUG - Found valid extracted JSON with case search results');
          
          if (extractedJson.data && Array.isArray(extractedJson.data.cases)) {
            console.log('DEBUG - Setting cases from extracted JSON:', extractedJson.data.cases.length);
            message.cases = extractedJson.data.cases;
            return; // Exit early since we've processed this message
          }
        } else {
          console.log('DEBUG - No valid case search results found in extracted JSON');
        }
        
        // Only process messages that don't already have parsed cases
        if (!message.cases) {
          console.log('DEBUG - Checking for case search results in message');
          const isCaseResult = isCaseSearchResult(message.text);
          console.log('DEBUG - Is case search result?', isCaseResult);
          
          if (isCaseResult) {
            console.log('DEBUG - Parsing case results...');
            try {
              const cases = parseCaseResults(message.text);
              console.log('DEBUG - Parsed cases:', cases.length, cases);
              
              if (cases.length > 0) {
                message.cases = cases;
              } else {
                console.log('DEBUG - No cases parsed from text that was identified as case results');
              }
            } catch (error) {
              console.error('DEBUG - Error parsing case results:', error);
            }
          }
        }
      }
    });
  }, [chatHistory]);

  // Handle case selection
  const handleCaseSelection = (messageId: string, selectedCases: Case[]) => {
    if (onCaseSelection) {
      onCaseSelection(messageId, selectedCases);
    }
  };

  // Handle case selection submission
  const handleCaseSelectionSubmit = (messageId: string, selectedCases: Case[]) => {
    if (onCaseSelectionSubmit) {
      onCaseSelectionSubmit(messageId, selectedCases);
    }
  };

  const messageWrapperClass = `
    ${listStyles.messageWrapper}
    ${showCanvas ? listStyles.messageWrapperCanvas : ''}
  `;

  // Render bot message
  const renderMessage = (chat: ChatMessage) => {
    const isUser = chat.sender === 'user';
    
    // If it's a user message, just render the text
    if (isUser) {
      return <span>{chat.text}</span>;
    }
    
    // If there's a custom renderer, use that
    if (renderBotMessage) {
      return renderBotMessage(chat);
    }
    
    // First, try to detect if this is a structured JSON response
    if (typeof chat.text === 'string') {
      try {
        // Check if the text is actually a JSON string
        const jsonData = JSON.parse(chat.text);
        if (jsonData && typeof jsonData === 'object' && jsonData.type === MESSAGE_TYPES.CASE_SEARCH_RESULTS) {
          console.log('DEBUG - Detected structured JSON response with type:', jsonData.type);
          
          // Extract data from the structured response
          if (jsonData.data && Array.isArray(jsonData.data.cases) && jsonData.data.cases.length > 0) {
            const cases = jsonData.data.cases.map((c: { id?: string; title?: string; summary?: string }) => ({
              id: c.id || '',
              title: c.title || '',
              summary: c.summary || ''
            }));
            
            return (
              <div className={listStyles.botMessageContent}>
                <p>{jsonData.text?.split('\n')[0] || 'Case search results:'}</p>
                <CaseResultList 
                  cases={cases} 
                  onSelectionChange={(selectedCases) => {
                    chat.selectedCases = selectedCases;
                    handleCaseSelection(chat.id || '', selectedCases);
                  }}
                  onSubmitSelection={(selectedCases) => {
                    handleCaseSelectionSubmit(chat.id || '', selectedCases);
                  }}
                />
              </div>
            );
          }
        }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        // Not valid JSON or doesn't have expected structure
        console.log('DEBUG - Not a JSON-structured message, continuing with regular parsing');
      }
    }
    
    // If it's a case search result and we have parsed cases
    if (chat.cases && chat.cases.length > 0) {
      console.log('DEBUG - Rendering cases in component:', chat.cases.length);
      
      // Only show the intro text, not the full case list in text form
      let introText = "Case search results";
      
      // Try to extract intro text from the message
      if (chat.text.startsWith('Here are the cases related to your search:')) {
        introText = chat.text.split("\n")[0]; // "Here are the cases related to your search:"
      } else if (chat.text.includes('Here are the cases')) {
        const introMatch = chat.text.match(/^(.*?cases.*?)(?:\n|:)/);
        if (introMatch) {
          introText = introMatch[1];
        }
      }
      
      return (
        <div className={listStyles.botMessageContent}>
          <p>{introText}</p>
          <CaseResultList 
            cases={chat.cases} 
            onSelectionChange={(selectedCases) => {
              chat.selectedCases = selectedCases;
              handleCaseSelection(chat.id || '', selectedCases);
            }}
            onSubmitSelection={(selectedCases) => {
              handleCaseSelectionSubmit(chat.id || '', selectedCases);
            }}
          />
        </div>
      );
    }
    
    // Default: just render the text
    return <span>{chat.text}</span>;
  };

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
                {renderMessage(chat)}
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