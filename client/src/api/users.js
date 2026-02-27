import api from './axios';

export const usersAPI = {
  getProfile: () => api.get('/users/profile'),
  getUserProfile: (userId) => api.get(`/users/profile/${userId}`),
  updateProfile: (data) => api.put('/users/profile', data),
  uploadProfilePhoto: (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    return api.post('/users/profile-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getAllUsers: () => api.get('/users/all'),
  searchUsers: (query) => api.get('/users/search', { params: { q: query } }),
  updatePrivacy: (settings) => api.put('/users/privacy', settings),
  blockUser: (userId) => api.post(`/users/block/${userId}`),
  unblockUser: (userId) => api.post(`/users/unblock/${userId}`),
  deleteAccount: () => api.delete('/users/account')
};

