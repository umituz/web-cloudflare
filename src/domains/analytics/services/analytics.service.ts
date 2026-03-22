/**
 * Analytics Service
 * @description Cloudflare Web Analytics operations
 */

import type { AnalyticsEvent, AnalyticsPageviewEvent, AnalyticsCustomEvent, AnalyticsData } from "../entities";
import type { IAnalyticsService } from "../../../domain/interfaces/services.interface";

export interface AnalyticsClientOptions {
  readonly siteId: string;
  readonly scriptUrl?: string;
}

class AnalyticsService implements IAnalyticsService {
  private siteId: string | null = null;
  private scriptUrl: string | null = null;
  private eventQueue: AnalyticsEvent[] = [];

  initialize(options: AnalyticsClientOptions): void {
    this.siteId = options.siteId;
    this.scriptUrl = options.scriptUrl ?? null;
  }

  private ensureInitialized(): void {
    if (!this.siteId) {
      throw new Error("AnalyticsService not initialized");
    }
  }

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    this.ensureInitialized();

    this.eventQueue.push(event);

    // In a browser environment, send to Cloudflare Analytics
    if (typeof window !== "undefined" && (window as any)._cfAnalytics) {
      (window as any)._cfAnalytics.track(event);
    }
  }

  async trackPageview(url: string, title: string, referrer?: string): Promise<void> {
    const event: AnalyticsPageviewEvent = {
      timestamp: Date.now(),
      url,
      eventType: "pageview",
      title,
      referrer,
    };

    await this.trackEvent(event);
  }

  async trackCustom(eventName: string, data?: Record<string, unknown>): Promise<void> {
    if (typeof window === "undefined") return;

    const event: AnalyticsCustomEvent = {
      timestamp: Date.now(),
      url: window.location.href,
      eventType: "custom",
      eventName,
      eventData: data,
    };

    await this.trackEvent(event);
  }

  async trackOutboundLink(url: string, linkType?: string): Promise<void> {
    if (typeof window === "undefined") return;

    const event: AnalyticsCustomEvent = {
      timestamp: Date.now(),
      url: window.location.href,
      eventType: "custom",
      eventName: "outbound-link",
      eventData: {
        targetUrl: url,
        linkType,
      },
    };

    await this.trackEvent(event);
  }

  async trackTiming(name: string, value: number, label?: string): Promise<void> {
    if (typeof window === "undefined") return;

    const event: AnalyticsEvent = {
      timestamp: Date.now(),
      url: window.location.href,
      eventType: "timing",
      eventData: {
        name,
        value,
        label,
      },
    };

    await this.trackEvent(event);
  }

  async getAnalytics(): Promise<AnalyticsData> {
    this.ensureInitialized();

    // In a real implementation, this would fetch from Cloudflare Analytics API
    // For now, return queued events

    return {
      siteId: this.siteId!,
      events: this.eventQueue,
      metrics: {
        pageviews: this.eventQueue.filter((e) => e.eventType === "pageview").length,
        uniqueVisitors: new Set(this.eventQueue.map((e) => e.url)).size,
      },
    };
  }

  /**
   * Get analytics script tag
   */
  getScriptTag(): string {
    this.ensureInitialized();

    const scriptUrl = this.scriptUrl || `https://static.cloudflareinsights.com/beacon.min.js`;

    return `
<script defer src='${scriptUrl}' data-cf-beacon='{"token": "${this.siteId}"}'></script>
    `.trim();
  }

  /**
   * Clear queued events
   */
  clearEvents(): void {
    this.eventQueue = [];
  }

  /**
   * Get queued events
   */
  getQueuedEvents(): readonly AnalyticsEvent[] {
    return this.eventQueue;
  }

  /**
   * E-commerce helpers
   */
  async trackPurchase(transactionId: string, revenue: number, items: readonly { id: string; name: string; price: number; quantity: number }[]): Promise<void> {
    await this.trackCustom("purchase", {
      transactionId,
      revenue,
      items,
    });
  }

  async trackAddToCart(itemId: string, price: number, quantity: number): Promise<void> {
    await this.trackCustom("add-to-cart", {
      itemId,
      price,
      quantity,
    });
  }

  async trackRemoveFromCart(itemId: string, quantity: number): Promise<void> {
    await this.trackCustom("remove-from-cart", {
      itemId,
      quantity,
    });
  }

  /**
   * Engagement helpers
   */
  async trackScrollDepth(depth: number): Promise<void> {
    await this.trackCustom("scroll-depth", { depth });
  }

  async trackTimeOnPage(seconds: number): Promise<void> {
    await this.trackCustom("time-on-page", { seconds });
  }

  async trackEngagement(action: string, target?: string): Promise<void> {
    await this.trackCustom("engagement", {
      action,
      target,
    });
  }
}

export const analyticsService = new AnalyticsService();
