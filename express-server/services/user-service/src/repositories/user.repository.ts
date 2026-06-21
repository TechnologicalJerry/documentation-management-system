import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto,
  UserResponseDto,
  PaginatedResponse,
  UpdateUserPreferencesDto,
  UserPreferenceResponseDto,
} from '../types/user.types';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IUserRepository {
  findById(id: string, includeDeleted?: boolean): Promise<UserResponseDto | null>;
  findByEmail(email: string): Promise<UserResponseDto | null>;
  findAll(query: UserQueryDto): Promise<PaginatedResponse<UserResponseDto>>;
  create(dto: CreateUserDto): Promise<UserResponseDto>;
  update(id: string, dto: UpdateUserDto): Promise<UserResponseDto>;
  softDelete(id: string): Promise<void>;
  search(query: string, pagination: { page: number; limit: number }): Promise<PaginatedResponse<UserResponseDto>>;
  upsertPreferences(userId: string, dto: UpdateUserPreferencesDto): Promise<UserPreferenceResponseDto>;
  getPreferences(userId: string): Promise<UserPreferenceResponseDto | null>;
  updateAvatar(id: string, avatarUrl: string): Promise<UserResponseDto>;
}

// ─── Include Helpers ──────────────────────────────────────────────────────────

const userInclude = {
  organization: {
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      plan: true,
    },
  },
  preferences: true,
} satisfies Prisma.UserInclude;

// ─── Implementation ───────────────────────────────────────────────────────────

export class UserRepository implements IUserRepository {
  async findById(id: string, includeDeleted = false): Promise<UserResponseDto | null> {
    const user = await prisma.user.findFirst({
      where: {
        id,
        ...(!includeDeleted && { deletedAt: null }),
      },
      include: userInclude,
    });

    return user as UserResponseDto | null;
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deletedAt: null,
      },
      include: userInclude,
    });

    return user as UserResponseDto | null;
  }

  async findAll(query: UserQueryDto): Promise<PaginatedResponse<UserResponseDto>> {
    const {
      page = 1,
      limit = 20,
      search,
      organizationId,
      isActive,
      teamId,
      language,
      timezone,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined && { isActive }),
      ...(organizationId && { organizationId }),
      ...(language && { language }),
      ...(timezone && { timezone }),
      ...(teamId && {
        teamMembers: { some: { teamId } },
      }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users as UserResponseDto[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        firstName: dto.firstName,
        lastName: dto.lastName,
        displayName: dto.displayName ?? null,
        bio: dto.bio ?? null,
        avatar: dto.avatar ?? null,
        timezone: dto.timezone ?? 'UTC',
        language: dto.language ?? 'en',
        ...(dto.organizationId && { organizationId: dto.organizationId }),
        preferences: {
          create: {
            emailNotifications: true,
            pushNotifications: true,
            theme: 'light',
            editorFontSize: 14,
            editorTheme: 'default',
          },
        },
      },
      include: userInclude,
    });

    return user as UserResponseDto;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const updateData: Prisma.UserUpdateInput = {};

    if (dto.firstName !== undefined) {updateData.firstName = dto.firstName;}
    if (dto.lastName !== undefined) {updateData.lastName = dto.lastName;}
    if (dto.displayName !== undefined) {updateData.displayName = dto.displayName;}
    if (dto.bio !== undefined) {updateData.bio = dto.bio;}
    if (dto.timezone !== undefined) {updateData.timezone = dto.timezone;}
    if (dto.language !== undefined) {updateData.language = dto.language;}
    if (dto.isActive !== undefined) {updateData.isActive = dto.isActive;}
    if (dto.organizationId !== undefined) {
      updateData.organization = dto.organizationId
        ? { connect: { id: dto.organizationId } }
        : { disconnect: true };
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: userInclude,
    });

    return user as UserResponseDto;
  }

  async softDelete(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  async search(
    query: string,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResponse<UserResponseDto>> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      isActive: true,
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { displayName: { contains: query, mode: 'insensitive' } },
      ],
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users as UserResponseDto[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async upsertPreferences(
    userId: string,
    dto: UpdateUserPreferencesDto,
  ): Promise<UserPreferenceResponseDto> {
    const data: Prisma.UserPreferenceUpdateInput = {};

    if (dto.emailNotifications !== undefined) {data.emailNotifications = dto.emailNotifications;}
    if (dto.pushNotifications !== undefined) {data.pushNotifications = dto.pushNotifications;}
    if (dto.theme !== undefined) {data.theme = dto.theme;}
    if (dto.editorFontSize !== undefined) {data.editorFontSize = dto.editorFontSize;}
    if (dto.editorTheme !== undefined) {data.editorTheme = dto.editorTheme;}

    const preference = await prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        emailNotifications: dto.emailNotifications ?? true,
        pushNotifications: dto.pushNotifications ?? true,
        theme: dto.theme ?? 'light',
        editorFontSize: dto.editorFontSize ?? 14,
        editorTheme: dto.editorTheme ?? 'default',
      },
      update: data,
    });

    return preference as UserPreferenceResponseDto;
  }

  async getPreferences(userId: string): Promise<UserPreferenceResponseDto | null> {
    const pref = await prisma.userPreference.findUnique({
      where: { userId },
    });

    return pref as UserPreferenceResponseDto | null;
  }

  async updateAvatar(id: string, avatarUrl: string): Promise<UserResponseDto> {
    const user = await prisma.user.update({
      where: { id },
      data: { avatar: avatarUrl },
      include: userInclude,
    });

    return user as UserResponseDto;
  }
}
