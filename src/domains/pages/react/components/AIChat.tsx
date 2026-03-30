/**
 * AIChat Component
 * @description AI chat interface component with streaming support
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAIChat, type UseAIOptions, type AIMessage } from '../hooks/useAI';

export interface AIChatProps extends UseAIOptions {
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  showTimestamp?: boolean;
  showModel?: boolean;
  maxHeight?: string;
  welcomeMessage?: string;
  systemPrompt?: string;
  onMessageSend?: (message: string) => void;
  onMessageReceive?: (message: string) => void;
  renderMessage?: (message: AIMessage) => React.ReactNode;
  renderInput?: (props: {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    disabled: boolean;
  }) => React.ReactNode;
}

/**
 * AIChat component for conversational AI interfaces
 */
export const AIChat: React.FC<AIChatProps> = ({
  className = '',
  placeholder = 'Type your message...',
  disabled = false,
  showTimestamp = false,
  showModel = false,
  maxHeight = '500px',
  welcomeMessage = 'Hello! How can I help you today?',
  systemPrompt,
  onMessageSend,
  onMessageReceive,
  renderMessage,
  renderInput,
  ...aiOptions
}) => {
  const { messages, aiState, sendMessage, clearConversation } = useAIChat(aiOptions);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Scroll to bottom when messages change
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Auto-scroll during streaming
   */
  useEffect(() => {
    if (aiState.isStreaming) {
      messagesContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [aiState.streamContent, aiState.isStreaming]);

  /**
   * Handle send
   */
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || aiState.isLoading) return;

    const message = inputValue.trim();
    setInputValue('');
    onMessageSend?.(message);

    try {
      await sendMessage(message, {
        stream: true,
        system: systemPrompt,
      });

      // Get the last assistant message
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        onMessageReceive?.(lastMessage.content);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [inputValue, aiState.isLoading, sendMessage, messages, systemPrompt, onMessageSend, onMessageReceive]);

  /**
   * Handle key press
   */
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  /**
   * Render default message
   */
  const renderDefaultMessage = useCallback((message: AIMessage) => {
    return (
      <div
        key={message.timestamp || Math.random()}
        className={`chat-message ${message.role}`}
        style={{
          display: 'flex',
          marginBottom: '16px',
          justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
        }}
      >
        <div
          style={{
            maxWidth: '70%',
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: message.role === 'user' ? '#4caf50' : '#f0f0f0',
            color: message.role === 'user' ? 'white' : 'black',
          }}
        >
          {showModel && message.role === 'assistant' && aiState.response?.model && (
            <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '4px' }}>
              {aiState.response.model}
            </div>
          )}
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.content}
          </div>
          {showTimestamp && message.timestamp && (
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    );
  }, [showTimestamp, showModel, aiState.response]);

  return (
    <div className={`ai-chat ${className}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="ai-chat-messages"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 && welcomeMessage && (
          <div
            className="chat-message assistant"
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: '#f0f0f0',
                color: 'black',
              }}
            >
              {welcomeMessage}
            </div>
          </div>
        )}

        {messages.map((message) => renderMessage ? renderMessage(message) : renderDefaultMessage(message))}

        {/* Streaming indicator */}
        {aiState.isStreaming && aiState.streamContent && (
          <div
            className="chat-message assistant streaming"
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: '#f0f0f0',
                color: 'black',
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {aiState.streamContent}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
                ▊
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {aiState.isLoading && !aiState.isStreaming && (
          <div
            className="chat-message assistant loading"
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: '#f0f0f0',
                color: 'black',
              }}
            >
              <div className="typing-indicator">...</div>
            </div>
          </div>
        )}

        {/* Error message */}
        {aiState.error && (
          <div
            className="chat-message error"
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: '#f44336',
                color: 'white',
              }}
            >
              {aiState.error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {renderInput ? (
        renderInput({
          value: inputValue,
          onChange: setInputValue,
          onSend: handleSend,
          disabled: disabled || aiState.isLoading,
        })
      ) : (
        <div
          className="ai-chat-input"
          style={{
            display: 'flex',
            gap: '8px',
            padding: '16px',
            borderTop: '1px solid #e0e0e0',
          }}
        >
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled || aiState.isLoading}
            rows={1}
            style={{
              flex: 1,
              padding: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              resize: 'none',
              fontFamily: 'inherit',
              fontSize: '14px',
              opacity: disabled || aiState.isLoading ? 0.5 : 1,
            }}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || aiState.isLoading || !inputValue.trim()}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: !inputValue.trim() || aiState.isLoading ? '#ccc' : '#4caf50',
              color: 'white',
              cursor: !inputValue.trim() || aiState.isLoading ? 'not-allowed' : 'pointer',
              opacity: !inputValue.trim() || aiState.isLoading ? 0.5 : 1,
            }}
          >
            Send
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearConversation();
                setInputValue('');
              }}
              disabled={aiState.isLoading}
              style={{
                padding: '12px 24px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#f44336',
                color: 'white',
                cursor: aiState.isLoading ? 'not-allowed' : 'pointer',
                opacity: aiState.isLoading ? 0.5 : 1,
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Simple chat input component
 */
export const AIChatInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
  className = '',
}) => {
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }, [onSend]);

  return (
    <div className={`ai-chat-input ${className}`} style={{ display: 'flex', gap: '8px' }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          padding: '12px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          resize: 'none',
          fontFamily: 'inherit',
          fontSize: '14px',
        }}
      />

      <button
        type="button"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        style={{
          padding: '12px 24px',
          border: 'none',
          borderRadius: '4px',
          backgroundColor: !value.trim() ? '#ccc' : '#4caf50',
          color: 'white',
        }}
      >
        Send
      </button>
    </div>
  );
};
