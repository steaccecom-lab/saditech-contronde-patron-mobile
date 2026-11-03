import {create} from 'zustand';
import type {User} from '../types/api';

type AuthState = {
  sessionGeneration: number;
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  pendingRoundId: string | null;
  beginSession: () => void;
  setSession: (accessToken: string, refreshToken: string, user: User) => void;
  updateAccessToken: (accessToken: string, refreshToken?: string) => void;
  clearSession: () => void;
  setPendingRoundId: (roundId: string | null) => void;
};

export const useAuthStore = create<AuthState>(set => ({
  sessionGeneration: 0,
  accessToken: null,
  refreshToken: null,
  user: null,
  pendingRoundId: null,
  beginSession: () =>
    set(state => ({
      sessionGeneration: state.sessionGeneration + 1,
      accessToken: null,
      refreshToken: null,
      user: null,
      pendingRoundId: state.user ? null : state.pendingRoundId,
    })),
  setSession: (accessToken, refreshToken, user) =>
    set(state => ({
      sessionGeneration: state.sessionGeneration + 1,
      accessToken,
      refreshToken,
      user,
    })),
  updateAccessToken: (accessToken, refreshToken) =>
    set(state => ({
      accessToken,
      refreshToken: refreshToken ?? state.refreshToken,
    })),
  clearSession: () =>
    set(state => ({
      sessionGeneration: state.sessionGeneration + 1,
      accessToken: null,
      refreshToken: null,
      user: null,
      pendingRoundId: null,
    })),
  setPendingRoundId: pendingRoundId => set({pendingRoundId}),
}));

export type SessionOwner = {
  generation: number;
  userId: string | null;
  companyId: string | null;
  roleType: User['roleType'] | null;
};

export function captureSession(): SessionOwner {
  const state = useAuthStore.getState();
  return {
    generation: state.sessionGeneration,
    userId: state.user?.id ?? null,
    companyId: state.user?.companyId ?? null,
    roleType: state.user?.roleType ?? null,
  };
}

export function isCurrentSession(owner: SessionOwner): boolean {
  const state = useAuthStore.getState();
  return (
    state.sessionGeneration === owner.generation &&
    (state.user?.id ?? null) === owner.userId &&
    (state.user?.companyId ?? null) === owner.companyId &&
    (state.user?.roleType ?? null) === owner.roleType
  );
}

export class SessionChangedError extends Error {
  constructor() {
    super('La session a changé. Reconnectez-vous si nécessaire.');
    this.name = 'SessionChangedError';
  }
}

export function assertCurrentSession(owner: SessionOwner): void {
  if (!isCurrentSession(owner)) {
    throw new SessionChangedError();
  }
}
