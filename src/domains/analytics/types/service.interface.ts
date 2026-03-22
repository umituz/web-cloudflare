/**
 * Analytics Service Interface
 * @description Abstract interface for Analytics operations
 */

import type { AnalyticsEvent, AnalyticsData } from '../../../domain/entities/analytics.entity';

export interface IAnalyticsService {
  trackEvent(event: AnalyticsEvent): Promise<void>;
  trackPageview(url: string, title: string, referrer?: string): Promise<void>;
  getAnalytics(): Promise<AnalyticsData>;
}
