import { MemberRole } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';
import { logger } from '../lib/logger';
import { ProjectMemberService } from '../services/projectMember.service';
import { ProjectService } from '../services/project.service';
import { AuthenticatedUser } from '../types/project.types';

// Extend Express Request to carry authenticated user and resolved project role
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
    projectRole?: MemberRole;
  }
}

const projectService = new ProjectService();
const memberService = new ProjectMemberService();

/**
 * Middleware factory that checks whether the authenticated user has AT LEAST
 * the specified role on the project identified by req.params.projectId.
 *
 * Usage:
 *   router.delete('/:projectId', requireProjectRole(MemberRole.OWNER), controller.deleteProject);
 */
export function requireProjectRole(requiredRole: MemberRole) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        throw new UnauthorizedError('Authentication required');
      }

      const projectId = req.params['projectId'];
      if (projectId === undefined || projectId === '') {
        throw new ForbiddenError('Project ID is required');
      }

      const hasAccess = await memberService.checkAccess(projectId, user.userId, requiredRole);

      if (!hasAccess) {
        // Check if project even exists (to give a proper 404 vs 403)
        const project = await projectService.getProject(projectId, user.userId).catch(() => null);
        if (project === null) {
          res.status(StatusCodes.NOT_FOUND).json({
            success: false,
            message: 'Project not found',
            code: 'NOT_FOUND',
          });

          return;
        }

        throw new ForbiddenError(
          `This action requires ${requiredRole} role or higher`,
        );
      }

      // Attach the resolved role to request for downstream handlers
      const role = await memberService
        .checkAccess(projectId, user.userId, MemberRole.VIEWER)
        .then(async () => {
          const projectMemberService = new ProjectMemberService();
          const members = await projectMemberService.getMembers(projectId);
          const member = members.find((m) => m.userId === user.userId);

          return member?.role ?? MemberRole.VIEWER;
        });

      req.projectRole = role;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check if user is the project owner specifically.
 */
export function requireProjectOwner() {
  return requireProjectRole(MemberRole.OWNER);
}

/**
 * Middleware to attach the user's project role to the request without
 * enforcing a specific level. Useful for conditional logic in controllers.
 */
export function attachProjectRole() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (user === undefined) {
        next();

        return;
      }

      const projectId = req.params['projectId'];
      if (projectId === undefined || projectId === '') {
        next();

        return;
      }

      const members = await memberService.getMembers(projectId).catch(() => []);
      const member = members.find((m) => m.userId === user.userId);
      if (member !== undefined) {
        req.projectRole = member.role;
      }

      next();
    } catch (error) {
      logger.warn('Failed to attach project role', { error });
      next();
    }
  };
}
