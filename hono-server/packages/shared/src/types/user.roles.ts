export const USER_ROLES = ['admin', 'manager', 'supperwizer', 'lead', 'user'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 5,
  manager: 4,
  supperwizer: 3,
  lead: 2,
  user: 1
};
