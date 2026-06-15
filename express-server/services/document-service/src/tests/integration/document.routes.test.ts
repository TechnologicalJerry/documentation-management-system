import request from 'supertest';
import { Application } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app';
import { DocumentPublisher } from '../../events/document.publisher';
import { DocumentModel, DocumentStatus, DocumentType } from '../../models/document.model';
import { DocumentVersionModel } from '../../models/documentVersion.model';

// ─── Test setup / teardown ────────────────────────────────────────────────────

let mongod: MongoMemoryServer;
let app: Application;

const TEST_USER_ID = 'user-test-123';
const TEST_PROJECT_ID = new mongoose.Types.ObjectId().toHexString();

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  await mongoose.connect(uri);

  // Use a no-op publisher so tests don't need RabbitMQ
  const publisher = new DocumentPublisher(null);
  app = createApp(publisher);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await DocumentModel.deleteMany({});
  await DocumentVersionModel.deleteMany({});
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authedRequest(method: 'get' | 'post' | 'patch' | 'delete', url: string) {
  return request(app)[method](url).set('x-user-id', TEST_USER_ID);
}

const BASE = `/api/v1/projects/${TEST_PROJECT_ID}/documents`;

// ─── Test suites ──────────────────────────────────────────────────────────────

describe('Document Routes — Integration', () => {
  // ── POST /documents ────────────────────────────────────────────────────────

  describe('POST /projects/:projectId/documents', () => {
    it('should create a document and return 201', async () => {
      const res = await authedRequest('post', BASE).send({
        title: 'My First Document',
        content: '# Introduction\nHello world!',
        type: DocumentType.GUIDE,
        tags: ['intro'],
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        title: 'My First Document',
        slug: 'my-first-document',
        status: DocumentStatus.DRAFT,
        projectId: TEST_PROJECT_ID,
        authorId: TEST_USER_ID,
      });
    });

    it('should return 422 when title is missing', async () => {
      const res = await authedRequest('post', BASE).send({
        content: 'Some content',
      });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when x-user-id header is missing', async () => {
      const res = await request(app).post(BASE).send({ title: 'Test' });

      expect(res.status).toBe(401);
    });

    it('should append suffix for duplicate title slugs in same project', async () => {
      await authedRequest('post', BASE).send({ title: 'Duplicate' });
      const res2 = await authedRequest('post', BASE).send({ title: 'Duplicate' });

      expect(res2.status).toBe(201);
      expect(res2.body.data.slug).toBe('duplicate-1');
    });
  });

  // ── GET /documents ─────────────────────────────────────────────────────────

  describe('GET /projects/:projectId/documents', () => {
    it('should return paginated list of documents', async () => {
      // Seed 3 documents
      await authedRequest('post', BASE).send({ title: 'Doc A' });
      await authedRequest('post', BASE).send({ title: 'Doc B' });
      await authedRequest('post', BASE).send({ title: 'Doc C' });

      const res = await authedRequest('get', BASE);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.pagination.total).toBe(3);
    });

    it('should filter by status', async () => {
      const createRes = await authedRequest('post', BASE).send({ title: 'Draft Doc' });
      const docId: string = createRes.body.data.id as string;

      // Submit for review
      await authedRequest('post', `${BASE}/${docId}/review`);

      const draftRes = await authedRequest('get', BASE).query({ status: 'DRAFT' });
      const reviewRes = await authedRequest('get', BASE).query({ status: 'REVIEW' });

      expect(draftRes.body.data).toHaveLength(0);
      expect(reviewRes.body.data).toHaveLength(1);
    });
  });

  // ── GET /documents/:id ─────────────────────────────────────────────────────

  describe('GET /projects/:projectId/documents/:id', () => {
    it('should return document by id', async () => {
      const createRes = await authedRequest('post', BASE).send({ title: 'Find Me' });
      const docId: string = createRes.body.data.id as string;

      const res = await authedRequest('get', `${BASE}/${docId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(docId);
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = new mongoose.Types.ObjectId().toHexString();
      const res = await authedRequest('get', `${BASE}/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });
  });

  // ── PATCH /documents/:id ───────────────────────────────────────────────────

  describe('PATCH /projects/:projectId/documents/:id', () => {
    it('should update a document', async () => {
      const createRes = await authedRequest('post', BASE).send({ title: 'Original Title' });
      const docId: string = createRes.body.data.id as string;

      const res = await authedRequest('patch', `${BASE}/${docId}`).send({
        title: 'Updated Title',
        changeDescription: 'Title fix',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Title');
      expect(res.body.data.slug).toBe('updated-title');
    });

    it('should return 422 when body is empty', async () => {
      const createRes = await authedRequest('post', BASE).send({ title: 'Immutable' });
      const docId: string = createRes.body.data.id as string;

      const res = await authedRequest('patch', `${BASE}/${docId}`).send({});

      expect(res.status).toBe(422);
    });
  });

  // ── DELETE /documents/:id ──────────────────────────────────────────────────

  describe('DELETE /projects/:projectId/documents/:id', () => {
    it('should soft-delete a document and return 204', async () => {
      const createRes = await authedRequest('post', BASE).send({ title: 'Delete Me' });
      const docId: string = createRes.body.data.id as string;

      const deleteRes = await authedRequest('delete', `${BASE}/${docId}`);
      expect(deleteRes.status).toBe(204);

      const getRes = await authedRequest('get', `${BASE}/${docId}`);
      expect(getRes.status).toBe(404);
    });
  });

  // ── Status workflow ────────────────────────────────────────────────────────

  describe('Status workflow', () => {
    it('should follow DRAFT -> REVIEW -> PUBLISHED -> ARCHIVED', async () => {
      const createRes = await authedRequest('post', BASE).send({ title: 'Workflow Doc' });
      const docId: string = createRes.body.data.id as string;

      const reviewRes = await authedRequest('post', `${BASE}/${docId}/review`);
      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.status).toBe(DocumentStatus.REVIEW);

      const publishRes = await authedRequest('post', `${BASE}/${docId}/publish`);
      expect(publishRes.status).toBe(200);
      expect(publishRes.body.data.status).toBe(DocumentStatus.PUBLISHED);
      expect(publishRes.body.data.publishedAt).toBeDefined();

      const archiveRes = await authedRequest('post', `${BASE}/${docId}/archive`);
      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.data.status).toBe(DocumentStatus.ARCHIVED);
    });

    it('should reject invalid transition (DRAFT -> PUBLISHED)', async () => {
      const createRes = await authedRequest('post', BASE).send({ title: 'Transition Test' });
      const docId: string = createRes.body.data.id as string;

      const res = await authedRequest('post', `${BASE}/${docId}/publish`);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  // ── Lock / Unlock ──────────────────────────────────────────────────────────

  describe('Document locking', () => {
    it('should lock and unlock a document', async () => {
      const createRes = await authedRequest('post', BASE).send({ title: 'Lockable Doc' });
      const docId: string = createRes.body.data.id as string;

      const lockRes = await authedRequest('post', `${BASE}/${docId}/lock`);
      expect(lockRes.status).toBe(200);
      expect(lockRes.body.data.lockedBy).toBe(TEST_USER_ID);

      const unlockRes = await authedRequest('delete', `${BASE}/${docId}/lock`);
      expect(unlockRes.status).toBe(200);
      expect(unlockRes.body.data.lockedBy).toBeUndefined();
    });

    it('should reject lock acquisition when another user holds the lock', async () => {
      const createRes = await authedRequest('post', BASE).send({ title: 'Contested Doc' });
      const docId: string = createRes.body.data.id as string;

      // Lock as test user
      await authedRequest('post', `${BASE}/${docId}/lock`);

      // Attempt to lock as a different user
      const res = await request(app)
        .post(`${BASE}/${docId}/lock`)
        .set('x-user-id', 'other-user-999');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DOCUMENT_LOCKED');
    });
  });

  // ── GET /documents/tree ────────────────────────────────────────────────────

  describe('GET /projects/:projectId/documents/tree', () => {
    it('should return hierarchical document tree', async () => {
      const parentRes = await authedRequest('post', BASE).send({
        title: 'Parent Doc',
        order: 0,
      });
      const parentId: string = parentRes.body.data.id as string;

      await authedRequest('post', BASE).send({
        title: 'Child Doc',
        parentId,
        order: 1,
      });

      const res = await authedRequest('get', `${BASE}/tree`);

      expect(res.status).toBe(200);
      const roots: Array<{ id: string; children: Array<{ id: string }> }> = res.body.data;
      const parent = roots.find((n) => n.id === parentId);

      expect(parent).toBeDefined();
      expect(parent?.children).toHaveLength(1);
    });
  });

  // ── GET /documents/search ──────────────────────────────────────────────────

  describe('GET /projects/:projectId/documents/search', () => {
    it('should return 422 when query param q is missing', async () => {
      const res = await authedRequest('get', `${BASE}/search`);

      expect(res.status).toBe(422);
    });
  });

  // ── Health endpoint ────────────────────────────────────────────────────────

  describe('GET /api/v1/health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  // ── 404 fallback ───────────────────────────────────────────────────────────

  describe('Unknown routes', () => {
    it('should return 404 for unmatched routes', async () => {
      const res = await request(app).get('/api/v1/nonexistent-route');

      expect(res.status).toBe(404);
    });
  });
});

// ─── Version Routes ───────────────────────────────────────────────────────────

describe('Version Routes — Integration', () => {
  let docId: string;

  beforeEach(async () => {
    const createRes = await authedRequest('post', BASE).send({
      title: 'Versioned Doc',
      content: 'v1 content',
    });
    docId = createRes.body.data.id as string;
  });

  it('should list versions of a document', async () => {
    const res = await authedRequest('get', `${BASE}/${docId}/versions`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].version).toBe(1);
  });

  it('should get a specific version', async () => {
    const res = await authedRequest('get', `${BASE}/${docId}/versions/1`);

    expect(res.status).toBe(200);
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.content).toBe('v1 content');
  });

  it('should return 404 for non-existent version', async () => {
    const res = await authedRequest('get', `${BASE}/${docId}/versions/999`);

    expect(res.status).toBe(404);
  });

  it('should restore a document to a previous version', async () => {
    // Create v2 by updating
    await authedRequest('patch', `${BASE}/${docId}`).send({
      content: 'v2 content',
      changeDescription: 'Second version',
    });

    // Restore to v1
    const res = await authedRequest('post', `${BASE}/${docId}/versions/1/restore`);

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('v1 content');

    // The document should now have a new version (v3) pointing to restored content
    const versionsRes = await authedRequest('get', `${BASE}/${docId}/versions`);
    expect(versionsRes.body.data).toHaveLength(3);
  });

  it('should compare two versions', async () => {
    await authedRequest('patch', `${BASE}/${docId}`).send({
      content: 'v2 content changed',
    });

    const res = await authedRequest('get', `${BASE}/${docId}/versions/compare`).query({
      v1: '1',
      v2: '2',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.fromVersion).toBe(1);
    expect(res.body.data.toVersion).toBe(2);
    expect(res.body.data.diff).toBeDefined();
  });
});

// ─── Comment Routes ───────────────────────────────────────────────────────────

describe('Comment Routes — Integration', () => {
  let docId: string;

  beforeEach(async () => {
    const createRes = await authedRequest('post', BASE).send({ title: 'Commented Doc' });
    docId = createRes.body.data.id as string;
  });

  it('should add a comment and return 201', async () => {
    const res = await authedRequest('post', `${BASE}/${docId}/comments`).send({
      content: 'This is a comment',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('This is a comment');
    expect(res.body.data.authorId).toBe(TEST_USER_ID);
    expect(res.body.data.isResolved).toBe(false);
  });

  it('should list comments on a document', async () => {
    await authedRequest('post', `${BASE}/${docId}/comments`).send({ content: 'Comment 1' });
    await authedRequest('post', `${BASE}/${docId}/comments`).send({ content: 'Comment 2' });

    const res = await authedRequest('get', `${BASE}/${docId}/comments`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('should add a threaded reply', async () => {
    const parentRes = await authedRequest('post', `${BASE}/${docId}/comments`).send({
      content: 'Parent comment',
    });
    const parentCommentId: string = parentRes.body.data.id as string;

    const replyRes = await authedRequest('post', `${BASE}/${docId}/comments`).send({
      content: 'Reply comment',
      parentId: parentCommentId,
    });

    expect(replyRes.status).toBe(201);
    expect(replyRes.body.data.parentId).toBe(parentCommentId);
  });

  it('should update a comment', async () => {
    const commentRes = await authedRequest('post', `${BASE}/${docId}/comments`).send({
      content: 'Original',
    });
    const commentId: string = commentRes.body.data.id as string;

    const res = await authedRequest('patch', `${BASE}/${docId}/comments/${commentId}`).send({
      content: 'Edited',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Edited');
  });

  it('should reject comment update by non-author', async () => {
    const commentRes = await authedRequest('post', `${BASE}/${docId}/comments`).send({
      content: 'My comment',
    });
    const commentId: string = commentRes.body.data.id as string;

    const res = await request(app)
      .patch(`${BASE}/${docId}/comments/${commentId}`)
      .set('x-user-id', 'different-user')
      .send({ content: 'Hijacked' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COMMENT_NOT_AUTHOR');
  });

  it('should resolve and unresolve a comment', async () => {
    const commentRes = await authedRequest('post', `${BASE}/${docId}/comments`).send({
      content: 'Resolve me',
    });
    const commentId: string = commentRes.body.data.id as string;

    const resolveRes = await authedRequest('post', `${BASE}/${docId}/comments/${commentId}/resolve`);
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.isResolved).toBe(true);

    const unresolveRes = await authedRequest(
      'delete',
      `${BASE}/${docId}/comments/${commentId}/resolve`,
    );
    expect(unresolveRes.status).toBe(200);
    expect(unresolveRes.body.data.isResolved).toBe(false);
  });

  it('should soft-delete a comment', async () => {
    const commentRes = await authedRequest('post', `${BASE}/${docId}/comments`).send({
      content: 'Delete me',
    });
    const commentId: string = commentRes.body.data.id as string;

    const deleteRes = await authedRequest('delete', `${BASE}/${docId}/comments/${commentId}`);
    expect(deleteRes.status).toBe(204);

    // Comment should no longer appear in the list
    const listRes = await authedRequest('get', `${BASE}/${docId}/comments`);
    const ids = (listRes.body.data as Array<{ id: string }>).map((c) => c.id);

    expect(ids).not.toContain(commentId);
  });
});
