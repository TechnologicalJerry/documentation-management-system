-- =============================================================================
-- DevDocs Studio — PostgreSQL initialization
-- Runs once when the postgres container is first created.
-- The default database 'devdocs' is created by POSTGRES_DB; here we create
-- the per-service databases and grant the application role access.
-- =============================================================================

-- Auth service database
CREATE DATABASE devdocs_auth;

-- User service database
CREATE DATABASE devdocs_users;

-- Project service database
CREATE DATABASE devdocs_projects;

-- Grant the default superuser (postgres) access to all databases
-- (already implicit for superuser, listed for documentation purposes)

-- ─── devdocs_auth schema ─────────────────────────────────────────────────────

\connect devdocs_auth

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    is_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_verifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user  ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_user      ON password_resets(user_id);

-- ─── devdocs_users schema ────────────────────────────────────────────────────

\connect devdocs_users

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS profiles (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID         NOT NULL UNIQUE,   -- FK to devdocs_auth.users.id (cross-db reference)
    username     VARCHAR(64)  NOT NULL UNIQUE,
    display_name VARCHAR(128),
    avatar_url   TEXT,
    bio          TEXT,
    timezone     VARCHAR(64)  NOT NULL DEFAULT 'UTC',
    locale       VARCHAR(16)  NOT NULL DEFAULT 'en',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id            UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    theme              VARCHAR(16)  NOT NULL DEFAULT 'system',
    editor_font_size   SMALLINT     NOT NULL DEFAULT 14,
    editor_tab_size    SMALLINT     NOT NULL DEFAULT 2,
    notifications_email BOOLEAN     NOT NULL DEFAULT TRUE,
    notifications_push  BOOLEAN     NOT NULL DEFAULT TRUE,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id    UUID        NOT NULL,
    user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role       VARCHAR(32) NOT NULL DEFAULT 'member',
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- ─── devdocs_projects schema ─────────────────────────────────────────────────

\connect devdocs_projects

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE project_visibility AS ENUM ('private', 'internal', 'public');
CREATE TYPE project_status AS ENUM ('active', 'archived', 'deleted');

CREATE TABLE IF NOT EXISTS projects (
    id          UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id    UUID               NOT NULL,
    name        VARCHAR(128)       NOT NULL,
    slug        VARCHAR(128)       NOT NULL,
    description TEXT,
    visibility  project_visibility NOT NULL DEFAULT 'private',
    status      project_status     NOT NULL DEFAULT 'active',
    settings    JSONB              NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    UNIQUE (owner_id, slug)
);

CREATE TABLE IF NOT EXISTS project_members (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL,
    role       VARCHAR(32) NOT NULL DEFAULT 'viewer',
    added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS project_invitations (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email      VARCHAR(320) NOT NULL,
    role       VARCHAR(32)  NOT NULL DEFAULT 'viewer',
    token      TEXT         NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ  NOT NULL,
    accepted   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner         ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status        ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_members_proj   ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user   ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_proj ON project_invitations(project_id);
