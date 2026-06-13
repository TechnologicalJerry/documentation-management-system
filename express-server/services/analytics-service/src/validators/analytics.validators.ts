import { z } from 'zod';

export const pageViewSchema = z.object({
  body: z.object({
    projectId: z.string().min(1),
    documentId: z.string().min(1),
    userId: z.string().optional(),
    sessionId: z.string().min(1),
    referrer: z.string().url().optional(),
    durationS: z.number().int().nonnegative().optional(),
  }),
});

export const searchEventSchema = z.object({
  body: z.object({
    projectId: z.string().min(1),
    userId: z.string().optional(),
    query: z.string().min(1).max(512),
    resultCount: z.number().int().nonnegative(),
    clickedId: z.string().optional(),
  }),
});

export const userEventSchema = z.object({
  body: z.object({
    userId: z.string().min(1),
    projectId: z.string().optional(),
    eventType: z.string().min(1).max(128),
    resourceType: z.string().max(64).optional(),
    resourceId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export const projectSummarySchema = z.object({
  params: z.object({
    projectId: z.string().min(1),
  }),
});
