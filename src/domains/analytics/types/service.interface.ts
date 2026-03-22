/**
 * Analytics Service Interface
 * @description Abstract interface for Analytics operations
 */

import type { AnalyticsEvent, AnalyticsData } from '../entities';

export interface IAnalyticsService {
  trackEvent(event: AnalyticsEvent): Promise<void>;
  trackPageview(url: string, title: string, referrer?: string): Promise<void>;
  getAnalytics(): Promise<AnalyticsData>;
}
