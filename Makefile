SHELL := /usr/bin/env bash

COMPOSE_DIR := infrastructure
COMPOSE_CMD := docker compose
FRONTEND_DIR := frontend
CERT_DIR := infrastructure/certs
CERT_KEY := $(CERT_DIR)/quillow.local.key
CERT_CRT := $(CERT_DIR)/quillow.local.crt
CERT_CONF := $(CERT_DIR)/openssl-local.cnf
NPM_DIRS := . frontend infrastructure backend/auth-service backend/user-service backend/diary-service backend/realtime-service backend/api-gateway

.PHONY: all help make-start check-tools npm-self-update npm-install up down vault-dev dev fclean certs

all: make-start

help:
	@echo "Targets:"
	@echo "  make / make-start : update npm, install deps, start docker compose, run frontend dev server"
	@echo "  certs             : create local HTTPS cert/key if missing"
	@echo "  up                : docker compose up -d --build"
	@echo "  down              : docker compose down --remove-orphans"
	@echo "  vault-dev         : dev: auto-init+unseal+seed vault; writes token under infrastructure/vault/dev-secrets/"
	@echo "  fclean            : alias of down"
	@echo "  npm-install       : npm install in all package folders"
	@echo "  npm-self-update   : try updating npm CLI globally"

make-start: check-tools certs npm-self-update npm-install up dev

check-tools:
	@command -v docker >/dev/null || { echo "docker is required"; exit 1; }
	@docker compose version >/dev/null || { echo "docker compose is required"; exit 1; }
	@command -v npm >/dev/null || { echo "npm is required"; exit 1; }
	@command -v openssl >/dev/null || { echo "openssl is required"; exit 1; }

certs:
	@mkdir -p $(CERT_DIR)
	@if [ -d "$(CERT_KEY)" ] || [ -d "$(CERT_CRT)" ]; then \
		echo "Removing invalid cert directories..."; \
		rm -rf "$(CERT_KEY)" "$(CERT_CRT)"; \
	fi
	@if [ ! -f "$(CERT_KEY)" ] || [ ! -f "$(CERT_CRT)" ]; then \
		echo "Generating local HTTPS certs..."; \
		openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
			-keyout "$(CERT_KEY)" \
			-out "$(CERT_CRT)" \
			-config "$(CERT_CONF)" >/dev/null 2>&1; \
		chmod 644 "$(CERT_KEY)" "$(CERT_CRT)"; \
		echo "Created $(CERT_CRT) and $(CERT_KEY)"; \
	else \
		echo "Certs already exist: $(CERT_CRT), $(CERT_KEY)"; \
	fi

npm-self-update:
	@echo "Checking npm version..."
	@npm --version
	@echo "Trying to update npm globally (will continue if not permitted)..."
	@npm install -g npm@latest >/dev/null 2>&1 || \
		echo "Skipping npm global update (permission or policy prevented it)."
	@echo "npm version now:"
	@npm --version

npm-install:
	@set -e; \
	for dir in $(NPM_DIRS); do \
		if [ -f "$$dir/package.json" ]; then \
			echo "Installing npm deps in $$dir"; \
			(cd "$$dir" && npm install); \
		fi; \
	done

up:
	@echo "Starting docker compose services..."
	@cd $(COMPOSE_DIR) && $(COMPOSE_CMD) up -d --build

down:
	@echo "Stopping docker compose services..."
	@cd $(COMPOSE_DIR) && $(COMPOSE_CMD) down --remove-orphans

vault-dev:
	@echo "Bootstrapping Vault (dev mode: init+unseal+seed)..."
	@cd $(COMPOSE_DIR) && $(COMPOSE_CMD) up -d vault user-service
	@echo "Vault dev token file is in docker volume 'vault-dev-secrets' (mounted at /vault/dev-secrets)."
	@echo "To print it: cd infrastructure && docker compose exec -T user-service cat /vault/dev-secrets/app-token"

dev:
	@if lsof -ti :5173 >/dev/null 2>&1; then \
		echo "Port 5173 already in use; skipping frontend dev server."; \
	else \
		echo "Running frontend dev server..."; \
		cd $(FRONTEND_DIR) && npm run dev; \
	fi

fclean: down
	@echo "Removing local HTTPS certs..."
	@rm -f $(CERT_KEY) $(CERT_CRT)
