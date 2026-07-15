import React, { useState, useRef, useEffect } from 'react';
import { useERPStore } from '../store';
import { Bot, Send, X, Database, Loader2, Sparkles, ServerCrash } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  results?: any[];
  error?: string;
}

interface AIAssistantProps {
  onClose: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'assistant',
      content: 'Hi! I am your AI ERP Assistant. Ask me questions about your data, e.g., "What is our total revenue?" or "Who are our top 5 customers?"'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { token } = useERPStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    
    const newMessages: Message[] = [
      ...messages,
      { id: Date.now().toString(), role: 'user', content: userMsg }
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMsg })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process request');
      }

      setMessages([
        ...newMessages,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.explanation || 'Here are the results:',
          sql: data.sql,
          results: data.results
        }
      ]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I ran into an error processing your request.',
          error: err.message
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    "What is the total revenue?",
    "Show me unpaid invoices",
    "Top 3 customers by revenue"
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-8 fade-in duration-300">
      {/* Header */}
      <div className="h-14 border-b border-[var(--color-border)] flex items-center justify-between px-4 bg-gradient-to-r from-[var(--color-surface)] to-[var(--color-surface-hover)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Sparkles size={16} className="text-blue-500" />
          </div>
          <div>
            <h3 className="font-bold text-sm">ERP AI Assistant</h3>
            <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
              <Database size={10} /> Read-only SQL Chat
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-[var(--color-border)] rounded-lg transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-bl-none'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold">
                  <Bot size={12} /> Assistant
                </div>
              )}
              
              <div className="text-sm leading-relaxed">{msg.content}</div>

              {msg.error && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-xs flex items-center gap-2">
                  <ServerCrash size={14} />
                  {msg.error}
                </div>
              )}

              {msg.sql && (
                <div className="mt-3">
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)] mb-1 uppercase">Generated Query</div>
                  <pre className="text-[10px] bg-black/30 p-2 rounded overflow-x-auto text-blue-300 font-mono border border-[var(--color-border)]/50">
                    {msg.sql}
                  </pre>
                </div>
              )}

              {msg.results && msg.results.length > 0 && (
                <div className="mt-3 border border-[var(--color-border)] rounded overflow-hidden">
                  <div className="max-h-[200px] overflow-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--color-surface)] sticky top-0">
                        <tr>
                          {Object.keys(msg.results[0]).map((key) => (
                            <th key={key} className="px-2 py-1.5 font-semibold text-[var(--color-text-muted)] border-b border-[var(--color-border)] whitespace-nowrap">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {msg.results.map((row, i) => (
                          <tr key={i} className="hover:bg-[var(--color-surface-hover)]">
                            {Object.values(row).map((val: any, j) => (
                              <td key={j} className="px-2 py-1.5 whitespace-nowrap truncate max-w-[150px]">
                                {val === null ? 'null' : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-[var(--color-surface)] px-2 py-1 text-[10px] text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
                    {msg.results.length} rows returned
                  </div>
                </div>
              )}
              {msg.results && msg.results.length === 0 && (
                <div className="mt-2 text-xs text-[var(--color-text-muted)] italic">
                  Query returned 0 rows.
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-2xl rounded-bl-none p-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Loader2 size={16} className="animate-spin" />
              Analyzing data...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length === 1 && !isLoading && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => setInput(p)}
              className="text-[11px] bg-[var(--color-surface-hover)] hover:bg-[var(--color-border)] border border-[var(--color-border)] px-2.5 py-1 rounded-full transition-colors whitespace-nowrap"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 bg-[var(--color-surface-hover)] border-t border-[var(--color-border)]">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your ERP data..."
            className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            <Send size={18} className={input.trim() && !isLoading ? 'ml-0.5' : ''} />
          </button>
        </form>
      </div>
    </div>
  );
};
