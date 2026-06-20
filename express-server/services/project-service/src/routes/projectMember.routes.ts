import { Router } from 'express';
import { MemberRole } from '@prisma/client';
import { ProjectMemberController } from '../controllers/projectMember.controller';
import { authenticate } from '../middleware/auth.middleware';
import {
  attachProjectRole,
  requireProjectRole,
} from '../middleware/projectAccess.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  acceptInvitationSchema,
  addMemberSchema,
  inviteMemberSchema,
  memberIdParamSchema,
  updateMemberSchema,
} from '../validators/project.validators';

const router = Router({ mergeParams: true });
const controller = new ProjectMemberController();

/**
 * @route   GET /api/projects/:projectId/members
 * @desc    List all members of a project
 * @access  Member (Viewer+)
 */
router.get(
  '/',
  authenticate,
  requireProjectRole(MemberRole.VIEWER),
  controller.getMembers,
);

/**
 * @route   POST /api/projects/:projectId/members
 * @desc    Add a member to a project by userId
 * @access  Admin+
 */
router.post(
  '/',
  authenticate,
  requireProjectRole(MemberRole.ADMIN),
  validate(addMemberSchema, 'body'),
  controller.addMember,
);

/**
 * @route   PATCH /api/projects/:projectId/members/:userId
 * @desc    Update a member's role
 * @access  Admin+
 */
router.patch(
  '/:userId',
  authenticate,
  requireProjectRole(MemberRole.ADMIN),
  validate(memberIdParamSchema, 'params'),
  validate(updateMemberSchema, 'body'),
  controller.updateMemberRole,
);

/**
 * @route   DELETE /api/projects/:projectId/members/:userId
 * @desc    Remove a member from the project (self or Admin+)
 * @access  Self or Admin+
 */
router.delete(
  '/:userId',
  authenticate,
  validate(memberIdParamSchema, 'params'),
  controller.removeMember,
);

/**
 * @route   POST /api/projects/:projectId/members/invite
 * @desc    Send an email invitation to join the project
 * @access  Admin+
 */
router.post(
  '/invite',
  authenticate,
  requireProjectRole(MemberRole.ADMIN),
  validate(inviteMemberSchema, 'body'),
  controller.inviteMember,
);

/**
 * @route   POST /api/projects/:projectId/members/accept-invitation
 * @desc    Accept an invitation using a token
 * @access  Authenticated
 */
router.post(
  '/accept-invitation',
  authenticate,
  validate(acceptInvitationSchema, 'body'),
  controller.acceptInvitation,
);

/**
 * @route   GET /api/projects/:projectId/members/access
 * @desc    Check current user's access level for a project
 * @access  Authenticated
 */
router.get(
  '/access',
  authenticate,
  attachProjectRole(),
  controller.checkAccess,
);

export { router as projectMemberRouter };
