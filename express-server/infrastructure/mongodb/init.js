// =============================================================================
// DevDocs Studio — MongoDB initialization script
// Runs inside the mongo container on first start via
//   /docker-entrypoint-initdb.d/init.js
//
// The script is executed as the MONGO_INITDB_ROOT_USERNAME user against the
// 'admin' database.  We switch to each application database, create a
// dedicated read/write user, then seed the initial indexes and collections.
// =============================================================================

// Helper to switch database and create an app user with readWrite access
function initDatabase(dbName, appUser, appPassword) {
  const db = db.getSiblingDB(dbName);

  // Create application-level user (least-privilege principle)
  db.createUser({
    user: appUser,
    pwd: appPassword,
    roles: [{ role: 'readWrite', db: dbName }],
  });

  return db;
}

// ─── devdocs_documents ───────────────────────────────────────────────────────
const docsDb = initDatabase('devdocs_documents', 'docs_user', 'docs_password');

docsDb.createCollection('documents', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['projectId', 'title', 'createdBy', 'createdAt'],
      properties: {
        projectId:   { bsonType: 'string' },
        title:       { bsonType: 'string', minLength: 1, maxLength: 512 },
        slug:        { bsonType: 'string' },
        content:     { bsonType: 'string' },
        contentType: { enum: ['markdown', 'richtext', 'html'] },
        status:      { enum: ['draft', 'published', 'archived'] },
        tags:        { bsonType: 'array', items: { bsonType: 'string' } },
        createdBy:   { bsonType: 'string' },
        createdAt:   { bsonType: 'date' },
        updatedAt:   { bsonType: 'date' },
      },
    },
  },
});

docsDb.documents.createIndex({ projectId: 1, slug: 1 }, { unique: true });
docsDb.documents.createIndex({ projectId: 1, status: 1 });
docsDb.documents.createIndex({ createdBy: 1 });
docsDb.documents.createIndex({ tags: 1 });
docsDb.documents.createIndex(
  { title: 'text', content: 'text' },
  { weights: { title: 10, content: 1 }, name: 'documents_text_search' }
);

docsDb.createCollection('document_versions');
docsDb.document_versions.createIndex({ documentId: 1, version: -1 });
docsDb.document_versions.createIndex({ documentId: 1, createdAt: -1 });

docsDb.createCollection('document_comments');
docsDb.document_comments.createIndex({ documentId: 1, createdAt: 1 });
docsDb.document_comments.createIndex({ authorId: 1 });

print('[init] devdocs_documents initialized');

// ─── devdocs_templates ───────────────────────────────────────────────────────
const templatesDb = initDatabase('devdocs_templates', 'templates_user', 'templates_password');

templatesDb.createCollection('templates', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'createdBy', 'createdAt'],
      properties: {
        name:        { bsonType: 'string', minLength: 1, maxLength: 256 },
        description: { bsonType: 'string' },
        category:    { bsonType: 'string' },
        content:     { bsonType: 'string' },
        contentType: { enum: ['markdown', 'richtext', 'html'] },
        isPublic:    { bsonType: 'bool' },
        createdBy:   { bsonType: 'string' },
        createdAt:   { bsonType: 'date' },
        updatedAt:   { bsonType: 'date' },
      },
    },
  },
});

templatesDb.templates.createIndex({ category: 1 });
templatesDb.templates.createIndex({ isPublic: 1 });
templatesDb.templates.createIndex({ createdBy: 1 });
templatesDb.templates.createIndex(
  { name: 'text', description: 'text' },
  { name: 'templates_text_search' }
);

// Seed built-in templates
const now = new Date();
templatesDb.templates.insertMany([
  {
    name: 'API Reference',
    description: 'Structured template for documenting REST or GraphQL APIs.',
    category: 'engineering',
    contentType: 'markdown',
    isPublic: true,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
    content: [
      '# {API Name}',
      '',
      '## Overview',
      'Brief description of the API.',
      '',
      '## Authentication',
      'Describe how to authenticate.',
      '',
      '## Endpoints',
      '',
      '### `GET /resource`',
      '**Description:** Retrieve a list of resources.',
      '',
      '**Query Parameters**',
      '| Name | Type | Required | Description |',
      '|------|------|----------|-------------|',
      '| `limit` | integer | No | Max results (default 20) |',
      '',
      '**Response**',
      '```json',
      '{ "data": [], "total": 0 }',
      '```',
    ].join('\n'),
  },
  {
    name: 'Getting Started Guide',
    description: 'Onboarding template for new users or developers.',
    category: 'guides',
    contentType: 'markdown',
    isPublic: true,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
    content: [
      '# Getting Started with {Project Name}',
      '',
      '## Prerequisites',
      '- Node.js >= 18',
      '- Docker',
      '',
      '## Installation',
      '```bash',
      'npm install',
      '```',
      '',
      '## Quick Start',
      '1. Step one',
      '2. Step two',
      '',
      '## Next Steps',
      '- Link to deeper docs',
    ].join('\n'),
  },
  {
    name: 'Architecture Decision Record (ADR)',
    description: 'Capture architectural decisions with context and consequences.',
    category: 'architecture',
    contentType: 'markdown',
    isPublic: true,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
    content: [
      '# ADR-{NUMBER}: {Title}',
      '',
      '**Status:** Proposed | Accepted | Deprecated | Superseded',
      '**Date:** {YYYY-MM-DD}',
      '',
      '## Context',
      'Describe the issue motivating this decision.',
      '',
      '## Decision',
      'State the decision that was made.',
      '',
      '## Consequences',
      'What becomes easier or harder after this change?',
    ].join('\n'),
  },
]);

print('[init] devdocs_templates initialized');

// ─── devdocs_ai ───────────────────────────────────────────────────────────────
const aiDb = initDatabase('devdocs_ai', 'ai_user', 'ai_password');

aiDb.createCollection('ai_requests');
aiDb.ai_requests.createIndex({ userId: 1, createdAt: -1 });
aiDb.ai_requests.createIndex({ documentId: 1 });
aiDb.ai_requests.createIndex({ status: 1 });
aiDb.ai_requests.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30-day TTL

aiDb.createCollection('ai_suggestions');
aiDb.ai_suggestions.createIndex({ documentId: 1 });
aiDb.ai_suggestions.createIndex({ status: 1 });

print('[init] devdocs_ai initialized');

// ─── devdocs_export ───────────────────────────────────────────────────────────
const exportDb = initDatabase('devdocs_export', 'export_user', 'export_password');

exportDb.createCollection('export_jobs');
exportDb.export_jobs.createIndex({ userId: 1, createdAt: -1 });
exportDb.export_jobs.createIndex({ status: 1 });
exportDb.export_jobs.createIndex({ documentId: 1 });
// Auto-delete completed jobs after 7 days
exportDb.export_jobs.createIndex(
  { completedAt: 1 },
  { expireAfterSeconds: 604800, partialFilterExpression: { status: 'completed' } }
);

print('[init] devdocs_export initialized');

// ─── devdocs_files ────────────────────────────────────────────────────────────
const filesDb = initDatabase('devdocs_files', 'files_user', 'files_password');

filesDb.createCollection('file_metadata', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['ownerId', 'filename', 'mimeType', 'sizeBytes', 'storagePath', 'createdAt'],
      properties: {
        ownerId:     { bsonType: 'string' },
        projectId:   { bsonType: 'string' },
        filename:    { bsonType: 'string' },
        mimeType:    { bsonType: 'string' },
        sizeBytes:   { bsonType: 'long' },
        storagePath: { bsonType: 'string' },
        createdAt:   { bsonType: 'date' },
      },
    },
  },
});

filesDb.file_metadata.createIndex({ ownerId: 1 });
filesDb.file_metadata.createIndex({ projectId: 1 });
filesDb.file_metadata.createIndex({ mimeType: 1 });

print('[init] devdocs_files initialized');

// ─── devdocs_audit ────────────────────────────────────────────────────────────
const auditDb = initDatabase('devdocs_audit', 'audit_user', 'audit_password');

auditDb.createCollection('audit_logs', {
  capped: false, // use TTL index instead so we can delete selectively
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['actorId', 'action', 'resourceType', 'timestamp'],
      properties: {
        actorId:      { bsonType: 'string' },
        action:       { bsonType: 'string' },
        resourceType: { bsonType: 'string' },
        resourceId:   { bsonType: 'string' },
        projectId:    { bsonType: 'string' },
        ipAddress:    { bsonType: 'string' },
        userAgent:    { bsonType: 'string' },
        metadata:     { bsonType: 'object' },
        timestamp:    { bsonType: 'date' },
      },
    },
  },
});

auditDb.audit_logs.createIndex({ actorId: 1, timestamp: -1 });
auditDb.audit_logs.createIndex({ resourceType: 1, resourceId: 1 });
auditDb.audit_logs.createIndex({ projectId: 1, timestamp: -1 });
auditDb.audit_logs.createIndex({ action: 1 });
// Retain audit logs for 2 years
auditDb.audit_logs.createIndex({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

print('[init] devdocs_audit initialized');

print('[init] All MongoDB databases initialized successfully.');
