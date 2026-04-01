/**
 * Auth Service Interface
 * @description Interface for device-based authentication service
 */

import type { D1Service } from '../../d1/services/d1.service';
import type { KVService } from '../../kv/services/kv.service';
import type {
  User,
  DeviceAuthInput,
  SignUpInput,
  LoginInput,
  AuthResponse,
  CreateUserInput,
  UpdateUserInput,
  UserSession,
  CreditTransaction,
  CreditBalance,
} from '../entities';

// ============================================================
// Auth Service Interface
// ============================================================

export interface IDeviceAuthService {
  // Device-based authentication
  registerDevice(input: DeviceAuthInput): Promise<AuthResponse>;
  getDeviceUser(deviceId: string): Promise<User | null>;

  // User management
  getUserById(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(userId: string, input: UpdateUserInput): Promise<User>;

  // Account upgrade
  upgradeAccount(userId: string, input: SignUpInput): Promise<AuthResponse>;

  // Traditional auth
  signUp(input: SignUpInput): Promise<AuthResponse>;
  login(input: LoginInput): Promise<AuthResponse>;

  // Session management
  validateSession(sessionToken: string): Promise<{ user: User; session: UserSession } | null>;
  refreshSession(sessionToken: string): Promise<AuthResponse | null>;
  revokeSession(sessionToken: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;

  // Credits
  addCredits(userId: string, amount: number, description: string, metadata?: Record<string, unknown>): Promise<CreditTransaction>;
  consumeCredits(userId: string, amount: number, description: string, metadata?: Record<string, unknown>): Promise<CreditTransaction>;
  getCreditBalance(userId: string): Promise<CreditBalance>;
  getCreditHistory(userId: string, limit?: number): Promise<CreditTransaction[]>;

  // Cleanup
  cleanupExpiredSessions(): Promise<number>;
}

// ============================================================
// Auth Service Options
// ============================================================

export interface DeviceAuthServiceOptions {
  initialCredits?: number;
  sessionTTL?: number; // seconds
  tokenSecret?: string;
  passwordHashRounds?: number;
}

// ============================================================
// Token Service Interface
// ============================================================

export interface ITokenService {
  generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string>;
  verifyToken(token: string): Promise<TokenPayload | null>;
  refreshToken(token: string, ttl: number): Promise<string | null>;
}

export type { TokenPayload } from '../entities';
