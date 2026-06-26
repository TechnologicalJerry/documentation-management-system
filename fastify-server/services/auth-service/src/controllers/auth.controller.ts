import { FastifyRequest, FastifyReply } from 'fastify';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '@devdocs/shared-utils';
import { AuthService } from '../services/auth.service';

export class AuthController {
  constructor(private readonly service = new AuthService()) {}

  register = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await this.service.register(request.body as any, this.requestMeta(request));
    sendSuccess(reply, result, 'User registered successfully', StatusCodes.CREATED);
  };

  login = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const result = await this.service.login(request.body as any, this.requestMeta(request));
    sendSuccess(reply, result, 'Logged in successfully');
  };

  refresh = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = request.body as any;
    const tokens = await this.service.refresh(body.refreshToken, this.requestMeta(request));
    sendSuccess(reply, { tokens }, 'Token refreshed successfully');
  };

  logout = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = request.body as any;
    await this.service.logout(request.user!.sub, body.refreshToken, body.logoutAllDevices);
    sendSuccess(reply, null, 'Logged out successfully');
  };

  me = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    sendSuccess(reply, { user: request.user }, 'Current user');
  };

  changePassword = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = request.body as any;
    await this.service.changePassword(request.user!.sub, body.currentPassword, body.newPassword);
    sendSuccess(reply, null, 'Password changed successfully');
  };

  private requestMeta(request: FastifyRequest): { ip?: string; userAgent?: string } {
    return {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}
