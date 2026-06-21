import { Router } from 'express';
import { OrganizationController } from '../controllers/organization.controller';
import { TeamController } from '../controllers/team.controller';

const router = Router();
const orgController = new OrganizationController();
const teamController = new TeamController();

/**
 * @route   GET /api/v1/organizations
 * @desc    List all organizations
 */
router.get('/', orgController.getOrganizations);

/**
 * @route   POST /api/v1/organizations
 * @desc    Create a new organization
 */
router.post('/', orgController.createOrganization);

/**
 * @route   GET /api/v1/organizations/slug/:slug
 * @desc    Get organization by slug
 */
router.get('/slug/:slug', orgController.getOrganizationBySlug);

/**
 * @route   GET /api/v1/organizations/:id
 * @desc    Get organization by ID
 */
router.get('/:id', orgController.getOrganizationById);

/**
 * @route   PATCH /api/v1/organizations/:id
 * @desc    Update organization
 */
router.patch('/:id', orgController.updateOrganization);

/**
 * @route   DELETE /api/v1/organizations/:id
 * @desc    Delete organization (soft-delete)
 */
router.delete('/:id', orgController.deleteOrganization);

/**
 * @route   GET /api/v1/organizations/:id/members
 * @desc    List organization members
 */
router.get('/:id/members', orgController.getMembers);

/**
 * @route   POST /api/v1/organizations/:id/members
 * @desc    Invite a user to the organization
 */
router.post('/:id/members', orgController.inviteMember);

/**
 * @route   DELETE /api/v1/organizations/:id/members/:userId
 * @desc    Remove member from organization
 */
router.delete('/:id/members/:userId', orgController.removeMember);

/**
 * @route   GET /api/v1/organizations/:orgId/teams
 * @desc    List teams for an organization
 */
router.get('/:orgId/teams', teamController.getTeamsByOrganization);

/**
 * @route   POST /api/v1/organizations/:orgId/teams
 * @desc    Create a new team under an organization
 */
router.post('/:orgId/teams', teamController.createTeam);

export { router as organizationRouter };
