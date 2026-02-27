import axios from 'axios';
import { io } from 'socket.io-client';

const API = 'http://localhost:5000/api';
const SOCKET = 'http://localhost:5000';

const timeout = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
    try {
        // Create two users
        const u1 = { email: `e2e1${Date.now()}@example.com`, password: 'Password1', username: `e2euser1${Date.now()}`, phoneNumber: `+100000${Date.now().toString().slice(-6)}` };
        const u2 = { email: `e2e2${Date.now()}@example.com`, password: 'Password1', username: `e2euser2${Date.now()}`, phoneNumber: `+200000${Date.now().toString().slice(-6)}` };

        const reg1 = await axios.post(`${API}/auth/register`, u1);
        const reg2 = await axios.post(`${API}/auth/register`, u2);

        const login1 = await axios.post(`${API}/auth/login`, { email: u1.email, password: u1.password });
        const login2 = await axios.post(`${API}/auth/login`, { email: u2.email, password: u2.password });

        const token1 = login1.data.tokens.accessToken;
        const token2 = login2.data.tokens.accessToken;
        const id1 = login1.data.user.id || login1.data.user._id;
        const id2 = login2.data.user.id || login2.data.user._id;

        console.log('Users registered and logged in:', id1, id2);

        // Create private chat from user1 to user2
        const chatRes = await axios.post(`${API}/chats/private/${id2}`, {}, { headers: { Authorization: `Bearer ${token1}` } });
        const chat = chatRes.data.chat;
        const chatId = chat._id || chat.id;

        console.log('Chat created:', chatId);

        // Connect sockets
        const sock1 = io(SOCKET, { auth: { token: token1 }, transports: ['websocket'], reconnection: false });
        const sock2 = io(SOCKET, { auth: { token: token2 }, transports: ['websocket'], reconnection: false });

        await new Promise((resolve, reject) => {
            let ready = 0;
            sock1.on('connect', () => { ready++; if (ready === 2) resolve(); });
            sock2.on('connect', () => { ready++; if (ready === 2) resolve(); });
            setTimeout(() => reject(new Error('Sockets failed to connect in time')), 5000);
        });

        console.log('Both sockets connected');

        // Join chat rooms
        sock1.emit('join-chat', chatId);
        sock2.emit('join-chat', chatId);

        // Wait a moment
        await timeout(200);

        // Listen for message on sock2
        const received = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Did not receive new-message event')), 5000);
            sock2.on('new-message', (data) => {
                if (data?.chatId === chatId) {
                    clearTimeout(timer);
                    resolve(data.message);
                }
            });

            // Send a message via API as user1
            (async () => {
                try {
                    const send = await axios.post(`${API}/messages/${chatId}/text`, { text: 'Hello from e2e' }, { headers: { Authorization: `Bearer ${token1}` } });
                    // nothing
                } catch (e) {
                    // ignore, will be caught by outer promise
                }
            })();
        });

        console.log('Received message via socket:', received?._id || received?.content || 'no id');

        // Check stored messages via API for user2
        const msgs = await axios.get(`${API}/messages/${chatId}`, { headers: { Authorization: `Bearer ${token2}` } });
        const messages = msgs.data.messages || msgs.data;
        if (!Array.isArray(messages) || messages.length === 0) throw new Error('No messages stored in DB');

        console.log('Messages fetched from DB count:', messages.length);

        sock1.disconnect();
        sock2.disconnect();

        console.log('E2E socket test passed');
        process.exit(0);
    } catch (error) {
        console.error('E2E socket test failed:', error.response?.data || error.message || error);
        process.exit(1);
    }
}

run();
