SHELL := /usr/bin/env bash

COMPOSE_DIR := infrastructure
COMPOSE_CMD := docker compose
FRONTEND_DIR := frontend
NPM_DIRS := . frontend infrastructure backend/auth-service backend/user-service backend/diary-service backend/realtime-service backend/api-gateway

.PHONY: all help make-start check-tools npm-self-update npm-install up down dev fclean

all: make-start

help:
	@echo "Targets:"
	@echo "  make / make-start : update npm, install deps, start docker compose, run frontend dev server"
	@echo "  up                : docker compose up -d --build"
	@echo "  down              : docker compose down --remove-orphans"
	@echo "  fclean            : alias of down"
	@echo "  npm-install       : npm install in all package folders"
	@echo "  npm-self-update   : try updating npm CLI globally"

make-start: check-tools npm-self-update npm-install up dev

check-tools:
	@command -v docker >/dev/null || { echo "docker is required"; exit 1; }
	@docker compose version >/dev/null || { echo "docker compose is required"; exit 1; }
	@command -v npm >/dev/null || { echo "npm is required"; exit 1; }

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

dev:
	@echo "Running frontend dev server..."
	@cd $(FRONTEND_DIR) && npm run dev

fclean: down
