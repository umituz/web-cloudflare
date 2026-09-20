/**
 * Token Service
 * @description Simple JWT-like token generation and verification for Cloudflare Workers
 */

import type { ITokenService } from '../types';
import type { TokenPayload } from '../entities';

// ============================================================
// Token Service Implementation
// ============================================================

/**
 * Sentinel secret retained for API compatibility. Signing or verifying with
 * it throws: anyone can read this value from the published package, so
 * tokens minted with it are forgeable by definition. Construct
 * `TokenService` with a real secret (e.g. a Worker secret binding).
 */
export const INSECURE_DEFAULT_SECRET = 'default-secret-change-in-production';

function assertRealSecret(secret: string): void {
  if (secret === INSECURE_DEFAULT_SECRET) {
    throw new Error(
      'TokenService is using its insecure default secret. Pass a real secret, e.g. new TokenService(env.TOKEN_SECRET), before issuing or verifying tokens.',
    );
  }
}

export class TokenService implements ITokenService {
  private secret: string;

  constructor(secret: string = INSECURE_DEFAULT_SECRET) {
    this.secret = secret;
  }

  /**
   * Generate a token from payload
   * Uses base64url encoding with HMAC-SHA256 signature
   */
  async generateToken(payload: Omit<TokenPayload, 'iat'> & { exp?: number }): Promise<string> {
    assertRealSecret(this.secret);
    const now = Date.now();
    const fullPayload: TokenPayload = {
      ...payload,
      iat: now,
      exp: payload.exp ?? now + 86400000, // 24 hours default
    };

    // Encode payload
    const encodedPayload = this.base64UrlEncode(JSON.stringify(fullPayload));

    // Create signature
    const signature = await this.createSignature(encodedPayload, this.secret);
    const encodedSignature = this.base64UrlEncode(signature);

    // Combine: payload.signature
    return `${encodedPayload}.${encodedSignature}`;
  }

  /**
   * Verify and decode a token
   */
  async verifyToken(token: string): Promise<TokenPayload | null> {
    assertRealSecret(this.secret);
    try {
      const [encodedPayload, encodedSignature] = token.split('.');

      if (!encodedPayload || !encodedSignature) {
        return null;
      }

      // Verify signature
      const signature = this.base64UrlDecode(encodedSignature);
      const expectedSignature = await this.createSignature(encodedPayload, this.secret);

      // Constant-time comparison to prevent timing attacks
      if (!this.constantTimeCompare(signature, expectedSignature)) {
        return null;
      }

      // Decode payload
      const payloadJson = this.base64UrlDecode(encodedPayload);
      const payload: TokenPayload = JSON.parse(payloadJson);

      // Check expiration
      if (Date.now() > payload.exp) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Refresh a token with new expiration
   */
  async refreshToken(token: string, ttl: number = 86400): Promise<string | null> {
    const payload = await this.verifyToken(token);
    if (!payload) {
      return null;
    }

    const newPayload = {
      userId: payload.userId,
      sessionId: payload.sessionId,
      deviceId: payload.deviceId,
      isAnonymous: payload.isAnonymous,
      exp: Date.now() + ttl * 1000,
    };

    return this.generateToken(newPayload);
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private base64UrlEncode(str: string): string {
    // Byte-safe: btoa() throws on non-Latin1 characters, so encode via
    // UTF-8 bytes first. Identical output to btoa(str) for ASCII payloads,
    // so previously issued tokens still verify.
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    const base64 = btoa(binary);
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  private async createSignature(data: string, secret: string): Promise<string> {
    // Simple HMAC-SHA256 using Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(data);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const signatureArray = Array.from(new Uint8Array(signature));
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Convert hex to base64url
    return this.base64UrlEncode(signatureHex.match(/.{2}/g)?.map(b => String.fromCharCode(parseInt(b, 16))).join('') || '');
  }

  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

// Export singleton instance
export const tokenService = new TokenService();
