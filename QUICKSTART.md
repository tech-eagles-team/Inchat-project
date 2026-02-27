# Quick Start Guide

Get the chat application running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- MongoDB running (local or Atlas)
- Email account for OTP (Gmail recommended)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# From project root
npm run install-all
```

Or manually:
```bash
npm install
cd server && npm install
cd ../client && npm install
```

### 2. Configure MongoDB

**Option A: Local MongoDB**
- Install MongoDB from [mongodb.com](https://www.mongodb.com/try/download/community)
- Start MongoDB service
- Connection string: `mongodb://localhost:27017/chatapp`

**Option B: MongoDB Atlas (Cloud)**
- Create free account at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- Create a cluster
- Get connection string
- Example: `mongodb+srv://username:password@cluster.mongodb.net/chatapp`

### 3. Configure Email (for OTP)

**Gmail Setup:**
1. Go to Google Account Settings
2. Enable 2-Step Verification
3. Generate App Password: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Use the generated app password (not your regular password)

### 4. Create Environment File

Create `server/.env`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/chatapp

JWT_SECRET=change-this-to-random-string-in-production
JWT_REFRESH_SECRET=change-this-to-random-string-in-production
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@chatapp.com

OTP_EXPIRE_MINUTES=10
OTP_MAX_ATTEMPTS=5

MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

ENCRYPTION_KEY=generate-32-character-random-string
```

**Generate encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 5. Create Upload Directories

```bash
cd server
mkdir -p uploads/profiles uploads/media uploads/status uploads/temp
```

### 6. Start the Application

**Development Mode (both server and client) - FROM ROOT:**
```bash
npm run dev
```

**Or run separately:**

Terminal 1 - Server:
```bash
npm run server
```

Terminal 2 - Client:
```bash
npm run client
```

Or manually:

Terminal 1 - Server:
```bash
cd server
npm run dev
```

Terminal 2 - Client:
```bash
cd client
npm run dev
```

### 7. Access the Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/api/health

## First Login

1. Open http://localhost:5173
2. Enter your email address
3. Click "Send OTP"
4. Check your email for the 6-digit code
5. Enter the OTP and your display name
6. Click "Verify & Login"

## Testing the Application

1. **Create Multiple Accounts**: Use different emails to test multi-user features
2. **Start a Chat**: Search for users and start conversations
3. **Send Messages**: Try text, images, and other media types
4. **Create Groups**: Test group chat functionality
5. **Test Features**: Try all the features like replies, forwarding, etc.

## Troubleshooting

### MongoDB Connection Error
```
Error: MongoDB connection error
```
**Solution:** 
- Ensure MongoDB is running: `mongod` or check service status
- Verify `MONGODB_URI` in `.env` is correct
- Check MongoDB is accessible on port 27017

### Email/OTP Not Sending
```
Failed to send email
```
**Solution:**
- Verify email credentials in `.env`
- For Gmail, use App Password (not regular password)
- Check if 2-Step Verification is enabled
- Verify SMTP settings

### Port Already in Use
```
Error: Port 5000 already in use
```
**Solution:**
- Change `PORT` in `server/.env` to another port (e.g., 5001)
- Update client proxy in `client/vite.config.js` if needed

### Socket Connection Failed
```
Socket not connected
```
**Solution:**
- Ensure server is running
- Check CORS settings in `server/index.js`
- Verify `CLIENT_URL` matches your frontend URL

### Module Not Found
```
Error: Cannot find module
```
**Solution:**
- Run `npm install` in the directory with the error
- Delete `node_modules` and `package-lock.json`, then reinstall
- Check Node.js version: `node --version` (should be 18+)

## Next Steps

- Read [README.md](README.md) for full documentation
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- Customize the UI and features as needed
- Set up monitoring and logging for production

## Support

If you encounter issues:
1. Check the console for error messages
2. Verify all environment variables are set correctly
3. Ensure all dependencies are installed
4. Check MongoDB and email service connectivity

---

**Happy Chatting! 💬**

