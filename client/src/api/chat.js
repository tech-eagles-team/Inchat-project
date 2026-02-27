import api from './axios';

export const chatAPI = {
  getChats: () => api.get('/chats'),
  getChat: (chatId) => api.get(`/chats/${chatId}`),
  createPrivateChat: (userId) => api.post(`/chats/private/${userId}`),
  archiveChat: (chatId) => api.post(`/chats/${chatId}/archive`),
  muteChat: (chatId) => api.post(`/chats/${chatId}/mute`),
  getMessages: (chatId, page = 1) => api.get(`/messages/${chatId}`, { params: { page } }),
  sendTextMessage: (chatId, text, replyTo) =>
    api.post(`/messages/${chatId}/text`, { text, replyTo }),
  sendMediaMessage: (chatId, formData) =>
    api.post(`/messages/${chatId}/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  deleteMessage: (messageId, deleteFor = 'me') =>
    api.delete(`/messages/${messageId}`, { params: { deleteFor } }),
  starMessage: (messageId) => api.post(`/messages/${messageId}/star`),
  markAsRead: (chatId) => api.post(`/messages/${chatId}/read`),
  searchMessages: (chatId, query) =>
    api.get(`/messages/search/${chatId}`, { params: { q: query } }),
  clearChat: (chatId) => api.delete(`/chats/${chatId}/clear`),
  leaveChat: (chatId) => api.delete(`/chats/${chatId}/leave`)
};

