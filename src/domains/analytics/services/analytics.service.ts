/**
 * Analytics Service
 * @description Cloudflare Web Analytics operations for Workers runtime
 */

import type { AnalyticsEvent, AnalyticsPageviewEvent, AnalyticsCustomEvent } from "../entities";
import type { AnalyticsData } from "../../../domain/entities/analytics.entity";
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
    // In Workers runtime, events are queued for batch processing
    // The actual sending would be done via Cloudflare Analytics API
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

  async trackCustom(eventName: string, data?: Record<string, unknown>, url?: string): Promise<void> {
    const event: AnalyticsCustomEvent = {
      timestamp: Date.now(),
      url: url || '/workers',
      eventType: "custom",
      eventName,
      eventData: data,
    };

    await this.trackEvent(event);
  }

  async trackOutboundLink(url: string, linkType?: string): Promise<void> {
    const event: AnalyticsCustomEvent = {
      timestamp: Date.now(),
      url: '/workers',
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
    const event: AnalyticsEvent = {
      timestamp: Date.now(),
      url: '/workers',
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

    return {
      siteId: this.siteId!,
      events: [...this.eventQueue],
      metrics: {
        pageviews: this.eventQueue.filter(e => e.eventType === "pageview").length,
        uniqueVisitors: 0, // Would be calculated from stored data
      },
    };
  }

  async flush(): Promise<void> {
    // In Workers, this would send events to Cloudflare Analytics API
    this.eventQueue = [];
  }
}

// Export class and singleton instance
export { AnalyticsService };
export const analyticsService = new AnalyticsService();
