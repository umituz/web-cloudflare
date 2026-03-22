/**
 * Analytics Entity
 * @description Basic Analytics entity placeholder
 */

export interface AnalyticsEntity {
  siteId: string;
  eventCount: number;
}

export interface AnalyticsConfig {
  siteId: string;
  scriptUrl?: string;
}

export interface AnalyticsEvent {
  timestamp: number;
  url: string;
  eventType: string;
  data?: Record<string, unknown>;
}

export interface AnalyticsData {
  siteId: string;
  events: AnalyticsEvent[];
  metrics?: {
    pageviews: number;
    uniqueVisitors: number;
  };
}
