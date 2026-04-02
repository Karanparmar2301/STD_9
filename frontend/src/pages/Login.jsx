import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser, clearError } from '../store/authSlice';
import './Auth.css';

const DEMO_EMAIL = 'demo@school.com';
const DEMO_PASSWORD = 'Demo@123';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, error, user } = useSelector((state) => state.auth);

    useEffect(() => {
        if (user?.uid) {
            navigate(`/dashboard/${user.uid}`);
        }
    }, [user, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        dispatch(clearError());

        const result = await dispatch(loginUser({ email, password }));

        if (result.type === 'auth/login/fulfilled') {
            const token = result.payload.token || result.payload.access_token;
            const uid = result.payload.uid;
            if (token) localStorage.setItem('authToken', token);
            if (result.payload.refresh_token) {
                localStorage.setItem('refreshToken', result.payload.refresh_token);
            }
            navigate(`/dashboard/${uid}`);
        }
    };

    const handleUseDemoCredentials = () => {
        dispatch(clearError());
        setEmail(DEMO_EMAIL);
        setPassword(DEMO_PASSWORD);
    };

    const shouldShowError = !!error;

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1><span style={{ WebkitTextFillColor: "initial", background: "none" }}>🎓</span> Class 8 Portal</h1>
                    <p>Welcome back! Please sign in to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {shouldShowError && (
                        <div className="error-message">
                            {error.includes('Invalid login credentials') || error.includes('Invalid email')
                                ? 'Email or password is incorrect'
                                : error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your.email@example.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            required
                        />
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                    
                    <div style={{ textAlign: 'center', margin: '15px 0', color: '#666' }}>
                        <span>— OR —</span>
                    </div>

                    <button 
                        type="button" 
                        className="btn-secondary" 
                        style={{ width: '100%', padding: '12px', background: '#e1e1e1', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        onClick={handleUseDemoCredentials} 
                        disabled={loading}
                    >
                        Use Demo Credentials
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Don't have an account? <Link to="/signup">Create one</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;
