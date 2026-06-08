/**
 * Auth API Example
 * @description Reference implementation of device-based authentication API endpoints
 *
 * Copy this file into your application and bind real D1 / KV namespaces
 * (see the usage block at the bottom). All handlers are typed end-to-end.
 */

import { D1Service } from '../../d1/services/d1.service';
import { KVService } from '../../kv/services/kv.service';
import { DeviceAuthService } from '../services/device-auth.service';
import { json } from '../../../infrastructure/utils/helpers';
import {
  createRouter,
  success,
  fail,
  type RouteHandler,
} from '../../../infrastructure/router';

interface RegisterDeviceBody {
  device_id: string;
  device_info?: { model?: string; os?: string; osVersion?: string; appVersion?: string };
}

interface CredentialsBody {
  email: string;
  password: string;
  display_name?: string;
}

interface AddCreditsBody {
  user_id: string;
  amount: number;
  description: string;
}

interface ConsumeCreditsBody {
  amount: number;
  description: string;
}

/**
 * Build the auth router with the supplied service instances.
 * The factories are the integration seam — pass real D1/KV bindings here.
 */
export function createAuthRouter(auth: DeviceAuthService) {
  const requireBearer = (request: Request): string | null => {
    const header = request.headers.get('Authorization');
    return header?.startsWith('Bearer ') ? header.substring(7) : null;
  };

  const readJson = async <T>(request: Request): Promise<T> => {
    return (await request.json()) as T;
  };

  const registerDevice: RouteHandler = async (request) => {
    const body = await readJson<RegisterDeviceBody>(request);
    if (!body.device_id) {
      return fail('device_id is required', 400);
    }
    const result = await auth.registerDevice({
      deviceId: body.device_id,
      deviceInfo: body.device_info,
    });
    return success(result, 'Device registered successfully');
  };

  const upgradeAccount: RouteHandler = async (request) => {
    const token = requireBearer(request);
    if (!token) return fail('Authentication required', 401);

    const session = await auth.validateSession(token);
    if (!session) return fail('Invalid or expired session', 401);

    const body = await readJson<CredentialsBody>(request);
    if (!body.email || !body.password) {
      return fail('email and password are required', 400);
    }

    const result = await auth.upgradeAccount(session.user.id, {
      email: body.email,
      password: body.password,
      displayName: body.display_name,
    });
    return success(result, 'Account upgraded successfully');
  };

  const signUp: RouteHandler = async (request) => {
    const body = await readJson<CredentialsBody>(request);
    if (!body.email || !body.password) {
      return fail('email and password are required', 400);
    }

    const result = await auth.signUp({
      email: body.email,
      password: body.password,
      displayName: body.display_name,
    });
    return success(result, 'Account created successfully');
  };

  const login: RouteHandler = async (request) => {
    const body = await readJson<CredentialsBody>(request);
    if (!body.email || !body.password) {
      return fail('email and password are required', 400);
    }

    const result = await auth.login({ email: body.email, password: body.password });
    return success(result, 'Login successful');
  };

  const me: RouteHandler = async (request) => {
    const token = requireBearer(request);
    if (!token) return fail('Authentication required', 401);

    const result = await auth.validateSession(token);
    if (!result) return fail('Invalid or expired session', 401);

    return success(result);
  };

  const refreshToken: RouteHandler = async (request) => {
    const token = requireBearer(request);
    if (!token) return fail('Authentication required', 401);

    const result = await auth.refreshSession(token);
    if (!result) return fail('Invalid or expired session', 401);

    return success(result, 'Token refreshed successfully');
  };

  const logout: RouteHandler = async (request) => {
    const token = requireBearer(request);
    if (!token) return fail('Authentication required', 401);

    await auth.revokeSession(token);
    return json({ success: true, message: 'Logged out successfully' });
  };

  const getCredits: RouteHandler = async (request) => {
    const token = requireBearer(request);
    if (!token) return fail('Authentication required', 401);

    const session = await auth.validateSession(token);
    if (!session) return fail('Invalid or expired session', 401);

    const balance = await auth.getCreditBalance(session.user.id);
    return success(balance);
  };

  const getCreditHistory: RouteHandler = async (request) => {
    const token = requireBearer(request);
    if (!token) return fail('Authentication required', 401);

    const session = await auth.validateSession(token);
    if (!session) return fail('Invalid or expired session', 401);

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const history = await auth.getCreditHistory(session.user.id, limit);
    return success(history);
  };

  const addCredits: RouteHandler = async (request) => {
    const body = await readJson<AddCreditsBody>(request);
    if (!body.user_id || !body.amount || !body.description) {
      return fail('user_id, amount, and description are required', 400);
    }

    const transaction = await auth.addCredits(body.user_id, body.amount, body.description);
    return success(transaction, 'Credits added successfully');
  };

  const consumeCredits: RouteHandler = async (request) => {
    const token = requireBearer(request);
    if (!token) return fail('Authentication required', 401);

    const session = await auth.validateSession(token);
    if (!session) return fail('Invalid or expired session', 401);

    const body = await readJson<ConsumeCreditsBody>(request);
    if (!body.amount || !body.description) {
      return fail('amount and description are required', 400);
    }

    const transaction = await auth.consumeCredits(
      session.user.id,
      body.amount,
      body.description
    );
    return success(transaction, 'Credits consumed successfully');
  };

  return createRouter()
    .post('/api/auth/register-device', registerDevice)
    .post('/api/auth/upgrade-account', upgradeAccount)
    .post('/api/auth/signup', signUp)
    .post('/api/auth/login', login)
    .get('/api/auth/me', me)
    .post('/api/auth/refresh-token', refreshToken)
    .post('/api/auth/logout', logout)
    .get('/api/auth/credits', getCredits)
    .get('/api/auth/credits/history', getCreditHistory)
    .post('/api/auth/credits/add', addCredits)
    .post('/api/auth/credits/consume', consumeCredits);
}

// ============================================================
// Usage in Worker
// ============================================================

/*
import { D1Service, KVService } from '@umituz/web-cloudflare';

interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const d1 = new D1Service();
    d1.bindDatabase('main', env.DB);

    const kv = new KVService();
    kv.bindNamespace('main', env.CACHE);

    const auth = new DeviceAuthService(d1, kv, {
      initialCredits: 10,
      sessionTTL: 86400,
      tokenSecret: 'replace-me',
    });

    return createAuthRouter(auth).handle(request, env, ctx);
  },
};
*/
