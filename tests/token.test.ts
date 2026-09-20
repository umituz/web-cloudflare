import { describe, it, expect } from 'vitest';
import { TokenService, INSECURE_DEFAULT_SECRET } from '../src/domains/auth/services/token.service';

const basePayload = {
  userId: 'u1',
  sessionId: 's1',
  deviceId: null,
  isAnonymous: false,
  exp: Date.now() + 3600_000,
};

describe('TokenService', () => {
  const service = new TokenService('test-secret-for-vitest-only');

  it('round-trips a payload', async () => {
    const token = await service.generateToken(basePayload);
    const payload = await service.verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe('u1');
    expect(payload!.sessionId).toBe('s1');
  });

  it('rejects a tampered token', async () => {
    const token = await service.generateToken(basePayload);
    const [encodedPayload, encodedSignature] = token.split('.');
    const tampered = `${encodedPayload.slice(0, -2)}XX.${encodedSignature}`;
    expect(await service.verifyToken(tampered)).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const other = new TokenService('a-different-secret');
    const token = await other.generateToken(basePayload);
    expect(await service.verifyToken(token)).toBeNull();
  });

  it('rejects expired tokens', async () => {
    const token = await service.generateToken({ ...basePayload, exp: Date.now() - 1000 });
    expect(await service.verifyToken(token)).toBeNull();
  });

  it('refuses to issue tokens with the insecure default secret', async () => {
    const insecure = new TokenService(INSECURE_DEFAULT_SECRET);
    await expect(insecure.generateToken(basePayload)).rejects.toThrow(
      /insecure default secret/i
    );
    await expect(insecure.verifyToken('abc.def')).rejects.toThrow(/insecure default secret/i);
  });

  it('handles non-ASCII payloads (byte-safe base64url)', async () => {
    const token = await service.generateToken({ ...basePayload, userId: 'üser-日本語-🔒' });
    const payload = await service.verifyToken(token);
    expect(payload!.userId).toBe('üser-日本語-🔒');
  });

  it('refresh issues a new valid token with the same subject', async () => {
    const token = await service.generateToken(basePayload);
    const refreshed = await service.refreshToken(token);
    expect(refreshed).not.toBeNull();
    const payload = await service.verifyToken(refreshed!);
    expect(payload!.userId).toBe('u1');
  });
});
