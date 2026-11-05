
import type {
  User,
  DeviceAuthInput,
  SignUpInput,
  LoginInput,
  AuthResponse,
  UpdateUserInput,
  UserSession,
  CreditTransaction,
  CreditBalance,
  TokenPayload,
} from '../entities';


export interface IDeviceAuthService {
  registerDevice(input: DeviceAuthInput): Promise<AuthResponse>;
  getDeviceUser(deviceId: string): Promise<User | null>;

  getUserById(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUser(userId: string, input: UpdateUserInput): Promise<User>;

  upgradeAccount(userId: string, input: SignUpInput): Promise<AuthResponse>;

  signUp(input: SignUpInput): Promise<AuthResponse>;
  login(input: LoginInput): Promise<AuthResponse>;

  validateSession(sessionToken: string): Promise<{ user: User; session: UserSession } | null>;
  refreshSession(sessionToken: string): Promise<AuthResponse | null>;
  revokeSession(sessionToken: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;

  addCredits(userId: string, amount: number, description: string, metadata?: Record<string, unknown>): Promise<CreditTransaction>;
  consumeCredits(userId: string, amount: number, description: string, metadata?: Record<string, unknown>): Promise<CreditTransaction>;
  getCreditBalance(userId: string): Promise<CreditBalance>;
  getCreditHistory(userId: string, limit?: number): Promise<CreditTransaction[]>;

  cleanupExpiredSessions(): Promise<number>;
}


export interface DeviceAuthServiceOptions {
  initialCredits?: number;
  sessionTTL?: number;
  tokenSecret?: string;
  passwordHashRounds?: number;
}


export interface ITokenService {
  generateToken(payload: Omit<TokenPayload, 'iat'> & { exp?: number }): Promise<string>;
  verifyToken(token: string): Promise<TokenPayload | null>;
  refreshToken(token: string, ttl: number): Promise<string | null>;
}
