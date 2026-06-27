import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { createApp } from '../../app';

const { mockRegister, mockLogin, mockRefresh, mockLogout, mockChangePassword } = vi.hoisted(() => {
  return {
    mockRegister: vi.fn(),
    mockLogin: vi.fn(),
    mockRefresh: vi.fn(),
    mockLogout: vi.fn(),
    mockChangePassword: vi.fn(),
  };
});

vi.mock('../../services/auth.service', () => {
  return {
    AuthService: vi.fn().mockImplementation(() => ({
      register: mockRegister,
      login: mockLogin,
      refresh: mockRefresh,
      logout: mockLogout,
      changePassword: mockChangePassword,
    })),
  };
});

describe('Auth Service Route Integration Tests', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /health - returns health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.service).toBe('auth-service');
    expect(body.status).toBe('healthy');
  });

  it('POST /api/v1/auth/register - validation failed for empty body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {},
    });

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/auth/register - success', async () => {
    const registrationResult = {
      user: {
        id: 'user-uuid',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
      },
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    };
    mockRegister.mockResolvedValue(registrationResult);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('test@example.com');
    expect(body.data.tokens.accessToken).toBe('access-token');
    expect(mockRegister).toHaveBeenCalled();
  });

  it('POST /api/v1/auth/login - success', async () => {
    const loginResult = {
      user: {
        id: 'user-uuid',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
      },
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    };
    mockLogin.mockResolvedValue(loginResult);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'Password123!',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.tokens.accessToken).toBe('access-token');
    expect(mockLogin).toHaveBeenCalled();
  });

  it('POST /api/v1/auth/refresh - success', async () => {
    const tokens = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    };
    mockRefresh.mockResolvedValue(tokens);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: {
        refreshToken: 'valid-refresh-token',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.tokens.accessToken).toBe('new-access-token');
    expect(mockRefresh).toHaveBeenCalledWith('valid-refresh-token', expect.any(Object));
  });
});
