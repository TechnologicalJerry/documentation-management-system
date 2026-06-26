import { PaginationQuery, PaginationMeta, SortOrder } from '@devdocs/shared-types';

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: SortOrder;
  search?: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(query: PaginationQuery, defaultSortBy: string = 'createdAt'): ParsedPagination {
  const page = Math.max(1, parseInt(String(query.page || DEFAULT_PAGE), 10));
  const rawLimit = parseInt(String(query.limit || DEFAULT_LIMIT), 10);
  const limit = Math.min(Math.max(1, rawLimit), MAX_LIMIT);
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || defaultSortBy;
  const sortOrder = query.sortOrder === SortOrder.ASC ? SortOrder.ASC : SortOrder.DESC;

  return {
    page,
    limit,
    skip,
    sortBy,
    sortOrder,
    search: query.search?.trim(),
  };
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function buildPrismaOrderBy(
  sortBy: string,
  sortOrder: SortOrder,
): Record<string, 'asc' | 'desc'> {
  // Handle nested fields like "user.email"
  const parts = sortBy.split('.');
  if (parts.length === 2) {
    return { [parts[0]]: { [parts[1]]: sortOrder } } as unknown as Record<string, 'asc' | 'desc'>;
  }
  return { [sortBy]: sortOrder };
}

export function buildSearchCondition(
  search: string | undefined,
  fields: string[],
): Record<string, unknown>[] | undefined {
  if (!search || fields.length === 0) return undefined;

  return fields.map((field) => ({
    [field]: {
      contains: search,
      mode: 'insensitive',
    },
  }));
}
