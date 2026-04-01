import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { createProfile } from '../store/studentSlice';
import './ProfileCompletionModal.css';

/**
 * ProfileCompletionModal Component
 * 
 * Mandatory modal shown on first login when profile is incomplete.
 * Cannot be closed until profile is completed.
 * Features smooth animations and form validation.
 */
function ProfileCompletionModal({ isOpen, onComplete }) {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);
    const loading = useSelector((state) => state.student.loading);
    const error = useSelector((state) => state.student.error);

    const [formData, setFormData] = useState({
        student_name: '',
        student_id: '',
        class_section: '',
        father_name: '',
        mother_name: '',
        mobile: '',
        email: user?.email || '',
        address: ''
    });

    const [errors, setErrors] = useState({});

    const validateForm = () => {
        const newErrors = {};

        if (!formData.student_name.trim()) {
            newErrors.student_name = 'Student name is required';
        }

        if (!formData.student_id.trim()) {
            newErrors.student_id = 'Student ID is required';
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
            const profileData = {
                uid: user?.uid,
                ...formData
            };

            await dispatch(createProfile(profileData)).unwrap();
            onComplete();
        } catch (err) {
            console.error('Profile creation failed:', err);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="modal-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <motion.div
                        className="modal-container"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                        <div className="modal-header">
                            <h2 className="modal-title">Complete Your Profile</h2>
                            <p className="modal-subtitle">
                                Please provide your information to get started
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-grid">
                                {/* Student Name */}
                                <div className="form-field">
                                    <label className="form-label">Student Name *</label>
                                    <input
                                        type="text"
                                        name="student_name"
                                        value={formData.student_name}
                                        onChange={handleChange}
                                        className={`form-input ${errors.student_name ? 'error' : ''}`}
                                        placeholder="Enter full name"
                                    />
                                    {errors.student_name && (
                                        <span className="error-text">{errors.student_name}</span>
                                    )}
                                </div>

                                {/* Student ID */}
                                <div className="form-field">
                                    <label className="form-label">Student ID *</label>
                                    <input
                                        type="text"
                                        name="student_id"
                                        value={formData.student_id}
                                        onChange={handleChange}
                                        className={`form-input ${errors.student_id ? 'error' : ''}`}
                                        placeholder="Enter student ID"
                                    />
                                    {errors.student_id && (
                                        <span className="error-text">{errors.student_id}</span>
                                    )}
                                </div>

                                {/* Class & Section */}
                                <div className="form-field">
                                    <label className="form-label">Class & Section *</label>
                                    <input
                                        type="text"
                                        name="class_section"
                                        value={formData.class_section}
                                        onChange={handleChange}
                                        className={`form-input ${errors.class_section ? 'error' : ''}`}
                                        placeholder="e.g., 8-A"
                                    />
                                    {errors.class_section && (
                                        <span className="error-text">{errors.class_section}</span>
                                    )}
                                </div>

                                {/* Father's Name */}
                                <div className="form-field">
                                    <label className="form-label">Father's Name *</label>
                                    <input
                                        type="text"
                                        name="father_name"
                                        value={formData.father_name}
                                        onChange={handleChange}
                                        className={`form-input ${errors.father_name ? 'error' : ''}`}
                                        placeholder="Enter father's name"
                                    />
                                    {errors.father_name && (
                                        <span className="error-text">{errors.father_name}</span>
                                    )}
                                </div>

                                {/* Mother's Name */}
                                <div className="form-field">
                                    <label className="form-label">Mother's Name *</label>
                                    <input
                                        type="text"
                                        name="mother_name"
                                        value={formData.mother_name}
                                        onChange={handleChange}
                                        className={`form-input ${errors.mother_name ? 'error' : ''}`}
                                        placeholder="Enter mother's name"
                                    />
                                    {errors.mother_name && (
                                        <span className="error-text">{errors.mother_name}</span>
                                    )}
                                </div>

                                {/* Mobile Number */}
                                <div className="form-field">
                                    <label className="form-label">Mobile Number *</label>
                                    <input
                                        type="tel"
                                        name="mobile"
                                        value={formData.mobile}
                                        onChange={handleChange}
                                        className={`form-input ${errors.mobile ? 'error' : ''}`}
                                        placeholder="10 digit mobile"
                                        maxLength={10}
                                    />
                                    {errors.mobile && (
                                        <span className="error-text">{errors.mobile}</span>
                                    )}
                                </div>

                                {/* Email (disabled) */}
                                <div className="form-field">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        className="form-input"
                                        disabled
                                    />
                                </div>

                                {/* Address (full width) */}
                                <div className="form-field form-field-full">
                                    <label className="form-label">Address *</label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className={`form-textarea ${errors.address ? 'error' : ''}`}
                                        placeholder="Enter complete address"
                                        rows={3}
                                    />
                                    {errors.address && (
                                        <span className="error-text">{errors.address}</span>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <div className="error-banner">
                                    {typeof error === 'string' ? error : 'An error occurred. Please try again.'}
                                </div>
                            )}

                            <div className="modal-footer">
                                <motion.button
                                    type="submit"
                                    className="submit-button"
                                    disabled={loading}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {loading ? (
                                        <span className="loading-spinner"></span>
                                    ) : (
                                        'Complete Profile'
                                    )}
                                </motion.button>
                            </div>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default ProfileCompletionModal;
