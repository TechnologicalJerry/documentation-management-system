import { Router } from 'express';
import { TeamController } from '../controllers/team.controller';

const router = Router();
const controller = new TeamController();

/**
 * @route   GET /api/v1/teams/:id
 * @desc    Get team by ID
 */
router.get('/:id', controller.getTeamById);

/**
 * @route   PATCH /api/v1/teams/:id
 * @desc    Update team details
 */
router.patch('/:id', controller.updateTeam);

/**
 * @route   DELETE /api/v1/teams/:id
 * @desc    Delete a team
 */
router.delete('/:id', controller.deleteTeam);

/**
 * @route   GET /api/v1/teams/:id/members
 * @desc    List team members
 */
router.get('/:id/members', controller.getTeamMembers);

/**
 * @route   POST /api/v1/teams/:id/members
 * @desc    Add a member to a team
 */
router.post('/:id/members', controller.addTeamMember);

/**
 * @route   PATCH /api/v1/teams/:id/members/:userId
 * @desc    Update team member role
 */
router.patch('/:id/members/:userId', controller.updateMemberRole);

/**
 * @route   DELETE /api/v1/teams/:id/members/:userId
 * @desc    Remove member from team
 */
router.delete('/:id/members/:userId', controller.removeTeamMember);

export { router as teamRouter };
