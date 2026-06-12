import {
  PageViewInput,
  ProjectAnalyticsSummary,
  SearchEventInput,
  UserEventInput,
} from '../types/analytics.types';
import { AnalyticsRepository } from '../repositories/analytics.repository';

export class AnalyticsService {
  constructor(private readonly repository = new AnalyticsRepository()) {}

  recordPageView(input: PageViewInput): Promise<void> {
    return this.repository.recordPageView(input);
  }

  recordSearch(input: SearchEventInput): Promise<void> {
    return this.repository.recordSearch(input);
  }

  recordUserEvent(input: UserEventInput): Promise<void> {
    return this.repository.recordUserEvent(input);
  }

  getProjectSummary(projectId: string): Promise<ProjectAnalyticsSummary> {
    return this.repository.getProjectSummary(projectId);
  }
}
