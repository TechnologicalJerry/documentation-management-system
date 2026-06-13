import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '@devdocs/shared-utils';

export function validate(schema: z.ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success) {
      next(
        new ValidationError(
          'Validation failed',
          result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        ),
      );

      return;
    }
    next();
  };
}
