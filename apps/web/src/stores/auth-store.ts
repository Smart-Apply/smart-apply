import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearCsrfToken } from '@/lib/csrf';

interface User {
  id: number;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  
  // Actions
  setAuth: (user: User) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      setAuth: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),

      clearAuth: () => {
        clearCsrfToken(); // Clear CSRF token on logout
        set({
          user: null,
          isAuthenticated: false,
        });
        // Fetch new CSRF token for next login attempt
        // Note: We don't await this to avoid blocking logout
        import('@/lib/csrf').then(({ fetchCsrfToken }) => {
          fetchCsrfToken().catch(console.error);
        });
      },

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
    }),
    {
      name: 'smart-apply-auth',
    }
  )
);
