import { db } from '../lib/knex';
import {
  PageViewInput,
  ProjectAnalyticsSummary,
  SearchEventInput,
  UserEventInput,
} from '../types/analytics.types';

export class AnalyticsRepository {
  async recordPageView(input: PageViewInput): Promise<void> {
    await db('page_views').insert({
      project_id: input.projectId,
      document_id: input.documentId,
      user_id: input.userId,
      session_id: input.sessionId,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      referrer: input.referrer,
      duration_s: input.durationS,
    });
  }

  async recordSearch(input: SearchEventInput): Promise<void> {
    await db('search_events').insert({
      project_id: input.projectId,
      user_id: input.userId,
      query: input.query,
      result_count: input.resultCount,
      clicked_id: input.clickedId,
    });
  }

  async recordUserEvent(input: UserEventInput): Promise<void> {
    await db('user_events').insert({
      user_id: input.userId,
      project_id: input.projectId,
      event_type: input.eventType,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
      metadata: JSON.stringify(input.metadata ?? {}),
    });
  }

  async getProjectSummary(projectId: string): Promise<ProjectAnalyticsSummary> {
    const [pageViewsRow] = await db('page_views')
      .where({ project_id: projectId })
      .count<{ count: number }[]>({ count: '*' });
    const [uniqueVisitorsRow] = await db('page_views')
      .where({ project_id: projectId })
      .countDistinct<{ count: number }[]>({ count: 'session_id' });
    const [searchesRow] = await db('search_events')
      .where({ project_id: projectId })
      .count<{ count: number }[]>({ count: '*' });
    const [eventsRow] = await db('user_events')
      .where({ project_id: projectId })
      .count<{ count: number }[]>({ count: '*' });

    return {
      projectId,
      pageViews: Number(pageViewsRow?.count ?? 0),
      uniqueVisitors: Number(uniqueVisitorsRow?.count ?? 0),
      searches: Number(searchesRow?.count ?? 0),
      events: Number(eventsRow?.count ?? 0),
    };
  }
}
