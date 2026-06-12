import { AnalyticsService } from '../../services/analytics.service';

describe('AnalyticsService', () => {
  it('delegates project summary lookup', async () => {
    const repository = {
      recordPageView: jest.fn(),
      recordSearch: jest.fn(),
      recordUserEvent: jest.fn(),
      getProjectSummary: jest.fn().mockResolvedValue({
        projectId: 'project-1',
        pageViews: 1,
        uniqueVisitors: 1,
        searches: 0,
        events: 0,
      }),
    };
    const service = new AnalyticsService(repository);
    await expect(service.getProjectSummary('project-1')).resolves.toMatchObject({ pageViews: 1 });
  });
});
