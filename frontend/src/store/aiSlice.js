import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// ─── Personal / non-academic keywords — only these SKIP RAG ──────────────────
const PERSONAL_KEYWORDS = [
  'progress', 'xp', 'level', 'streak', 'badge', 'reward',
  'homework', 'assignment', 'how am i', 'how i am', 'game', 'play',
  'hi', 'hello', 'hey', 'namaste', 'good morning', 'good afternoon', 'good evening', 'how are you',
  'spell', 'spelling',
];

function isPersonalMessage(message) {
  const msg = message.toLowerCase();
  return PERSONAL_KEYWORDS.some((kw) => msg.includes(kw));
}

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const sendChatMessage = createAsyncThunk(
  'ai/sendChatMessage',
  async ({ uid, message, studentName, image }, { rejectWithValue }) => {
    try {
      const { apiService } = await import('../services/api');

      // Route to RAG by default — only skip for personal/greeting messages (and no image)
      if (!isPersonalMessage(message) || image) {
        try {
          const ragRes = await apiService.sendRagMessage({
            message,
            student_name: studentName || 'Student',
            image: image || undefined,
          });
          return ragRes.data; // { reply, suggestions, timestamp, intent: 'rag' }
        } catch (_ragErr) {
          // RAG failed — fall through to regular chat
        }
      }

      const res = await apiService.sendChatMessage({ uid, message });
      return res.data; // { reply, suggestions, timestamp, intent }
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.detail || 'Could not reach the assistant. Please try again.'
      );
    }
  }
);

export const sendRagMessage = createAsyncThunk(
  'ai/sendRagMessage',
  async ({ message, studentName, subjectFilter, image }, { rejectWithValue }) => {
    try {
      const { apiService } = await import('../services/api');
      const res = await apiService.sendRagMessage({
        message,
        student_name:   studentName || 'Student',
        subject_filter: subjectFilter || '',
        image: image || undefined,
      });
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.detail || 'RAG assistant unavailable. Please try again.'
      );
    }
  }
);

export const loadHistory = createAsyncThunk(
  'ai/loadHistory',
  async (uid, { rejectWithValue }) => {
    try {
      const { apiService } = await import('../services/api');
      const res = await apiService.getChatHistory(uid);
      return res.data?.messages || [];
    } catch (err) {
      return rejectWithValue('Could not load chat history.');
    }
  }
);

// ─── Default suggestions ──────────────────────────────────────────────────────
const DEFAULT_SUGGESTIONS = [
  'Help me with math 🧮',
  'Check my progress 📊',
  'Which game gives the most XP? 🎮',
  'Homework tips 📚',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── Slice ────────────────────────────────────────────────────────────────────
const aiSlice = createSlice({
  name: 'ai',
  initialState: {
    messages: [],          // [{ id, role: 'user'|'assistant', content, timestamp }]
    isTyping: false,
    suggestions: DEFAULT_SUGGESTIONS,
    error: null,
    historyLoaded: false,
    lastIntent: null,      // 'rag' | 'math' | 'greeting' | etc.
  },
  reducers: {
    addUserMessage: (state, action) => {
      state.messages.push({
        id:        makeId(),
        role:      'user',
        content:   action.payload,
        timestamp: new Date().toISOString(),
      });
    },
    clearChat: (state) => {
      state.messages      = [];
      state.suggestions   = DEFAULT_SUGGESTIONS;
      state.error         = null;
      state.historyLoaded = false;
      state.lastIntent    = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // ── sendChatMessage ──────────────────────────────────────────────
    builder.addCase(sendChatMessage.pending, (state) => {
      state.isTyping = true;
      state.error    = null;
    });
    builder.addCase(sendChatMessage.fulfilled, (state, action) => {
      state.isTyping   = false;
      state.lastIntent = action.payload?.intent || null;
      const { reply, suggestions, timestamp, sources, chunks_found } = action.payload;
      state.messages.push({
        id:           makeId(),
        role:         'assistant',
        content:      reply,
        timestamp:    timestamp || new Date().toISOString(),
        intent:       action.payload?.intent,
        sources:      sources || [],
        chunks_found: chunks_found || 0,
      });
      if (suggestions?.length) {
        state.suggestions = suggestions;
      }
    });
    builder.addCase(sendChatMessage.rejected, (state, action) => {
      state.isTyping = false;
      state.error    = action.payload;
      state.messages.push({
        id:        makeId(),
        role:      'assistant',
        content:   "😕 I couldn't connect right now. Check your internet and try again!",
        timestamp: new Date().toISOString(),
        isError:   true,
      });
    });

    // ── sendRagMessage ───────────────────────────────────────────────
    builder.addCase(sendRagMessage.pending, (state) => {
      state.isTyping = true;
      state.error    = null;
    });
    builder.addCase(sendRagMessage.fulfilled, (state, action) => {
      state.isTyping   = false;
      state.lastIntent = 'rag';
      const { reply, suggestions, timestamp, sources, chunks_found } = action.payload;
      state.messages.push({
        id:           makeId(),
        role:         'assistant',
        content:      reply,
        timestamp:    timestamp || new Date().toISOString(),
        intent:       'rag',
        sources:      sources || [],
        chunks_found: chunks_found || 0,
      });
      if (suggestions?.length) {
        state.suggestions = suggestions;
      }
    });
    builder.addCase(sendRagMessage.rejected, (state, action) => {
      state.isTyping = false;
      state.error    = action.payload;
      state.messages.push({
        id:        makeId(),
        role:      'assistant',
        content:   "📚 I couldn't search the textbooks right now. Try again in a moment!",
        timestamp: new Date().toISOString(),
        isError:   true,
      });
    });

    // ── loadHistory ──────────────────────────────────────────────────
    builder.addCase(loadHistory.pending, (state) => {
      state.historyLoaded = false;
    });
    builder.addCase(loadHistory.fulfilled, (state, action) => {
      state.historyLoaded = true;
      if (!action.payload?.length) return;
      if (state.messages.length > 0) return; // don't overwrite live session
      state.messages = action.payload.map((m) => ({
        id:        makeId(),
        role:      m.role,
        content:   m.message,
        timestamp: m.timestamp,
      }));
    });
    builder.addCase(loadHistory.rejected, (state) => {
      state.historyLoaded = true;
    });
  },
});

// ─── Actions ──────────────────────────────────────────────────────────────────
export const { addUserMessage, clearChat, clearError } = aiSlice.actions;

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectMessages      = (state) => state.ai.messages;
export const selectIsTyping      = (state) => state.ai.isTyping;
export const selectSuggestions   = (state) => state.ai.suggestions;
export const selectAIError       = (state) => state.ai.error;
export const selectHistoryLoaded = (state) => state.ai.historyLoaded;
export const selectLastIntent    = (state) => state.ai.lastIntent;

export default aiSlice.reducer;
