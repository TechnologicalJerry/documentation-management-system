import { UserService } from '../../services/user.service';
import { IUserRepository } from '../../repositories/user.repository';
import {
  UserResponseDto,
  UpdateUserDto,
  UserQueryDto,
  PaginatedResponse,
  UpdateUserPreferencesDto,
  UserPreferenceResponseDto,
  Theme,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../types/user.types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUser: UserResponseDto = {
  id: 'user-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Johnson',
  displayName: 'Alice J.',
  avatar: null,
  bio: 'Engineer',
  timezone: 'UTC',
  language: 'en',
  isActive: true,
  organizationId: 'org-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPreferences: UserPreferenceResponseDto = {
  id: 'pref-1',
  userId: 'user-1',
  emailNotifications: true,
  pushNotifications: true,
  theme: 'light',
  editorFontSize: 14,
  editorTheme: 'default',
  updatedAt: new Date(),
};

function createMockRepository(): jest.Mocked<IUserRepository> {
  return {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    search: jest.fn(),
    upsertPreferences: jest.fn(),
    getPreferences: jest.fn(),
    updateAvatar: jest.fn(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserService', () => {
  let service: UserService;
  let mockRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new UserService(mockRepo);
  });

  // ─── getUser ──────────────────────────────────────────────────────────────

  describe('getUser', () => {
    it('returns user when found', async () => {
      mockRepo.findById.mockResolvedValueOnce(mockUser);

      const result = await service.getUser('user-1');

      expect(result).toEqual(mockUser);
      expect(mockRepo.findById).toHaveBeenCalledWith('user-1');
    });

    it('throws NotFoundError when user does not exist', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);

      await expect(service.getUser('non-existent')).rejects.toThrow(NotFoundError);
      await expect(service.getUser('non-existent')).rejects.toThrow("User with id 'non-existent' not found");
    });
  });

  // ─── getUserByEmail ───────────────────────────────────────────────────────

  describe('getUserByEmail', () => {
    it('returns user by email', async () => {
      mockRepo.findByEmail.mockResolvedValueOnce(mockUser);

      const result = await service.getUserByEmail('alice@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepo.findByEmail).toHaveBeenCalledWith('alice@example.com');
    });

    it('throws NotFoundError when email not found', async () => {
      mockRepo.findByEmail.mockResolvedValueOnce(null);

      await expect(service.getUserByEmail('unknown@example.com')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── getUsers ─────────────────────────────────────────────────────────────

  describe('getUsers', () => {
    it('returns paginated users with defaults', async () => {
      const paginatedResult: PaginatedResponse<UserResponseDto> = {
        data: [mockUser],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockRepo.findAll.mockResolvedValueOnce(paginatedResult);

      const query: UserQueryDto = {};
      const result = await service.getUsers(query);

      expect(result).toEqual(paginatedResult);
      expect(mockRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it('clamps page to minimum of 1', async () => {
      const paginatedResult: PaginatedResponse<UserResponseDto> = {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
      mockRepo.findAll.mockResolvedValueOnce(paginatedResult);

      await service.getUsers({ page: -5, limit: 20 });

      expect(mockRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });

    it('clamps limit to maximum of 100', async () => {
      const paginatedResult: PaginatedResponse<UserResponseDto> = {
        data: [],
        meta: { total: 0, page: 1, limit: 100, totalPages: 0 },
      };
      mockRepo.findAll.mockResolvedValueOnce(paginatedResult);

      await service.getUsers({ limit: 9999 });

      expect(mockRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 }),
      );
    });
  });

  // ─── updateUser ───────────────────────────────────────────────────────────

  describe('updateUser', () => {
    it('updates and returns user', async () => {
      const updatedUser = { ...mockUser, firstName: 'Alicia' };
      mockRepo.findById.mockResolvedValueOnce(mockUser);
      mockRepo.update.mockResolvedValueOnce(updatedUser);

      const dto: UpdateUserDto = { firstName: 'Alicia' };
      const result = await service.updateUser('user-1', dto);

      expect(result.firstName).toBe('Alicia');
      expect(mockRepo.update).toHaveBeenCalledWith('user-1', dto);
    });

    it('throws NotFoundError if user does not exist', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);

      await expect(service.updateUser('no-such-user', {})).rejects.toThrow(NotFoundError);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── deleteUser ───────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('soft-deletes existing user', async () => {
      mockRepo.findById.mockResolvedValueOnce(mockUser);
      mockRepo.softDelete.mockResolvedValueOnce(undefined);

      await service.deleteUser('user-1');

      expect(mockRepo.softDelete).toHaveBeenCalledWith('user-1');
    });

    it('throws NotFoundError for non-existent user', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);

      await expect(service.deleteUser('ghost')).rejects.toThrow(NotFoundError);
      expect(mockRepo.softDelete).not.toHaveBeenCalled();
    });
  });

  // ─── uploadAvatar ─────────────────────────────────────────────────────────

  describe('uploadAvatar', () => {
    const mockFile = {
      originalname: 'avatar.jpg',
      mimetype: 'image/jpeg',
      size: 1024 * 100, // 100 KB
      buffer: Buffer.from('fake-image-data'),
    } as Express.Multer.File;

    it('uploads avatar for existing user', async () => {
      const updatedUser = { ...mockUser, avatar: 'http://files/avatars/user-1/uuid.jpg' };
      mockRepo.findById.mockResolvedValueOnce(mockUser);
      mockRepo.updateAvatar.mockResolvedValueOnce(updatedUser);

      const result = await service.uploadAvatar('user-1', mockFile);

      expect(result.avatar).toBeTruthy();
      expect(mockRepo.updateAvatar).toHaveBeenCalledWith('user-1', expect.stringContaining('avatars/user-1'));
    });

    it('throws ValidationError for invalid MIME type', async () => {
      mockRepo.findById.mockResolvedValueOnce(mockUser);

      const invalidFile = { ...mockFile, mimetype: 'application/pdf' } as Express.Multer.File;

      await expect(service.uploadAvatar('user-1', invalidFile)).rejects.toThrow(ValidationError);
      expect(mockRepo.updateAvatar).not.toHaveBeenCalled();
    });

    it('throws ValidationError for oversized file', async () => {
      mockRepo.findById.mockResolvedValueOnce(mockUser);

      const bigFile = {
        ...mockFile,
        size: 100 * 1024 * 1024, // 100 MB
      } as Express.Multer.File;

      await expect(service.uploadAvatar('user-1', bigFile)).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError if user does not exist', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);

      await expect(service.uploadAvatar('missing', mockFile)).rejects.toThrow(NotFoundError);
    });
  });

  // ─── removeAvatar ─────────────────────────────────────────────────────────

  describe('removeAvatar', () => {
    it('removes avatar from user', async () => {
      const userWithAvatar = { ...mockUser, avatar: 'https://example.com/avatar.jpg' };
      const userWithoutAvatar = { ...mockUser, avatar: null };
      mockRepo.findById.mockResolvedValueOnce(userWithAvatar);
      mockRepo.updateAvatar.mockResolvedValueOnce(userWithoutAvatar);

      const result = await service.removeAvatar('user-1');

      expect(mockRepo.updateAvatar).toHaveBeenCalledWith('user-1', '');
      expect(result.avatar).toBeNull();
    });

    it('throws ConflictError if user has no avatar', async () => {
      mockRepo.findById.mockResolvedValueOnce({ ...mockUser, avatar: null });

      await expect(service.removeAvatar('user-1')).rejects.toThrow(ConflictError);
    });
  });

  // ─── updatePreferences ────────────────────────────────────────────────────

  describe('updatePreferences', () => {
    it('updates user preferences', async () => {
      const updatedPrefs = {
        ...mockPreferences,
        theme: 'dark',
        editorFontSize: 16,
      };
      mockRepo.findById.mockResolvedValueOnce(mockUser);
      mockRepo.upsertPreferences.mockResolvedValueOnce(updatedPrefs);

      const dto: UpdateUserPreferencesDto = { theme: Theme.DARK, editorFontSize: 16 };
      const result = await service.updatePreferences('user-1', dto);

      expect(result.theme).toBe('dark');
      expect(result.editorFontSize).toBe(16);
      expect(mockRepo.upsertPreferences).toHaveBeenCalledWith('user-1', dto);
    });

    it('throws NotFoundError if user does not exist', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);

      await expect(service.updatePreferences('ghost', {})).rejects.toThrow(NotFoundError);
    });
  });

  // ─── getPreferences ───────────────────────────────────────────────────────

  describe('getPreferences', () => {
    it('returns existing preferences', async () => {
      mockRepo.findById.mockResolvedValueOnce(mockUser);
      mockRepo.getPreferences.mockResolvedValueOnce(mockPreferences);

      const result = await service.getPreferences('user-1');

      expect(result).toEqual(mockPreferences);
    });

    it('creates default preferences if none exist', async () => {
      mockRepo.findById.mockResolvedValueOnce(mockUser);
      mockRepo.getPreferences.mockResolvedValueOnce(null);
      mockRepo.upsertPreferences.mockResolvedValueOnce(mockPreferences);

      const result = await service.getPreferences('user-1');

      expect(result).toEqual(mockPreferences);
      expect(mockRepo.upsertPreferences).toHaveBeenCalledWith('user-1', {});
    });
  });

  // ─── searchUsers ──────────────────────────────────────────────────────────

  describe('searchUsers', () => {
    it('searches users with valid query', async () => {
      const paginatedResult: PaginatedResponse<UserResponseDto> = {
        data: [mockUser],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockRepo.search.mockResolvedValueOnce(paginatedResult);

      const result = await service.searchUsers('Alice', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(mockRepo.search).toHaveBeenCalledWith('Alice', { page: 1, limit: 20 });
    });

    it('throws ValidationError for too-short query', async () => {
      await expect(service.searchUsers('a', { page: 1, limit: 20 })).rejects.toThrow(
        ValidationError,
      );
    });

    it('throws ValidationError for empty query', async () => {
      await expect(service.searchUsers('', { page: 1, limit: 20 })).rejects.toThrow(
        ValidationError,
      );
    });

    it('clamps limit to maximum of 50 for search', async () => {
      const paginatedResult: PaginatedResponse<UserResponseDto> = {
        data: [],
        meta: { total: 0, page: 1, limit: 50, totalPages: 0 },
      };
      mockRepo.search.mockResolvedValueOnce(paginatedResult);

      await service.searchUsers('Alice', { page: 1, limit: 200 });

      expect(mockRepo.search).toHaveBeenCalledWith('Alice', { page: 1, limit: 50 });
    });
  });
});
