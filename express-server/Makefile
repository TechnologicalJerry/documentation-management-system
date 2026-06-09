# =============================================================================
# DevDocs Studio — Developer Workflow Makefile
# =============================================================================
# Usage: make <target>
# Run `make help` for a list of all available targets.
# =============================================================================

.DEFAULT_GOAL := help
SHELL         := /bin/bash

# Default mock environment variables for testing
export JWT_SECRET ?= secret
export JWT_ACCESS_SECRET ?= secret
export JWT_REFRESH_SECRET ?= secret
export SESSION_SECRET ?= secret
export DATABASE_URL ?= postgresql://postgres:password@localhost:5432/devdocs_projects?schema=public

.PHONY: help install build test test-coverage lint lint-fix \
        docker-up docker-down docker-rebuild docker-logs docker-ps \
        migrate migrate-prod seed db-reset \
        clean clean-dist clean-modules \
        generate-secrets health-check setup \
        dev dev-gateway dev-user dev-project dev-document \
        dev-template dev-ai dev-file dev-notification dev-audit dev-analytics \
        prisma-studio format check-env

# Colors
CYAN  := \033[0;36m
RESET := \033[0m

# =============================================================================
# Help
# =============================================================================
help: ## Show this help message
	@echo ""
	@echo "  DevDocs Studio — Make targets"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-30s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# =============================================================================
# Setup & Installation
# =============================================================================
setup: ## Full initial setup: install deps, build packages, setup DB, run migrations, seed
	@echo "==> Running initial project setup..."
	@bash scripts/setup.sh

install: ## Install all workspace dependencies
	npm install

install-frozen: ## Install exact deps from lockfile (CI mode)
	npm ci

# =============================================================================
# Build
# =============================================================================
build: ## Build TypeScript for all services and packages
	npm run build --workspaces --if-present

build-packages: ## Build shared packages only
	npm run build -w @devdocs/shared-types
	npm run build -w @devdocs/shared-utils

build-services: ## Build all services (assumes packages are already built)
	@for dir in services/*/; do \
		SERVICE=$$(basename "$$dir"); \
		echo "Building $$SERVICE..."; \
		(cd "$$dir" && npm run build) || exit 1; \
	done

# =============================================================================
# Development
# =============================================================================
dev: docker-up ## Start Docker infra and all services in dev mode
	@echo "==> Starting all services in dev mode..."
	@echo "    Use Ctrl-C to stop. Services:"
	@echo "    API Gateway:  http://localhost:3000"
	@echo "    Auth:         http://localhost:3001"
	@echo "    User:         http://localhost:3002"
	@echo "    Project:      http://localhost:3003"
	@echo "    Document:     http://localhost:3004"
	@echo "    Template:     http://localhost:3005"
	@echo "    AI:           http://localhost:3006"
	@echo "    Export:       http://localhost:3007"
	@echo "    File:         http://localhost:3008"
	@echo "    Notification: http://localhost:3009"
	@echo "    Audit:        http://localhost:3010"
	@echo "    Analytics:    http://localhost:3011"

dev-gateway: ## Start API gateway in dev mode (with hot reload)
	npm run dev:gateway

dev-user: ## Start user service in dev mode
	npm run dev:user

dev-project: ## Start project service in dev mode
	npm run dev:project

dev-document: ## Start document service in dev mode
	npm run dev:document

dev-template: ## Start template service in dev mode
	npm run dev:template

dev-ai: ## Start AI service in dev mode
	npm run dev:ai

dev-file: ## Start file service in dev mode
	npm run dev:file

dev-notification: ## Start notification service in dev mode
	npm run dev:notification

dev-audit: ## Start audit service in dev mode
	npm run dev:audit

dev-analytics: ## Start analytics service in dev mode
	npm run dev:analytics

# =============================================================================
# Testing
# =============================================================================
test: ## Run all tests (unit + integration) across all services
	npm test

test-coverage: ## Run tests with coverage reports (min 70%)
	npm run test --workspaces --if-present -- --coverage --passWithNoTests --forceExit

test-watch: ## Run tests in watch mode
	npm run test --workspaces --if-present -- --watch --passWithNoTests

test-service: ## Run tests for a specific service: make test-service SERVICE=user-service
	@if [ -z "$(SERVICE)" ]; then \
		echo "Usage: make test-service SERVICE=<service-name>"; \
		exit 1; \
	fi
	cd services/$(SERVICE) && npm run test -- --passWithNoTests --coverage

test-integration: ## Run integration tests only
	npm run test --workspaces --if-present -- --testPathPattern="integration" --passWithNoTests

# =============================================================================
# Linting & Formatting
# =============================================================================
lint: ## Run ESLint across all services
	npm run lint

lint-fix: ## Auto-fix ESLint issues across all services
	npm run lint --workspaces --if-present -- --fix

format: ## Format all TypeScript files with Prettier
	npx prettier --write "services/**/*.ts" "packages/**/*.ts"

format-check: ## Check formatting without writing (dry-run)
	npx prettier --check "services/**/*.ts" "packages/**/*.ts"

# =============================================================================
# Docker
# =============================================================================
docker-up: ## Start all Docker infrastructure services (DB, Redis, RabbitMQ, etc.)
	docker-compose up -d

docker-down: ## Stop all Docker services
	docker-compose down

docker-rebuild: ## Rebuild and restart all Docker services
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d

docker-logs: ## Tail logs from all Docker services
	docker-compose logs -f

docker-logs-service: ## Tail logs from a specific service: make docker-logs-service S=postgres
	docker-compose logs -f $(S)

docker-ps: ## Show status of all Docker containers
	docker-compose ps

docker-clean: ## Remove all Docker containers, volumes, and images for this project
	docker-compose down -v --remove-orphans
	docker image prune -f

# =============================================================================
# Database Migrations & Seeding
# =============================================================================
migrate: ## Run database migrations for all services
	@bash scripts/migrate.sh

migrate-service: ## Run migrations for a specific service: make migrate-service SERVICE=user-service
	@if [ -z "$(SERVICE)" ]; then \
		echo "Usage: make migrate-service SERVICE=<service-name>"; \
		exit 1; \
	fi
	cd services/$(SERVICE) && npm run prisma:migrate

migrate-prod: ## Run production migrations (deploy mode — no schema resets)
	@echo "==> Running production migrations..."
	@for dir in services/*/; do \
		SERVICE=$$(basename "$$dir"); \
		if [ -f "$$dir/prisma/schema.prisma" ]; then \
			echo "  Migrating $$SERVICE..."; \
			(cd "$$dir" && npx prisma migrate deploy) || exit 1; \
		fi; \
	done

seed: ## Seed all databases with development data
	@echo "==> Seeding databases..."
	@for dir in services/*/; do \
		SERVICE=$$(basename "$$dir"); \
		if [ -f "$$dir/prisma/seed.ts" ] || [ -f "$$dir/prisma/seed.js" ]; then \
			echo "  Seeding $$SERVICE..."; \
			(cd "$$dir" && npm run prisma:seed) || echo "  Warning: seed failed for $$SERVICE"; \
		fi; \
	done

db-reset: ## Reset all databases (WARNING: destroys all data)
	@echo ""
	@echo "  WARNING: This will destroy ALL local database data!"
	@echo ""
	@read -p "  Type 'yes' to confirm: " CONFIRM; \
	if [ "$$CONFIRM" = "yes" ]; then \
		echo "Resetting databases..."; \
		docker-compose down -v; \
		docker-compose up -d; \
		sleep 5; \
		$(MAKE) migrate; \
		$(MAKE) seed; \
	else \
		echo "Aborted."; \
	fi

prisma-studio: ## Open Prisma Studio for a service: make prisma-studio SERVICE=user-service
	@if [ -z "$(SERVICE)" ]; then \
		echo "Usage: make prisma-studio SERVICE=<service-name>"; \
		exit 1; \
	fi
	cd services/$(SERVICE) && npx prisma studio

# =============================================================================
# Secrets & Environment
# =============================================================================
generate-secrets: ## Generate all required secrets (.env files)
	@bash scripts/generate-secrets.sh

check-env: ## Verify all required environment variables are set
	@echo "==> Checking environment configuration..."
	@MISSING=0; \
	REQUIRED_VARS="JWT_ACCESS_SECRET JWT_REFRESH_SECRET SESSION_SECRET POSTGRES_PASSWORD REDIS_HOST"; \
	for VAR in $$REQUIRED_VARS; do \
		if [ -z "$${!VAR}" ]; then \
			echo "  MISSING: $$VAR"; \
			MISSING=1; \
		else \
			echo "  OK:      $$VAR"; \
		fi; \
	done; \
	exit $$MISSING

# =============================================================================
# Health Checks
# =============================================================================
health-check: ## Check health of all running services
	@bash scripts/health-check.sh

# =============================================================================
# Cleanup
# =============================================================================
clean: clean-dist clean-modules ## Clean all build artifacts and node_modules

clean-dist: ## Remove all dist/ build directories
	@echo "==> Cleaning dist directories..."
	find . -name "dist" -type d \
		-not -path "*/node_modules/*" \
		-exec rm -rf {} + 2>/dev/null; true
	@echo "Done."

clean-modules: ## Remove all node_modules directories (re-run make install after)
	@echo "==> Cleaning node_modules..."
	find . -name "node_modules" -type d \
		-not -path "*/node_modules/*/node_modules/*" \
		-exec rm -rf {} + 2>/dev/null; true
	@echo "Done. Run 'make install' to reinstall."

clean-cache: ## Clean npm cache
	npm cache clean --force

# =============================================================================
# Code Generation
# =============================================================================
prisma-generate: ## Regenerate Prisma clients for all services
	@for dir in services/*/; do \
		SERVICE=$$(basename "$$dir"); \
		if [ -f "$$dir/prisma/schema.prisma" ]; then \
			echo "Generating Prisma client for $$SERVICE..."; \
			(cd "$$dir" && npx prisma generate); \
		fi; \
	done

# =============================================================================
# CI Targets (used by GitHub Actions)
# =============================================================================
ci-install: ## Install deps in CI (frozen lockfile)
	npm ci

ci-test: lint type-check test ## Full CI validation suite
	@echo "CI validation complete."

type-check: ## Run TypeScript compiler check without emitting files
	@echo "==> Running TypeScript type checks..."
	@FAILED=0; \
	for dir in services/*/; do \
		SERVICE=$$(basename "$$dir"); \
		echo "  Checking $$SERVICE..."; \
		(cd "$$dir" && npx tsc --noEmit 2>&1) || FAILED=1; \
	done; \
	[ $$FAILED -eq 0 ] && echo "All type checks passed." || (echo "Type check failed." && exit 1)
