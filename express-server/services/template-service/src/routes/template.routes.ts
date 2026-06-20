import { Router } from 'express';
import type { TemplateController } from '../controllers/template.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createTemplateSchema,
  updateTemplateSchema,
  templateQuerySchema,
  applyTemplateSchema,
  rateTemplateSchema,
  templateIdParamSchema,
} from '../validators/template.validators';

export function createTemplateRouter(controller: TemplateController): Router {
  const router = Router();

  // ─── Static / collection routes (must come before :id to avoid conflicts) ───

  /**
   * GET /templates/system
   * Return all system-defined templates.
   */
  router.get('/system', optionalAuthenticate, controller.getSystemTemplates);

  /**
   * GET /templates/categories
   * Return the list of valid template categories.
   */
  router.get('/categories', controller.getCategories);

  /**
   * GET /templates/search?q=...
   * Full-text search across templates.
   */
  router.get('/search', optionalAuthenticate, validate(templateQuerySchema), controller.searchTemplates);

  // ─── Collection CRUD ────────────────────────────────────────────────────────

  /**
   * GET /templates
   * List templates with optional filters, pagination and sorting.
   * Public templates are accessible without auth; private ones require auth.
   */
  router.get('/', optionalAuthenticate, validate(templateQuerySchema), controller.getTemplates);

  /**
   * POST /templates
   * Create a new template. Requires authentication.
   */
  router.post('/', authenticate, validate(createTemplateSchema), controller.createTemplate);

  // ─── Item-level routes ──────────────────────────────────────────────────────

  /**
   * GET /templates/:id
   * Get a single template by ID.
   */
  router.get('/:id', optionalAuthenticate, validate(templateIdParamSchema), controller.getTemplate);

  /**
   * PUT /templates/:id
   * Update a template. Only the owner may update.
   */
  router.put(
    '/:id',
    authenticate,
    validate(updateTemplateSchema),
    controller.updateTemplate,
  );

  /**
   * DELETE /templates/:id
   * Soft-delete a template. Only the owner may delete.
   */
  router.delete(
    '/:id',
    authenticate,
    validate(templateIdParamSchema),
    controller.deleteTemplate,
  );

  // ─── Template actions ───────────────────────────────────────────────────────

  /**
   * POST /templates/:id/apply
   * Apply a template with variable substitution and return rendered content.
   * Optionally authenticated — anonymous use is allowed.
   */
  router.post(
    '/:id/apply',
    optionalAuthenticate,
    validate(applyTemplateSchema),
    controller.applyTemplate,
  );

  /**
   * POST /templates/:id/rate
   * Submit a 1-5 star rating for a template. Requires authentication.
   */
  router.post(
    '/:id/rate',
    authenticate,
    validate(rateTemplateSchema),
    controller.rateTemplate,
  );

  /**
   * GET /templates/:id/ratings
   * Retrieve all ratings for a template.
   */
  router.get(
    '/:id/ratings',
    optionalAuthenticate,
    validate(templateIdParamSchema),
    controller.getTemplateRatings,
  );

  /**
   * GET /templates/:id/versions
   * Retrieve version history for a template.
   */
  router.get(
    '/:id/versions',
    authenticate,
    validate(templateIdParamSchema),
    controller.getTemplateVersions,
  );

  /**
   * POST /templates/:id/publish
   * Publish a template to the marketplace. Requires authentication + ownership.
   */
  router.post(
    '/:id/publish',
    authenticate,
    validate(templateIdParamSchema),
    controller.publishTemplate,
  );

  /**
   * POST /templates/:id/unpublish
   * Unpublish a template (make it private). Requires authentication + ownership.
   */
  router.post(
    '/:id/unpublish',
    authenticate,
    validate(templateIdParamSchema),
    controller.unpublishTemplate,
  );

  return router;
}
