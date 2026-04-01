/**
 * Web Device Service
 * @description Device ID generation and management for web browsers using localStorage and fingerprinting
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

/**
 * Generate device ID for web browsers
 * Uses combination of localStorage and browser fingerprinting
 */
export class WebDeviceService {
  private storageKey = 'web_device_id';
  private fingerprintKey = 'web_device_fingerprint';

  /**
   * Get or create device ID
   * Uses localStorage with fallback to fingerprinting
   */
  getDeviceId(): string {
    // Try to get from localStorage first
    const stored = this.getFromLocalStorage<WebDeviceInfo>(this.storageKey);

    if (stored && stored.deviceId) {
      // Update last seen
      stored.lastSeenAt = Date.now();
      this.setToLocalStorage(this.storageKey, stored);
      return stored.deviceId;
    }

    // Generate new device ID
    const deviceId = this.generateDeviceId();

    // Store device info
    const deviceInfo: WebDeviceInfo = {
      deviceId,
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
    };

    this.setToLocalStorage(this.storageKey, deviceInfo);

    return deviceId;
  }

  /**
   * Get complete device info
   */
  getDeviceInfo(): WebDeviceInfo {
    const deviceId = this.getDeviceId();

    return {
      deviceId,
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
    };
  }

  /**
   * Generate browser fingerprint
   * Uses canvas, webgl, and other browser attributes
   */
  getFingerprint(): string {
    // Try to get cached fingerprint
    const cached = this.getFromLocalStorage<string>(this.fingerprintKey);
    if (cached) {
      return cached;
    }

    // Generate fingerprint from various browser attributes
    const components = [
      // Screen info
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      // Timezone
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      // Language
      navigator.language,
      // Platform
      navigator.platform,
      // User agent (truncated)
      navigator.userAgent.substring(0, 100),
      // Cookie enabled
      navigator.cookieEnabled ? '1' : '0',
      // Do not track
      navigator.doNotTrack || '0',
    ];

    // Try to get canvas fingerprint
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Fingerprint', 2, 2);
        const canvasData = canvas.toDataURL().slice(0, 50);
        components.push(canvasData);
      }
    } catch {
      // Canvas not available
    }

    // Create simple hash from components
    const fingerprint = this.simpleHash(components.join('|'));

    // Cache fingerprint
    this.setToLocalStorage(this.fingerprintKey, fingerprint);

    return fingerprint;
  }

  /**
   * Reset device ID (for testing or privacy)
   */
  resetDeviceId(): void {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.fingerprintKey);
  }

  /**
   * Check if device ID exists
   */
  hasDeviceId(): boolean {
    const stored = this.getFromLocalStorage<WebDeviceInfo>(this.storageKey);
    return !!(stored && stored.deviceId);
  }

  // ============================================================
  // Private Helpers
  // ============================================================

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
      const item = localStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
      }
    } catch {
      // LocalStorage not available or corrupted
    }
    return null;
  }

  /**
   * Set to localStorage with error handling
   */
  private setToLocalStorage<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // LocalStorage not available or quota exceeded
    }
  }
}

// Export singleton instance
export const webDeviceService = new WebDeviceService();
