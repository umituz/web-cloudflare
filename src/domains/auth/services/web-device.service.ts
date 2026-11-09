
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
  static isBrowserAvailable(): boolean {
    const g = globalThis as unknown as Partial<BrowserGlobalScope>;
    return typeof g.localStorage !== 'undefined' && typeof g.navigator !== 'undefined';
  }

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

  getDeviceInfo(): WebDeviceInfo {
    if (!WebDeviceService.isBrowserAvailable()) {
      throw new Error('WebDeviceService must be used in a browser runtime');
    }
    return this.collectDeviceInfo(this.getDeviceId());
  }

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

  resetDeviceId(): void {
    if (!WebDeviceService.isBrowserAvailable()) return;
    const g = globalThis as unknown as BrowserGlobalScope;
    g.localStorage.removeItem(STORAGE_KEY);
    g.localStorage.removeItem(FINGERPRINT_KEY);
  }

  hasDeviceId(): boolean {
    if (!WebDeviceService.isBrowserAvailable()) return false;
    const stored = this.getFromLocalStorage<WebDeviceInfo>(STORAGE_KEY);
    return Boolean(stored?.deviceId);
  }


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
    }

    return this.simpleHash(components.join('|'));
  }

  private generateDeviceId(): string {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16) + Date.now().toString(36);
  }

  private getFromLocalStorage<T>(key: string): T | null {
    try {
      const item = globalThis.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : null;
    } catch {
      return null;
    }
  }

  private setToLocalStorage<T>(key: string, value: T): void {
    try {
      globalThis.localStorage.setItem(key, JSON.stringify(value));
    } catch {
    }
  }
}

export const webDeviceService = new WebDeviceService();
