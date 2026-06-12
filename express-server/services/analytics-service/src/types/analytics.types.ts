export interface PageViewInput {
  projectId: string;
  documentId: string;
  userId?: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  durationS?: number;
}

export interface SearchEventInput {
  projectId: string;
  userId?: string;
  query: string;
  resultCount: number;
  clickedId?: string;
}

export interface UserEventInput {
  userId: string;
  projectId?: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectAnalyticsSummary {
  projectId: string;
  pageViews: number;
  uniqueVisitors: number;
  searches: number;
  events: number;
}
