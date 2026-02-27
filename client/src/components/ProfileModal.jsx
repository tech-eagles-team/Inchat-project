import { useState, useEffect } from 'react';
import { FiX, FiUser, FiMail, FiPhone, FiCalendar } from 'react-icons/fi';
import { usersAPI } from '../api/users';
import toast from 'react-hot-toast';
import ImageViewer from './ImageViewer';

export default function ProfileModal({ userId, onClose, darkMode }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showImageViewer, setShowImageViewer] = useState(false);

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const response = await usersAPI.getUserProfile(userId);
                setUser(response.data.user);
            } catch (error) {
                console.error('Failed to load user profile:', error);
                toast.error('Failed to load user profile');
                onClose();
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchUserProfile();
        } else {
            setLoading(false);
            onClose();
        }
    }, [userId, onClose]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center">
                <div className="bg-white dark:bg-dark-800 rounded-lg p-6 max-w-md w-full mx-4">
                    <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-dark-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                    >
                        <FiX className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Profile Content */}
                <div className="p-6">
                    {/* Avatar */}
                    <div className="flex justify-center mb-6">
                        <div
                            className="w-32 h-32 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-4xl overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => user?.profilePhoto && setShowImageViewer(true)}
                        >
                            {user.profilePhoto ? (
                                <img
                                    src={`/api/uploads/${user.profilePhoto}`}
                                    alt={`${user.username}'s profile`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                            ) : (
                                user.username?.[0]?.toUpperCase() || '?'
                            )}
                        </div>
                    </div>

                    {/* User Info */}
                    <div className="space-y-4">
                        <div className="text-center">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {user.username}
                            </h3>
                            {user.bio && (
                                <p className="text-gray-600 dark:text-gray-400 mt-2">{user.bio}</p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                                <FiUser className="w-5 h-5" />
                                <span>@{user.username}</span>
                            </div>

                            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                                <FiMail className="w-5 h-5" />
                                <span>{user.email}</span>
                            </div>

                            {user.phoneNumber && (
                                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                                    <FiPhone className="w-5 h-5" />
                                    <span>{user.phoneNumber}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                                <FiCalendar className="w-5 h-5" />
                                <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showImageViewer && user?.profilePhoto && (
                <ImageViewer
                    imageUrl={`/api/uploads/${user.profilePhoto}`}
                    alt={`${user.username}'s profile picture`}
                    onClose={() => setShowImageViewer(false)}
                />
            )}
        </div>
    );
}