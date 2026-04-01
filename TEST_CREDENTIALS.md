# Test Credentials & Quick Start Guide

## 🚀 Running the Application

Both backend and frontend servers are already running:
- **Frontend**: http://localhost:3001
- **Backend API**: http://127.0.0.1:8000
- **API Docs**: http://127.0.0.1:8000/docs

## 📝 Test Account Credentials

Use any of these accounts to login:

### Account 1 (Recommended - Demo Account)
- **Email**: `demo@school.com`
- **Password**: `Demo@123`
- **Status**: ✅ Freshly created and tested

### Account 2 (Existing User)
- **Email**: `karanjparmar2301@gmail.com`
- **Password**: *(password hash stored, use Signup if needed)*

## 🔐 Authentication Flow

1. **Signup** → Creates new user account with email & password
2. **Login** → Returns JWT token & user profile
3. **Session Check** → Automatically restores session on page reload
4. **Token** → Stored in browser localStorage and included in all API requests

## 🛠️ Troubleshooting

### Seeing Login Errors in Console?
- Check browser console (F12) for detailed error messages with [Auth] prefix
- Verify email/password are correct
- Check that both backend & frontend servers are running

### Token Issues?
- Try logging out and logging back in
- Clear localStorage if needed (DevTools → Application → Storage)
- Token expires after 30 days (configured in backend)

### API Not Responding?
- Ensure backend is running: `http://127.0.0.1:8000/health`
- Check that port 8000 is not blocked by firewall
- Restart backend if needed: Kill the running task and run `.\start-servers.bat`

## ✅ Testing Checklist

- [ ] Signup with new email works
- [ ] Login with valid credentials works
- [ ] Page refresh maintains login session
- [ ] Logout clears session properly
- [ ] Protected routes redirect to login when unauthorized
- [ ] Dashboard loads with user data

## 📊 Next Steps

Once logged in:
1. View your dashboard with KPIs
2. Update your profile information
3. Explore homework assignments
4. Check your academic performance
5. Use the AI Study Assistant
6. Read digital textbooks

---
**Last Updated**: 2026-03-16
**Auth System**: JWT-based with localStorage persistence
