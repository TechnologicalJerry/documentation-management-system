import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { OrganizationService, IOrganizationService } from '../services/organization.service';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  organizationQuerySchema,
  inviteMemberSchema,
  paginationSchema,
} from '../validators/user.validators';

export class OrganizationController {
  private readonly orgService: IOrganizationService;

  constructor(orgService?: IOrganizationService) {
    this.orgService = orgService ?? new OrganizationService();
  }

  // GET /organizations
  getOrganizations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = organizationQuerySchema.parse(req.query);
      const result = await this.orgService.getOrganizations(query);
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // POST /organizations
  createOrganization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = createOrganizationSchema.parse(req.body);
      const org = await this.orgService.createOrganization(dto);
      res.status(StatusCodes.CREATED).json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  };

  // GET /organizations/:id
  getOrganizationById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const org = await this.orgService.getOrganization(req.params['id']);
      res.status(StatusCodes.OK).json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  };

  // GET /organizations/slug/:slug
  getOrganizationBySlug = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const org = await this.orgService.getOrganizationBySlug(req.params['slug']);
      res.status(StatusCodes.OK).json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /organizations/:id
  updateOrganization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = updateOrganizationSchema.parse(req.body);
      const org = await this.orgService.updateOrganization(req.params['id'], dto as any);
      res.status(StatusCodes.OK).json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  };

  // DELETE /organizations/:id
  deleteOrganization = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.orgService.deleteOrganization(req.params['id']);
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  };

  // GET /organizations/:id/members
  getMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = paginationSchema.parse(req.query);
      const result = await this.orgService.getMembers(req.params['id'], { page, limit });
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // POST /organizations/:id/members
  inviteMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = inviteMemberSchema.parse(req.body);
      await this.orgService.inviteMember(req.params['id'], userId);
      res
        .status(StatusCodes.OK)
        .json({ success: true, message: 'Member invited successfully' });
    } catch (err) {
      next(err);
    }
  };

  // DELETE /organizations/:id/members/:userId
  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.orgService.removeMember(
        req.params['id'],
        req.params['userId'],
      );
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  };
}
