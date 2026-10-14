# Tujya data pipeline. Run `make help` for the list of targets.
# On Windows, use Git Bash / WSL, or run the underlying commands shown here directly.

PYTHON ?= python
SAMPLE ?= 100

.DEFAULT_GOAL := help
.PHONY: help install test lint format typecheck check live preflight dry-run sample fetch \
        clean-data literature report export update sources summary docker-build docker-run

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "} {printf "  %-14s %s\n", $$1, $$2}'

install:  ## Install the package with development tools
	$(PYTHON) -m pip install -e ".[dev]"

test:  ## Unit tests: mocked HTTP, no network access
	$(PYTHON) -m pytest tests/unit

lint:  ## Lint and check formatting
	$(PYTHON) -m ruff check src tests
	$(PYTHON) -m ruff format --check src tests

format:  ## Auto-format and fix what can be fixed
	$(PYTHON) -m ruff format src tests
	$(PYTHON) -m ruff check --fix src tests

typecheck:  ## Static type check
	$(PYTHON) -m mypy

check: lint typecheck test  ## Everything CI should run

live:  ## Optional smoke tests against the real services (tiny samples, needs .env)
	$(PYTHON) -m pytest tests/live -m live

preflight:  ## Disk space, permissions, identity and tooling
	tujya preflight

dry-run:  ## Show what a fetch would do, without touching anything
	tujya fetch --sample $(SAMPLE) --dry-run

sample:  ## Fetch a small sample of every enabled source
	tujya fetch --sample $(SAMPLE)

fetch:  ## Fetch every enabled source in full
	tujya fetch

clean-data:  ## Build the processed tables (data/parquet) from data/interim
	tujya clean

literature:  ## Abstract store, candidate sentences, annotation sample
	tujya literature

report:  ## Quality report, coverage, conflicts, LICENSES.md
	tujya report

export:  ## Frontend JSON files
	tujya export

update:  ## Incremental end-to-end run (what the scheduler calls)
	tujya update

sources:  ## Probe every link and rewrite docs/SOURCES.md
	tujya sources --check

summary:  ## Final report of everything collected
	tujya summary

docker-build:  ## Build the container image
	docker build -t tujya-data .

docker-run:  ## Run `tujya update` in the container (everything stays in ./data on the host)
	docker run --rm --env-file .env -v "$(CURDIR)/data:/app/data" tujya-data update
