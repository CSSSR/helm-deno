.PHONY: fmt test install

HELM=$(shell which helm3 || which helm)

install:
	@ HELM_PLUGIN_DIR="$$PWD" ./scripts/install.sh v1.4.6

fmt:
	@ yarn prettier --write .

# Run fast and independant tests
test:
	@ $(shell $(HELM) env) deno test --allow-run --allow-env tests/

# Run all tests
# Require kubernetes cluster with access to read services in default namespace
test-all:
	@ $(shell $(HELM) env) RUN_CLUSER_DEPENDENT_TESTS=true deno test --allow-run --allow-env tests/
