import type { Request, Response, NextFunction } from 'express';
import type { AnyZodObject, ZodError } from 'zod';
import { StatusCodes } from 'http-status-codes';

export function validate(schema: AnyZodObject) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (parsed.body !== undefined) {req.body = parsed.body as unknown;}
      if (parsed.query !== undefined) {req.query = parsed.query as typeof req.query;}
      if (parsed.params !== undefined) {req.params = parsed.params as typeof req.params;}

      next();
    } catch (err) {
      const zodError = err as ZodError;
      if (zodError.errors) {
        res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
          success: false,
          error: 'Validation failed',
          details: zodError.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });

        return;
      }
      next(err);
    }
  };
}
