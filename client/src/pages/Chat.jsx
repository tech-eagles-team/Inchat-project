import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { chatAPI } from '../api/chat';
import { socketService } from '../services/socket';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import Sidebar from '../components/Sidebar';
import Groups from '../components/Groups';
import { Toaster } from 'react-hot-toast';

export default function Chat() {
  const { user, token } = useAuthStore();
  const { setChats, setLoading, loading } = useChatStore();
  const { setActiveChat, activeChat } = useChatStore();
  const [showSidebar, setShowSidebar] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem('darkMode') === 'true' || false
  );

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const loadChats = useCallback(async () => {
    if (!token || !user) {
      return;
    }

    try {
      setLoading(true);
      const response = await chatAPI.getChats();
      setChats(response.data.chats);

      // Validate activeChat exists in loaded chats using safe ID comparison
      const currentActiveChat = useChatStore.getState().activeChat;
      if (currentActiveChat) {
        // Check if _id exists and is valid
        const activeChatId = currentActiveChat._id;

        if (!activeChatId || activeChatId.startsWith('temp-')) {
          console.warn(`⚠️ Clearing invalid active chat ID: ${activeChatId}`);
          useChatStore.getState().setActiveChat(null);
          return;
        }

        const activeChatIdStr = String(activeChatId);
        const chatExists = response.data.chats.some(chat => String(chat._id) === activeChatIdStr);

        if (!chatExists) {
          // Only warn and clear if the chat is truly deleted (not just a timing issue)
          console.warn(`⚠️ Chat ${activeChatIdStr} no longer available, clearing active chat`);
          useChatStore.getState().setActiveChat(null);
        }
      }
    } catch (error) {
      console.error('Failed to load chats:', error.response?.status, error.response?.data);

      // If auth error or user not found, force logout and redirect to login
      if (error.response?.status === 401 || error.response?.status === 404) {
        console.warn('Auth error or user not found, logging out...');
        try {
          useAuthStore.getState().logout();
        } catch (e) {
          console.warn('Logout failed during auth error handling', e);
        }
        socketService.disconnect();
        window.location.href = '/login';
        return;
      }

      // For other errors, preserve any persisted chats and mark as loaded
      const existingChats = useChatStore.getState().chats || [];
      if (existingChats.length === 0) {
        // Ensure UI doesn't hang on spinner: set empty list
        setChats([]);
      } else {
        // re-set to trigger chatsLoaded flag in store
        setChats(existingChats);
      }
    } finally {
      setLoading(false);
    }
  }, [token, user, setChats, setLoading]);

  // Initialize socket connection and load chats
  useEffect(() => {
    if (!token || !user) {
      return;
    }

    console.log('📱 Initializing socket and loading chats...');

    // Connect socket with token
    const socketConnected = socketService.connect(token);
    if (!socketConnected) {
      console.warn('⚠️ Socket connection failed');
    }

    // Load chats immediately, don't wait
    loadChats();

    return () => {
      // Don't disconnect socket on cleanup - it should persist
    };
  }, [token, user, loadChats]);

  // Refresh chats periodically to stay in sync
  useEffect(() => {
    if (!token || !user) return;

    const interval = setInterval(() => {
      loadChats();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [token, user, loadChats]);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-900">
      <Toaster position="top-center" />

      {/* Chat List */}
      <ChatList
        onChatSelect={(chat) => setActiveChat(chat)}
        onMenuClick={() => setShowSidebar(true)}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        loading={loading}
      />

      {/* Chat Window */}
      {activeChat ? (
        <ChatWindow
          chat={activeChat}
          onBack={() => setActiveChat(null)}
          onMenuClick={() => setShowSidebar(true)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-dark-800">
          <div className="text-center">
            {loading ? (
              <>
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Loading chats...
                </h2>
              </>
            ) : (
              <>
                <div className="w-24 h-24 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Select a chat to start messaging
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Your conversations will appear here
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sidebar */}
      {showSidebar && (
        <Sidebar
          onClose={() => setShowSidebar(false)}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          onShowGroups={() => {
            setShowSidebar(false);
            setShowGroups(true);
          }}
        />
      )}

      {/* Groups */}
      {showGroups && (
        <Groups
          onClose={() => setShowGroups(false)}
        />
      )}
    </div>
  );
}
