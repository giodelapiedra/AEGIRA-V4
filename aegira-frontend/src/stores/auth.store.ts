import { create } from 'zustand';
import type { User } from '@/types/auth.types';

export type { User };

interface AuthState {
  user: User | null;
  setAuth: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  setAuth: (user) => set({ user }),
  clearAuth: () => set({ user: null }),
}));
