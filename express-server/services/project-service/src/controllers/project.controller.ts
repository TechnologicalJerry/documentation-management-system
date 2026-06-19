import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ProjectService } from '../services/project.service';
import { CreateProjectDto, UpdateProjectDto, ProjectQueryDto } from '../types/project.types';

export class ProjectController {
  private readonly projectService: ProjectService;

  constructor(projectService?: ProjectService) {
    this.projectService = projectService ?? new ProjectService();

    // Bind all methods to preserve `this` context
    this.createProject = this.createProject.bind(this);
    this.getProject = this.getProject.bind(this);
    this.getProjectBySlug = this.getProjectBySlug.bind(this);
    this.getProjects = this.getProjects.bind(this);
    this.updateProject = this.updateProject.bind(this);
    this.deleteProject = this.deleteProject.bind(this);
    this.archiveProject = this.archiveProject.bind(this);
    this.restoreProject = this.restoreProject.bind(this);
    this.getProjectStats = this.getProjectStats.bind(this);
  }

  async createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const dto = req.body as CreateProjectDto;

      const project = await this.projectService.createProject(userId, dto);

      res.status(StatusCodes.CREATED).json({
        success: true,
        message: 'Project created successfully',
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params as { projectId: string };
      const userId = req.user?.userId;

      const project = await this.projectService.getProject(projectId, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjectBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params as { slug: string };
      const userId = req.user?.userId;

      const project = await this.projectService.getProjectBySlug(slug, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const query = req.query as unknown as ProjectQueryDto;

      const result = await this.projectService.getProjects(userId, query);

      res.status(StatusCodes.OK).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { projectId } = req.params as { projectId: string };
      const dto = req.body as UpdateProjectDto;

      const project = await this.projectService.updateProject(projectId, userId, dto);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Project updated successfully',
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { projectId } = req.params as { projectId: string };

      await this.projectService.deleteProject(projectId, userId);

      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      next(error);
    }
  }

  async archiveProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { projectId } = req.params as { projectId: string };

      const project = await this.projectService.archiveProject(projectId, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Project archived successfully',
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  async restoreProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { projectId } = req.params as { projectId: string };

      const project = await this.projectService.restoreProject(projectId, userId);

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Project restored successfully',
        data: project,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProjectStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params as { projectId: string };

      const stats = await this.projectService.getProjectStats(projectId);

      res.status(StatusCodes.OK).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}
