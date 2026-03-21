/**
 * Analytics Entity
 * @description Cloudflare Web Analytics configuration and types
 */

export interface AnalyticsConfig {
  readonly siteId: string;
  readonly scriptUrl?: string;
}

export interface AnalyticsEvent {
  readonly timestamp: number;
  readonly url: string;
  readonly eventType: "pageview" | "custom" | "outbound-link" | "timing";
  readonly eventData?: Record<string, unknown>;
}

export interface AnalyticsPageviewEvent extends AnalyticsEvent {
  readonly eventType: "pageview";
  readonly title: string;
  readonly referrer?: string;
}

export interface AnalyticsCustomEvent extends AnalyticsEvent {
  readonly eventType: "custom";
  readonly eventName: string;
}

export interface AnalyticsTimingEvent extends AnalyticsEvent {
  readonly eventType: "timing";
  readonly name: string;
  readonly value: number;
  readonly label?: string;
}

export interface AnalyticsData {
  readonly siteId: string;
  readonly events: readonly AnalyticsEvent[];
  readonly metrics?: AnalyticsMetrics;
}

export interface AnalyticsMetrics {
  readonly pageviews: number;
  readonly uniqueVisitors: number;
  readonly bounceRate?: number;
  readonly avgSessionDuration?: number;
}
