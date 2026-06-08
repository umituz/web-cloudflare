/**
 * Web Device Service
 * @description Device ID generation and management for web browsers using localStorage and fingerprinting
 *
 * IMPORTANT: This service is browser-only. It must never be imported from
 * Worker code, because the runtime does not provide `localStorage`, `navigator`,
 * or `screen`. Use the `WebDeviceService.isBrowserAvailable()` guard before
 * touching any DOM API.
 *
 * Browser global types are declared locally so they don't collide with the
 * WebWorker `WorkerNavigator` provided by the default lib.
 */

export interface WebDeviceInfo {
  deviceId: string;
  userAgent: string;
  language: string;
  screenResolution: string;
  timezone: string;
  cookieEnabled: boolean;
  doNotTrack: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
}

interface BrowserScreen {
  width: number;
  height: number;
  colorDepth: number;
}

interface BrowserNavigator {
  userAgent: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  doNotTrack: string | null;
}

interface BrowserCanvasRenderingContext {
  textBaseline: string;
  font: string;
  fillText(text: string, x: number, y: number): void;
}

interface BrowserCanvas {
  getContext(contextId: '2d'): BrowserCanvasRenderingContext | null;
  toDataURL(): string;
  width: number;
  height: number;
}

interface BrowserDocument {
  createElement(tagName: 'canvas' | string): BrowserCanvas;
}

interface BrowserGlobalScope {
  localStorage: Storage;
  navigator: BrowserNavigator;
  screen?: BrowserScreen;
  document?: BrowserDocument;
}

const STORAGE_KEY = 'web_device_id';
const FINGERPRINT_KEY = 'web_device_fingerprint';

export class WebDeviceService {
  /**
   * Check if the current runtime exposes the browser APIs the service depends on.
   * Use this to guard usage inside Workers, SSR, or test environments.
   */
  static isBrowserAvailable(): boolean {
    const g = globalThis as unknown as Partial<BrowserGlobalScope>;
    return typeof g.localStorage !== 'undefined' && typeof g.navigator !== 'undefined';
  }

  /**
   * Get or create device ID.
   * Uses localStorage with fallback to fingerprinting.
   */
  getDeviceId(): string {
    if (!WebDeviceService.isBrowserAvailable()) {
      throw new Error('WebDeviceService must be used in a browser runtime');
    }

    const stored = this.getFromLocalStorage<WebDeviceInfo>(STORAGE_KEY);
    if (stored?.deviceId) {
      stored.lastSeenAt = Date.now();
      this.setToLocalStorage(STORAGE_KEY, stored);
      return stored.deviceId;
    }

    const deviceId = this.generateDeviceId();
    const deviceInfo = this.collectDeviceInfo(deviceId);
    this.setToLocalStorage(STORAGE_KEY, deviceInfo);
    return deviceId;
  }

  /**
   * Get complete device info. Builds a fresh info record rather than returning
   * the cached one so the snapshot reflects the current page state.
   */
  getDeviceInfo(): WebDeviceInfo {
    if (!WebDeviceService.isBrowserAvailable()) {
      throw new Error('WebDeviceService must be used in a browser runtime');
    }
    return this.collectDeviceInfo(this.getDeviceId());
  }

  /**
   * Generate browser fingerprint.
   * Uses canvas, webgl, and other browser attributes when available.
   */
  getFingerprint(): string {
    if (!WebDeviceService.isBrowserAvailable()) {
      throw new Error('WebDeviceService must be used in a browser runtime');
    }

    const cached = this.getFromLocalStorage<string>(FINGERPRINT_KEY);
    if (cached) {
      return cached;
    }

    const fingerprint = this.computeFingerprint();
    this.setToLocalStorage(FINGERPRINT_KEY, fingerprint);
    return fingerprint;
  }

  /**
   * Reset device ID (for testing or privacy)
   */
  resetDeviceId(): void {
    if (!WebDeviceService.isBrowserAvailable()) return;
    const g = globalThis as unknown as BrowserGlobalScope;
    g.localStorage.removeItem(STORAGE_KEY);
    g.localStorage.removeItem(FINGERPRINT_KEY);
  }

  /**
   * Check if device ID exists
   */
  hasDeviceId(): boolean {
    if (!WebDeviceService.isBrowserAvailable()) return false;
    const stored = this.getFromLocalStorage<WebDeviceInfo>(STORAGE_KEY);
    return Boolean(stored?.deviceId);
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private collectDeviceInfo(deviceId: string): WebDeviceInfo {
    const g = globalThis as unknown as BrowserGlobalScope;
    const now = Date.now();

    return {
      deviceId,
      userAgent: g.navigator.userAgent,
      language: g.navigator.language,
      screenResolution: g.screen ? `${g.screen.width}x${g.screen.height}` : 'unknown',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookieEnabled: g.navigator.cookieEnabled,
      doNotTrack: g.navigator.doNotTrack ?? null,
      firstSeenAt: now,
      lastSeenAt: now,
    };
  }

  private computeFingerprint(): string {
    const g = globalThis as unknown as BrowserGlobalScope;
    const components: string[] = [
      g.screen ? `${g.screen.width}x${g.screen.height}x${g.screen.colorDepth}` : 'unknown',
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      g.navigator.language,
      g.navigator.platform,
      g.navigator.userAgent.substring(0, 100),
      g.navigator.cookieEnabled ? '1' : '0',
      g.navigator.doNotTrack || '0',
    ];

    // Optional canvas fingerprint
    try {
      if (g.document) {
        const canvas = g.document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillText('Fingerprint', 2, 2);
          components.push(canvas.toDataURL().slice(0, 50));
        }
      }
    } catch {
      // Canvas not available, continue without it
    }

    return this.simpleHash(components.join('|'));
  }

  /**
   * Generate v4 UUID
   */
  private generateDeviceId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Simple hash function for fingerprinting
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16) + Date.now().toString(36);
  }

  /**
   * Get from localStorage with error handling
   */
  private getFromLocalStorage<T>(key: string): T | null {
    try {
      const item = globalThis.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : null;
    } catch {
      return null;
    }
  }

  /**
   * Set to localStorage with error handling
   */
  private setToLocalStorage<T>(key: string, value: T): void {
    try {
      globalThis.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota exceeded or storage disabled — silently skip.
      // The service degrades to per-session device IDs in that case.
    }
  }
}

// Export singleton instance
export const webDeviceService = new WebDeviceService();
