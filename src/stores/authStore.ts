import { create } from 'zustand';
import type { User } from '../types/api';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  pendingRoundId: string | null;
  setSession: (accessToken: string, refreshToken: string, user: User) => void;
  updateAccessToken: (accessToken: string, refreshToken?: string) => void;
  clearSession: () => void;
  setPendingRoundId: (roundId: string | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  pendingRoundId: null,
  setSession: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
  updateAccessToken: (accessToken, refreshToken) =>
    set((state) => ({ accessToken, refreshToken: refreshToken ?? state.refreshToken })),
  clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
  setPendingRoundId: (pendingRoundId) => set({ pendingRoundId }),
}));
