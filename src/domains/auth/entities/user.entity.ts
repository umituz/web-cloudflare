

export type UserType = 'anonymous' | 'real';

export interface User {
  id: string;
  deviceId: string | null;
  email: string | null;
  passwordHash: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isAnonymous: boolean;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  metadata: Record<string, unknown> | null;
  creditsRemaining: number;
}


export interface CreateUserInput {
  deviceId?: string;
  email?: string;
  password?: string;
  displayName?: string;
  isAnonymous?: boolean;
  metadata?: Record<string, unknown>;
  creditsRemaining?: number;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  displayName?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}


export interface DeviceAuthInput {
  deviceId: string;
  deviceInfo?: {
    model?: string;
    os?: string;
    osVersion?: string;
    appVersion?: string;
  };
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  sessionToken: string;
  expiresAt: number;
}


export interface UserSession {
  sessionId: string;
  userId: string;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: number;
  expiresAt: number;
  lastRefreshedAt: number;
}


export interface TokenPayload {
  userId: string;
  sessionId: string;
  deviceId: string | null;
  isAnonymous: boolean;
  iat: number;
  exp: number;
}


export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'grant' | 'purchase' | 'consume' | 'refund';
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

export interface CreditBalance {
  userId: string;
  remaining: number;
  totalGranted: number;
  totalConsumed: number;
}
