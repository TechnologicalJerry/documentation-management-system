import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { TemplateModel } from '../models/template.model';
import { TemplateVersionModel } from '../models/templateVersion.model';
import { TemplateCategory, TemplateType } from '../types/template.types';
import { marked } from 'marked';

const SYSTEM_USER_ID = 'system';

interface SystemTemplateDefinition {
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  variables: Array<{ name: string; description: string; defaultValue?: string; required: boolean }>;
  content: string;
}

const systemTemplates: SystemTemplateDefinition[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. API Documentation
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: 'API Documentation',
    description:
      'Comprehensive REST API reference documentation with endpoints, request/response examples, authentication details, and error codes.',
    category: TemplateCategory.API_DOCS,
    tags: ['api', 'rest', 'reference', 'openapi', 'endpoints'],
    variables: [
      { name: 'PROJECT_NAME', description: 'Name of the project or API', required: true },
      { name: 'API_VERSION', description: 'API version string (e.g. v1)', defaultValue: 'v1', required: false },
      { name: 'BASE_URL', description: 'Base URL of the API', defaultValue: 'https://api.example.com', required: false },
      { name: 'AUTH_TYPE', description: 'Authentication mechanism (e.g. Bearer Token)', defaultValue: 'Bearer Token', required: false },
      { name: 'CONTACT_EMAIL', description: 'Support or developer contact email', defaultValue: 'api-support@example.com', required: false },
    ],
    content: `# {{PROJECT_NAME}} API Reference

> Version: **{{API_VERSION}}**
> Base URL: \`{{BASE_URL}}\`
> Contact: {{CONTACT_EMAIL}}

---

## Overview

Welcome to the {{PROJECT_NAME}} API documentation. This API follows REST principles and returns JSON for all responses.

---

## Authentication

All endpoints require authentication via **{{AUTH_TYPE}}**.

Include the token in the \`Authorization\` header:

\`\`\`http
Authorization: Bearer <your-token>
\`\`\`

Tokens can be obtained from the \`POST /auth/login\` endpoint. Tokens expire after **24 hours**; use \`POST /auth/refresh\` to renew.

---

## Request & Response Format

All request bodies must be sent with \`Content-Type: application/json\`.

### Successful response envelope

\`\`\`json
{
  "success": true,
  "data": { ... }
}
\`\`\`

### Paginated response envelope

\`\`\`json
{
  "success": true,
  "data": [ ... ],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5,
  "hasNext": true,
  "hasPrev": false
}
\`\`\`

---

## Endpoints

### 1. Resource: Items

#### List Items

\`\`\`http
GET {{BASE_URL}}/{{API_VERSION}}/items
\`\`\`

**Query Parameters**

| Parameter  | Type    | Required | Description                      |
|------------|---------|----------|----------------------------------|
| \`page\`   | integer | No       | Page number (default: 1)         |
| \`limit\`  | integer | No       | Items per page (default: 20)     |
| \`search\` | string  | No       | Full-text search query           |
| \`sortBy\` | string  | No       | Field to sort by                 |
| \`order\`  | string  | No       | \`asc\` or \`desc\` (default: desc) |

**Example Request**

\`\`\`bash
curl -X GET "{{BASE_URL}}/{{API_VERSION}}/items?page=1&limit=10" \\
  -H "Authorization: Bearer <token>"
\`\`\`

**Example Response** \`200 OK\`

\`\`\`json
{
  "success": true,
  "data": [
    {
      "id": "item_01j2k3l4",
      "name": "Example Item",
      "status": "active",
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10,
  "totalPages": 1,
  "hasNext": false,
  "hasPrev": false
}
\`\`\`

#### Get Item by ID

\`\`\`http
GET {{BASE_URL}}/{{API_VERSION}}/items/:id
\`\`\`

**Path Parameters**

| Parameter | Type   | Description    |
|-----------|--------|----------------|
| \`id\`    | string | The item's ID  |

**Example Response** \`200 OK\`

\`\`\`json
{
  "success": true,
  "data": {
    "id": "item_01j2k3l4",
    "name": "Example Item",
    "description": "A description of the item",
    "status": "active",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-16T08:30:00.000Z"
  }
}
\`\`\`

#### Create Item

\`\`\`http
POST {{BASE_URL}}/{{API_VERSION}}/items
\`\`\`

**Request Body**

\`\`\`json
{
  "name": "New Item",
  "description": "A description"
}
\`\`\`

**Example Response** \`201 Created\`

\`\`\`json
{
  "success": true,
  "data": {
    "id": "item_01j5m6n7",
    "name": "New Item",
    "description": "A description",
    "status": "active",
    "createdAt": "2024-06-08T12:00:00.000Z",
    "updatedAt": "2024-06-08T12:00:00.000Z"
  }
}
\`\`\`

#### Update Item

\`\`\`http
PUT {{BASE_URL}}/{{API_VERSION}}/items/:id
\`\`\`

#### Delete Item

\`\`\`http
DELETE {{BASE_URL}}/{{API_VERSION}}/items/:id
\`\`\`

Returns \`204 No Content\` on success.

---

## Error Codes

| HTTP Status | Error Code           | Description                                      |
|-------------|----------------------|--------------------------------------------------|
| 400         | \`VALIDATION_ERROR\` | Request body or params failed validation         |
| 401         | \`UNAUTHORIZED\`     | Missing or invalid token                         |
| 403         | \`FORBIDDEN\`        | Authenticated but not permitted                  |
| 404         | \`NOT_FOUND\`        | Resource does not exist                          |
| 409         | \`CONFLICT\`         | Resource already exists or duplicate key         |
| 422         | \`UNPROCESSABLE\`    | Validation passed but business logic rejected it |
| 429         | \`RATE_LIMITED\`     | Too many requests                                |
| 500         | \`INTERNAL_ERROR\`   | Unexpected server error                          |

### Error response shape

\`\`\`json
{
  "success": false,
  "error": "Human readable message",
  "details": [
    { "field": "name", "message": "Name is required" }
  ]
}
\`\`\`

---

## Rate Limiting

The API is rate-limited to **200 requests per 15 minutes** per IP address. The following headers are included in every response:

| Header                  | Description                                    |
|-------------------------|------------------------------------------------|
| \`X-RateLimit-Limit\`   | Maximum requests per window                    |
| \`X-RateLimit-Remaining\`| Requests left in the current window           |
| \`X-RateLimit-Reset\`   | UNIX timestamp when the window resets          |

---

## Changelog

- **{{API_VERSION}}** — Initial release
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. User Guide
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: 'User Guide',
    description:
      'End-user product guide with getting-started instructions, feature walkthroughs, FAQ, and support information.',
    category: TemplateCategory.USER_GUIDE,
    tags: ['guide', 'user', 'howto', 'tutorial', 'manual'],
    variables: [
      { name: 'PRODUCT_NAME', description: 'Name of the product', required: true },
      { name: 'PRODUCT_VERSION', description: 'Product version', defaultValue: '1.0', required: false },
      { name: 'SUPPORT_URL', description: 'URL of the support portal', defaultValue: 'https://support.example.com', required: false },
      { name: 'SUPPORT_EMAIL', description: 'Support email address', defaultValue: 'support@example.com', required: false },
    ],
    content: `# {{PRODUCT_NAME}} User Guide

> Version {{PRODUCT_VERSION}} · Last updated: {{TODAY}}

---

## Welcome

Thank you for using **{{PRODUCT_NAME}}**. This guide will help you get the most out of the product, from first-time setup through advanced workflows.

If you need assistance at any point, visit {{SUPPORT_URL}} or email {{SUPPORT_EMAIL}}.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Getting Started](#getting-started)
3. [Dashboard Overview](#dashboard-overview)
4. [Core Features](#core-features)
5. [Advanced Configuration](#advanced-configuration)
6. [Troubleshooting](#troubleshooting)
7. [Frequently Asked Questions](#frequently-asked-questions)
8. [Glossary](#glossary)

---

## System Requirements

Before installing, confirm your system meets the minimum requirements:

| Component     | Minimum          | Recommended        |
|---------------|------------------|--------------------|
| OS            | Windows 10 / macOS 12 / Ubuntu 20.04 | Latest stable |
| RAM           | 4 GB             | 8 GB               |
| Disk space    | 2 GB             | 10 GB              |
| Browser       | Chrome 110+      | Latest Chrome/Firefox |
| Network       | Broadband        | Broadband          |

---

## Getting Started

### Step 1 — Create Your Account

1. Navigate to [{{SUPPORT_URL}}]({{SUPPORT_URL}}) and click **Sign Up**.
2. Enter your email address and choose a secure password.
3. Check your inbox for a verification email and click the link.

> **Tip:** Use a work email so your organization can find and invite you automatically.

### Step 2 — Complete Your Profile

1. Log in and click your avatar in the top-right corner.
2. Select **Profile Settings**.
3. Fill in your display name, timezone, and notification preferences.

### Step 3 — Create Your First Project

1. From the home screen, click **+ New Project**.
2. Enter a project name and optional description.
3. Click **Create** — you'll be taken to the project dashboard.

---

## Dashboard Overview

The dashboard is divided into four areas:

| Area           | Description                                           |
|----------------|-------------------------------------------------------|
| **Sidebar**    | Navigation: projects, templates, settings             |
| **Main panel** | Primary work area — documents, tasks, etc.            |
| **Toolbar**    | Context-sensitive actions for the current view        |
| **Notifications** | Real-time alerts and activity feed               |

---

## Core Features

### Feature: Documents

- **Create** a document via **+ New Document** in the sidebar.
- Documents support full **Markdown** with live preview.
- Use **/** commands to insert headings, tables, code blocks, and more.
- **Auto-save** runs every 30 seconds; a manual save is triggered by **Ctrl+S**.

### Feature: Templates

- Browse the **Template Library** to jumpstart new documents.
- Apply a template and fill in the variable prompts.
- Save your own custom templates from **Templates → Save as Template**.

### Feature: Collaboration

- Invite team members via **Project Settings → Members**.
- Mention colleagues with **@username** inside documents.
- Leave inline comments by highlighting text and clicking the comment icon.

---

## Advanced Configuration

### Integrations

{{PRODUCT_NAME}} supports integrations with:

- **GitHub / GitLab** — sync documentation with your repos.
- **Slack** — receive notifications in your team channels.
- **Webhook** — forward events to any HTTP endpoint.

Navigate to **Settings → Integrations** to configure.

### Keyboard Shortcuts

| Shortcut          | Action                  |
|-------------------|-------------------------|
| Ctrl+S / ⌘+S      | Save document           |
| Ctrl+B / ⌘+B      | Bold                    |
| Ctrl+I / ⌘+I      | Italic                  |
| Ctrl+K / ⌘+K      | Insert link             |
| Ctrl+/ / ⌘+/      | Toggle comment          |
| Ctrl+Z / ⌘+Z      | Undo                    |

---

## Troubleshooting

### I can't log in

- Check your email address for typos.
- Reset your password at **{{SUPPORT_URL}}/reset-password**.
- Clear browser cookies and try in incognito mode.

### Changes aren't saving

- Ensure you are connected to the internet.
- Check the status indicator at the bottom of the editor (green = saved, orange = pending).
- Hard-refresh the page (**Ctrl+Shift+R**).

### Performance is slow

- Close unused browser tabs.
- Disable browser extensions that may intercept requests.
- Contact {{SUPPORT_EMAIL}} if the issue persists.

---

## Frequently Asked Questions

**Q: Can I export documents as PDF?**
A: Yes — open the document, click **•••** → **Export → PDF**.

**Q: Is there a mobile app?**
A: A mobile-responsive web app is available. Native iOS/Android apps are on the roadmap.

**Q: How is my data backed up?**
A: Data is backed up every 6 hours with 30-day retention. See our [Privacy Policy]({{SUPPORT_URL}}/privacy) for details.

**Q: Can I self-host?**
A: An on-premise edition is available for Enterprise plans. Contact {{SUPPORT_EMAIL}} for licensing.

---

## Glossary

| Term          | Definition                                                |
|---------------|-----------------------------------------------------------|
| **Project**   | A workspace that groups related documents together        |
| **Template**  | A reusable document scaffold with variable placeholders   |
| **Slug**      | A URL-friendly identifier derived from a document's title |
| **Version**   | A snapshot of a document's content at a point in time     |
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. README
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: 'Project README',
    description:
      'A thorough open-source README with badges, description, installation, usage, contributing guidelines, and license information.',
    category: TemplateCategory.README,
    tags: ['readme', 'open-source', 'github', 'markdown', 'project'],
    variables: [
      { name: 'PROJECT_NAME', description: 'Name of the project', required: true },
      { name: 'SHORT_DESCRIPTION', description: 'One-line description of the project', required: true },
      { name: 'GITHUB_USER', description: 'GitHub username or org name', required: true },
      { name: 'GITHUB_REPO', description: 'GitHub repository name', required: true },
      { name: 'PACKAGE_MANAGER', description: 'Package manager used (npm, yarn, pnpm)', defaultValue: 'npm', required: false },
      { name: 'LICENSE', description: 'SPDX license identifier', defaultValue: 'MIT', required: false },
    ],
    content: `<div align="center">

# {{PROJECT_NAME}}

{{SHORT_DESCRIPTION}}

[![CI](https://github.com/{{GITHUB_USER}}/{{GITHUB_REPO}}/actions/workflows/ci.yml/badge.svg)](https://github.com/{{GITHUB_USER}}/{{GITHUB_REPO}}/actions/workflows/ci.yml)
[![License: {{LICENSE}}](https://img.shields.io/badge/License-{{LICENSE}}-yellow.svg)](https://opensource.org/licenses/{{LICENSE}})
[![npm version](https://badge.fury.io/js/{{GITHUB_REPO}}.svg)](https://badge.fury.io/js/{{GITHUB_REPO}})

</div>

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [API / CLI Reference](#api--cli-reference)
- [Running Tests](#running-tests)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)

---

## About

{{SHORT_DESCRIPTION}}

<!-- Add a screenshot or demo GIF here -->
<!--
![Demo](docs/demo.gif)
-->

---

## Features

- Feature one — brief description
- Feature two — brief description
- Feature three — brief description

---

## Prerequisites

- Node.js >= 18
- {{PACKAGE_MANAGER}} >= 9
- (Add other prerequisites)

---

## Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/{{GITHUB_USER}}/{{GITHUB_REPO}}.git
cd {{GITHUB_REPO}}

# Install dependencies
{{PACKAGE_MANAGER}} install
\`\`\`

---

## Usage

### Development

\`\`\`bash
{{PACKAGE_MANAGER}} run dev
\`\`\`

### Production build

\`\`\`bash
{{PACKAGE_MANAGER}} run build
{{PACKAGE_MANAGER}} start
\`\`\`

---

## Configuration

Copy the example environment file and fill in your values:

\`\`\`bash
cp .env.example .env
\`\`\`

| Variable        | Description                | Default     |
|-----------------|----------------------------|-------------|
| \`PORT\`        | HTTP server port           | \`3000\`    |
| \`NODE_ENV\`    | Runtime environment        | \`development\` |
| \`DATABASE_URL\`| Database connection string | —           |

---

## API / CLI Reference

> Full API documentation is available at [{{GITHUB_USER}}.github.io/{{GITHUB_REPO}}](https://{{GITHUB_USER}}.github.io/{{GITHUB_REPO}}).

---

## Running Tests

\`\`\`bash
# Unit tests
{{PACKAGE_MANAGER}} test

# Coverage report
{{PACKAGE_MANAGER}} run test:coverage
\`\`\`

---

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository and create your branch from \`main\`:
   \`\`\`bash
   git checkout -b feature/my-awesome-feature
   \`\`\`
2. **Write your changes** and add tests where appropriate.
3. **Run the test suite** to confirm nothing is broken.
4. **Open a Pull Request** against \`main\`, describing what you changed and why.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for our code of conduct and full contribution guidelines.

---

## Roadmap

- [ ] Feature A
- [ ] Feature B
- [ ] Performance improvements
- [ ] i18n support

---

## License

This project is licensed under the **{{LICENSE}} License** — see the [LICENSE](LICENSE) file for details.
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Changelog
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: 'Changelog (Keep a Changelog)',
    description:
      'Structured changelog following the Keep a Changelog format (keepachangelog.com) with Semantic Versioning sections.',
    category: TemplateCategory.CHANGELOG,
    tags: ['changelog', 'versioning', 'semver', 'release', 'history'],
    variables: [
      { name: 'PROJECT_NAME', description: 'Name of the project', required: true },
      { name: 'REPO_URL', description: 'Base URL of the repository (for diff links)', defaultValue: 'https://github.com/org/repo', required: false },
      { name: 'INITIAL_VERSION', description: 'First released version', defaultValue: '1.0.0', required: false },
      { name: 'INITIAL_DATE', description: 'Release date of the first version (YYYY-MM-DD)', defaultValue: '2024-01-01', required: false },
    ],
    content: `# Changelog — {{PROJECT_NAME}}

All notable changes to this project are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

---

## [Unreleased]

### Added
- Describe newly added features here.

### Changed
- Describe changes to existing functionality.

### Deprecated
- List features that will be removed in an upcoming release.

### Removed
- List features removed in this release.

### Fixed
- Describe bug fixes.

### Security
- Describe vulnerability patches (CVE references where applicable).

---

## [{{INITIAL_VERSION}}] — {{INITIAL_DATE}}

### Added
- Initial public release of {{PROJECT_NAME}}.
- Core feature set shipped.
- Documentation and examples included.

---

<!-- Link definitions (auto-generated or maintained manually) -->
[Unreleased]: {{REPO_URL}}/compare/v{{INITIAL_VERSION}}...HEAD
[{{INITIAL_VERSION}}]: {{REPO_URL}}/releases/tag/v{{INITIAL_VERSION}}

---

> **How to add a new release:**
> 1. Move items from **\[Unreleased\]** into a new dated section \`## [X.Y.Z] — YYYY-MM-DD\`.
> 2. Add the comparison link at the bottom.
> 3. Leave an empty **\[Unreleased\]** section for the next cycle.
`,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Technical Tutorial
  // ─────────────────────────────────────────────────────────────────────────────
  {
    name: 'Technical Tutorial',
    description:
      'Step-by-step developer tutorial with learning objectives, prerequisites, code examples, and a "What you built" summary.',
    category: TemplateCategory.TUTORIAL,
    tags: ['tutorial', 'howto', 'developer', 'guide', 'step-by-step'],
    variables: [
      { name: 'TUTORIAL_TITLE', description: 'Title of the tutorial', required: true },
      { name: 'AUTHOR_NAME', description: 'Name of the tutorial author', required: true },
      { name: 'SKILL_LEVEL', description: 'Target skill level (beginner, intermediate, advanced)', defaultValue: 'intermediate', required: false },
      { name: 'TIME_REQUIRED', description: 'Estimated time to complete (e.g. 30 minutes)', defaultValue: '30 minutes', required: false },
      { name: 'TECH_STACK', description: 'Primary technologies used (e.g. Node.js, TypeScript, MongoDB)', required: true },
    ],
    content: `# {{TUTORIAL_TITLE}}

**Author:** {{AUTHOR_NAME}}
**Skill level:** {{SKILL_LEVEL}}
**Estimated time:** {{TIME_REQUIRED}}
**Tech stack:** {{TECH_STACK}}

---

## Overview

In this tutorial you will learn how to [describe the goal in one sentence]. By the end you will have a working [artifact / app / function] that demonstrates [key concept].

---

## Learning Objectives

By completing this tutorial you will be able to:

- Objective one — practical outcome
- Objective two — practical outcome
- Objective three — practical outcome

---

## Prerequisites

Before you begin, make sure you have:

- [ ] [Prerequisite 1] installed and configured
- [ ] [Prerequisite 2] — version X or higher
- [ ] Basic familiarity with [related concept]

---

## What You Will Build

Briefly describe the end result with a diagram, screenshot placeholder, or bulleted feature list.

\`\`\`
[ASCII diagram or description of the finished artifact]
\`\`\`

---

## Step 1 — Set Up Your Environment

Start by creating a new project directory and initialising it:

\`\`\`bash
mkdir my-project && cd my-project
npm init -y
\`\`\`

Install the required dependencies:

\`\`\`bash
npm install {{TECH_STACK}}
\`\`\`

> **Why these dependencies?** Explain briefly why each package is needed.

---

## Step 2 — [Second Milestone]

Create the main entry file:

\`\`\`typescript
// src/index.ts
import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
\`\`\`

Run it to confirm everything works:

\`\`\`bash
npx ts-node src/index.ts
\`\`\`

**Expected output:**

\`\`\`
Server running on port 3000
\`\`\`

---

## Step 3 — [Third Milestone]

> Add as many steps as the complexity of the topic requires. Each step should have:
> - A clear goal stated at the top
> - Minimal working code
> - Expected output or a verification step

---

## Step 4 — Add Tests

Write a simple test to validate your implementation:

\`\`\`typescript
// src/tests/index.test.ts
import request from 'supertest';
import { app } from '../app';

describe('Health check', () => {
  it('returns 200 OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
\`\`\`

Run the tests:

\`\`\`bash
npm test
\`\`\`

---

## What You Built

Congratulations! You have successfully:

- Built [item 1]
- Learned [concept 1]
- Applied [technique 1]

---

## Next Steps

- Extend the project with [feature idea 1]
- Explore [related concept] for deeper understanding
- Read the [official documentation](https://example.com)

---

## Troubleshooting

### Error: Cannot find module 'X'

Run \`npm install\` to ensure all dependencies are installed. If the module is a peer dependency, install it explicitly:

\`\`\`bash
npm install X
\`\`\`

### Port already in use

Change the port in your code or kill the process using it:

\`\`\`bash
lsof -ti:3000 | xargs kill
\`\`\`

---

## Further Reading

- [Link 1](https://example.com) — description
- [Link 2](https://example.com) — description
`,
  },
];

async function seed(): Promise<void> {
  const mongoUri = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/devdocs_templates';

  console.log('[seed] Connecting to MongoDB:', mongoUri);
  await mongoose.connect(mongoUri);
  console.log('[seed] Connected');

  let created = 0;
  let skipped = 0;

  for (const def of systemTemplates) {
    const slugifyModule = await import('slugify') as any;
    const slugify = slugifyModule.default || slugifyModule;
    const slug = slugify(def.name, { lower: true, strict: true });

    const existing = await TemplateModel.findOne({ slug });
    if (existing) {
      console.log(`[seed] Skipping "${def.name}" — already exists`);
      skipped++;
      continue;
    }

    const contentHtml = await marked(def.content, { async: true });

    const template = await TemplateModel.create({
      name: def.name,
      slug,
      description: def.description,
      content: def.content,
      contentHtml,
      category: def.category,
      type: TemplateType.SYSTEM,
      authorId: SYSTEM_USER_ID,
      isPublic: true,
      isActive: true,
      tags: def.tags,
      variables: def.variables,
      usageCount: 0,
      rating: 0,
      metadata: { seeded: true },
    });

    await TemplateVersionModel.create({
      templateId: String(template._id),
      version: '1.0.0',
      content: def.content,
      contentHtml,
      changelog: 'Initial system template',
      createdBy: SYSTEM_USER_ID,
    });

    console.log(`[seed] Created "${def.name}" (${String(template._id)})`);
    created++;
  }

  console.log(`[seed] Done — created: ${created}, skipped: ${skipped}`);
  await mongoose.disconnect();
}

// Run when executed directly
void seed().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});

export { systemTemplates };
