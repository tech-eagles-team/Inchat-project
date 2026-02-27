# WebSocket Fix - Quick Start Test

## 🚀 What Was Fixed

1. ✅ **Socket URL** - Now connects to `http://localhost:5000` (was trying 5173)
2. ✅ **Client .env** - Created with correct environment variables  
3. ✅ **Logging** - Added detailed debugging messages
4. ✅ **Error Handling** - Better error recovery and diagnostics

---

## ⚡ Quick Test (5 minutes)

### Terminal 1 - Start MongoDB
```bash
mongod
```
Expected: Shows connection info, **no errors**

---

### Terminal 2 - Start Server
```bash
cd server
npm run dev
```

Expected to see:
```
✅ MongoDB connected successfully
🚀 Server running on port 5000
```

---

### Terminal 3 - Start Client
```bash
cd client
npm run dev
```

Expected to see:
```
  ➜  Local:   http://localhost:5173/
```

---

## 🧪 Test in Browser

1. **Open** `http://localhost:5173`
2. **Open DevTools** - Press `F12`
3. **Go to Console tab**
4. **Check for these messages:**

✅ **Good Console Output:**
```
✅ Socket URL resolved to: http://localhost:5000
🔌 Connecting to socket: http://localhost:5000
✅ Auth ready, initializing socket and chats
Socket connection attempt: Success
```

❌ **Bad Console Output (if you see these, problem still exists):**
```
ws://localhost:5173/socket.io/
GET http://localhost:5173/api/chats 500
Socket connection error: Error: timeout
```

---

## 🧑‍💻 Test Workflow

### Test 1: Login
1. Click "Register" or "Login"
2. Register: `email: test@test.com`, `password: Test123!`, `name: Test User`
3. Check Console: Should see ✅ messages
4. Should navigate to Chat page

### Test 2: Socket Connection
1. In Console, you should see:
   ```
   🔌 Connecting to socket: http://localhost:5000
   ✅ Socket connected: socket-id-xxx
   ```

### Test 3: Load Chats
1. In Console, you should see:
   ```
   📬 Fetching chats for user: 6xxx
   ✅ Found 0 chats
   ```

### Test 4: Page Refresh
1. Press `F5` to refresh
2. Should stay logged in
3. Should still see chats
4. Socket should reconnect

---

## 🔍 If Something's Wrong

### Error: "WebSocket is closed before..."
**Cause:** Socket still connecting to wrong URL

**Fix:**
1. Check `client/.env` exists and has:
   ```
   VITE_SOCKET_URL=http://localhost:5000
   ```
2. Restart dev server: Kill `npm run dev` and run again
3. Hard refresh browser: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)

---

### Error: "GET ... 500 (Internal Server Error)"
**Cause:** Server error - usually auth or database issue

**Fix:**
1. Check MongoDB is running (Terminal 1 should show mongod output)
2. Check server logs for error message (Terminal 2)
3. Look for: `❌ Error fetching chats:` or `❌ Auth error:`
4. Make sure you're logged in (check localStorage in DevTools)

---

### Error: "Socket connection error: timeout"
**Cause:** Server not running or wrong port

**Fix:**
1. Is Server running in Terminal 2? 
   - Should show: `🚀 Server running on port 5000`
2. Is port 5000 in use? Try: `netstat -an | grep 5000`
3. Restart server

---

## ✅ Success Checklist

After testing, verify these:

- [ ] Can see `✅ Socket URL resolved to: http://localhost:5000`
- [ ] Can see `🔌 Connecting to socket: http://localhost:5000`
- [ ] Socket status shows "connected"
- [ ] No 500 errors in Network tab
- [ ] Chats display (even if count is 0)
- [ ] Page refresh keeps you logged in
- [ ] No red error messages in Console

---

## 📊 Network Tab Check

1. Open DevTools → **Network** tab
2. Login and look for these requests:

| Request | Status | Headers |
|---------|--------|---------|
| `auth/login` | 200 | POST |
| `chats` | 200 | GET + `Authorization: Bearer ...` |
| `socket.io` | 101 | WebSocket |

**Should NOT see:**
- ❌ 500 errors
- ❌ 401 errors (unless you logout)
- ❌ Requests to `localhost:5173/api/`

---

## 📱 Local Storage Check

**DevTools → Application → Local Storage → http://localhost:5173**

Should have these keys:
- `auth-storage` - Contains user and tokens
- `chat-storage` - Contains cached chats
- `darkMode` - Dark mode preference

---

## 🎯 What Should Work Now

✅ Login/Register works  
✅ Socket connects to correct server  
✅ Chats load without 500 errors  
✅ Page refresh keeps you logged in  
✅ Can see detailed logs for debugging  

---

## 📋 Files Changed

- `client/.env` - Created (new file with URLs)
- `client/src/services/socket.js` - Fixed URL resolution
- `client/src/pages/Chat.jsx` - Better initialization
- `client/src/api/axios.js` - Better error logging
- `server/routes/chats.js` - Added logging
- `server/middleware/auth.js` - Added logging

---

## 🆘 Still Having Issues?

1. **Check the detailed guide:** `WEBSOCKET_FIX_GUIDE.md`
2. **Check server logs** - Look for error messages with ❌
3. **Check browser console** - Look for actual error text
4. **Verify MongoDB is running** - `mongod` should show connection info
5. **Check ports are accessible:**
   ```bash
   # Check if ports are in use
   netstat -an | grep 5000  # Server
   netstat -an | grep 5173  # Client
   netstat -an | grep 27017 # MongoDB
   ```

---

## 🚀 Next Steps (After Fix Works)

1. Test sending a message
2. Test page refresh during chat
3. Test opening multiple chats
4. Test on mobile/different browser
5. Check performance in Network tab

---

**✅ All fixes applied! Now test it out! 🎉**
