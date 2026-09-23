import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  CheckSquare,
  HelpCircle,
  GraduationCap,
} from 'lucide-react';
import { apiAskAssistant, apiCreateSupportRequest } from '../api/useApi';
import type {
  AssistantMessage,
  ProposedAction,
  ReferenceItem,
  SupportRequestType,
} from '../types';

interface AssistantPageProps {
  onNavigateToTasks?: () => void;
  onNavigateToAlerts?: () => void;
  onNavigateToSupervisor?: () => void;
  onNavigateToTraining?: () => void;
  onSupportRequestCreated?: () => void;
}

const INITIAL_MESSAGES: AssistantMessage[] = [
  {
    id: 'welcome-1',
    role: 'assistant',
    text: "Hello! I am your ShiftMate AI Operator Assistant. I have live access to your machine telemetry, assigned tasks, active safety alerts, and shift logs. How can I help you today?",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
];

const SUGGESTED_PROMPTS = [
  "Why is my task delayed?",
  "What are my active safety alerts?",
  "How do I request supervisor help?",
  "Summarize my current shift",
  "Recommend safety training",
];

export const AssistantPage: React.FC<AssistantPageProps> = ({
  onNavigateToTasks,
  onNavigateToAlerts,
  onNavigateToSupervisor,
  onNavigateToTraining,
  onSupportRequestCreated,
}) => {
  const [messages, setMessages] = useState<AssistantMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [actionStatuses, setActionStatuses] = useState<Record<string, 'pending' | 'submitting' | 'confirmed' | 'cancelled' | 'failed'>>({});
  const [actionFeedbacks, setActionFeedbacks] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText ?? input).trim();
    if (!textToSend || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: AssistantMessage = {
      id: userMsgId,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await apiAskAssistant(textToSend);
      const assistantMsgId = `asst-${Date.now()}`;
      const assistantMsg: AssistantMessage = {
        id: assistantMsgId,
        role: 'assistant',
        text: response.answer,
        references: response.references,
        proposed_action: response.proposed_action,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      if (response.proposed_action) {
        setActionStatuses((prev) => ({ ...prev, [assistantMsgId]: 'pending' }));
      }

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve assistant response.';
      const fallbackMsg: AssistantMessage = {
        id: `asst-err-${Date.now()}`,
        role: 'assistant',
        text: `⚠️ Operational query error: ${errorMsg}. Please try rephrasing or check server connection.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (msgId: string, action: ProposedAction) => {
    setActionStatuses((prev) => ({ ...prev, [msgId]: 'submitting' }));

    try {
      const payload = {
        request_type: action.payload.request_type as SupportRequestType,
        task_id: action.payload.task_id,
        message: action.payload.message,
      };

      const result = await apiCreateSupportRequest(payload);
      setActionStatuses((prev) => ({ ...prev, [msgId]: 'confirmed' }));
      setActionFeedbacks((prev) => ({
        ...prev,
        [msgId]: `Support Request ${result.id} dispatched to supervisor and logged in the system.`,
      }));

      onSupportRequestCreated?.();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to submit support request.';
      setActionStatuses((prev) => ({ ...prev, [msgId]: 'failed' }));
      setActionFeedbacks((prev) => ({ ...prev, [msgId]: `Error: ${errorMsg}` }));
    }
  };

  const handleCancelAction = (msgId: string) => {
    setActionStatuses((prev) => ({ ...prev, [msgId]: 'cancelled' }));
  };

  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
    setActionStatuses({});
    setActionFeedbacks({});
  };

  const handleReferenceClick = (ref: ReferenceItem) => {
    if (ref.type === 'task' && onNavigateToTasks) {
      onNavigateToTasks();
    } else if (ref.type === 'incident' && onNavigateToAlerts) {
      onNavigateToAlerts();
    } else if (ref.type === 'support_request' && onNavigateToSupervisor) {
      onNavigateToSupervisor();
    } else if (ref.type === 'training' && onNavigateToTraining) {
      onNavigateToTraining();
    }
  };

  return (
    <div className="assistant-container">
      {/* Header bar */}
      <div className="assistant-header">
        <div className="assistant-title-group">
          <div className="assistant-icon-box">
            <Bot size={22} color="var(--cat-yellow)" />
          </div>
          <div>
            <h2 className="assistant-heading">AI Operator Assistant</h2>
            <p className="assistant-subheading">
              Grounded operational intelligence · Context-aware shift telemetry · Guarded action confirmation
            </p>
          </div>
        </div>
        <button
          className="btn btn-secondary assistant-clear-btn"
          onClick={handleClearChat}
          title="Reset conversation"
        >
          <RotateCcw size={14} />
          <span>Reset Chat</span>
        </button>
      </div>

      {/* Suggested Prompts Shelf */}
      <div className="assistant-prompts-shelf">
        <span className="prompts-label">
          <Sparkles size={14} color="var(--cat-yellow)" /> Suggested Questions:
        </span>
        <div className="prompts-list">
          {SUGGESTED_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              className="prompt-chip"
              onClick={() => handleSend(prompt)}
              disabled={loading}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="assistant-chat-window">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const actionState = actionStatuses[msg.id];

          return (
            <div
              key={msg.id}
              className={`chat-message-row ${isUser ? 'user-row' : 'assistant-row'}`}
            >
              <div className={`chat-avatar ${isUser ? 'user-avatar' : 'assistant-avatar'}`}>
                {isUser ? <User size={16} /> : <Bot size={16} />}
              </div>

              <div className="chat-bubble-container">
                <div className="chat-meta">
                  <span className="chat-author">{isUser ? 'Operator (You)' : 'ShiftMate Assistant'}</span>
                  <span className="chat-timestamp">{msg.timestamp}</span>
                </div>

                <div className={`chat-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
                  <p className="chat-text">{msg.text}</p>

                  {/* Grounded References Section */}
                  {msg.references && msg.references.length > 0 && (
                    <div className="chat-references-block">
                      <span className="references-heading">Verified Operational Grounding:</span>
                      <div className="references-chips">
                        {msg.references.map((ref, idx) => (
                          <button
                            key={idx}
                            className="reference-badge"
                            onClick={() => handleReferenceClick(ref)}
                            title={`Navigate to ${ref.type} ${ref.id}`}
                          >
                            {ref.type === 'task' && <CheckSquare size={12} />}
                            {ref.type === 'incident' && <ShieldAlert size={12} />}
                            {ref.type === 'support_request' && <HelpCircle size={12} />}
                            {ref.type === 'training' && <GraduationCap size={12} />}
                            <span>{ref.label || `${ref.type.toUpperCase()}: ${ref.id}`}</span>
                            <ExternalLink size={10} style={{ opacity: 0.7 }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proposed Action Card (Requires Explicit Operator Confirmation) */}
                  {msg.proposed_action && (
                    <div className="proposed-action-card">
                      <div className="proposed-action-header">
                        <div className="proposed-action-title">
                          <AlertTriangle size={16} color="var(--cat-yellow)" />
                          <span>Proposed Action: Supervisor Support Request</span>
                        </div>
                        <span className="action-tag">Requires Confirmation</span>
                      </div>

                      <div className="proposed-action-body">
                        <div className="action-detail-row">
                          <span className="action-detail-lbl">Request Type:</span>
                          <span className="action-detail-val badge-category">
                            {msg.proposed_action.payload.request_type}
                          </span>
                        </div>

                        {msg.proposed_action.payload.task_id && (
                          <div className="action-detail-row">
                            <span className="action-detail-lbl">Associated Task:</span>
                            <span className="action-detail-val" style={{ fontFamily: 'var(--font-mono)' }}>
                              {msg.proposed_action.payload.task_id}
                            </span>
                          </div>
                        )}

                        <div className="action-detail-row">
                          <span className="action-detail-lbl">Message:</span>
                          <span className="action-detail-val action-msg-text">
                            "{msg.proposed_action.payload.message}"
                          </span>
                        </div>

                        <div className="action-safety-notice">
                          ShiftMate will NOT submit or alter equipment state without your explicit approval.
                        </div>

                        {/* Action Buttons / States */}
                        {actionState === 'pending' && (
                          <div className="proposed-action-buttons">
                            <button
                              className="btn btn-primary action-btn-confirm"
                              onClick={() => handleConfirmAction(msg.id, msg.proposed_action!)}
                            >
                              <CheckCircle2 size={15} />
                              <span>Confirm & Dispatch Ticket</span>
                            </button>
                            <button
                              className="btn btn-secondary action-btn-cancel"
                              onClick={() => handleCancelAction(msg.id)}
                            >
                              <XCircle size={15} />
                              <span>Cancel</span>
                            </button>
                          </div>
                        )}

                        {actionState === 'submitting' && (
                          <div className="action-state-indicator pending">
                            <span>Submitting support ticket to supervisor...</span>
                          </div>
                        )}

                        {actionState === 'confirmed' && (
                          <div className="action-state-indicator success">
                            <CheckCircle2 size={16} />
                            <span>
                              {actionFeedbacks[msg.id] || 'Support Request created and dispatched.'}
                            </span>
                          </div>
                        )}

                        {actionState === 'cancelled' && (
                          <div className="action-state-indicator cancelled">
                            <XCircle size={16} />
                            <span>Action cancelled by operator. No request was created.</span>
                          </div>
                        )}

                        {actionState === 'failed' && (
                          <div className="action-state-indicator error">
                            <AlertTriangle size={16} />
                            <span>{actionFeedbacks[msg.id] || 'Submission failed.'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="chat-message-row assistant-row">
            <div className="chat-avatar assistant-avatar">
              <Bot size={16} />
            </div>
            <div className="chat-bubble-container">
              <div className="chat-meta">
                <span className="chat-author">ShiftMate Assistant</span>
              </div>
              <div className="chat-bubble assistant-bubble loading-bubble">
                <div className="typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="loading-label">Querying live machine state & shift telemetry...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <form
        className="assistant-input-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          type="text"
          className="assistant-input-field"
          placeholder="Ask a question about current task, delays, alerts, or request supervisor assistance..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="btn btn-primary assistant-send-btn"
          disabled={loading || !input.trim()}
        >
          <Send size={16} />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
};
