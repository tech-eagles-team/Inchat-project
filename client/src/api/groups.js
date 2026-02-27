import api from './axios';

export const groupsAPI = {
  createGroup: (name, memberIds, description) =>
    api.post('/groups', { name, memberIds, description }),
  getGroups: () => api.get('/groups'),
  getGroup: (groupId) => api.get(`/groups/${groupId}`),
  updateGroup: (groupId, data) => api.put(`/groups/${groupId}`, data),
  addMembers: (groupId, memberIds) =>
    api.post(`/groups/${groupId}/members`, { memberIds }),
  removeMember: (groupId, userId) =>
    api.delete(`/groups/${groupId}/members/${userId}`),
  makeAdmin: (groupId, userId) =>
    api.post(`/groups/${groupId}/admins/${userId}`),
  joinGroup: (inviteLink) => api.post(`/groups/join/${inviteLink}`)
};

