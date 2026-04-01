import { useState, useRef, useEffect, useLayoutEffect, useCallback, memo } from 'react';
import { Plus, SendHorizonal } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  sendChatMessage,
  sendRagMessage,
  addUserMessage,
  clearChat,
  selectMessages,
  selectIsTyping,
  selectSuggestions,
} from '../store/aiSlice';
import './AIAssistant.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatContent = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );

const bubbleVariants = {
  hidden:  { opacity: 0, y: 14, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1, transition: { duration: 0.22, ease: 'easeOut' } },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const TypingIndicator = memo(() => (
  <div className="aia-bubble aia-bubble-ai">
    <div className="aia-typing">
      <span /><span /><span />
    </div>
    <div className="aia-avatar">🤖</div>
  </div>
));
TypingIndicator.displayName = 'TypingIndicator';

const MessageBubble = memo(({ msg }) => {
  const isUser = msg.role === 'user';
  const hasSources = !isUser && msg.sources && msg.sources.length > 0;
  return (
    <motion.div
      className={`aia-bubble ${isUser ? 'aia-bubble-user' : 'aia-bubble-ai'}`}
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
    >
      {isUser && <div className="aia-avatar aia-avatar-user">🧒</div>}
      <div className={`aia-bubble-text${msg.isError ? ' aia-bubble-error' : ''}`}>
        {msg.content.split('\n').map((line, i, arr) => (
          <span key={i}>
            {formatContent(line)}
            {i < arr.length - 1 && <br />}
          </span>
        ))}

      </div>
      {!isUser && <div className="aia-avatar">🤖</div>}
    </motion.div>
  );
});
MessageBubble.displayName = 'MessageBubble';

// ─── Main Component ───────────────────────────────────────────────────────────
function AIAssistant({ data }) {
  const dispatch  = useDispatch();
  const messages      = useSelector(selectMessages);
  const isTyping      = useSelector(selectIsTyping);
  const suggestions   = useSelector(selectSuggestions);

  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const chatRef  = useRef(null);
  const inputRef = useRef(null);
  const fileRef  = useRef(null);

  const uid = data?.uid || data?.id || null;
  const studentName = data?.student_name || data?.name || 'Student';

  // Clear chat synchronously on mount for fresh welcome experience
  useLayoutEffect(() => {
    dispatch(clearChat());
  }, [dispatch]);

  // Focus input after mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Derive mode from messages - welcome when empty, chat when messages exist
  const mode = messages.length === 0 ? 'welcome' : 'chat';

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = useCallback(
    (textOverride) => {
      const text = (typeof textOverride === 'string' ? textOverride : input).trim();
      if ((!text && !image) || isTyping) return;
      const displayText = image ? `${text || ''} 📷 Image attached`.trim() : text;
      dispatch(addUserMessage(displayText));
      dispatch(sendChatMessage({ uid, message: text, studentName, image }));
      setInput('');
      setImage(null);
      setImagePreview(null);
      if (fileRef.current) fileRef.current.value = '';
      inputRef.current?.focus();
    },
    [input, image, isTyping, uid, studentName, dispatch]
  );

  // Explicit textbook RAG search (bypasses personal-data routing)
  const handleRagSend = useCallback(
    (textOverride) => {
      const text = (typeof textOverride === 'string' ? textOverride : input).trim();
      if (!text || isTyping) return;
      dispatch(addUserMessage(text));
      dispatch(sendRagMessage({ message: text, studentName }));
      setInput('');
      inputRef.current?.focus();
    },
    [input, isTyping, studentName, dispatch]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5 MB');
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClearChat = () => {
    dispatch(clearChat());
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="aia-page">
      {/* ── Body ── */}
      <div className="aia-body">
        <AnimatePresence mode="wait">
          {mode === 'welcome' ? (
            <motion.div
              key="welcome"
              className="aia-welcome-screen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <h1 className="aia-welcome-title">What's on your mind today?</h1>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              className="aia-chat-wrapper"
              ref={chatRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="aia-chat-area">
                {/* Active suggestion chips (compact row) */}
                {hasMessages && suggestions.length > 0 && (
                  <div className="aia-chips-row">
                    {suggestions.slice(0, 3).map((s, i) => (
                      <button key={i} className="aia-chip-sm" onClick={() => handleSend(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))}
                  {isTyping && <TypingIndicator key="typing" />}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Sticky Input ── */}
      <div className="aia-input-zone">
        {hasMessages && (
          <button className="aia-clear-btn" onClick={handleClearChat}>
            🗑 Clear
          </button>
        )}

        {/* Image preview strip */}
        {imagePreview && (
          <div className="aia-image-preview">
            <img src={imagePreview} alt="Upload preview" />
            <button className="aia-image-remove" onClick={handleRemoveImage}>✕</button>
          </div>
        )}

        <div className="aia-input-box">
          {/* Image upload button */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            hidden
          />
          <button
            className="aia-upload-btn"
            title="Attach image"
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>

          <textarea
            ref={inputRef}
            className="aia-textarea"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything... (Enter to send, Shift+Enter for newline)"
            disabled={isTyping}
          />
          <motion.button
            className={`aia-send-btn${(!input.trim() && !image || isTyping) ? ' aia-send-disabled' : ''}`}
            onClick={handleSend}
            disabled={(!input.trim() && !image) || isTyping}
            whileHover={(input.trim() || image) && !isTyping ? { scale: 1.08 } : {}}
            whileTap={(input.trim() || image) && !isTyping ? { scale: 0.95 } : {}}
            aria-label="Send message"
          >
            <SendHorizonal size={17} strokeWidth={2.2} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default AIAssistant;
