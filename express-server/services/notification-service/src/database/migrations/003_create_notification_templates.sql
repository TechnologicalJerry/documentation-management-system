CREATE TABLE IF NOT EXISTS notification_templates (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL,
  channel ENUM('in_app', 'email', 'push') NOT NULL,
  subject VARCHAR(255),
  body_text TEXT NOT NULL,
  body_html TEXT,
  variables JSON COMMENT 'List of variable names used in this template',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_type (type),
  INDEX idx_channel (channel)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default templates
INSERT IGNORE INTO notification_templates (id, name, type, channel, subject, body_text, body_html, variables) VALUES
  (
    UUID(), 'document_published_email', 'document_published', 'email',
    'Document Published: {{documentTitle}}',
    'Hello {{recipientName}},\n\nThe document "{{documentTitle}}" in project "{{projectName}}" has been published by {{publisherName}}.\n\nView it here: {{documentUrl}}\n\nBest,\nDevDocs Studio',
    '<p>Hello {{recipientName}},</p><p>The document <strong>{{documentTitle}}</strong> in project <strong>{{projectName}}</strong> has been published by {{publisherName}}.</p><p><a href="{{documentUrl}}">View Document</a></p>',
    JSON_ARRAY('recipientName', 'documentTitle', 'projectName', 'publisherName', 'documentUrl')
  ),
  (
    UUID(), 'export_completed_email', 'export_completed', 'email',
    'Your Export is Ready: {{exportName}}',
    'Hello {{recipientName}},\n\nYour export "{{exportName}}" has been completed successfully.\n\nDownload it here: {{downloadUrl}}\n\nThis link will expire in 24 hours.\n\nBest,\nDevDocs Studio',
    '<p>Hello {{recipientName}},</p><p>Your export <strong>{{exportName}}</strong> has been completed successfully.</p><p><a href="{{downloadUrl}}">Download Export</a></p><p><small>This link will expire in 24 hours.</small></p>',
    JSON_ARRAY('recipientName', 'exportName', 'downloadUrl')
  ),
  (
    UUID(), 'ai_generation_completed_email', 'ai_generation_completed', 'email',
    'AI Content Generation Complete',
    'Hello {{recipientName}},\n\nYour AI content generation request for "{{documentTitle}}" has completed.\n\nReview the results: {{documentUrl}}\n\nBest,\nDevDocs Studio',
    '<p>Hello {{recipientName}},</p><p>Your AI content generation request for <strong>{{documentTitle}}</strong> has completed.</p><p><a href="{{documentUrl}}">Review Results</a></p>',
    JSON_ARRAY('recipientName', 'documentTitle', 'documentUrl')
  ),
  (
    UUID(), 'project_member_added_email', 'project_member_added', 'email',
    'You have been added to project: {{projectName}}',
    'Hello {{recipientName}},\n\nYou have been added to the project "{{projectName}}" by {{inviterName}} with the role of {{role}}.\n\nVisit the project: {{projectUrl}}\n\nBest,\nDevDocs Studio',
    '<p>Hello {{recipientName}},</p><p>You have been added to the project <strong>{{projectName}}</strong> by {{inviterName}} with the role of <strong>{{role}}</strong>.</p><p><a href="{{projectUrl}}">Visit Project</a></p>',
    JSON_ARRAY('recipientName', 'projectName', 'inviterName', 'role', 'projectUrl')
  );
