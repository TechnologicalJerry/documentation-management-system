import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserService, IUserService } from '../services/user.service';
import { UserRepository } from '../repositories/user.repository';
import {
  updateUserSchema,
  userQuerySchema,
  userSearchSchema,
  updateUserPreferencesSchema,
  createUserSchema,
} from '../validators/user.validators';

export class UserController {
  private readonly userService: IUserService;

  constructor(userService?: IUserService) {
    this.userService = userService ?? new UserService(new UserRepository());
  }

  // GET /users
  getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = userQuerySchema.parse(req.query);
      const result = await this.userService.getUsers(query);
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // GET /users/search
  searchUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q, page, limit } = userSearchSchema.parse(req.query);
      const result = await this.userService.searchUsers(q, { page, limit });
      res.status(StatusCodes.OK).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  };

  // GET /users/:id
  getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.getUser(req.params['id']);
      res.status(StatusCodes.OK).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  // GET /users/email/:email
  getUserByEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.getUserByEmail(req.params['email']);
      res.status(StatusCodes.OK).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  // POST /users (internal — typically created by auth-service via event)
  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = createUserSchema.parse(req.body);
      const { UserRepository: Repo } = await import('../repositories/user.repository');
      const repo = new Repo();
      const user = await repo.create(dto);
      res.status(StatusCodes.CREATED).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /users/:id
  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = updateUserSchema.parse(req.body);
      const user = await this.userService.updateUser(req.params['id'], dto as any);
      res.status(StatusCodes.OK).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  // DELETE /users/:id
  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.userService.deleteUser(req.params['id']);
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  };

  // POST /users/:id/avatar
  uploadAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'No file uploaded. Use multipart/form-data with field name "avatar"',
        });

        return;
      }
      const user = await this.userService.uploadAvatar(req.params['id'], req.file);
      res.status(StatusCodes.OK).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  // DELETE /users/:id/avatar
  removeAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.removeAvatar(req.params['id']);
      res.status(StatusCodes.OK).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  };

  // GET /users/:id/preferences
  getPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const prefs = await this.userService.getPreferences(req.params['id']);
      res.status(StatusCodes.OK).json({ success: true, data: prefs });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /users/:id/preferences
  updatePreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = updateUserPreferencesSchema.parse(req.body);
      const prefs = await this.userService.updatePreferences(req.params['id'], dto);
      res.status(StatusCodes.OK).json({ success: true, data: prefs });
    } catch (err) {
      next(err);
    }
  };
}
