import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { signupUser, clearError } from '../store/authSlice';
import './Auth.css';

function Signup() {
    const [formData, setFormData] = useState({
        name: '',
        studentId: '',
        classLevel: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error } = useSelector((state) => state.auth);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        dispatch(clearError());

        if (formData.password !== formData.confirmPassword) {
            alert('Passwords do not match!');
            return;
        }

        const result = await dispatch(signupUser({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            studentId: formData.studentId,
            classLevel: formData.classLevel,
        }));

        if (result.type === 'auth/signup/fulfilled') {
            navigate('/');  // Redirect to login — no email verify needed
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1><span style={{ WebkitTextFillColor: "initial", background: "none" }}>🎓</span> Create Account</h1>
                    <p>Join the Class 8 Portal platform</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && (
                        <div className="error-message">
                            {error.includes('already registered')
                                ? 'User already exists. Please sign in'
                                : error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="name">Student Name</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Enter student name"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="studentId">Student ID</label>
                        <input
                            type="text"
                            id="studentId"
                            name="studentId"
                            value={formData.studentId}
                            onChange={handleChange}
                            placeholder="e.g., STU001"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="classLevel">Class & Section</label>
                        <input
                            type="text"
                            id="classLevel"
                            name="classLevel"
                            value={formData.classLevel}
                            onChange={handleChange}
                            placeholder="e.g., 8-A"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="your.email@example.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Create a password"
                            autoComplete="new-password"
                            required
                            minLength="6"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="Confirm your password"
                            autoComplete="new-password"
                            required
                            minLength="6"
                        />
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Already have an account? <Link to="/">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Signup;
