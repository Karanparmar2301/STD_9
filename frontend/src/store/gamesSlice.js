import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import apiService from '../services/api';

// Game definitions with metadata
export const GAMES_CONFIG = [
    {
        id: 'number_match',
        name: 'Number Match',
        description: 'Match numbers with their word forms',
        difficulty: 'Easy',
        xp_reward: 5,
        icon: '🔢',
        color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    {
        id: 'alphabet_race',
        name: 'Alphabet Race',
        description: 'Identify letters quickly and correctly',
        difficulty: 'Medium',
        xp_reward: 8,
        icon: '🔤',
        color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    {
        id: 'math_quest',
        name: 'Math Quest',
        description: 'Solve simple addition and subtraction',
        difficulty: 'Easy',
        xp_reward: 10,
        icon: '➕',
        color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    },
    {
        id: 'shape_finder',
        name: 'Shape Finder',
        description: 'Identify circles, squares, and triangles',
        difficulty: 'Easy',
        xp_reward: 5,
        icon: '🔺',
        color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    },
    {
        id: 'color_match',
        name: 'Color Match',
        description: 'Match color names with colored boxes',
        difficulty: 'Easy',
        xp_reward: 5,
        icon: '🎨',
        color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    },
    {
        id: 'spelling_bee',
        name: 'Spelling Bee',
        description: 'Spell simple 3-letter words',
        difficulty: 'Medium',
        xp_reward: 10,
        icon: '🐝',
        color: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)'
    },
    {
        id: 'word_builder',
        name: 'Word Builder',
        description: 'Arrange letters to form words',
        difficulty: 'Medium',
        xp_reward: 12,
        icon: '📝',
        color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
    },
    {
        id: 'counting_stars',
        name: 'Counting Stars',
        description: 'Count objects and numbers',
        difficulty: 'Easy',
        xp_reward: 6,
        icon: '⭐',
        color: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
    },
    {
        id: 'memory_flip',
        name: 'Memory Flip',
        description: 'Match pairs of cards',
        difficulty: 'Medium',
        xp_reward: 15,
        icon: '🃏',
        color: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
    }
];

// Async thunks
export const fetchGamesStats = createAsyncThunk(
    'games/fetchStats',
    async (uid, { rejectWithValue }) => {
        try {
            const response = await apiService.getGamesStats(uid);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.detail || 'Failed to fetch game stats');
        }
    }
);

export const completeGame = createAsyncThunk(
    'games/complete',
    async (gameData, { rejectWithValue }) => {
        try {
            const response = await apiService.completeGame(gameData);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.detail || 'Failed to complete game');
        }
    }
);

const initialState = {
    activeGame: null,
    stats: {
        total_games: 0,
        total_xp: 0,
        total_game_xp: 0,
        games_played: 0,
        badges: [],
        current_level: 1,
        current_level_xp: 0,
        xp_to_next_level: 100,
        recent_sessions: []
    },
    loading: false,
    completing: false,
    error: null,
    lastCompletedGame: null,
    newBadges: [],
    showBadgeModal: false,
    xpAnimation: null
};

const gamesSlice = createSlice({
    name: 'games',
    initialState,
    reducers: {
        setActiveGame: (state, action) => {
            state.activeGame = action.payload;
        },
        clearActiveGame: (state) => {
            state.activeGame = null;
        },
        clearGameError: (state) => {
            state.error = null;
        },
        closeBadgeModal: (state) => {
            state.showBadgeModal = false;
            state.newBadges = [];
        },
        clearXPAnimation: (state) => {
            state.xpAnimation = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch stats
            .addCase(fetchGamesStats.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchGamesStats.fulfilled, (state, action) => {
                state.loading = false;
                state.stats = action.payload;
            })
            .addCase(fetchGamesStats.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Complete game
            .addCase(completeGame.pending, (state) => {
                state.completing = true;
                state.error = null;
            })
            .addCase(completeGame.fulfilled, (state, action) => {
                state.completing = false;
                state.lastCompletedGame = action.payload;
                
                // Update stats
                state.stats.total_games = action.payload.games_played;
                state.stats.total_xp = action.payload.total_xp;
                state.stats.total_game_xp = action.payload.total_game_xp;
                state.stats.games_played = action.payload.games_played;
                state.stats.badges = action.payload.badges;
                state.stats.current_level = action.payload.level;
                state.stats.current_level_xp = action.payload.current_level_xp;
                state.stats.xp_to_next_level = action.payload.xp_to_next_level;
                state.stats.current_level_xp = action.payload.current_level_xp;
                state.stats.xp_to_next_level = action.payload.xp_to_next_level;
                
                // Show badge modal if new badges earned
                if (action.payload.new_badges && action.payload.new_badges.length > 0) {
                    state.newBadges = action.payload.new_badges;
                    state.showBadgeModal = true;
                }
                
                // Trigger XP animation
                state.xpAnimation = {
                    amount: action.payload.xp_earned,
                    timestamp: Date.now()
                };
            })
            .addCase(completeGame.rejected, (state, action) => {
                state.completing = false;
                state.error = action.payload;
            });
    }
});

export const {
    setActiveGame,
    clearActiveGame,
    clearGameError,
    closeBadgeModal,
    clearXPAnimation
} = gamesSlice.actions;

// Selectors
export const selectAllGames = () => GAMES_CONFIG;
export const selectActiveGame = (state) => state.games.activeGame;
export const selectGamesStats = (state) => state.games.stats;
export const selectGamesLoading = (state) => state.games.loading;
export const selectCompletingGame = (state) => state.games.completing;
export const selectGameError = (state) => state.games.error;
export const selectNewBadges = (state) => state.games.newBadges;
export const selectShowBadgeModal = (state) => state.games.showBadgeModal;
export const selectXPAnimation = (state) => state.games.xpAnimation;

// Memoized selector for game by ID
export const selectGameById = createSelector(
    [(state, gameId) => gameId],
    (gameId) => GAMES_CONFIG.find(game => game.id === gameId)
);

export default gamesSlice.reducer;
