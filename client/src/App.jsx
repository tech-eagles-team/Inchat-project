import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useChatStore } from './store/chatStore';
import { authAPI } from './api/auth';
import Login from './pages/Login';
import Chat from './pages/Chat';
import './App.css';

function App() {
  const { isAuthenticated, setAuth, token } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);

  // Wait for localStorage to hydrate before checking auth
  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      try {
        if (token && !isAuthenticated) {
          const res = await authAPI.getMe();
          setAuth(res.data.user, token, useAuthStore.getState().refreshToken);
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        useAuthStore.getState().logout();
      } finally {
        setHydrated(true);
        setLoading(false);
        // Cleanup invalid messages after hydration
        useChatStore.getState().cleanupMessages();
      }
    };

    // Give state time to hydrate from localStorage
    const timer = setTimeout(checkAuth, 100);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !hydrated) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-dark-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" /> : <Login />}
        />
        <Route
          path="/*"
          element={isAuthenticated ? <Chat /> : <Navigate to="/login" />}
        />
      </Routes>
    </div>
  );
}

export default App;

