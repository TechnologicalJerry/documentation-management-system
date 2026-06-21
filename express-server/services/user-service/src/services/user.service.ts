import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IUserRepository, UserRepository } from '../repositories/user.repository';
import {
  UpdateUserDto,
  UserQueryDto,
  UserResponseDto,
  PaginatedResponse,
  UpdateUserPreferencesDto,
  UserPreferenceResponseDto,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../types/user.types';
import { logger } from '../utils/logger';
import { config } from '../config';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IUserService {
  getUser(id: string): Promise<UserResponseDto>;
  getUserByEmail(email: string): Promise<UserResponseDto>;
  getUsers(query: UserQueryDto): Promise<PaginatedResponse<UserResponseDto>>;
  updateUser(id: string, dto: UpdateUserDto): Promise<UserResponseDto>;
  deleteUser(id: string): Promise<void>;
  uploadAvatar(id: string, file: Express.Multer.File): Promise<UserResponseDto>;
  removeAvatar(id: string): Promise<UserResponseDto>;
  updatePreferences(id: string, prefs: UpdateUserPreferencesDto): Promise<UserPreferenceResponseDto>;
  getPreferences(id: string): Promise<UserPreferenceResponseDto>;
  searchUsers(
    query: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<UserResponseDto>>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class UserService implements IUserService {
  private readonly userRepository: IUserRepository;

  constructor(userRepository?: IUserRepository) {
    this.userRepository = userRepository ?? new UserRepository();
  }

  async getUser(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User', id);
    }

    return user;
  }

  async getUserByEmail(email: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  async getUsers(query: UserQueryDto): Promise<PaginatedResponse<UserResponseDto>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    return this.userRepository.findAll({ ...query, page, limit });
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    // Ensure user exists
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User', id);
    }

    const updated = await this.userRepository.update(id, dto);
    logger.info('User updated', { userId: id });

    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User', id);
    }

    await this.userRepository.softDelete(id);
    logger.info('User soft-deleted', { userId: id });
  }

  async uploadAvatar(id: string, file: Express.Multer.File): Promise<UserResponseDto> {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User', id);
    }

    // Validate file type
    if (!config.avatar.allowedMimeTypes.includes(file.mimetype)) {
      throw new ValidationError(
        `Invalid file type. Allowed types: ${config.avatar.allowedMimeTypes.join(', ')}`,
      );
    }

    // Validate file size
    const maxBytes = config.avatar.maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${config.avatar.maxSizeMb}MB`,
      );
    }

    // Generate unique filename
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `avatars/${id}/${uuidv4()}${ext}`;

    // In a real implementation, this would upload to S3/GCS/etc.
    // For now we store the path reference
    const avatarUrl = `${config.fileService.url}/files/${filename}`;

    const updated = await this.userRepository.updateAvatar(id, avatarUrl);
    logger.info('Avatar uploaded', { userId: id, avatarUrl });

    return updated;
  }

  async removeAvatar(id: string): Promise<UserResponseDto> {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User', id);
    }

    if (!existing.avatar) {
      throw new ConflictError('User does not have an avatar to remove');
    }

    const updated = await this.userRepository.updateAvatar(id, '');
    logger.info('Avatar removed', { userId: id });

    return updated;
  }

  async updatePreferences(
    id: string,
    prefs: UpdateUserPreferencesDto,
  ): Promise<UserPreferenceResponseDto> {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User', id);
    }

    const updated = await this.userRepository.upsertPreferences(id, prefs);
    logger.info('User preferences updated', { userId: id });

    return updated;
  }

  async getPreferences(id: string): Promise<UserPreferenceResponseDto> {
    const existing = await this.userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User', id);
    }

    const prefs = await this.userRepository.getPreferences(id);
    if (!prefs) {
      // Auto-create default preferences
      return this.userRepository.upsertPreferences(id, {});
    }

    return prefs;
  }

  async searchUsers(
    query: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<UserResponseDto>> {
    if (!query || query.trim().length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }

    const page = Math.max(1, pagination.page);
    const limit = Math.min(50, Math.max(1, pagination.limit));

    return this.userRepository.search(query.trim(), { page, limit });
  }
}
