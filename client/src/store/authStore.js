import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useChatStore } from './chatStore';

const getUserId = (user) => {
  if (!user) return null;
  return user.id || user._id || null;
};

const clearPersistedChats = () => {
  useChatStore.getState().clearChats();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('chat-storage-v2');
    localStorage.removeItem('chat-storage-v3');
  }
};

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, token, refreshToken) => set((state) => {
        const previousUserId = getUserId(state.user);
        const nextUserId = getUserId(user);

        if (previousUserId && nextUserId && previousUserId !== nextUserId) {
          clearPersistedChats();
        }

        return {
          user,
          token,
          refreshToken,
          isAuthenticated: !!user
        };
      }),
      logout: () => {
        clearPersistedChats();
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false
        });
      },
      updateUser: (userData) => set((state) => ({
        user: { ...state.user, ...userData }
      }))
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
);

