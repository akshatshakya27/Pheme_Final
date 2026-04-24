/**
 * Chat Panel Component (Two-Way Proctoring Only)
 * Real-time chat between proctor and student
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProctoringWebSocket } from '@/hooks/useProctoringWebSocket';

interface ChatPanelProps {
  sessionId: string;
  onClose: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ sessionId, onClose }) => {
  const { sendCommand, on } = useProctoringWebSocket(sessionId);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Listen for incoming messages from student
   */
  useEffect(() => {
    const unsubscribe = on('message:received', (message: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          from: 'student',
          text: message.text,
          timestamp: new Date(),
        },
      ]);
    });

    return unsubscribe;
  }, [on]);

  /**
   * Auto-scroll to latest message
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Send message to student
   */
  const handleSendMessage = () => {
    if (!messageText.trim()) return;

    const message = {
      text: messageText,
      timestamp: new Date(),
    };

    // Add to local UI
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        from: 'proctor',
        ...message,
      },
    ]);

    // Send to EXE
    sendCommand('message:send', message);

    setMessageText('');
  };

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 bg-gray-800 border-l border-gray-700 shadow-lg flex flex-col z-40">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h3 className="font-bold">Chat with Student</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-sm text-center mt-4">
            Start a conversation...
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.from === 'proctor' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  msg.from === 'proctor'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-700 text-gray-100 rounded-bl-none'
                }`}
              >
                <p>{msg.text}</p>
                <p className="text-xs opacity-70 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-700 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Type message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className="bg-gray-700 border-gray-600 text-white placeholder-gray-500 flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-400">
          Press Enter to send
        </p>
      </div>
    </div>
  );
};
