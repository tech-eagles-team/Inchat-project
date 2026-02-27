import api from './axios';

export const callsAPI = {
    // Get call history
    getCallHistory: (page = 1, limit = 20) =>
        api.get('/calls', { params: { page, limit } }),

    // Create a new call
    createCall: (callData) =>
        api.post('/calls', callData),

    // Get call details
    getCall: (callId) =>
        api.get(`/calls/${callId}`),

    // Update call status
    updateCallStatus: (callId, status, data = {}) =>
        api.put(`/calls/${callId}`, { status, ...data }),

    // End call
    endCall: (callId) =>
        api.delete(`/calls/${callId}`),

    // Get active calls
    getActiveCalls: () =>
        api.get('/calls/active'),

    // Join call
    joinCall: (callId) =>
        api.post(`/calls/${callId}/join`),

    // Leave call
    leaveCall: (callId) =>
        api.post(`/calls/${callId}/leave`),

    // Send call signal (WebRTC)
    sendCallSignal: (callId, signalData) =>
        api.post(`/calls/${callId}/signal`, signalData)
};