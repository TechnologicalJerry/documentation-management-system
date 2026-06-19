import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ProjectMemberService } from '../services/projectMember.service';
import {
  AddMemberDto,
  UpdateMemberDto,
  InviteMemberDto,
  AcceptInvitationDto,
} from '../types/project.types';

export class ProjectMemberController {
  private readonly memberService: ProjectMemberService;

  constructor(memberService?: ProjectMemberService) {
    this.memberService = memberService ?? new ProjectMemberService();

    this.getMembers = this.getMembers.bind(this);
    this.addMember = this.addMember.bind(this);
    this.removeMember = this.removeMember.bind(this);
    this.updateMemberRole = this.updateMemberRole.bind(this);
    this.inviteMember = this.inviteMember.bind(this);
    this.acceptInvitation = this.acceptInvitation.bind(this);
    this.checkAccess = this.checkAccess.bind(this);
  }

  async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params as { projectId: string };

      const members = await this.memberService.getMembers(projectId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: members,
      });
    } catch (error) {
      next(error);
    }
  }

  async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = req.user!.userId;
      const { projectId } = req.params as { projectId: string };
      const dto = req.body as AddMemberDto;

      const member = await this.memberService.addMember(projectId, actorId, dto);

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Member added successfully',
        data: member,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = req.user!.userId;
      const { projectId, userId } = req.params as { projectId: string; userId: string };

      await this.memberService.removeMember(projectId, actorId, userId);

      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      next(error);
    }
  }

  async updateMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = req.user!.userId;
      const { projectId, userId } = req.params as { projectId: string; userId: string };
      const dto = req.body as UpdateMemberDto;

      const member = await this.memberService.updateRole(projectId, actorId, userId, dto);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Member role updated successfully',
        data: member,
      });
    } catch (error) {
      next(error);
    }
  }

  async inviteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = req.user!.userId;
      const { projectId } = req.params as { projectId: string };
      const dto = req.body as InviteMemberDto;

      const invitation = await this.memberService.inviteMember(projectId, actorId, dto);

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Invitation sent successfully',
        data: invitation,
      });
    } catch (error) {
      next(error);
    }
  }

  async acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const dto: AcceptInvitationDto = {
        token: (req.body as { token: string }).token,
        userId,
      };

      const member = await this.memberService.acceptInvitation(dto);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Invitation accepted successfully',
        data: member,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { projectId } = req.params as { projectId: string };
      const { role } = req.query as { role?: string };

      // Default to VIEWER role check if none specified
      const requiredRole = role ?? 'VIEWER';
      const hasAccess = await this.memberService.checkAccess(
        projectId,
        userId,
        requiredRole as Parameters<ProjectMemberService['checkAccess']>[2],
      );

      res.status(StatusCodes.OK).json({
        success: true,
        data: {
          projectId,
          userId,
          requiredRole,
          hasAccess,
          memberRole: req.projectRole ?? null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
