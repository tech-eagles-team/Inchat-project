import { useState } from 'react';
import { groupsAPI } from '../api/groups';
import { usersAPI } from '../api/users';
import { useChatStore } from '../store/chatStore';
import { socketService } from '../services/socket';
import { FiX, FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function Groups({ onClose }) {
  const { addChat, setActiveChat } = useChatStore();

  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await usersAPI.searchUsers(query);
      setSearchResults(response.data.users || []);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const toGroupChat = (group) => {
    if (!group) return null;

    const rawChat = group.chatId;
    const chatId = typeof rawChat === 'string' ? rawChat : rawChat?._id;
    if (!chatId) return null;

    return {
      ...(typeof rawChat === 'object' ? rawChat : {}),
      _id: chatId.toString(),
      type: 'group',
      name: group.name || 'Group Chat',
      profilePhoto: group.profilePhoto || '',
      participants: rawChat?.participants || group.memberIds || []
    };
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Group name is required');
      return;
    }

    setLoading(true);

    try {
      const response = await groupsAPI.createGroup(groupName, selectedUsers);
      const createdGroup = response.data?.group;
      const groupChat = toGroupChat(createdGroup);

      if (groupChat) {
        addChat(groupChat);
        setActiveChat(groupChat);
        socketService.joinChat(groupChat._id);
      }

      toast.success('Group created successfully');

      setGroupName('');
      setSelectedUsers([]);
      setSearchQuery('');
      setSearchResults([]);

      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex">
      <div className="w-full md:w-96 bg-white dark:bg-dark-800 h-full flex flex-col">
        <div className="h-16 px-4 bg-primary-500 dark:bg-primary-600 flex items-center justify-between">
          <h2 className="text-white font-semibold">Create Group</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-primary-600 dark:hover:bg-primary-700 rounded-lg"
          >
            <FiX className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg dark:bg-dark-700"
              placeholder="Enter group name"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Add Members</label>

            <div className="relative mb-2">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-dark-700"
                placeholder="Search users..."
              />
            </div>

            {searchResults.length > 0 && (
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user._id}
                    onClick={() => toggleUserSelection(user._id)}
                    className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-dark-700 ${
                      selectedUsers.includes(user._id) ? 'bg-primary-50 dark:bg-primary-900' : ''
                    }`}
                  >
                    <div className="flex-1 text-left">{user.username}</div>
                    {selectedUsers.includes(user._id) && (
                      <span className="text-primary-500">Selected</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 dark:bg-dark-700 py-2 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroup}
              disabled={loading}
              className="flex-1 bg-primary-500 text-white py-2 rounded-lg"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1" onClick={onClose} />
    </div>
  );
}
