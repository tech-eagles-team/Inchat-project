import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { usersAPI } from '../api/users';
import {
  FiX,
  FiCamera,
  FiUsers,
  FiSettings,
  FiLogOut,
  FiChevronRight,
  FiMoon,
  FiSun
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import ImageViewer from './ImageViewer';

export default function Sidebar({ onClose, darkMode, toggleDarkMode, onShowGroups }) {
  const { user, logout } = useAuthStore();
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleUpdateProfile = async () => {
    try {
      const response = await usersAPI.updateProfile({ username, bio });
      toast.success('Profile updated');

      if (response.data?.user) {
        const { updateUser } = useAuthStore.getState();
        updateUser(response.data.user);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const response = await usersAPI.uploadProfilePhoto(file);
      toast.success('Profile photo updated');

      if (response.data?.profilePhoto) {
        const { updateUser } = useAuthStore.getState();
        updateUser({ profilePhoto: response.data.profilePhoto });
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to upload photo');
    }
  };

  const handleOpenGroups = () => {
    if (typeof onShowGroups === 'function') {
      onShowGroups();
      return;
    }

    toast.error('Groups menu is unavailable right now');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex" onClick={onClose}>
      <div className="w-80 bg-white dark:bg-dark-800 h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="h-16 px-4 bg-primary-500 dark:bg-primary-600 flex items-center justify-between">
          <h2 className="text-white font-semibold">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-primary-600 dark:hover:bg-primary-700 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 dark:border-dark-700">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div
                  className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-xl cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => user?.profilePhoto && setShowImageViewer(true)}
                >
                  {user?.profilePhoto ? (
                    <img
                      src={`/api/uploads/${user.profilePhoto}`}
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    user?.username?.[0]?.toUpperCase() || '?'
                  )}
                </div>
                <label className="absolute bottom-0 right-0 bg-primary-500 text-white p-1.5 rounded-full cursor-pointer hover:bg-primary-600">
                  <FiCamera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-white truncate">
                  {user?.username}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-2 border-b border-gray-200 dark:border-dark-700">
            <button
              onClick={handleOpenGroups}
              className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-900 dark:text-white"
            >
              <span className="flex items-center gap-3">
                <FiUsers className="w-5 h-5" />
                <span>Groups</span>
              </span>
              <FiChevronRight className="w-4 h-4 text-gray-500" />
            </button>

            <button
              onClick={() => setShowSettings((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-900 dark:text-white"
            >
              <span className="flex items-center gap-3">
                <FiSettings className="w-5 h-5" />
                <span>Settings</span>
              </span>
              <FiChevronRight className="w-4 h-4 text-gray-500" />
            </button>

            <button
              onClick={logout}
              className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
            >
              <span className="flex items-center gap-3">
                <FiLogOut className="w-5 h-5" />
                <span>Logout</span>
              </span>
            </button>
          </div>

          {showSettings && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-dark-600 px-3 py-3">
                <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                  {darkMode ? <FiSun className="w-5 h-5" /> : <FiMoon className="w-5 h-5" />}
                  <span>Theme</span>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className="text-sm px-3 py-1.5 rounded-md bg-primary-500 hover:bg-primary-600 text-white"
                >
                  {darkMode ? 'Light' : 'Dark'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={150}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-white resize-none"
                />
              </div>

              <button
                onClick={handleUpdateProfile}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {showImageViewer && user?.profilePhoto && (
        <ImageViewer
          imageUrl={`/api/uploads/${user.profilePhoto}`}
          alt="Your profile picture"
          onClose={() => setShowImageViewer(false)}
        />
      )}
    </div>
  );
}
