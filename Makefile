.PHONY: build install install-tools install-plugin lint fmt test test-all

HELM=$(shell which helm3 || which helm)

build:
	bin/deno bundle --unstable src/index.ts bin/bundle.js

install: install-tools install-plugin

install-tools:
	@ yarn --frozen-lockfile

install-plugin:
	@ HELM_PLUGIN_DIR="$$PWD" ./scripts/install.sh v1.8.3

lint:
	@ yarn prettier --check .
	@ yarn eslint .

fmt:
	@ yarn prettier --write .
	@ yarn eslint --fix .

# Run fast and independant tests
test:
	@ $(shell $(HELM) env) deno test --unstable --allow-run --allow-read --allow-write --allow-env --allow-net src/ e2e-tests/

# Run all tests
#
# Require
# - https://github.com/jkroepke/helm-secrets
# - https://github.com/mozilla/sops
# - https://github.com/FiloSottile/age
# - https://github.com/jkroepke/helm-secrets
# - Docker
# - Kubernetes cluster with access to read services in default namespace
test-all:
	@ $(shell $(HELM) env) RUN_ALL_TESTS=true deno test --unstable --allow-run --allow-read --allow-write --allow-env --allow-net src/ e2e-tests/

update-deps:
	@ # Install udd: https://github.com/hayd/deno-udd
	udd src/**/*.ts
