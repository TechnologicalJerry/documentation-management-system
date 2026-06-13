import { AuditService } from '../../services/audit.service';

describe('AuditService', () => {
  it('throws when an audit log is missing', async () => {
    const repository = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue(null),
      findAll: jest.fn(),
      findByResourceHistory: jest.fn(),
      getComplianceSummary: jest.fn(),
      countByAction: jest.fn(),
      countByResource: jest.fn(),
      getTopUsers: jest.fn(),
      getSecurityIncidents: jest.fn(),
      deleteOld: jest.fn(),
      findByUserId: jest.fn(),
    };
    const service = new AuditService(repository);
    await expect(service.findById('missing')).rejects.toThrow('Audit log');
  });
});
