/**
 * Device Auth Service
 * @description Device-based anonymous user authentication with account upgrade support
 */

import type {
  IDeviceAuthService,
  DeviceAuthServiceOptions,
  TokenPayload,
} from '../types';
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
} from '../entities';
import type { D1Service } from '../../d1/services/d1.service';
import type { KVService } from '../../kv/services/kv.service';
import { TokenService } from './token.service';

// ============================================================
// Password Hashing Helper
// ============================================================

async function hashPassword(password: string, rounds: number = 10): Promise<string> {
  // Simple password hashing using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'pepper'); // Add pepper in production

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Add rounds (in production, use bcrypt/scrypt/argon2)
  return `${rounds}$${hashHex}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [rounds, hashHex] = hash.split('$');

  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'pepper');

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return computedHex === hashHex;
}

// ============================================================
// Device Auth Service
// ============================================================

export class DeviceAuthService implements IDeviceAuthService {
  private d1: D1Service;
  private kv: KVService;
  private tokenService: TokenService;
  private options: Required<DeviceAuthServiceOptions>;

  constructor(
    d1: D1Service,
    kv: KVService,
    options: DeviceAuthServiceOptions = {}
  ) {
    this.d1 = d1;
    this.kv = kv;
    this.tokenService = new TokenService(options.tokenSecret);
    this.options = {
      initialCredits: options.initialCredits ?? 10,
      sessionTTL: options.sessionTTL ?? 86400, // 24 hours
      tokenSecret: options.tokenSecret ?? 'default-secret-change-in-production',
      passwordHashRounds: options.passwordHashRounds ?? 10,
    };
  }

  // ============================================================
  // Device-Based Authentication
  // ============================================================

  /**
   * Register or get user by device ID (anonymous authentication)
   */
  async registerDevice(input: DeviceAuthInput): Promise<AuthResponse> {
    const { deviceId, deviceInfo } = input;

    // Check if user exists with this device ID
    const existingUser = await this.getDeviceUser(deviceId);

    if (existingUser) {
      // Update last active
      await this.updateUserActivity(existingUser.id);
      return this.createSession(existingUser, deviceId);
    }

    // Create new anonymous user
    const userId = this.generateUUID();
    const now = Date.now();

    const user: User = {
      id: userId,
      deviceId,
      email: null,
      passwordHash: null,
      displayName: null,
      avatarUrl: null,
      isAnonymous: true,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      metadata: deviceInfo ? { deviceInfo } : null,
      creditsRemaining: this.options.initialCredits,
    };

    // Insert user into D1
    await this.d1.insert('users', {
      id: user.id,
      device_id: user.deviceId,
      email: null,
      password_hash: null,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      is_anonymous: 1,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      last_active_at: user.lastActiveAt,
      metadata: user.metadata ? JSON.stringify(user.metadata) : null,
      credits_remaining: user.creditsRemaining,
    });

    // Create initial credit transaction
    await this.addCreditTransaction(userId, this.options.initialCredits, 'grant', 'Initial welcome credits');

    return this.createSession(user, deviceId);
  }

  /**
   * Get user by device ID
   */
  async getDeviceUser(deviceId: string): Promise<User | null> {
    const result = await this.d1.findOne<any>(
      `SELECT * FROM users WHERE device_id = ? AND is_anonymous = 1`,
      [deviceId]
    );

    return result ? this.mapDbUserToUser(result) : null;
  }

  // ============================================================
  // User Management
  // ============================================================

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const result = await this.d1.findOne<any>(
      `SELECT * FROM users WHERE id = ?`,
      [userId]
    );

    return result ? this.mapDbUserToUser(result) : null;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.d1.findOne<any>(
      `SELECT * FROM users WHERE email = ?`,
      [email.toLowerCase()]
    );

    return result ? this.mapDbUserToUser(result) : null;
  }

  /**
   * Update user
   */
  async updateUser(userId: string, input: UpdateUserInput): Promise<User> {
    const updates: Record<string, any> = {};
    const now = Date.now();

    if (input.email !== undefined) {
      updates.email = input.email.toLowerCase();
    }
    if (input.password !== undefined) {
      updates.password_hash = await hashPassword(input.password, this.options.passwordHashRounds);
    }
    if (input.displayName !== undefined) {
      updates.display_name = input.displayName;
    }
    if (input.avatarUrl !== undefined) {
      updates.avatar_url = input.avatarUrl;
    }
    if (input.metadata !== undefined) {
      updates.metadata = JSON.stringify(input.metadata);
    }

    updates.updated_at = now;

    await this.d1.update('users', updates, 'id = ?', [userId]);

    return this.getUserById(userId) as Promise<User>;
  }

  /**
   * Update user last active timestamp
   */
  private async updateUserActivity(userId: string): Promise<void> {
    await this.d1.query(
      `UPDATE users SET last_active_at = ? WHERE id = ?`,
      [Date.now(), userId]
    );
  }

  // ============================================================
  // Account Upgrade
  // ============================================================

  /**
   * Upgrade anonymous user to real user with email/password
   */
  async upgradeAccount(userId: string, input: SignUpInput): Promise<AuthResponse> {
    const user = await this.getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isAnonymous) {
      throw new Error('User is already a real user');
    }

    // Check if email already exists
    const existingUser = await this.getUserByEmail(input.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Update user to real user
    const passwordHash = await hashPassword(input.password, this.options.passwordHashRounds);
    const now = Date.now();

    await this.d1.query(
      `UPDATE users SET
        email = ?,
        password_hash = ?,
        display_name = ?,
        is_anonymous = 0,
        updated_at = ?
      WHERE id = ?`,
      [
        input.email.toLowerCase(),
        passwordHash,
        input.displayName || null,
        now,
        userId,
      ]
    );

    const updatedUser = await this.getUserById(userId);

    // Create new session
    return this.createSession(updatedUser!, user.deviceId || undefined);
  }

  // ============================================================
  // Traditional Authentication
  // ============================================================

  /**
   * Sign up new real user (without device ID)
   */
  async signUp(input: SignUpInput): Promise<AuthResponse> {
    // Check if email exists
    const existingUser = await this.getUserByEmail(input.email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const userId = this.generateUUID();
    const now = Date.now();
    const passwordHash = await hashPassword(input.password, this.options.passwordHashRounds);

    const user: User = {
      id: userId,
      deviceId: null,
      email: input.email.toLowerCase(),
      passwordHash,
      displayName: input.displayName || null,
      avatarUrl: null,
      isAnonymous: false,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      metadata: null,
      creditsRemaining: this.options.initialCredits,
    };

    await this.d1.insert('users', {
      id: user.id,
      device_id: null,
      email: user.email,
      password_hash: user.passwordHash,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      is_anonymous: 0,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      last_active_at: user.lastActiveAt,
      metadata: null,
      credits_remaining: user.creditsRemaining,
    });

    // Create initial credit transaction
    await this.addCreditTransaction(userId, this.options.initialCredits, 'grant', 'Initial welcome credits');

    return this.createSession(user);
  }

  /**
   * Login with email/password
   */
  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.getUserByEmail(input.email);

    if (!user || user.isAnonymous || !user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    await this.updateUserActivity(user.id);

    return this.createSession(user);
  }

  // ============================================================
  // Session Management
  // ============================================================

  /**
   * Create session for user
   */
  private async createSession(
    user: User,
    deviceId?: string
  ): Promise<AuthResponse> {
    const sessionId = this.generateUUID();
    const now = Date.now();
    const expiresAt = now + this.options.sessionTTL * 1000;

    // Create session token
    const tokenPayload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId: user.id,
      sessionId,
      deviceId: deviceId || null,
      isAnonymous: user.isAnonymous,
    };

    const sessionToken = await this.tokenService.generateToken({
      ...tokenPayload,
      exp: expiresAt,
    });

    // Store session in KV for fast access
    await this.kv.put(
      `session:${sessionId}`,
      {
        userId: user.id,
        sessionId,
        deviceId: deviceId || null,
        isAnonymous: user.isAnonymous,
        createdAt: now,
        expiresAt,
      },
      { ttl: this.options.sessionTTL }
    );

    // Store session in D1 for persistence
    await this.d1.insert('user_sessions', {
      session_id: sessionId,
      user_id: user.id,
      device_id: deviceId || null,
      ip_address: null,
      user_agent: null,
      created_at: now,
      expires_at: expiresAt,
      last_refreshed_at: now,
    });

    return {
      user,
      sessionToken,
      expiresAt,
    };
  }

  /**
   * Validate session and return user
   */
  async validateSession(
    sessionToken: string
  ): Promise<{ user: User; session: UserSession } | null> {
    const payload = await this.tokenService.verifyToken(sessionToken);

    if (!payload) {
      return null;
    }

    // Check KV first (fast path)
    const kvSession = await this.kv.get<any>(`session:${payload.sessionId}`);

    if (kvSession) {
      const user = await this.getUserById(payload.userId);
      if (user) {
        return {
          user,
          session: {
            sessionId: payload.sessionId,
            userId: user.id,
            deviceId: kvSession.deviceId,
            ipAddress: kvSession.ipAddress,
            userAgent: kvSession.userAgent,
            createdAt: kvSession.createdAt,
            expiresAt: kvSession.expiresAt,
            lastRefreshedAt: kvSession.lastRefreshedAt || kvSession.createdAt,
          },
        };
      }
    }

    // Check D1 if not in KV
    const dbSession = await this.d1.findOne<any>(
      `SELECT * FROM user_sessions WHERE session_id = ? AND expires_at > ?`,
      [payload.sessionId, Date.now()]
    );

    if (dbSession) {
      const user = await this.getUserById(payload.userId);
      if (user) {
        // Restore to KV
        await this.kv.put(
          `session:${payload.sessionId}`,
          {
            userId: user.id,
            sessionId: payload.sessionId,
            deviceId: dbSession.device_id,
            isAnonymous: user.isAnonymous,
            createdAt: dbSession.created_at,
            expiresAt: dbSession.expires_at,
          },
          { ttl: Math.floor((dbSession.expires_at - Date.now()) / 1000) }
        );

        return {
          user,
          session: {
            sessionId: dbSession.session_id,
            userId: dbSession.user_id,
            deviceId: dbSession.device_id,
            ipAddress: dbSession.ip_address,
            userAgent: dbSession.user_agent,
            createdAt: dbSession.created_at,
            expiresAt: dbSession.expires_at,
            lastRefreshedAt: dbSession.last_refreshed_at,
          },
        };
      }
    }

    return null;
  }

  /**
   * Refresh session token
   */
  async refreshSession(sessionToken: string): Promise<AuthResponse | null> {
    const result = await this.validateSession(sessionToken);

    if (!result) {
      return null;
    }

    const newToken = await this.tokenService.refreshToken(
      sessionToken,
      this.options.sessionTTL
    );

    if (!newToken) {
      return null;
    }

    const now = Date.now();
    const expiresAt = now + this.options.sessionTTL * 1000;

    // Update KV
    await this.kv.put(
      `session:${result.session.sessionId}`,
      {
        ...result.session,
        expiresAt,
        lastRefreshedAt: now,
      },
      { ttl: this.options.sessionTTL }
    );

    // Update D1
    await this.d1.query(
      `UPDATE user_sessions SET expires_at = ?, last_refreshed_at = ? WHERE session_id = ?`,
      [expiresAt, now, result.session.sessionId]
    );

    return {
      user: result.user,
      sessionToken: newToken,
      expiresAt,
    };
  }

  /**
   * Revoke session
   */
  async revokeSession(sessionToken: string): Promise<void> {
    const payload = await this.tokenService.verifyToken(sessionToken);

    if (payload) {
      await this.kv.delete(`session:${payload.sessionId}`);
      await this.d1.query(
        `DELETE FROM user_sessions WHERE session_id = ?`,
        [payload.sessionId]
      );
    }
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.d1.query<any>(
      `SELECT session_id FROM user_sessions WHERE user_id = ?`,
      [userId]
    );

    for (const row of sessions.rows) {
      await this.kv.delete(`session:${row.session_id}`);
    }

    await this.d1.query(
      `DELETE FROM user_sessions WHERE user_id = ?`,
      [userId]
    );
  }

  // ============================================================
  // Credits
  // ============================================================

  /**
   * Add credits to user account
   */
  async addCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<CreditTransaction> {
    await this.d1.query(
      `UPDATE users SET credits_remaining = credits_remaining + ? WHERE id = ?`,
      [amount, userId]
    );

    return this.addCreditTransaction(userId, amount, 'grant', description, metadata);
  }

  /**
   * Consume credits from user account
   */
  async consumeCredits(
    userId: string,
    amount: number,
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<CreditTransaction> {
    const user = await this.getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.creditsRemaining < amount) {
      throw new Error('Insufficient credits');
    }

    await this.d1.query(
      `UPDATE users SET credits_remaining = credits_remaining - ? WHERE id = ?`,
      [amount, userId]
    );

    return this.addCreditTransaction(userId, amount, 'consume', description, metadata);
  }

  /**
   * Get user credit balance
   */
  async getCreditBalance(userId: string): Promise<CreditBalance> {
    const user = await this.getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const stats = await this.d1.findOne<any>(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'grant' THEN amount ELSE 0 END), 0) as total_granted,
        COALESCE(SUM(CASE WHEN type = 'consume' THEN amount ELSE 0 END), 0) as total_consumed
      FROM credit_transactions
      WHERE user_id = ?`,
      [userId]
    );

    return {
      userId,
      remaining: user.creditsRemaining,
      totalGranted: stats?.total_granted || 0,
      totalConsumed: stats?.total_consumed || 0,
    };
  }

  /**
   * Get credit transaction history
   */
  async getCreditHistory(userId: string, limit: number = 50): Promise<CreditTransaction[]> {
    const result = await this.d1.query<any>(
      `SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit]
    );

    return result.rows.map(this.mapDbCreditToCredit);
  }

  private async addCreditTransaction(
    userId: string,
    amount: number,
    type: 'grant' | 'purchase' | 'consume' | 'refund',
    description: string,
    metadata?: Record<string, unknown>
  ): Promise<CreditTransaction> {
    const transaction: CreditTransaction = {
      id: this.generateUUID(),
      userId,
      amount,
      type,
      description,
      metadata: metadata || null,
      createdAt: Date.now(),
    };

    await this.d1.insert('credit_transactions', {
      id: transaction.id,
      user_id: userId,
      amount,
      type,
      description,
      metadata: metadata ? JSON.stringify(metadata) : null,
      created_at: transaction.createdAt,
    });

    return transaction;
  }

  // ============================================================
  // Cleanup
  // ============================================================

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.d1.query<any>(
      `SELECT session_id FROM user_sessions WHERE expires_at < ?`,
      [Date.now()]
    );

    for (const row of result.rows) {
      await this.kv.delete(`session:${row.session_id}`);
    }

    await this.d1.query(
      `DELETE FROM user_sessions WHERE expires_at < ?`,
      [Date.now()]
    );

    return result.rows.length || 0;
  }

  // ============================================================
  // Helpers
  // ============================================================

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private mapDbUserToUser(db: any): User {
    return {
      id: db.id,
      deviceId: db.device_id,
      email: db.email,
      passwordHash: db.password_hash,
      displayName: db.display_name,
      avatarUrl: db.avatar_url,
      isAnonymous: db.is_anonymous === 1,
      createdAt: db.created_at,
      updatedAt: db.updated_at,
      lastActiveAt: db.last_active_at,
      metadata: db.metadata ? JSON.parse(db.metadata) : null,
      creditsRemaining: db.credits_remaining,
    };
  }

  private mapDbCreditToCredit(db: any): CreditTransaction {
    return {
      id: db.id,
      userId: db.user_id,
      amount: db.amount,
      type: db.type,
      description: db.description,
      metadata: db.metadata ? JSON.parse(db.metadata) : null,
      createdAt: db.created_at,
    };
  }
}

// Export singleton instance
export const deviceAuthService = new DeviceAuthService(
  // @ts-ignore - Will be initialized with proper D1/KV instances
  null as any,
  null as any
);
