-- =============================================================================
-- DevDocs Studio — MySQL initialization
-- Creates the per-service databases and all tables required by the
-- notification-service and analytics-service.
-- =============================================================================

-- ─── Databases ────────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS devdocs_notifications
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS devdocs_analytics
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- =============================================================================
-- NOTIFICATION SERVICE SCHEMA
-- =============================================================================

USE devdocs_notifications;

-- Notification templates (reusable message blueprints)
CREATE TABLE IF NOT EXISTS notification_templates (
    id           CHAR(36)     NOT NULL DEFAULT (UUID()),
    name         VARCHAR(128) NOT NULL UNIQUE,
    channel      ENUM('email','in_app','push','webhook') NOT NULL,
    subject      VARCHAR(256),
    body_text    TEXT,
    body_html    MEDIUMTEXT,
    variables    JSON         NOT NULL DEFAULT ('[]'),
    is_active    TINYINT(1)   NOT NULL DEFAULT 1,
    created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_nt_channel (channel),
    INDEX idx_nt_active  (is_active)
) ENGINE=InnoDB;

-- Individual notification records
CREATE TABLE IF NOT EXISTS notifications (
    id              CHAR(36)     NOT NULL DEFAULT (UUID()),
    recipient_id    VARCHAR(64)  NOT NULL,
    recipient_email VARCHAR(320),
    template_id     CHAR(36),
    channel         ENUM('email','in_app','push','webhook') NOT NULL,
    subject         VARCHAR(256),
    body            MEDIUMTEXT,
    status          ENUM('pending','sent','delivered','failed','read') NOT NULL DEFAULT 'pending',
    priority        ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
    metadata        JSON         NOT NULL DEFAULT ('{}'),
    error_message   TEXT,
    scheduled_at    DATETIME(3),
    sent_at         DATETIME(3),
    read_at         DATETIME(3),
    created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_notif_recipient  (recipient_id),
    INDEX idx_notif_status     (status),
    INDEX idx_notif_channel    (channel),
    INDEX idx_notif_priority   (priority),
    INDEX idx_notif_created    (created_at),
    INDEX idx_notif_scheduled  (scheduled_at),
    CONSTRAINT fk_notif_template
        FOREIGN KEY (template_id) REFERENCES notification_templates(id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id              VARCHAR(64)  NOT NULL,
    email_enabled        TINYINT(1)   NOT NULL DEFAULT 1,
    in_app_enabled       TINYINT(1)   NOT NULL DEFAULT 1,
    push_enabled         TINYINT(1)   NOT NULL DEFAULT 0,
    -- Granular per-event toggles (stored as JSON for extensibility)
    event_preferences    JSON         NOT NULL DEFAULT ('{}'),
    quiet_hours_start    TIME,
    quiet_hours_end      TIME,
    timezone             VARCHAR(64)  NOT NULL DEFAULT 'UTC',
    updated_at           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (user_id)
) ENGINE=InnoDB;

-- Webhook subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id          CHAR(36)     NOT NULL DEFAULT (UUID()),
    owner_id    VARCHAR(64)  NOT NULL,
    project_id  VARCHAR(64),
    url         VARCHAR(2048) NOT NULL,
    secret      VARCHAR(256)  NOT NULL,
    events      JSON          NOT NULL DEFAULT ('[]'),
    is_active   TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_ws_owner   (owner_id),
    INDEX idx_ws_project (project_id),
    INDEX idx_ws_active  (is_active)
) ENGINE=InnoDB;

-- Webhook delivery log
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id               CHAR(36)    NOT NULL DEFAULT (UUID()),
    subscription_id  CHAR(36)    NOT NULL,
    event_type       VARCHAR(128) NOT NULL,
    payload          JSON        NOT NULL DEFAULT ('{}'),
    http_status      SMALLINT    UNSIGNED,
    response_body    TEXT,
    duration_ms      INT         UNSIGNED,
    attempt_count    TINYINT     NOT NULL DEFAULT 1,
    status           ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
    created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_wd_subscription (subscription_id),
    INDEX idx_wd_status       (status),
    INDEX idx_wd_created      (created_at),
    CONSTRAINT fk_wd_subscription
        FOREIGN KEY (subscription_id) REFERENCES webhook_subscriptions(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- ANALYTICS SERVICE SCHEMA
-- =============================================================================

USE devdocs_analytics;

-- Page / document view events
CREATE TABLE IF NOT EXISTS page_views (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    project_id   VARCHAR(64)  NOT NULL,
    document_id  VARCHAR(64)  NOT NULL,
    user_id      VARCHAR(64),
    session_id   VARCHAR(64)  NOT NULL,
    ip_address   VARCHAR(45),
    user_agent   TEXT,
    referrer     VARCHAR(2048),
    duration_s   SMALLINT     UNSIGNED,
    viewed_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_pv_project   (project_id),
    INDEX idx_pv_document  (document_id),
    INDEX idx_pv_user      (user_id),
    INDEX idx_pv_session   (session_id),
    INDEX idx_pv_viewed_at (viewed_at)
) ENGINE=InnoDB;

-- Document search queries
CREATE TABLE IF NOT EXISTS search_events (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    project_id  VARCHAR(64)  NOT NULL,
    user_id     VARCHAR(64),
    query       VARCHAR(512) NOT NULL,
    result_count SMALLINT    UNSIGNED NOT NULL DEFAULT 0,
    clicked_id  VARCHAR(64),
    searched_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_se_project    (project_id),
    INDEX idx_se_user       (user_id),
    INDEX idx_se_searched   (searched_at),
    FULLTEXT INDEX idx_se_query (query)
) ENGINE=InnoDB;

-- Generic user action events (document created/edited, exports, AI usage, etc.)
CREATE TABLE IF NOT EXISTS user_events (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    user_id      VARCHAR(64)   NOT NULL,
    project_id   VARCHAR(64),
    event_type   VARCHAR(128)  NOT NULL,
    resource_type VARCHAR(64),
    resource_id  VARCHAR(64),
    metadata     JSON          NOT NULL DEFAULT ('{}'),
    occurred_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_ue_user        (user_id),
    INDEX idx_ue_project     (project_id),
    INDEX idx_ue_event_type  (event_type),
    INDEX idx_ue_occurred_at (occurred_at)
) ENGINE=InnoDB;

-- Daily project-level aggregated stats (materialized by the analytics service)
CREATE TABLE IF NOT EXISTS daily_project_stats (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    project_id        VARCHAR(64)  NOT NULL,
    stat_date         DATE         NOT NULL,
    total_page_views  INT          UNSIGNED NOT NULL DEFAULT 0,
    unique_visitors   INT          UNSIGNED NOT NULL DEFAULT 0,
    total_documents   INT          UNSIGNED NOT NULL DEFAULT 0,
    docs_created      SMALLINT     UNSIGNED NOT NULL DEFAULT 0,
    docs_updated      SMALLINT     UNSIGNED NOT NULL DEFAULT 0,
    exports_generated SMALLINT     UNSIGNED NOT NULL DEFAULT 0,
    ai_requests       SMALLINT     UNSIGNED NOT NULL DEFAULT 0,
    active_users      SMALLINT     UNSIGNED NOT NULL DEFAULT 0,
    computed_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_dps_project_date (project_id, stat_date),
    INDEX idx_dps_date (stat_date)
) ENGINE=InnoDB;

-- Monthly retention / funnel cohorts
CREATE TABLE IF NOT EXISTS monthly_cohorts (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    project_id      VARCHAR(64) NOT NULL,
    cohort_month    DATE        NOT NULL,
    cohort_size     INT         UNSIGNED NOT NULL DEFAULT 0,
    retention_data  JSON        NOT NULL DEFAULT ('{}'),
    computed_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uk_mc_project_month (project_id, cohort_month)
) ENGINE=InnoDB;

-- Feature usage counters (lightweight alternative to user_events for high-frequency events)
CREATE TABLE IF NOT EXISTS feature_usage (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    project_id   VARCHAR(64)  NOT NULL,
    feature_key  VARCHAR(128) NOT NULL,
    usage_date   DATE         NOT NULL,
    count        BIGINT       UNSIGNED NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uk_fu_project_feature_date (project_id, feature_key, usage_date),
    INDEX idx_fu_feature (feature_key),
    INDEX idx_fu_date    (usage_date)
) ENGINE=InnoDB;
