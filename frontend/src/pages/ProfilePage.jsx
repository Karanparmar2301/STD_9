import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { updateProfile, uploadProfilePhoto } from '../store/studentSlice';
import { setUser } from '../store/authSlice';
import { buildBackendFileUrl } from '../services/api';
import ImageCropModal from '../components/ImageCropModal';
import './ProfilePage.css';

/**
 * ProfilePage - Advanced Academic Dashboard
 * 
 * University-style structured profile with:
 * - Academic Overview Strip
 * - Personal, Parent, Academic, Extra-curricular cards
 * - Performance & Attendance summaries
 * - Inline editing per section
 */
function ProfilePage() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    const loading = useSelector((state) => state.student.loading);
    const photoUploadStatus = useSelector((state) => state.student.photoUploadStatus);
    const attendanceStats = useSelector((state) => state.attendance?.stats);
    const performanceData = useSelector((state) => state.performance?.overallScore);
    
    // File input ref
    const fileInputRef = useRef(null);
    
    // Image crop modal state
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [selectedImageSrc, setSelectedImageSrc] = useState(null);
    
    // Edit mode state - per section
    const [editingSections, setEditingSections] = useState({
        personal: false,
        parent: false,
        academic: false,
        extraCurricular: false
    });
    const [formData, setFormData] = useState({});
    const [saveLoading, setSaveLoading] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Initialize form data - ensure string fields are strings (not arrays from old data)
    useEffect(() => {
        if (user) {
            const ensureString = (value) => {
                if (typeof value === 'string') return value;
                if (Array.isArray(value)) return value.join(', ');
                return value || '';
            };

            setFormData({
                student_name: user.student_name || '',
                gender: user.gender || 'Male',
                age: user.age || 14,
                dob: user.dob || '2012-01-01',
                mobile: user.mobile || '',
                email: user.email || user?.email || '',
                address: user.address || '',
                father_name: user.father_name || '',
                mother_name: user.mother_name || '',
                parent_contact: user.parent_contact || '',
                parent_email: user.parent_email || '',
                emergency_contact: user.emergency_contact || '',
                parent_occupation: user.parent_occupation || '',
                guardian_info: user.guardian_info || '',
                prev_term_grade: user.prev_term_grade || 'A',
                overall_percentage: user.overall_percentage || 85,
                attendance_percentage: Math.round(user.attendance_percentage || attendanceStats?.percentage || 95),
                best_subject: user.best_subject || 'Mathematics',
                weak_subject: user.weak_subject || 'Hindi',
                total_exams: user.total_exams || 8,
                homework_completion: user.homework_completion || 92,
                sports: ensureString(user.sports),
                arts: ensureString(user.arts),
                music: ensureString(user.music),
                clubs: ensureString(user.clubs),
                achievements: ensureString(user.achievements),
                awards: ensureString(user.awards),
                leadership_role: ensureString(user.leadership_role),
                community_service: ensureString(user.community_service)
            });
        }
    }, [user]);

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    };

    const calculateProfileCompleteness = () => {
        if (!user) return 0;
        const fields = [
            user.student_name, user.mobile, user.email, user.address,
            user.father_name, user.mother_name, user.gender, user.dob
        ];
        const filledFields = fields.filter(field => field && field !== 'Not provided').length;
        return Math.round((filledFields / fields.length) * 100);
    };

    const handleBack = () => navigate(-1);

    const toggleSectionEdit = (section) => {
        setEditingSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
        setSaveSuccess(false);
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaveLoading(true);
        setSaveSuccess(false);

        try {
            // Validation
            if (!formData.student_name?.trim()) {
                alert('Student name is required');
                setSaveLoading(false);
                return;
            }

            // Email validation
            if (formData.email && formData.email.trim()) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(formData.email)) {
                    alert('Please enter a valid email address');
                    setSaveLoading(false);
                    return;
                }
            }

            // Mobile validation (10 digits)
            if (formData.mobile && formData.mobile.trim()) {
                const mobileRegex = /^\d{10}$/;
                if (!mobileRegex.test(formData.mobile.replace(/\s/g, ''))) {
                    alert('Mobile number must be 10 digits');
                    setSaveLoading(false);
                    return;
                }
            }

            // Parent contact validation
            if (formData.parent_contact && formData.parent_contact.trim()) {
                const mobileRegex = /^\d{10}$/;
                if (!mobileRegex.test(formData.parent_contact.replace(/\s/g, ''))) {
                    alert('Parent contact must be 10 digits');
                    setSaveLoading(false);
                    return;
                }
            }

            // Parent email validation
            if (formData.parent_email && formData.parent_email.trim()) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(formData.parent_email)) {
                    alert('Please enter a valid parent email address');
                    setSaveLoading(false);
                    return;
                }
            }

            // Emergency contact validation (10 digits)
            if (formData.emergency_contact && formData.emergency_contact.trim()) {
                const mobileRegex = /^\d{10}$/;
                if (!mobileRegex.test(formData.emergency_contact.replace(/\s/g, ''))) {
                    alert('Emergency contact must be 10 digits');
                    setSaveLoading(false);
                    return;
                }
            }

            // Dispatch update action
            const result = await dispatch(updateProfile(formData)).unwrap();
            
            // Sync with global auth state for real-time updates
            dispatch(setUser({ ...user, ...result }));
            
            setSaveSuccess(true);
            setEditingSections({
                personal: false,
                parent: false,
                academic: false,
                extraCurricular: false
            });
            
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert(error || 'Failed to update profile');
        } finally {
            setSaveLoading(false);
        }
    };

    // Photo upload handlers
    const handlePhotoClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('Invalid file type. Please upload PNG, JPEG, or WEBP image.');
            return;
        }

        // Validate file size (10MB max for preview)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('File too large. Maximum size is 10MB.');
            return;
        }

        // Read file and show crop modal
        const reader = new FileReader();
        reader.onload = () => {
            setSelectedImageSrc(reader.result);
            setCropModalOpen(true);
        };
        reader.readAsDataURL(file);
        
        // Reset file input
        event.target.value = '';
    };

    const handleCropComplete = async (croppedImageBlob) => {
        try {
            // Convert blob to file
            const croppedFile = new File([croppedImageBlob], 'profile-photo.jpg', {
                type: 'image/jpeg'
            });

            const result = await dispatch(uploadProfilePhoto(croppedFile)).unwrap();
            
            // Sync photo with global auth state for real-time updates
            dispatch(setUser({ ...user, profile_photo_url: result.photo_url }));
            
            // Show success message
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Photo upload failed:', error);
            alert(error || 'Failed to upload photo');
        }
    };

    if (loading && !user) {
        return (
            <div className="profile-page-loading">
                <div className="spinner"></div>
                <p>Loading profile...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="profile-page-error">
                <h2>Profile not found</h2>
                <button onClick={handleBack}>Go Back</button>
            </div>
        );
    }

    const completeness = calculateProfileCompleteness();
    const attendancePercent = Math.round(attendanceStats?.percentage || 95);
    const overallGrade = formData.prev_term_grade || 'A';
    const bestSubject = formData.best_subject || 'Mathematics';
    const classTeacher = 'Mr. Sharma';

    return (
        <div className="profile-page academic-dashboard">
            {/* Success Toast */}
            <AnimatePresence>
                {saveSuccess && (
                    <motion.div 
                        className="success-toast"
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M16.667 5L7.5 14.167L3.333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Profile updated successfully!
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image Crop Modal */}
            <ImageCropModal
                isOpen={cropModalOpen}
                onClose={() => setCropModalOpen(false)}
                imageSrc={selectedImageSrc}
                onCropComplete={handleCropComplete}
            />

            {/* Back Button */}
            <div className="profile-container">
                <button className="back-button" onClick={handleBack}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M12 16L6 10L12 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Back
                </button>

                {/* Compact Professional Profile Header */}
                <motion.div 
                    className="profile-header-compact"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    {/* Main Horizontal Row */}
                    <div className="header-main-row">
                        {/* Left: Avatar + Name + Badges (All Horizontal) */}
                        <div className="header-left-section">
                            <div className="avatar-wrapper-upload" onClick={handlePhotoClick}>
                                <div className="avatar-compact">
                                    {user.profile_photo_url ? (
                                        <img 
                                            src={buildBackendFileUrl(user.profile_photo_url)} 
                                            alt={user.student_name}
                                            className="avatar-photo"
                                        />
                                    ) : (
                                        getInitials(user.student_name)
                                    )}
                                    <div className="status-indicator active"></div>
                                </div>
                                <div className="avatar-edit-overlay">
                                    {photoUploadStatus === 'uploading' ? (
                                        <div className="upload-spinner"></div>
                                    ) : (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                                <circle cx="12" cy="13" r="4"></circle>
                                            </svg>
                                            <span>Edit</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                            <h2 className="student-name-compact">{user.student_name}</h2>
                            <span className="class-badge-inline">{user.class_section}</span>
                            <span className="email-verified-inline">
                                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                                    <path d="M12.833 6.417v.583a5.833 5.833 0 11-3.458-5.333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M12.833 2.333L7 8.172 5.25 6.422" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                Verified
                            </span>
                        </div>

                        {/* Right: Compact KPI Cards */}
                        <div className="header-kpi-group">
                            <div className="kpi-card-compact">
                                <div className="kpi-icon-compact">📚</div>
                                <div className="kpi-content-compact">
                                    <div className="kpi-label-compact">Class & Section</div>
                                    <div className="kpi-value-compact">8-A</div>
                                </div>
                            </div>
                            <div className="kpi-card-compact">
                                <div className="kpi-icon-compact">✓</div>
                                <div className="kpi-content-compact">
                                    <div className="kpi-label-compact">Attendance</div>
                                    <div className="kpi-value-compact">{attendancePercent}%</div>
                                </div>
                            </div>
                            <div className="kpi-card-compact">
                                <div className="kpi-icon-compact">🎯</div>
                                <div className="kpi-content-compact">
                                    <div className="kpi-label-compact">Overall Grade</div>
                                    <div className="kpi-value-compact">{overallGrade}</div>
                                </div>
                            </div>
                            <div className="kpi-card-compact">
                                <div className="kpi-icon-compact">👨‍🏫</div>
                                <div className="kpi-content-compact">
                                    <div className="kpi-label-compact">Class Teacher</div>
                                    <div className="kpi-value-compact">{classTeacher}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Conditional Progress Bar - Only show if < 100% */}
                    {completeness < 100 && (
                        <motion.div 
                            className="header-progress-section"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="progress-header-compact">
                                <span className="progress-label-compact">Profile Completeness</span>
                                <span className="progress-percent-compact">{completeness}%</span>
                            </div>
                            <div className="progress-track-compact">
                                <motion.div 
                                    className="progress-fill-compact"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${completeness}%` }}
                                    transition={{ duration: 1, delay: 0.3 }}
                                />
                            </div>
                        </motion.div>
                    )}
                </motion.div>

                {/* Main Grid Section */}
                <div className="dashboard-grid">
                    {/* Personal Information Card */}
                    <motion.div 
                        className="info-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="card-header">
                            <div className="card-title">
                                <span className="card-icon">👤</span>
                                <h3>Personal Information</h3>
                            </div>
                            <button 
                                className="edit-icon-btn"
                                onClick={() => toggleSectionEdit('personal')}
                            >
                                {editingSections.personal ? '✕' : '✏️'}
                            </button>
                        </div>
                        <div className="card-body">
                            <div className="info-row">
                                <span className="info-label">Student Name</span>
                                {editingSections.personal ? (
                                    <input 
                                        type="text"
                                        className="info-input"
                                        value={formData.student_name}
                                        onChange={(e) => handleInputChange('student_name', e.target.value)}
                                    />
                                ) : (
                                    <span className="info-value">{user.student_name}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Gender</span>
                                {editingSections.personal ? (
                                    <select 
                                        className="info-input"
                                        value={formData.gender}
                                        onChange={(e) => handleInputChange('gender', e.target.value)}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                ) : (
                                    <span className="info-value">{formData.gender}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Age</span>
                                <span className="info-value">{formData.age} years</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Date of Birth</span>
                                {editingSections.personal ? (
                                    <input 
                                        type="date"
                                        className="info-input"
                                        value={formData.dob}
                                        onChange={(e) => handleInputChange('dob', e.target.value)}
                                    />
                                ) : (
                                    <span className="info-value">{formData.dob}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Mobile</span>
                                {editingSections.personal ? (
                                    <input 
                                        type="tel"
                                        className="info-input"
                                        value={formData.mobile}
                                        onChange={(e) => handleInputChange('mobile', e.target.value)}
                                    />
                                ) : (
                                    <span className="info-value">{user.mobile || 'Not provided'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Email</span>
                                {editingSections.personal ? (
                                    <input 
                                        type="email"
                                        className="info-input"
                                        value={formData.email}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                    />
                                ) : (
                                    <span className="info-value">{user.email || user?.email}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Address</span>
                                {editingSections.personal ? (
                                    <input 
                                        type="text"
                                        className="info-input"
                                        value={formData.address}
                                        onChange={(e) => handleInputChange('address', e.target.value)}
                                    />
                                ) : (
                                    <span className="info-value">{user.address || 'Not provided'}</span>
                                )}
                            </div>

                            {editingSections.personal && (
                                <div className="card-actions">
                                    <button className="btn-save" onClick={handleSave} disabled={saveLoading}>
                                        {saveLoading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button className="btn-cancel" onClick={() => toggleSectionEdit('personal')}>
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Parent Information Card */}
                    <motion.div 
                        className="info-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="card-header">
                            <div className="card-title">
                                <span className="card-icon">👨‍👩‍👦</span>
                                <h3>Parent Information</h3>
                            </div>
                            <button 
                                className="edit-icon-btn"
                                onClick={() => toggleSectionEdit('parent')}
                            >
                                {editingSections.parent ? '✕' : '✏️'}
                            </button>
                        </div>
                        <div className="card-body">
                            <div className="info-row">
                                <span className="info-label">Father's Name</span>
                                {editingSections.parent ? (
                                    <input 
                                        type="text"
                                        className="info-input"
                                        value={formData.father_name}
                                        onChange={(e) => handleInputChange('father_name', e.target.value)}
                                    />
                                ) : (
                                    <span className="info-value">{user.father_name || 'Not provided'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Mother's Name</span>
                                {editingSections.parent ? (
                                    <input 
                                        type="text"
                                        className="info-input"
                                        value={formData.mother_name}
                                        onChange={(e) => handleInputChange('mother_name', e.target.value)}
                                    />
                                ) : (
                                    <span className="info-value">{user.mother_name || 'Not provided'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Contact</span>
                                {editingSections.parent ? (
                                    <input 
                                        type="tel"
                                        className="info-input"
                                        value={formData.parent_contact}
                                        onChange={(e) => handleInputChange('parent_contact', e.target.value)}
                                    />
                                ) : (
                                    <span className="info-value">{formData.parent_contact || 'Not provided'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Occupation</span>
                                {editingSections.parent ? (
                                    <input 
                                        type="text"
                                        className="info-input"
                                        value={formData.parent_occupation}
                                        onChange={(e) => handleInputChange('parent_occupation', e.target.value)}
                                    />
                                ) : (
                                    <span className="info-value">{formData.parent_occupation || 'Not provided'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Parent Email</span>
                                {editingSections.parent ? (
                                    <input 
                                        type="email"
                                        className="info-input"
                                        value={formData.parent_email}
                                        onChange={(e) => handleInputChange('parent_email', e.target.value)}
                                        placeholder="example@email.com"
                                    />
                                ) : (
                                    <span className="info-value">{formData.parent_email || 'Not provided'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Emergency Contact</span>
                                {editingSections.parent ? (
                                    <input 
                                        type="tel"
                                        className="info-input"
                                        value={formData.emergency_contact}
                                        onChange={(e) => handleInputChange('emergency_contact', e.target.value)}
                                        placeholder="10-digit number"
                                    />
                                ) : (
                                    <span className="info-value">{formData.emergency_contact || 'Not provided'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Guardian Info</span>
                                {editingSections.parent ? (
                                    <input 
                                        type="text"
                                        className="info-input"
                                        value={formData.guardian_info}
                                        onChange={(e) => handleInputChange('guardian_info', e.target.value)}
                                    />
                                ) : (
                                    <span className="info-value">{formData.guardian_info || 'Same as parent'}</span>
                                )}
                            </div>

                            {editingSections.parent && (
                                <div className="card-actions">
                                    <button className="btn-save" onClick={handleSave} disabled={saveLoading}>
                                        {saveLoading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button className="btn-cancel" onClick={() => toggleSectionEdit('parent')}>
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Academic Information Card */}
                    <motion.div 
                        className="info-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className="card-header">
                            <div className="card-title">
                                <span className="card-icon">📊</span>
                                <h3>Academic Information</h3>
                            </div>
                            <button 
                                className="edit-icon-btn"
                                onClick={() => toggleSectionEdit('academic')}
                            >
                                {editingSections.academic ? '✕' : '✏️'}
                            </button>
                        </div>
                        <div className="card-body">
                            <div className="info-row">
                                <span className="info-label">Previous Term Grade</span>
                                {editingSections.academic ? (
                                    <select 
                                        className="info-input"
                                        value={formData.prev_term_grade}
                                        onChange={(e) => handleInputChange('prev_term_grade', e.target.value)}
                                    >
                                        <option value="A+">A+</option>
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                        <option value="D">D</option>
                                    </select>
                                ) : (
                                    <span className="info-value grade-badge">{formData.prev_term_grade}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Overall Percentage</span>
                                <span className="info-value">{formData.overall_percentage}%</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Attendance</span>
                                <span className="info-value">{formData.attendance_percentage}%</span>
                            </div>
                            <div className="info-row">
                                <span className="info-label">Best Scoring Subject</span>
                                {editingSections.academic ? (
                                    <input 
                                        type="text"
                                        className="info-input"
                                        value={formData.best_subject}
                                        onChange={(e) => handleInputChange('best_subject', e.target.value)}
                                    />
                                ) : (
                                    <span className="info-value strength">{formData.best_subject}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Weak Subject</span>
                                {editingSections.academic ? (
                                    <input 
                                        type="text"
                                        className="info-input"
                                        value={formData.weak_subject}
                                        onChange={(e) => handleInputChange('weak_subject', e.target.value)}
                                    />
                                ) : (
                                    <span className="info-value weakness">{formData.weak_subject}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Total Exams Completed</span>
                                <span className="info-value">{formData.homework_completion}%</span>
                            </div>

                            {editingSections.academic && (
                                <div className="card-actions">
                                    <button className="btn-save" onClick={handleSave} disabled={saveLoading}>
                                        {saveLoading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button className="btn-cancel" onClick={() => toggleSectionEdit('academic')}>
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Extra Curricular Card */}
                    <motion.div 
                        className="info-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className="card-header">
                            <div className="card-title">
                                <span className="card-icon">🎨</span>
                                <h3>Extra Curricular</h3>
                            </div>
                            <button 
                                className="edit-icon-btn"
                                onClick={() => toggleSectionEdit('extraCurricular')}
                            >
                                {editingSections.extraCurricular ? '✕' : '✏️'}
                            </button>
                        </div>
                        <div className="card-body">
                            <div className="info-row">
                                <span className="info-label">Sports</span>
                                {editingSections.extraCurricular ? (
                                    <input 
                                        type="text"
                                        className="info-input"
                                        value={formData.sports}
                                        onChange={(e) => handleInputChange('sports', e.target.value)}
                                        placeholder="e.g., Cricket, Football"
                                    />
                                ) : (
                                    <span className="info-value">{formData.sports || 'Not specified'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Arts</span>
                                {editingSections.extraCurricular ? (
                                    <input 
                                        type="text"
                                        className="info-input"
                                        value={formData.arts}
                                        onChange={(e) => handleInputChange('arts', e.target.value)}
                                        placeholder="e.g., Drawing, Painting"
                                    />
                                ) : (
                                    <span className="info-value">{formData.arts || 'Not specified'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Music</span>
                                {editingSections.extraCurricular ? (
                                    <input 
                                        type="text"
                                        className="info-input"
                                        value={formData.music}
                                        onChange={(e) => handleInputChange('music', e.target.value)}
                                        placeholder="e.g., Guitar, Vocals"
                                    />
                                ) : (
                                    <span className="info-value">{formData.music || 'Not specified'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Achievements</span>
                                {editingSections.extraCurricular ? (
                                    <textarea 
                                        className="info-textarea"
                                        value={formData.achievements}
                                        onChange={(e) => handleInputChange('achievements', e.target.value)}
                                        placeholder="List your achievements"
                                        rows="2"
                                    />
                                ) : (
                                    <span className="info-value">{formData.achievements || 'Not specified'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Awards</span>
                                {editingSections.extraCurricular ? (
                                    <textarea 
                                        className="info-textarea"
                                        value={formData.awards}
                                        onChange={(e) => handleInputChange('awards', e.target.value)}
                                        placeholder="List your awards"
                                        rows="2"
                                    />
                                ) : (
                                    <span className="info-value">{formData.awards || 'Not specified'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Leadership Role</span>
                                {editingSections.extraCurricular ? (
                                    <input 
                                        type="text"
                                        className="info-input"
                                        value={formData.leadership_role}
                                        onChange={(e) => handleInputChange('leadership_role', e.target.value)}
                                        placeholder="e.g., Class Monitor, House Captain"
                                    />
                                ) : (
                                    <span className="info-value">{formData.leadership_role || 'Not specified'}</span>
                                )}
                            </div>
                            <div className="info-row">
                                <span className="info-label">Community Service</span>
                                {editingSections.extraCurricular ? (
                                    <textarea 
                                        className="info-textarea"
                                        value={formData.community_service}
                                        onChange={(e) => handleInputChange('community_service', e.target.value)}
                                        placeholder="e.g., 10 Hours - Cleanliness Drive"
                                        rows="2"
                                    />
                                ) : (
                                    <span className="info-value">{formData.community_service || 'Not specified'}</span>
                                )}
                            </div>

                            {editingSections.extraCurricular && (
                                <div className="card-actions">
                                    <button className="btn-save" onClick={handleSave} disabled={saveLoading}>
                                        {saveLoading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button className="btn-cancel" onClick={() => toggleSectionEdit('extraCurricular')}>
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

export default ProfilePage;
