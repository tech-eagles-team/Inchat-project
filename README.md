# WhatsApp Clone - Real-time Chat Application

A production-ready, full-featured real-time chat application built with React, Node.js, and WebSockets, featuring WhatsApp-style UI and comprehensive messaging capabilities.

## 🚀 Features

### Authentication
- ✅ Email + OTP authentication (primary login method)
- ✅ Optional phone number (never mandatory)
- ✅ Optional password setup after first login
- ✅ JWT access tokens + refresh tokens
- ✅ Secure session management
- ✅ Rate limiting & brute-force protection

### User Features
- ✅ Profile management (photo, name, username, bio)
- ✅ Privacy controls (last seen, profile photo, status visibility)
- ✅ Block & report users
- ✅ Account deletion & data cleanup

### Messaging
- ✅ 1-to-1 private chats
- ✅ Group chats with admin controls
- ✅ Text messages with emoji support
- ✅ Image messages (with compression & thumbnails)
- ✅ Video messages (with streaming)
- ✅ Audio messages (record & send)
- ✅ Document & file sharing
- ✅ Message replies
- ✅ Message forwarding
- ✅ Message deletion (for me / for everyone)
- ✅ Message starring
- ✅ Message search
- ✅ Typing indicators
- ✅ Read receipts (✓, ✓✓, ✓✓ blue)
- ✅ Delivered receipts

### Group Features
- ✅ Create & manage groups
- ✅ Add/remove members
- ✅ Admin roles & permissions
- ✅ Group profile image & description
- ✅ Mute groups
- ✅ Group invite links

### Real-time Features
- ✅ WebSocket-based real-time messaging
- ✅ Online/offline status
- ✅ Presence system
- ✅ Live typing indicators
- ✅ Instant message delivery

### UI/UX
- ✅ WhatsApp-inspired modern UI
- ✅ Light & Dark mode
- ✅ Fully responsive (mobile, tablet, desktop)
- ✅ Smooth animations
- ✅ Optimized scrolling
- ✅ Accessibility-friendly

### Security
- ✅ End-to-end encryption for messages
- ✅ Secure key exchange
- ✅ Encrypted message storage
- ✅ HTTPS support
- ✅ Input validation & sanitization
- ✅ XSS, CSRF protection
- ✅ Role-based access control

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB (v5 or higher)
- npm or yarn

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd Chat_app02
```

### 2. Install dependencies

**Shortcut (recommended):**
```bash
npm run install-all
```

**Or manually:**
```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Environment Setup

Create a `.env` file in the `server` directory:

```bash
cd server
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/chatapp

# JWT Secrets (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# Email Configuration (for OTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@chatapp.com

# OTP Configuration
OTP_EXPIRE_MINUTES=10
OTP_MAX_ATTEMPTS=5

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here

# AI API (optional)
OPENAI_API_KEY=your-openai-api-key
```

### 4. Create upload directories

```bash
cd server
mkdir -p uploads/profiles uploads/media uploads/status uploads/temp
```

## 🚀 Running the Application

### Development Mode

**From the root directory (recommended):**

```bash
npm run dev
```

This will start both the server (port 5000) and client (port 5173) concurrently.

**Or using individual commands from root:**

```bash
# Terminal 1
npm run server

# Terminal 2
npm run client
```

**Or run them manually:**

**Terminal 1 - Server:**
```bash
cd server
npm run dev
```

**Terminal 2 - Client:**
```bash
cd client
npm run dev
```

### Production Build

```bash
# Build client
npm run build

# Start server
cd server
npm start
```

## 📁 Project Structure

```
Chat_app02/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── api/           # API client functions
│   │   ├── store/         # State management (Zustand)
│   │   ├── services/      # Services (Socket, etc.)
│   │   └── hooks/         # Custom React hooks
│   ├── public/
│   └── package.json
├── server/                 # Node.js backend
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   ├── middleware/        # Express middleware
│   ├── utils/             # Utility functions
│   ├── socket/            # Socket.IO handlers
│   ├── uploads/           # Uploaded files
│   └── index.js           # Server entry point
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/request-otp` - Request OTP
- `POST /api/auth/verify-otp` - Verify OTP and login
- `POST /api/auth/set-password` - Set optional password
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/profile` - Get profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/profile-photo` - Upload profile photo
- `PUT /api/users/privacy` - Update privacy settings
- `GET /api/users/search` - Search users
- `POST /api/users/block/:userId` - Block user
- `POST /api/users/unblock/:userId` - Unblock user
- `DELETE /api/users/account` - Delete account

### Chats
- `GET /api/chats` - Get all chats
- `POST /api/chats/private/:userId` - Create/Get private chat
- `GET /api/chats/:chatId` - Get chat by ID
- `POST /api/chats/:chatId/archive` - Archive/Unarchive chat
- `POST /api/chats/:chatId/mute` - Mute/Unmute chat

### Messages
- `GET /api/messages/:chatId` - Get messages
- `POST /api/messages/:chatId/text` - Send text message
- `POST /api/messages/:chatId/media` - Send media message
- `DELETE /api/messages/:messageId` - Delete message
- `POST /api/messages/:messageId/star` - Star/Unstar message
- `POST /api/messages/:chatId/read` - Mark as read
- `GET /api/messages/search/:chatId` - Search messages

### Groups
- `POST /api/groups` - Create group
- `GET /api/groups` - Get user's groups
- `GET /api/groups/:groupId` - Get group by ID
- `PUT /api/groups/:groupId` - Update group
- `POST /api/groups/:groupId/members` - Add members
- `DELETE /api/groups/:groupId/members/:userId` - Remove member
- `POST /api/groups/:groupId/admins/:userId` - Make admin
- `POST /api/groups/join/:inviteLink` - Join via invite link

### Calls
- `GET /api/calls` - Get call history
- `POST /api/calls` - Create call
- `PUT /api/calls/:callId` - Update call status

### Status
- `POST /api/status` - Create status
- `GET /api/status/contacts` - Get contacts' statuses
- `POST /api/status/:statusId/view` - View status
- `GET /api/status/me` - Get my statuses

### AI
- `POST /api/ai/chat` - AI chat
- `POST /api/ai/summarize` - Summarize chat
- `POST /api/ai/translate` - Translate message

## 🔐 Security Features

1. **Authentication & Authorization**
   - JWT-based authentication
   - Refresh token rotation
   - Session management
   - Rate limiting on auth endpoints

2. **Data Protection**
   - End-to-end encryption for messages
   - Encrypted storage
   - Secure key exchange
   - Input validation & sanitization

3. **API Security**
   - Helmet.js for security headers
   - CORS configuration
   - Rate limiting
   - Request validation

## 🎨 UI Features

- **WhatsApp-style Design**: Familiar interface inspired by WhatsApp
- **Dark Mode**: Full dark mode support
- **Responsive**: Works on mobile, tablet, and desktop
- **Animations**: Smooth transitions and animations
- **Accessibility**: Keyboard navigation and screen reader support

## 📱 Usage

1. **Login**: Enter your email to receive an OTP
2. **Verify**: Enter the 6-digit OTP sent to your email
3. **Start Chatting**: Search for users and start conversations
4. **Send Messages**: Text, images, videos, audio, and documents
5. **Create Groups**: Start group conversations with multiple users
6. **Manage Profile**: Update your profile, photo, and privacy settings

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- Verify network connectivity

### Email/OTP Issues
- Check email credentials in `.env`
- For Gmail, use App Password (not regular password)
- Verify SMTP settings

### Socket Connection Issues
- Check CORS settings in server
- Verify `CLIENT_URL` in server `.env`
- Ensure WebSocket ports are open

## 📝 License

This project is licensed under the ISC License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For support, email support@chatapp.com or open an issue in the repository.

---

**Built with ❤️ using React, Node.js, MongoDB, and Socket.IO**

