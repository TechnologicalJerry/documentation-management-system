import request from 'supertest';
import { Application } from 'express';
import { SignJWT } from 'jose';
import { ProjectVisibility } from '@prisma/client';
import { createApp } from '../../app';
import { prisma } from '../../lib/prisma';
import { config } from '../../config';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateToken(userId: string, email: string): Promise<string> {
  const secret = new TextEncoder().encode(config.jwt.secret);

  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(config.jwt.issuer)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

// ─── Integration Test Suite ───────────────────────────────────────────────────

describe('Project Routes Integration', () => {
  let app: Application;
  const userId = 'test-user-' + Date.now();
  const userEmail = `test-${Date.now()}@example.com`;
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    app = createApp();
    token = await generateToken(userId, userEmail);
  });

  afterAll(async () => {
    // Cleanup all created test data
    await prisma.projectMember.deleteMany({ where: { userId } });
    await prisma.projectTag.deleteMany({ where: { project: { ownerId: userId } } });
    await prisma.projectSettings.deleteMany({ where: { project: { ownerId: userId } } });
    await prisma.project.deleteMany({ where: { ownerId: userId } });
    await prisma.$disconnect();
  });

  // ─── POST /api/projects ────────────────────────────────────────────────────

  describe('POST /api/projects', () => {
    it('should return 401 without a token', async () => {
      const res = await request(app).post('/api/projects').send({ name: 'Test' });

      expect(res.status).toBe(401);
    });

    it('should return 422 with invalid body', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' });

      expect(res.status).toBe(422);
      expect(res.body).toHaveProperty('errors');
    });

    it('should create a project and return 201', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Integration Test Project ${Date.now()}`,
          description: 'Created by integration test',
          visibility: ProjectVisibility.PRIVATE,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        ownerId: userId,
        visibility: ProjectVisibility.PRIVATE,
      });

      // Store for subsequent tests
      projectId = res.body.data.id as string;
    });
  });

  // ─── GET /api/projects ─────────────────────────────────────────────────────

  describe('GET /api/projects', () => {
    it('should return 401 without a token', async () => {
      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(401);
    });

    it('should list projects for the authenticated user', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('projects');
      expect(res.body.data).toHaveProperty('total');
      expect(Array.isArray(res.body.data.projects)).toBe(true);
    });

    it('should support pagination query params', async () => {
      const res = await request(app)
        .get('/api/projects?page=1&limit=5')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.limit).toBe(5);
      expect(res.body.data.page).toBe(1);
    });
  });

  // ─── GET /api/projects/:projectId ─────────────────────────────────────────

  describe('GET /api/projects/:projectId', () => {
    it('should return the project when the owner requests it', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(projectId);
    });

    it('should return 404 for a non-existent project ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/projects/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/projects/slug/:slug ─────────────────────────────────────────

  describe('GET /api/projects/slug/:slug', () => {
    it('should return the project by slug for the owner', async () => {
      // First fetch the project to get its slug
      const projectRes = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`);
      const slug = (projectRes.body.data as { slug: string }).slug;

      const res = await request(app)
        .get(`/api/projects/slug/${slug}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.slug).toBe(slug);
    });
  });

  // ─── PATCH /api/projects/:projectId ───────────────────────────────────────

  describe('PATCH /api/projects/:projectId', () => {
    it('should update a project as owner', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Updated by integration test' });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Updated by integration test');
    });

    it('should return 401 without a token', async () => {
      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .send({ name: 'Should fail' });

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/projects/:projectId/archive ────────────────────────────────

  describe('POST /api/projects/:projectId/archive', () => {
    it('should archive the project as owner', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/archive`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ARCHIVED');
    });

    it('should return 409 when archiving already-archived project', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/archive`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
    });
  });

  // ─── POST /api/projects/:projectId/restore ────────────────────────────────

  describe('POST /api/projects/:projectId/restore', () => {
    it('should restore an archived project', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/restore`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });
  });

  // ─── GET /api/projects/:projectId/stats ───────────────────────────────────

  describe('GET /api/projects/:projectId/stats', () => {
    it('should return project stats for a member', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/stats`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalMembers');
      expect(res.body.data).toHaveProperty('membersByRole');
    });
  });

  // ─── DELETE /api/projects/:projectId ──────────────────────────────────────

  describe('DELETE /api/projects/:projectId', () => {
    it('should soft-delete the project and return 204', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 when the project is already deleted', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
