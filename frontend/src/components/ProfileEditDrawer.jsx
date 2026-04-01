import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { updateProfile } from '../store/studentSlice';
import { setUser } from '../store/authSlice';
import './ProfileEditDrawer.css';

/**
 * ProfileEditDrawer Component
 * 
 * Slide-over drawer for editing profile information.
 * Opens from the right side with smooth animation.
 * Pre-fills with existing profile data.
 */
function ProfileEditDrawer({ isOpen, onClose }) {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    const loading = useSelector((state) => state.student.loading);
    const error = useSelector((state) => state.student.error);

    const [formData, setFormData] = useState({
        student_name: '',
        class_section: '',
        father_name: '',
        mother_name: '',
        mobile: '',
        address: ''
    });

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (user && isOpen) {
            setFormData({
                student_name: user.student_name || '',
                class_section: user.class_section || '',
                father_name: user.father_name || '',
                mother_name: user.mother_name || '',
                mobile: user.mobile || '',
                address: user.address || ''
            });
        }
    }, [user, isOpen]);

    const validateForm = () => {
        const newErrors = {};

        if (!formData.student_name.trim()) {
            newErrors.student_name = 'Student name is required';
        }

        if (!formData.class_section.trim()) {
            newErrors.class_section = 'Class & Section is required';
        }

        if (!formData.father_name.trim()) {
            newErrors.father_name = "Father's name is required";
        }

        if (!formData.mother_name.trim()) {
            newErrors.mother_name = "Mother's name is required";
        }

        if (!formData.mobile.trim()) {
            newErrors.mobile = 'Mobile number is required';
        } else if (!/^\d{10}$/.test(formData.mobile)) {
            newErrors.mobile = 'Mobile must be 10 digits';
        }

        if (!formData.address.trim()) {
            newErrors.address = 'Address is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            const result = await dispatch(updateProfile(formData)).unwrap();
            
            // Sync with global auth state for real-time dashboard updates
            dispatch(setUser({ ...user, ...result }));
            
            onClose();
        } catch (err) {
            console.error('Profile update failed:', err);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="drawer-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        className="drawer-container"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                        {/* Header */}
                        <div className="drawer-header">
                            <div>
                                <h2 className="drawer-title">Edit Profile</h2>
                                <p className="drawer-subtitle">
                                    Update your personal information
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="drawer-close-button"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="drawer-form">
                            <div className="drawer-form-content">
                                {/* Student Name */}
                                <div className="drawer-field">
                                    <label className="drawer-label">Student Name *</label>
                                    <input
                                        type="text"
                                        name="student_name"
                                        value={formData.student_name}
                                        onChange={handleChange}
                                        className={`drawer-input ${errors.student_name ? 'error' : ''}`}
                                        placeholder="Enter full name"
                                    />
                                    {errors.student_name && (
                                        <span className="drawer-error">{errors.student_name}</span>
                                    )}
                                </div>

                                {/* Student ID (Disabled) */}
                                <div className="drawer-field">
                                    <label className="drawer-label">Student ID</label>
                                    <input
                                        type="text"
                                        value={profile?.student_id || ''}
                                        className="drawer-input"
                                        disabled
                                    />
                                    <span className="drawer-hint">Student ID cannot be changed</span>
                                </div>

                                {/* Class & Section */}
                                <div className="drawer-field">
                                    <label className="drawer-label">Class & Section *</label>
                                    <input
                                        type="text"
                                        name="class_section"
                                        value={formData.class_section}
                                        onChange={handleChange}
                                        className={`drawer-input ${errors.class_section ? 'error' : ''}`}
                                        placeholder="e.g., 8-A"
                                    />
                                    {errors.class_section && (
                                        <span className="drawer-error">{errors.class_section}</span>
                                    )}
                                </div>

                                {/* Father's Name */}
                                <div className="drawer-field">
                                    <label className="drawer-label">Father's Name *</label>
                                    <input
                                        type="text"
                                        name="father_name"
                                        value={formData.father_name}
                                        onChange={handleChange}
                                        className={`drawer-input ${errors.father_name ? 'error' : ''}`}
                                        placeholder="Enter father's name"
                                    />
                                    {errors.father_name && (
                                        <span className="drawer-error">{errors.father_name}</span>
                                    )}
                                </div>

                                {/* Mother's Name */}
                                <div className="drawer-field">
                                    <label className="drawer-label">Mother's Name *</label>
                                    <input
                                        type="text"
                                        name="mother_name"
                                        value={formData.mother_name}
                                        onChange={handleChange}
                                        className={`drawer-input ${errors.mother_name ? 'error' : ''}`}
                                        placeholder="Enter mother's name"
                                    />
                                    {errors.mother_name && (
                                        <span className="drawer-error">{errors.mother_name}</span>
                                    )}
                                </div>

                                {/* Mobile Number */}
                                <div className="drawer-field">
                                    <label className="drawer-label">Mobile Number *</label>
                                    <input
                                        type="tel"
                                        name="mobile"
                                        value={formData.mobile}
                                        onChange={handleChange}
                                        className={`drawer-input ${errors.mobile ? 'error' : ''}`}
                                        placeholder="10 digit mobile"
                                        maxLength={10}
                                    />
                                    {errors.mobile && (
                                        <span className="drawer-error">{errors.mobile}</span>
                                    )}
                                </div>

                                {/* Email (Disabled) */}
                                <div className="drawer-field">
                                    <label className="drawer-label">Email</label>
                                    <input
                                        type="email"
                                        value={profile?.email || ''}
                                        className="drawer-input"
                                        disabled
                                    />
                                    <span className="drawer-hint">Email cannot be changed</span>
                                </div>

                                {/* Address */}
                                <div className="drawer-field">
                                    <label className="drawer-label">Address *</label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className={`drawer-textarea ${errors.address ? 'error' : ''}`}
                                        placeholder="Enter complete address"
                                        rows={3}
                                    />
                                    {errors.address && (
                                        <span className="drawer-error">{errors.address}</span>
                                    )}
                                </div>

                                {error && (
                                    <div className="drawer-error-banner">
                                        {typeof error === 'string' ? error : 'An error occurred. Please try again.'}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="drawer-footer">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="drawer-button-cancel"
                                >
                                    Cancel
                                </button>
                                <motion.button
                                    type="submit"
                                    className="drawer-button-save"
                                    disabled={loading}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {loading ? (
                                        <span className="drawer-spinner"></span>
                                    ) : (
                                        'Save Changes'
                                    )}
                                </motion.button>
                            </div>
                        </form>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default ProfileEditDrawer;
