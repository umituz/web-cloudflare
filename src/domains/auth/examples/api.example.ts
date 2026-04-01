/**
 * Auth API Example
 * @description Example implementation of device-based authentication API endpoints
 */

import { DeviceAuthService } from '../services';
import { createRouter, json, success, fail } from '../../../infrastructure/router';

// ============================================================
// Initialize Auth Service
// ============================================================

const d1Service = null; // Initialize with your D1 binding
const kvService = null; // Initialize with your KV binding

const authService = new DeviceAuthService(d1Service, kvService, {
  initialCredits: 10,
  sessionTTL: 86400, // 24 hours
  tokenSecret: 'your-secret-key-here',
});

// ============================================================
// Create Auth Router
// ============================================================

export function createAuthRouter() {
  return createRouter()

    // ============================================================
    // Device-Based Authentication
    // ============================================================

    /**
     * POST /api/auth/register-device
     * Register or login with device ID (anonymous authentication)
     *
     * Body: { device_id: string, device_info?: {...} }
     * Returns: { user: User, session_token: string, expires_at: number }
     */
    .post('/api/auth/register-device', async (request) => {
      try {
        const { device_id, device_info } = await request.json();

        if (!device_id) {
          return fail('device_id is required', 400);
        }

        const result = await authService.registerDevice({
          deviceId: device_id,
          deviceInfo: device_info,
        });

        return success(result, 'Device registered successfully');
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Registration failed', 400);
      }
    })

    // ============================================================
    // Account Upgrade
    // ============================================================

    /**
     * POST /api/auth/upgrade-account
     * Upgrade anonymous user to real user with email/password
     *
     * Headers: Authorization: Bearer <session_token>
     * Body: { email: string, password: string, display_name?: string }
     * Returns: { user: User, session_token: string, expires_at: number }
     */
    .post('/api/auth/upgrade-account', async (request) => {
      try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return fail('Authentication required', 401);
        }

        const sessionToken = authHeader.substring(7);
        const session = await authService.validateSession(sessionToken);

        if (!session) {
          return fail('Invalid or expired session', 401);
        }

        const { email, password, display_name } = await request.json();

        if (!email || !password) {
          return fail('email and password are required', 400);
        }

        const result = await authService.upgradeAccount(session.user.id, {
          email,
          password,
          displayName: display_name,
        });

        return success(result, 'Account upgraded successfully');
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Upgrade failed', 400);
      }
    })

    // ============================================================
    // Traditional Authentication
    // ============================================================

    /**
     * POST /api/auth/signup
     * Sign up new real user
     *
     * Body: { email: string, password: string, display_name?: string }
     * Returns: { user: User, session_token: string, expires_at: number }
     */
    .post('/api/auth/signup', async (request) => {
      try {
        const { email, password, display_name } = await request.json();

        if (!email || !password) {
          return fail('email and password are required', 400);
        }

        const result = await authService.signUp({
          email,
          password,
          displayName: display_name,
        });

        return success(result, 'Account created successfully', 201);
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Signup failed', 400);
      }
    })

    /**
     * POST /api/auth/login
     * Login with email/password
     *
     * Body: { email: string, password: string }
     * Returns: { user: User, session_token: string, expires_at: number }
     */
    .post('/api/auth/login', async (request) => {
      try {
        const { email, password } = await request.json();

        if (!email || !password) {
          return fail('email and password are required', 400);
        }

        const result = await authService.login({ email, password });

        return success(result, 'Login successful');
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Login failed', 401);
      }
    })

    // ============================================================
    // Session Management
    // ============================================================

    /**
     * GET /api/auth/me
     * Get current user info
     *
     * Headers: Authorization: Bearer <session_token>
     * Returns: { user: User, session: UserSession }
     */
    .get('/api/auth/me', async (request) => {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return fail('Authentication required', 401);
      }

      const sessionToken = authHeader.substring(7);
      const result = await authService.validateSession(sessionToken);

      if (!result) {
        return fail('Invalid or expired session', 401);
      }

      return success(result);
    })

    /**
     * POST /api/auth/refresh-token
     * Refresh session token
     *
     * Headers: Authorization: Bearer <session_token>
     * Returns: { user: User, session_token: string, expires_at: number }
     */
    .post('/api/auth/refresh-token', async (request) => {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return fail('Authentication required', 401);
      }

      const sessionToken = authHeader.substring(7);
      const result = await authService.refreshSession(sessionToken);

      if (!result) {
        return fail('Invalid or expired session', 401);
      }

      return success(result, 'Token refreshed successfully');
    })

    /**
     * POST /api/auth/logout
     * Logout and revoke session
     *
     * Headers: Authorization: Bearer <session_token>
     */
    .post('/api/auth/logout', async (request) => {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return fail('Authentication required', 401);
      }

      const sessionToken = authHeader.substring(7);
      await authService.revokeSession(sessionToken);

      return success(null, 'Logged out successfully');
    })

    // ============================================================
    // Credits
    // ============================================================

    /**
     * GET /api/auth/credits
     * Get user credit balance
     *
     * Headers: Authorization: Bearer <session_token>
     * Returns: CreditBalance
     */
    .get('/api/auth/credits', async (request) => {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return fail('Authentication required', 401);
      }

      const sessionToken = authHeader.substring(7);
      const session = await authService.validateSession(sessionToken);

      if (!session) {
        return fail('Invalid or expired session', 401);
      }

      const balance = await authService.getCreditBalance(session.user.id);

      return success(balance);
    })

    /**
     * GET /api/auth/credits/history
     * Get credit transaction history
     *
     * Headers: Authorization: Bearer <session_token>
     * Query: ?limit=50
     * Returns: CreditTransaction[]
     */
    .get('/api/auth/credits/history', async (request) => {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return fail('Authentication required', 401);
      }

      const sessionToken = authHeader.substring(7);
      const session = await authService.validateSession(sessionToken);

      if (!session) {
        return fail('Invalid or expired session', 401);
      }

      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);

      const history = await authService.getCreditHistory(session.user.id, limit);

      return success(history);
    })

    /**
     * POST /api/auth/credits/add
     * Add credits to user account (admin only)
     *
     * Headers: Authorization: Bearer <admin_session_token>
     * Body: { user_id: string, amount: number, description: string }
     */
    .post('/api/auth/credits/add', async (request) => {
      // Add admin check here
      const { user_id, amount, description } = await request.json();

      if (!user_id || !amount || !description) {
        return fail('user_id, amount, and description are required', 400);
      }

      const transaction = await authService.addCredits(user_id, amount, description);

      return success(transaction, 'Credits added successfully');
    })

    /**
     * POST /api/auth/credits/consume
     * Consume credits from user account
     *
     * Headers: Authorization: Bearer <session_token>
     * Body: { amount: number, description: string }
     */
    .post('/api/auth/credits/consume', async (request) => {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return fail('Authentication required', 401);
      }

      const sessionToken = authHeader.substring(7);
      const session = await authService.validateSession(sessionToken);

      if (!session) {
        return fail('Invalid or expired session', 401);
      }

      const { amount, description } = await request.json();

      if (!amount || !description) {
        return fail('amount and description are required', 400);
      }

      try {
        const transaction = await authService.consumeCredits(
          session.user.id,
          amount,
          description
        );

        return success(transaction, 'Credits consumed successfully');
      } catch (error) {
        return fail(error instanceof Error ? error.message : 'Failed to consume credits', 400);
      }
    });
}

// ============================================================
// Usage in Worker
// ============================================================

/*
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Initialize services with env bindings
    d1Service.bindDatabase('main', env.DB);
    kvService.bindNamespace('main', env.CACHE);

    const authRouter = createAuthRouter();

    return authRouter.handle(request, env, ctx);
  },
};
*/
