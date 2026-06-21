import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TeamService, ITeamService } from '../services/team.service';
import {
  createTeamSchema,
  updateTeamSchema,
  addTeamMemberSchema,
  updateTeamMemberRoleSchema,
  teamQuerySchema,
  paginationSchema,
} from '../validators/user.validators';

export class TeamController {
  private readonly teamService: ITeamService;

  constructor(teamService?: ITeamService) {
    this.teamService = teamService ?? new TeamService();
  }

  // GET /organizations/:orgId/teams
  getTeamsByOrganization = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = teamQuerySchema.parse(req.query);
      const result = await this.teamService.getTeamsByOrganization(
        req.params['orgId'],
        query,
      );
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // POST /organizations/:orgId/teams
  createTeam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = createTeamSchema.parse({
        ...req.body,
        organizationId: req.params['orgId'],
      });
      const team = await this.teamService.createTeam(dto);
      res.status(StatusCodes.CREATED).json({ success: true, data: team });
    } catch (err) {
      next(err);
    }
  };

  // GET /teams/:id
  getTeamById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const team = await this.teamService.getTeam(req.params['id']);
      res.status(StatusCodes.OK).json({ success: true, data: team });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /teams/:id
  updateTeam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = updateTeamSchema.parse(req.body);
      const team = await this.teamService.updateTeam(req.params['id'], dto as any);
      res.status(StatusCodes.OK).json({ success: true, data: team });
    } catch (err) {
      next(err);
    }
  };

  // DELETE /teams/:id
  deleteTeam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.teamService.deleteTeam(req.params['id']);
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  };

  // GET /teams/:id/members
  getTeamMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = paginationSchema.parse(req.query);
      const result = await this.teamService.getTeamMembers(req.params['id'], {
        page,
        limit,
      });
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // POST /teams/:id/members
  addTeamMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = addTeamMemberSchema.parse(req.body);
      const member = await this.teamService.addMember(req.params['id'], dto);
      res.status(StatusCodes.CREATED).json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /teams/:id/members/:userId
  updateMemberRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { role } = updateTeamMemberRoleSchema.parse(req.body);
      const member = await this.teamService.updateMemberRole(
        req.params['id'],
        req.params['userId'],
        role,
      );
      res.status(StatusCodes.OK).json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  };

  // DELETE /teams/:id/members/:userId
  removeTeamMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.teamService.removeMember(
        req.params['id'],
        req.params['userId'],
      );
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  };
}
