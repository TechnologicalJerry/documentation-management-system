import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '@devdocs/shared-utils';
import { AuthService } from '../services/auth.service';

export class AuthController {
  constructor(private readonly service = new AuthService()) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.register(req.body, this.requestMeta(req));
      sendSuccess(res, result, 'User registered successfully', StatusCodes.CREATED);
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.login(req.body, this.requestMeta(req));
      sendSuccess(res, result, 'Logged in successfully');
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokens = await this.service.refresh(req.body.refreshToken, this.requestMeta(req));
      sendSuccess(res, { tokens }, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.logout(req.user!.sub, req.body.refreshToken, req.body.logoutAllDevices);
      sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, { user: req.user }, 'Current user');
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.changePassword(req.user!.sub, req.body.currentPassword, req.body.newPassword);
      sendSuccess(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  };

  private requestMeta(req: Request): { ip?: string; userAgent?: string } {
    return {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
  }
}
