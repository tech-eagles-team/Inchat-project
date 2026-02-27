import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { socketService } from '../services/socket';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Log the error for debugging
    console.error('API Error:', {
      status: error.response?.status,
      url: originalRequest?.url,
      message: error.message
    });

    // Handle 401 - token might be expired
    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      try {
        const { refreshToken } = useAuthStore.getState();
        if (refreshToken) {
          console.log('Attempting token refresh...');
          const response = await axios.post('/api/auth/refresh-token', {
            refreshToken
          });

          const { accessToken } = response.data;
          const { user } = useAuthStore.getState();
          useAuthStore.getState().setAuth(user, accessToken, refreshToken);

          // Reconnect socket with new token
          socketService.disconnect();
          socketService.connect(accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } else {
          console.log('No refresh token available - logging out');
          useAuthStore.getState().logout();
          socketService.disconnect();
          window.location.href = '/login';
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        useAuthStore.getState().logout();
        socketService.disconnect();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

