import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../app';
import { UserResponseDto, UserPreferenceResponseDto, Theme } from '../../types/user.types';

// ─── Mock Service Layer ───────────────────────────────────────────────────────
// Integration tests mock the service to avoid requiring a real database.
// For true end-to-end tests, use a test database instead.

var mockServiceInstance: any;

jest.mock('../../services/user.service', () => {
  return {
    UserService: jest.fn().mockImplementation(() => {
      mockServiceInstance = {
        getUsers: jest.fn(),
        getUser: jest.fn(),
        getUserByEmail: jest.fn(),
        updateUser: jest.fn(),
        deleteUser: jest.fn(),
        uploadAvatar: jest.fn(),
        removeAvatar: jest.fn(),
        updatePreferences: jest.fn(),
        getPreferences: jest.fn(),
        searchUsers: jest.fn(),
      };
      return mockServiceInstance;
    }),
  };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseUser: UserResponseDto = {
  id: 'user-uuid-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  displayName: 'Test U.',
  avatar: null,
  bio: null,
  timezone: 'UTC',
  language: 'en',
  isActive: true,
  organizationId: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

const basePreferences: UserPreferenceResponseDto = {
  id: 'pref-uuid-1',
  userId: 'user-uuid-1',
  emailNotifications: true,
  pushNotifications: true,
  theme: Theme.LIGHT,
  editorFontSize: 14,
  editorTheme: 'default',
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

const paginatedUsers = {
  data: [baseUser],
  meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
};

// ─── Setup ────────────────────────────────────────────────────────────────────

let app: Application;

beforeAll(() => {
  app = createApp();
});

beforeEach(() => {
  jest.clearAllMocks();

  mockServiceInstance.getUsers.mockResolvedValue(paginatedUsers);
  mockServiceInstance.getUser.mockResolvedValue(baseUser);
  mockServiceInstance.getUserByEmail.mockResolvedValue(baseUser);
  mockServiceInstance.updateUser.mockResolvedValue(baseUser);
  mockServiceInstance.deleteUser.mockResolvedValue(undefined);
  mockServiceInstance.uploadAvatar.mockResolvedValue({ ...baseUser, avatar: 'http://files/avatar.jpg' });
  mockServiceInstance.removeAvatar.mockResolvedValue({ ...baseUser, avatar: null });
  mockServiceInstance.updatePreferences.mockResolvedValue(basePreferences);
  mockServiceInstance.getPreferences.mockResolvedValue(basePreferences);
  mockServiceInstance.searchUsers.mockResolvedValue(paginatedUsers);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/health', () => {
  it('returns 200 with service status', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'user-service',
    });
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('GET /api/v1/users', () => {
  it('returns paginated user list', async () => {
    const res = await request(app).get('/api/v1/users');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ total: 1, page: 1 });
  });

  it('accepts pagination query params', async () => {
    mockServiceInstance.getUsers.mockResolvedValueOnce({
      data: [],
      meta: { total: 0, page: 2, limit: 10, totalPages: 0 },
    });

    const res = await request(app).get('/api/v1/users?page=2&limit=10');

    expect(res.status).toBe(200);
    expect(mockServiceInstance.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10 }),
    );
  });

  it('accepts search filter', async () => {
    const res = await request(app).get('/api/v1/users?search=Alice');

    expect(res.status).toBe(200);
    expect(mockServiceInstance.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Alice' }),
    );
  });

  it('accepts organizationId filter', async () => {
    const orgId = '550e8400-e29b-41d4-a716-446655440000';
    const res = await request(app).get(`/api/v1/users?organizationId=${orgId}`);

    expect(res.status).toBe(200);
    expect(mockServiceInstance.getUsers).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: orgId }),
    );
  });
});

describe('GET /api/v1/users/search', () => {
  it('searches users by query string', async () => {
    const res = await request(app).get('/api/v1/users/search?q=alice');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockServiceInstance.searchUsers).toHaveBeenCalledWith(
      'alice',
      expect.objectContaining({ page: 1 }),
    );
  });

  it('returns 422 when query is too short', async () => {
    const res = await request(app).get('/api/v1/users/search?q=a');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 when query is missing', async () => {
    const res = await request(app).get('/api/v1/users/search');

    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/users/:id', () => {
  it('returns user by ID', async () => {
    const res = await request(app).get('/api/v1/users/user-uuid-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('user-uuid-1');
  });

  it('returns 404 when user not found', async () => {
    const { NotFoundError } = await import('../../types/user.types');
    mockServiceInstance.getUser.mockRejectedValueOnce(new NotFoundError('User', 'missing'));

    const res = await request(app).get('/api/v1/users/missing');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/v1/users/email/:email', () => {
  it('returns user by email', async () => {
    const res = await request(app).get('/api/v1/users/email/test@example.com');

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('test@example.com');
  });
});

describe('PATCH /api/v1/users/:id', () => {
  it('updates user and returns updated data', async () => {
    const updatedUser = { ...baseUser, firstName: 'Updated' };
    mockServiceInstance.updateUser.mockResolvedValueOnce(updatedUser);

    const res = await request(app)
      .patch('/api/v1/users/user-uuid-1')
      .send({ firstName: 'Updated' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.data.firstName).toBe('Updated');
  });

  it('returns 422 for invalid update payload', async () => {
    const res = await request(app)
      .patch('/api/v1/users/user-uuid-1')
      .send({ language: 'toolong' }) // language must be exactly 2 chars
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when user not found', async () => {
    const { NotFoundError } = await import('../../types/user.types');
    mockServiceInstance.updateUser.mockRejectedValueOnce(new NotFoundError('User', 'ghost'));

    const res = await request(app)
      .patch('/api/v1/users/ghost')
      .send({ firstName: 'Ghost' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/users/:id', () => {
  it('deletes user and returns 204', async () => {
    const res = await request(app).delete('/api/v1/users/user-uuid-1');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('returns 404 for non-existent user', async () => {
    const { NotFoundError } = await import('../../types/user.types');
    mockServiceInstance.deleteUser.mockRejectedValueOnce(new NotFoundError('User', 'ghost'));

    const res = await request(app).delete('/api/v1/users/ghost');

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/users/:id/avatar', () => {
  it('removes avatar successfully', async () => {
    const res = await request(app).delete('/api/v1/users/user-uuid-1/avatar');

    expect(res.status).toBe(200);
    expect(res.body.data.avatar).toBeNull();
  });

  it('returns 409 when user has no avatar', async () => {
    const { ConflictError } = await import('../../types/user.types');
    mockServiceInstance.removeAvatar.mockRejectedValueOnce(
      new ConflictError('User does not have an avatar to remove'),
    );

    const res = await request(app).delete('/api/v1/users/user-uuid-1/avatar');

    expect(res.status).toBe(409);
  });
});

describe('GET /api/v1/users/:id/preferences', () => {
  it('returns user preferences', async () => {
    const res = await request(app).get('/api/v1/users/user-uuid-1/preferences');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      userId: 'user-uuid-1',
      theme: 'light',
      editorFontSize: 14,
    });
  });
});

describe('PATCH /api/v1/users/:id/preferences', () => {
  it('updates preferences successfully', async () => {
    const updatedPrefs = { ...basePreferences, theme: 'dark', editorFontSize: 16 };
    mockServiceInstance.updatePreferences.mockResolvedValueOnce(updatedPrefs);

    const res = await request(app)
      .patch('/api/v1/users/user-uuid-1/preferences')
      .send({ theme: 'dark', editorFontSize: 16 })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.data.theme).toBe('dark');
    expect(res.body.data.editorFontSize).toBe(16);
  });

  it('returns 422 for invalid font size', async () => {
    const res = await request(app)
      .patch('/api/v1/users/user-uuid-1/preferences')
      .send({ editorFontSize: 100 }) // Max is 32
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid theme value', async () => {
    const res = await request(app)
      .patch('/api/v1/users/user-uuid-1/preferences')
      .send({ theme: 'invalid-theme' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(422);
  });
});

describe('404 handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/unknown-route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
  });
});
