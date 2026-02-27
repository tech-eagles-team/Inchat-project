import api from './axios';

export const authAPI = {
  register: (email, password, username, phoneNumber) =>
    api.post('/auth/register', { email, password, username, phoneNumber }),
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  refreshToken: (refreshToken) => api.post('/auth/refresh-token', { refreshToken }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }),
  resetPasswordDirect: (email, newPassword) =>
    api.post('/auth/reset-password-direct', { email, newPassword })
};

