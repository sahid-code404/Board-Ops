"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "USER";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  status: "ACTIVE" | "PENDING" | "SUSPENDED" | "ARCHIVED" | "INACTIVE";
  avatarUrl?: string;
  room?: string;
  gender?: string | null;
  emergencyContact?: string | null;
  theme?: string;
  language?: string;
  timezone?: string;
  twoFactorEnabled?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
};

type AuthState = {
  user: CurrentUser | null;
  token: string | null;
  setUser: (u: CurrentUser | null) => void;
  setToken: (t: string | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      setUser: (u) => set({ user: u }),
      setToken: (t) => set({ token: t }),
      logout: () => set({ user: null, token: null }),
      isAuthenticated: () => !!get().token,
    }),
    { name: "boardops-auth" }
  )
);
