'use client';
import React, { useRef, forwardRef, useEffect, useState } from 'react';
import styles from '@/app/chat/chat.module.css';
import inputStyles from './ChatInputArea.module.css';
import { getAgentReply } from '@/services/agent';

interface SelectedFile { file: File; id: string; }
interface ChatInputAreaProps {
  message: string;
  setMessage: (msg: string) => void;
  setShowCanvas?: (show: boolean) => void;
  selectedFiles: SelectedFile[];
  removeSelectedFile: (id: string) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  // Called when user sends a message (sender = user)
  onUserSend?: (message: string) => void;
  // Called when bot replies after processing user message
  onBotReply?: (reply: string) => void;
}
const ChatInputArea = forwardRef<HTMLTextAreaElement, ChatInputAreaProps>(
  (
    {
      message,
      setMessage,
      setShowCanvas,
      selectedFiles,
      removeSelectedFile,
      handleFileChange,
      placeholder,
      onUserSend,
      onBotReply,
    },
    ref
  ) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Reference to the form for programmatic submit on Enter
    const formRef = useRef<HTMLFormElement>(null);

    const [isBotReplying, setIsBotReplying] = useState(false);

    const isSendDisabled =
      (!message.trim() && selectedFiles.length === 0) || isBotReplying;

    // Reset textarea height to initial size after sending (when message is cleared)
    useEffect(() => {
      if (message === '' && ref && typeof ref === 'object' && ref.current) {
        ref.current.style.height = '40px';
      }
    }, [message, ref]);

    const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
      const target = e.target as HTMLTextAreaElement;
      target.style.height = '40px';
      const newHeight = Math.min(target.scrollHeight, 88);
      target.style.height = `${newHeight}px`;
    };

    const textareaClassName = `
      ${styles.textareaBase}
      ${selectedFiles.length > 0 ? inputStyles.textareaInputWithFiles : inputStyles.textareaInput}
    `;

    // Handle form submit: notify parent of user message, then call Gemini Agent API
    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (isSendDisabled) return;
      const trimmed = message.trim();
      // Notify parent of user message
      if (onUserSend) onUserSend(trimmed);
      setIsBotReplying(true);
      try {
        const reply = await getAgentReply(trimmed);
        if (onBotReply) onBotReply(reply);
      } catch (err) {
        if (onBotReply)
          onBotReply('There was an error contacting Gemini agent.');
      } finally {
        setMessage('');
        setIsBotReplying(false);
      }
    };

    const handleStopGenerating = () => {
      // Implement your own stop logic, if you support streaming or cancellation
      // For now, just set bot replying to false (not usually needed)
      setIsBotReplying(false);
    };

    return (
      <div className={styles.inputAreaWrapper}>
        {/* Selected files preview */}
        {selectedFiles.length > 0 && (
          <div className={styles.selectedFilesContainer}>
            {selectedFiles.map(fileEntry => (
              <div key={fileEntry.id} className={styles.selectedFileItem}>
                <span className={styles.selectedFileName}>{fileEntry.file.name}</span>
                <button
                  type="button"
                  className={styles.removeFileButton}
                  title="Remove file"
                  onClick={() => removeSelectedFile(fileEntry.id)}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Input form */}
        <div className={styles.inputFormWrapper}>
          <form ref={formRef} onSubmit={handleSendMessage} className={inputStyles.inputForm} autoComplete="off">
            <div className={inputStyles.textareaWrapper}>
              <textarea
                ref={ref}
                value={message}
                onChange={e => {
                  setMessage(e.target.value);
                  if (setShowCanvas)
                    setShowCanvas(e.target.value.trim().toLowerCase() === 'canvas');
                }}
                className={textareaClassName.trim()}
                placeholder={placeholder}
                autoFocus
                rows={1}
                onKeyDown={e => {
                  // Send on Enter (without Shift)
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    formRef.current?.requestSubmit();
                  }
                }}
                onInput={handleTextareaInput}
                disabled={isBotReplying}
              />
            </div>
            {/* Hidden input for files */}
            <input
              type="file"
              ref={fileInputRef}
              className={inputStyles.hiddenFileInput}
              onChange={handleFileChange}
              accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.csv,text/csv,.txt,text/plain,.html,.htm,text/html,.odt,application/vnd.oasis.opendocument.text,.rtf,application/rtf,text/rtf,.epub,application/epub+zip"
              multiple
            />
            <div className={styles.sendStopButtonContainer}>
              <button
                type="button"
                className={`${styles.iconButton} ${inputStyles.attachmentButton}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={isBotReplying}
                title="Upload images or docs"
              >
                {/* Attachment Icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>
              {/* Send or Stop button */}
              {isBotReplying ? (
                <button type="button" onClick={handleStopGenerating} className={styles.stopButton} title="Stop generating">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#757575">
                    <rect width="24" height="24" rx="4" ry="4" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  className={`${styles.sendButton} ${isSendDisabled ? styles.sendButtonDisabled : ''}`}
                  disabled={isSendDisabled}
                  title="Send"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 4L12 20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 11L12 4L19 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }
);
ChatInputArea.displayName = 'ChatInputArea';
export default ChatInputArea;