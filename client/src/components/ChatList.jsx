import { useState, useMemo, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { chatAPI } from '../api/chat';
import { usersAPI } from '../api/users';
import { useAuthStore } from '../store/authStore';
import {
  FiSearch,
  FiMenu,
  FiMoon,
  FiSun,
  FiMoreVertical,
  FiUsers
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const idOf = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString ? value.toString() : null;
};

const previewMessage = (lastMessage) => {
  if (!lastMessage) return 'No messages yet';

  if (lastMessage.type === 'text') {
    return lastMessage.content?.text || 'Text message';
  }

  if (lastMessage.type === 'image') return 'Photo';
  if (lastMessage.type === 'video') return 'Video';
  if (lastMessage.type === 'audio') return 'Audio';
  if (lastMessage.type === 'document') return 'Document';

  return 'New message';
};

export default function ChatList({
  onChatSelect,
  onMenuClick,
  darkMode,
  toggleDarkMode,
  loading
}) {
  const { chats, setActiveChat, addChat } = useChatStore();
  const { user, logout } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchUsers, setSearchUsers] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const currentUserId = idOf(user?.id || user?._id);
  const query = searchQuery.trim().toLowerCase();

  const getOtherParticipant = (chat) => {
    if (!chat || chat.type !== 'private') return null;

    if (chat.otherParticipant?._id) {
      return chat.otherParticipant;
    }

    const participants = Array.isArray(chat.participants) ? chat.participants : [];
    return participants.find((p) => idOf(p?._id || p) !== currentUserId) || null;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && !event.target.closest('.dropdown-menu')) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const sidebarChats = useMemo(() => {
    const deduped = new Map();

    (chats || []).forEach((chat) => {
      const chatId = idOf(chat?._id);
      if (!chat || !chatId || chatId.startsWith('temp-')) return;

      let key = null;
      if (chat.type === 'group') {
        key = `group:${chatId}`;
      } else if (chat.type === 'private') {
        const other = getOtherParticipant(chat);
        const otherId = idOf(other?._id || other);
        if (!otherId) return;
        key = `private:${otherId}`;
      }

      if (!key) return;

      const existing = deduped.get(key);
      const currentTime = chat.lastMessageAt ? new Date(chat.lastMessageAt).getTime() : 0;
      const existingTime = existing?.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;

      if (!existing || currentTime >= existingTime) {
        deduped.set(key, { ...chat, _id: chatId });
      }
    });

    return Array.from(deduped.values()).sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });
  }, [chats, currentUserId]);

  const existingPrivateUserIds = useMemo(() => {
    return new Set(
      sidebarChats
        .filter((chat) => chat.type === 'private')
        .map((chat) => idOf(getOtherParticipant(chat)?._id))
        .filter(Boolean)
    );
  }, [sidebarChats, currentUserId]);

  const visibleChats = useMemo(() => {
    if (!query) return sidebarChats;

    return sidebarChats.filter((chat) => {
      if (chat.type === 'group') {
        return (chat.name || 'group chat').toLowerCase().includes(query);
      }

      const other = getOtherParticipant(chat);
      return (other?.username || '').toLowerCase().includes(query);
    });
  }, [sidebarChats, query, currentUserId]);

  useEffect(() => {
    let canceled = false;

    const search = async () => {
      const term = searchQuery.trim();
      if (term.length < 2) {
        setSearchUsers([]);
        setSearchingUsers(false);
        return;
      }

      setSearchingUsers(true);
      try {
        const res = await usersAPI.searchUsers(term);
        const users = res.data?.users || [];

        const filtered = users.filter((u) => {
          const userId = idOf(u?._id);
          if (!userId || userId === currentUserId) return false;
          return !existingPrivateUserIds.has(userId);
        });

        if (!canceled) {
          setSearchUsers(filtered);
        }
      } catch (error) {
        if (!canceled) {
          setSearchUsers([]);
        }
      } finally {
        if (!canceled) {
          setSearchingUsers(false);
        }
      }
    };

    const timer = setTimeout(search, 250);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, currentUserId, existingPrivateUserIds]);

  const handleOpenChat = (chat) => {
    setActiveChat(chat);
    onChatSelect(chat);
  };

  const handleStartChat = async (otherUser) => {
    try {
      const otherUserId = idOf(otherUser?._id);
      if (!otherUserId) return;

      const existingChat = (chats || []).find((chat) => {
        if (chat?.type !== 'private') return false;
        const other = getOtherParticipant(chat);
        return idOf(other?._id || other) === otherUserId;
      });

      if (existingChat) {
        handleOpenChat(existingChat);
        return;
      }

      const optimisticChat = {
        _id: `temp-${Date.now()}`,
        type: 'private',
        participants: [otherUser],
        otherParticipant: otherUser,
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0
      };

      setActiveChat(optimisticChat);
      onChatSelect(optimisticChat);

      const res = await chatAPI.createPrivateChat(otherUserId);
      const chat = res.data.chat;

      addChat(chat);
      setActiveChat(chat);
      onChatSelect(chat);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start chat');
      setActiveChat(null);
    }
  };

  const showUserSearch = searchQuery.trim().length >= 2;
  const hasResults = visibleChats.length > 0 || searchUsers.length > 0;

  return (
    <div className="w-full md:w-96 border-r border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 flex flex-col">
      <div className="h-16 px-4 py-3 bg-primary-500 dark:bg-primary-600 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-primary-600 dark:hover:bg-primary-700 rounded-lg"
          >
            <FiMenu className="w-6 h-6 text-white" />
          </button>

          <h1 className="text-white font-semibold text-lg">Inchat</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleDarkMode}
            className="p-2 hover:bg-primary-600 dark:hover:bg-primary-700 rounded-lg"
          >
            {darkMode ? (
              <FiSun className="w-5 h-5 text-white" />
            ) : (
              <FiMoon className="w-5 h-5 text-white" />
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-primary-600 dark:hover:bg-primary-700 rounded-lg"
            >
              <FiMoreVertical className="w-5 h-5 text-white" />
            </button>

            {showMenu && (
              <div className="dropdown-menu absolute right-0 mt-2 w-40 bg-white dark:bg-dark-800 shadow-lg rounded-lg border dark:border-dark-700 z-50">
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-dark-700"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 bg-gray-50 dark:bg-dark-900">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats or users"
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded-lg text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !hasResults && !showUserSearch ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            No chats yet. Search a user to start messaging.
          </div>
        ) : (
          <>
            {visibleChats.map((chat) => {
              const isGroup = chat.type === 'group';
              const other = isGroup ? null : getOtherParticipant(chat);
              const displayName = isGroup ? (chat.name || 'Group Chat') : (other?.username || 'Unknown');
              const avatar = isGroup ? chat.profilePhoto : other?.profilePhoto;
              const chatKey = isGroup
                ? `group-${chat._id}`
                : `private-${idOf(other?._id) || chat._id}`;

              return (
                <button
                  key={chatKey}
                  onClick={() => handleOpenChat(chat)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-dark-700 border-b border-gray-100 dark:border-dark-700"
                >
                  <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold overflow-hidden">
                    {avatar ? (
                      <img
                        src={`/api/uploads/${avatar}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : isGroup ? (
                      <FiUsers className="w-6 h-6" />
                    ) : (
                      (displayName?.[0] || '?').toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <span className="font-semibold text-gray-900 dark:text-white truncate block">
                      {displayName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">
                      {previewMessage(chat.lastMessage)}
                    </span>
                  </div>
                </button>
              );
            })}

            {showUserSearch && (
              <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Start New Chat
              </div>
            )}

            {showUserSearch && searchingUsers && (
              <div className="flex justify-center py-3">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {showUserSearch && !searchingUsers && searchUsers.map((item) => (
              <button
                key={`user-${item._id}`}
                onClick={() => handleStartChat(item)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-dark-700 border-b border-gray-100 dark:border-dark-700"
              >
                <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold overflow-hidden">
                  {item.profilePhoto && item.profilePhoto.trim() ? (
                    <img
                      src={`/api/uploads/${item.profilePhoto}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (item.username?.[0] || '?').toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <span className="font-semibold text-gray-900 dark:text-white truncate block">
                    {item.username || 'Unknown'}
                  </span>
                </div>
              </button>
            ))}

            {showUserSearch && !searchingUsers && searchUsers.length === 0 && (
              <div className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                No new users found
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
