import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearCsrfToken } from '@/lib/csrf';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  
  // Actions
  setAuth: (user: User) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      hasHydrated: false,

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

      setHasHydrated: (state) => set({ hasHydrated: state }),
    }),
    {
      name: 'smart-apply-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
