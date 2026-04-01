import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { apiService } from '../services/api';

// Async thunks
export const checkProfile = createAsyncThunk(
    'student/checkProfile',
    async (uid, { getState, rejectWithValue }) => {
        try {
            if (!uid || typeof uid !== 'string' || uid.length === 0) {
                return rejectWithValue('Invalid user ID');
            }
            const response = await apiService.checkProfile(uid);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.detail || error.message);
        }
    }
);

export const fetchStudentData = createAsyncThunk(
    'student/fetchData',
    async (uid, { getState, rejectWithValue }) => {
        try {
            // Validate UID before making API call
            if (!uid || typeof uid !== 'string' || uid.length === 0) {
                return rejectWithValue('Invalid user ID');
            }

            const { auth } = getState();
            const response = await axios.get(`/api/dashboard/${uid}`, {
                headers: {
                    Authorization: `Bearer ${auth.token}`
                }
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const createProfile = createAsyncThunk(
    'student/createProfile',
    async (profileData, { getState, rejectWithValue }) => {
        try {
            const response = await apiService.createProfile(profileData);
            return response.data;
        } catch (error) {
            // Handle Pydantic validation errors (422)
            if (error.response?.data?.detail) {
                const detail = error.response.data.detail;
                // If detail is an array (Pydantic validation errors)
                if (Array.isArray(detail)) {
                    const errorMsg = detail.map(err => {
                        const field = err.loc?.[err.loc.length - 1] || 'Field';
                        return `${field}: ${err.msg}`;
                    }).join(', ');
                    return rejectWithValue(errorMsg);
                }
                // If detail is a string
                return rejectWithValue(detail);
            }
            return rejectWithValue(error.message || 'Failed to create profile');
        }
    }
);

export const updateProfile = createAsyncThunk(
    'student/updateProfile',
    async (profileData, { getState, rejectWithValue }) => {
        try {
            const { auth } = getState();
            const uid = auth.user?.uid;
            if (!uid) {
                return rejectWithValue('User not authenticated');
            }
            const response = await apiService.updateProfile(uid, profileData);
            return response.data;
        } catch (error) {
            // Handle Pydantic validation errors (422)
            if (error.response?.data?.detail) {
                const detail = error.response.data.detail;
                // If detail is an array (Pydantic validation errors)
                if (Array.isArray(detail)) {
                    const errorMsg = detail.map(err => {
                        const field = err.loc?.[err.loc.length - 1] || 'Field';
                        return `${field}: ${err.msg}`;
                    }).join(', ');
                    return rejectWithValue(errorMsg);
                }
                // If detail is a string
                return rejectWithValue(detail);
            }
            return rejectWithValue(error.message || 'Failed to update profile');
        }
    }
);

export const uploadProfilePhoto = createAsyncThunk(
    'student/uploadProfilePhoto',
    async (file, { getState, rejectWithValue }) => {
        try {
            const { auth } = getState();
            if (!auth.user?.uid) {
                return rejectWithValue('User not authenticated');
            }

            // Validate file type
            const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                return rejectWithValue('Invalid file type. Please upload PNG, JPEG, or WEBP image.');
            }

            // Validate file size (2MB max)
            const maxSize = 2 * 1024 * 1024; // 2MB
            if (file.size > maxSize) {
                return rejectWithValue('File too large. Maximum size is 2MB.');
            }

            // Create FormData
            const formData = new FormData();
            formData.append('file', file);

            const response = await apiService.uploadProfilePhoto(formData);
            return response.data;
        } catch (error) {
            if (error.response?.data?.detail) {
                return rejectWithValue(error.response.data.detail);
            }
            return rejectWithValue(error.message || 'Failed to upload photo');
        }
    }
);

export const completeGame = createAsyncThunk(
    'student/completeGame',
    async (gameData, { getState, rejectWithValue }) => {
        try {
            const { auth } = getState();
            const response = await axios.post('/api/game/complete', gameData, {
                headers: {
                    Authorization: `Bearer ${auth.token}`
                }
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

export const completeAlphabetGame = createAsyncThunk(
    'student/completeAlphabetGame',
    async (gameData, { getState, rejectWithValue }) => {
        try {
            const { auth } = getState();
            const response = await axios.post('/api/game/alphabet/complete', gameData, {
                headers: {
                    Authorization: `Bearer ${auth.token}`
                }
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || error.message);
        }
    }
);

const studentSlice = createSlice({
    name: 'student',
    initialState: {
        profile: null,
        profileExists: null, // null = not checked, true = exists, false = doesn't exist
        rewardPoints: 0,
        achievementStars: 0,
        gamesPlayed: 0,
        highScore: 0,
        currentLevel: 1,
        loading: false,
        error: null,
        photoUploadStatus: 'idle', // 'idle', 'uploading', 'success', 'error'
        photoUploadError: null
    },
    reducers: {
        clearStudentError: (state) => {
            state.error = null;
        },
        setProfile: (state, action) => {
            state.profile = { ...state.profile, ...action.payload };
        }
    },
    extraReducers: (builder) => {
        builder
            // Check profile exists
            .addCase(checkProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(checkProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.profileExists = action.payload.exists;
                if (action.payload.exists && action.payload.profile) {
                    state.profile = action.payload.profile;
                    state.rewardPoints = action.payload.profile.reward_points || 0;
                    state.achievementStars = action.payload.profile.achievement_stars || 0;
                    state.gamesPlayed = action.payload.profile.games_played || 0;
                    state.highScore = action.payload.profile.high_score || 0;
                    state.currentLevel = action.payload.profile.current_level || 1;
                }
            })
            .addCase(checkProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Fetch student data
            .addCase(fetchStudentData.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchStudentData.fulfilled, (state, action) => {
                state.loading = false;
                state.profile = action.payload;
                state.profileExists = true;
                state.rewardPoints = action.payload.reward_points || 0;
                state.achievementStars = action.payload.achievement_stars || 0;
                state.gamesPlayed = action.payload.games_played || 0;
                state.highScore = action.payload.high_score || 0;
                state.currentLevel = action.payload.current_level || 1;
            })
            .addCase(fetchStudentData.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Create profile
            .addCase(createProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(createProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.profile = action.payload;
                state.profileExists = true; // Mark as existing after creation
                state.rewardPoints = action.payload.reward_points || 0;
                state.achievementStars = action.payload.achievement_stars || 0;
                state.gamesPlayed = action.payload.games_played || 0;
                state.highScore = action.payload.high_score || 0;
                state.currentLevel = action.payload.current_level || 1;
            })
            .addCase(createProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Update profile
            .addCase(updateProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(updateProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.profile = action.payload;
            })
            .addCase(updateProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Complete game
            .addCase(completeGame.fulfilled, (state, action) => {
                state.rewardPoints = action.payload.total_points;
                state.achievementStars = action.payload.achievement_stars;
                state.gamesPlayed = action.payload.games_played;
                state.highScore = action.payload.high_score;
                state.currentLevel = action.payload.current_level;
            })
            // Complete alphabet game
            .addCase(completeAlphabetGame.fulfilled, (state, action) => {
                state.rewardPoints = action.payload.total_points;
                state.achievementStars = action.payload.achievement_stars;
                state.gamesPlayed = action.payload.games_played;
                state.currentLevel = action.payload.current_level;
            })
            // Upload profile photo
            .addCase(uploadProfilePhoto.pending, (state) => {
                state.photoUploadStatus = 'uploading';
                state.photoUploadError = null;
            })
            .addCase(uploadProfilePhoto.fulfilled, (state, action) => {
                state.photoUploadStatus = 'success';
                // Update profile with new photo URL
                if (state.profile) {
                    state.profile.profile_photo_url = action.payload.photo_url;
                }
            })
            .addCase(uploadProfilePhoto.rejected, (state, action) => {
                state.photoUploadStatus = 'error';
                state.photoUploadError = action.payload;
            });
    }
});

export const { clearStudentError, setProfile } = studentSlice.actions;
export default studentSlice.reducer;
