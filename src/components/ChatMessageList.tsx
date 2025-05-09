// src/app/components/ChatMessageList.tsx
import React, { useEffect, useState, useRef } from 'react';
import styles from '@/app/chat/chat.module.css'; // Shared chat styles (user/bot bubbles, etc.)
import listStyles from './ChatMessageList.module.css'; // Component-specific styles
import { Case } from './CaseResultList';
import SearchWidget from './SearchWidget';
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

// Replace the current findLatestSearchWidgetMessage function with a more sophisticated one
// that returns both the latest and all active search widget IDs (within 10 messages)
const findActiveSearchWidgets = (messages: ChatMessage[]): { 
  latest: string | null, 
  activeIds: string[] 
} => {
  // Reverse the array to start from the most recent messages
  const reversedMessages = [...messages].reverse();
  
  // Find all search messages
  const searchMessages = reversedMessages.filter(
    msg => msg.sender === 'bot' && msg.cases && msg.cases.length > 0
  );
  
  // Get the latest search message
  const latestSearchMessage = searchMessages[0];
  
  // Initialize result - only the latest widget should be active
  const result = {
    latest: latestSearchMessage?.id || null,
    activeIds: latestSearchMessage?.id ? [latestSearchMessage.id] : [] // Only the latest ID is active
  };
  
  // Set ALL search widget message IDs (for tracking purposes)
  const allSearchWidgetIds = searchMessages.map(msg => msg.id).filter(Boolean) as string[];
  
  // Log for debugging
  if (latestSearchMessage) {
    console.log('Latest search widget ID:', result.latest);
    console.log('All search widget IDs:', allSearchWidgetIds.length);
  }
  
  return result;
};

const ChatMessageList: React.FC<ChatMessageListProps> = ({
  chatHistory,
  showCanvas = false,
  isBotReplying,
  stopTypingRef,
  chatContainerRef,
  renderBotMessage,
  onCaseSelection,
  // Keep this in props but mark as unused
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onCaseSelectionSubmit
}) => {
  // Use a counter to force re-renders when needed
  const [updateCounter, setUpdateCounter] = useState(0);
  
  // Use a ref to track which messages have been processed already
  const processedMsgIds = useRef<Set<string>>(new Set());
  
  // Scroll to the bottom on new message
  useEffect(() => {
    if (chatContainerRef?.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isBotReplying, chatContainerRef, updateCounter]);

  // Process new case search results only once per message
  useEffect(() => {
    let hasUpdates = false;

    chatHistory.forEach(message => {
      // Use message ID or index as identifier
      const msgId = message.id || `msg-${message.timestamp.getTime()}`;
      
      // Only process bot messages we haven't seen yet
      if (message.sender === 'bot' && !processedMsgIds.current.has(msgId)) {
        console.log('DEBUG - Processing new bot message:', msgId);
        
        // First try to extract any JSON in the text
        const extractedJson = tryExtractJSON(message.text);
        
        if (extractedJson && extractedJson.type === MESSAGE_TYPES.CASE_SEARCH_RESULTS) {
          if (extractedJson.data && Array.isArray(extractedJson.data.cases)) {
            message.cases = extractedJson.data.cases;
            hasUpdates = true;
          }
        } else {
          // Check for case search results in text format
          if (!message.cases && isCaseSearchResult(message.text)) {
            try {
              const cases = parseCaseResults(message.text);
              if (cases.length > 0) {
                message.cases = cases;
                hasUpdates = true;
              }
            } catch (error) {
              console.error('DEBUG - Error parsing case results:', error);
            }
          }
        }
        
        // Mark this message as processed
        processedMsgIds.current.add(msgId);
      }
    });

    // Force a re-render if we modified any messages
    if (hasUpdates) {
      setUpdateCounter(prev => prev + 1);
    }
  }, [chatHistory]);

  // Handle search results updates
  const handleSearchResults = (messageId: string, newCases: Case[]) => {
    // Find and update the message
    const message = chatHistory.find(msg => msg.id === messageId);
    if (message) {
      message.cases = newCases;
      // Force re-render
      setUpdateCounter(prev => prev + 1);
    }
  };

  // Handle case selection
  const handleCaseSelection = (messageId: string, selectedCases: Case[]) => {
    if (onCaseSelection) {
      onCaseSelection(messageId, selectedCases);
    }
    
    // Find and update the message
    const message = chatHistory.find(msg => msg.id === messageId);
    if (message) {
      message.selectedCases = selectedCases;
      // Force re-render
      setUpdateCounter(prev => prev + 1);
    }
  };

  // Extract query from the message text
  const extractQuery = (text: string): string => {
    const queryMatches = [
      /cases related to (.*?)(?:\.|\?|$)/i,
      /search for (.*?)(?:\.|\?|$)/i, 
      /find cases about (.*?)(?:\.|\?|$)/i,
      /cases about (.*?)(?:\.|\?|$)/i
    ];
    
    for (const pattern of queryMatches) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    return '';
  };

  const messageWrapperClass = `
    ${listStyles.messageWrapper}
    ${showCanvas ? listStyles.messageWrapperCanvas : ''}
  `;

  // Inside the ChatMessageList component, replace this:
  // const latestSearchWidgetId = findLatestSearchWidgetMessage(chatHistory);

  // With this:
  const { activeIds: activeSearchWidgetIds } = findActiveSearchWidgets(chatHistory);

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
    
    // Special handling for case details responses - these come as markdown
    if (typeof chat.text === 'string' && chat.text.startsWith('# Case Details')) {
      console.log('DEBUG - Detected case details response');
      return (
        <div className={listStyles.botMessageContent}>
          <div className={listStyles.messageText}>
            {/* Use dangerouslySetInnerHTML to render markdown, but in production you should use a markdown parser */}
            <div dangerouslySetInnerHTML={{ 
              __html: chat.text
                .replace(/^# (.*)/gm, '<h1>$1</h1>')
                .replace(/^## (.*)/gm, '<h2>$1</h2>')
                .replace(/^### (.*)/gm, '<h3>$1</h3>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/---/g, '<hr/>')
                .replace(/\n\n/g, '<br/><br/>')
            }} />
          </div>
        </div>
      );
    }
    
    // First, try to detect if this is a structured JSON response
    if (typeof chat.text === 'string') {
      try {
        // Check if the text is actually a JSON string
        const jsonData = JSON.parse(chat.text);
        if (jsonData && typeof jsonData === 'object') {
          console.log('DEBUG - Detected structured JSON response with type:', jsonData.type);
          
          // Handle CASE_DETAILS structured response
          if (jsonData.type === 'CASE_DETAILS' && jsonData.data && jsonData.data.content) {
            console.log('DEBUG - Rendering structured case details');
            return (
              <div className={listStyles.botMessageContent}>
                <div className={listStyles.messageText}>
                  {/* Use dangerouslySetInnerHTML to render markdown */}
                  <div dangerouslySetInnerHTML={{ 
                    __html: jsonData.data.content
                      .replace(/^# (.*)/gm, '<h1>$1</h1>')
                      .replace(/^## (.*)/gm, '<h2>$1</h2>')
                      .replace(/^### (.*)/gm, '<h3>$1</h3>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/---/g, '<hr/>')
                      .replace(/\n\n/g, '<br/><br/>')
                  }} />
                </div>
              </div>
            );
          }
          
          // Handle case search results (existing code)
          if (jsonData.type === MESSAGE_TYPES.CASE_SEARCH_RESULTS) {
            // Extract data from the structured response
            if (jsonData.data && Array.isArray(jsonData.data.cases) && jsonData.data.cases.length > 0) {
              // Store the cases directly on the chat object instead of a separate variable
              // This avoids the unused variable warning
              chat.cases = jsonData.data.cases.map((c: { id?: string; title?: string; summary?: string }) => ({
                id: c.id || '',
                title: c.title || '',
                summary: c.summary || ''
              }));
              
              // Extract query from message or use a default
              const initialQuery = jsonData.data.query || extractQuery(chat.text) || '';
              
              return (
                <div className={listStyles.botMessageContent}>
                  <div className={listStyles.messageHeader}>
                    <p>{jsonData.text?.split('\n')[0] || 'Case search results:'}</p>
                  </div>
                  
                  <SearchWidget 
                    initialQuery={initialQuery}
                    onResultsLoaded={(cases) => handleSearchResults(chat.id || '', cases)}
                    onCaseSelect={(selectedCase) => {
                      // Only process selections if this is the active widget
                      if (!activeSearchWidgetIds.includes(chat.id || '')) {
                        console.log('Selection on inactive widget ignored');
                        return;
                      }
                      
                      const currentSelected = chat.selectedCases || [];
                      const isAlreadySelected = currentSelected.some(c => c.id === selectedCase.id);
                      
                      let newSelected;
                      if (isAlreadySelected) {
                        newSelected = currentSelected.filter(c => c.id !== selectedCase.id);
                      } else {
                        // Limit to 10 selected cases
                        if (currentSelected.length < 10 || isAlreadySelected) {
                          newSelected = [...currentSelected, selectedCase];
                        } else {
                          newSelected = currentSelected;
                          // Maybe show a toast or message that 10 is the limit
                          console.log('Maximum 10 cases can be selected');
                        }
                      }
                      
                      handleCaseSelection(chat.id || '', newSelected);
                    }}
                    onSelectionChange={(selectedCaseIds) => {
                      // Only process selections if this is the active widget
                      if (!activeSearchWidgetIds.includes(chat.id || '')) {
                        console.log('Selection change on inactive widget ignored');
                        return;
                      }
                      
                      // If we have case details for these IDs, convert IDs to full Case objects
                      if (chat.cases && selectedCaseIds.length > 0) {
                        const selectedCases = chat.cases.filter(c => selectedCaseIds.includes(c.id));
                        console.log('Selected case IDs from SearchWidget:', selectedCaseIds);
                        console.log('Selected cases after filtering:', selectedCases);
                        
                        // Update the selection in the parent component
                        handleCaseSelection(chat.id || '', selectedCases);
                      } else if (selectedCaseIds.length === 0) {
                        // Clear selection
                        handleCaseSelection(chat.id || '', []);
                      }
                    }}
                    disabled={!activeSearchWidgetIds.includes(chat.id || '')}
                  />
                  
                  {/* Show inactive message for previous search widgets */}
                  {!activeSearchWidgetIds.includes(chat.id || '') && (
                    <div className={listStyles.inactiveWidgetOverlay}>
                      <p>Previous search - use the latest search widget above</p>
                    </div>
                  )}
                </div>
              );
            }
          }
        }
      } catch (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        parseError
      ) {
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
      
      // Extract query from message or use a default
      const initialQuery = extractQuery(chat.text) || '';
      
      return (
        <div className={listStyles.botMessageContent}>
          <div className={listStyles.messageHeader}>
            <p>{introText}</p>
            {!activeSearchWidgetIds.includes(chat.id || '') && (
              <span className={listStyles.inactiveWidget}>
                Inactive search
              </span>
            )}
          </div>
          
          {/* Always show the search widget, remove the toggle */}
          <SearchWidget 
            initialQuery={initialQuery}
            onResultsLoaded={(cases) => handleSearchResults(chat.id || '', cases)}
            onCaseSelect={(selectedCase) => {
              // Only process selections if this is the active widget
              if (!activeSearchWidgetIds.includes(chat.id || '')) {
                console.log('Selection on inactive widget ignored');
                return;
              }
              
              const currentSelected = chat.selectedCases || [];
              const isAlreadySelected = currentSelected.some(c => c.id === selectedCase.id);
              
              let newSelected;
              if (isAlreadySelected) {
                newSelected = currentSelected.filter(c => c.id !== selectedCase.id);
              } else {
                // Limit to 10 selected cases
                if (currentSelected.length < 10 || isAlreadySelected) {
                  newSelected = [...currentSelected, selectedCase];
                } else {
                  newSelected = currentSelected;
                  // Maybe show a toast or message that 10 is the limit
                  console.log('Maximum 10 cases can be selected');
                }
              }
              
              handleCaseSelection(chat.id || '', newSelected);
            }}
            onSelectionChange={(selectedCaseIds) => {
              // Only process selections if this is the active widget
              if (!activeSearchWidgetIds.includes(chat.id || '')) {
                console.log('Selection change on inactive widget ignored');
                return;
              }
              
              // If we have case details for these IDs, convert IDs to full Case objects
              if (chat.cases && selectedCaseIds.length > 0) {
                const selectedCases = chat.cases.filter(c => selectedCaseIds.includes(c.id));
                console.log('Selected case IDs from SearchWidget:', selectedCaseIds);
                console.log('Selected cases after filtering:', selectedCases);
                
                // Update the selection in the parent component
                handleCaseSelection(chat.id || '', selectedCases);
              } else if (selectedCaseIds.length === 0) {
                // Clear selection
                handleCaseSelection(chat.id || '', []);
              }
            }}
            disabled={!activeSearchWidgetIds.includes(chat.id || '')}
          />
          
          {/* Show inactive message for previous search widgets */}
          {!activeSearchWidgetIds.includes(chat.id || '') && (
            <div className={listStyles.inactiveWidgetOverlay}>
              <p>Previous search - use the latest search widget above</p>
            </div>
          )}
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