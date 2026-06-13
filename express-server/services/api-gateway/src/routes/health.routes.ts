import { Router } from 'express';
import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import { upstreamServices } from '../config';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const checks = await Promise.all(
    upstreamServices.map(async (service) => {
      try {
        const response = await axios.get(`${service.target}/health`, { timeout: 2000 });

        return {
          service: service.name,
          status: response.status >= 200 && response.status < 300 ? 'healthy' : 'unhealthy',
          target: service.target,
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        return {
          service: service.name,
          status: 'unhealthy',
          target: service.target,
          error: err.message,
        };
      }
    }),
  );

  const allHealthy = checks.every((check) => check.status === 'healthy');
  res.status(allHealthy ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
    service: 'api-gateway',
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});
