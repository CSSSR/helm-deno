.PHONY: install fmt test test-all

HELM=$(shell which helm3 || which helm)

install:
	@ yarn --frozen-lockfile
	@ HELM_PLUGIN_DIR="$$PWD" ./scripts/install.sh v1.4.6

fmt:
	@ yarn eslint --fix .

# Run fast and independant tests
test:
	@ $(shell $(HELM) env) deno test --allow-run --allow-env src/ e2e-tests/

# Run all tests
#
# Require
# - helm-secrets
# - helm-diff
# - kubernetes cluster with access to read services in default namespace
test-all:
	@ $(shell $(HELM) env) RUN_ALL_TESTS=true deno test --allow-run --allow-env src/ e2e-tests/
