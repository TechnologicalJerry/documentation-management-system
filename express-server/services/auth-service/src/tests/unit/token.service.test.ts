import { TokenService } from '../../services/token.service';

describe('TokenService', () => {
  it('issues hashable refresh tokens', () => {
    const service = new TokenService();
    const refresh = service.issueRefreshToken();

    expect(refresh.raw).toHaveLength(96);
    expect(refresh.hash).toBe(service.hashRefreshToken(refresh.raw));
    expect(refresh.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
