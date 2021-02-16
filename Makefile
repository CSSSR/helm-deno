.PHONY: fmt test install

HELM=$(shell which helm3 || which helm)

install:
	@ HELM_PLUGIN_DIR="$$PWD" ./scripts/install.sh v1.4.6

fmt:
	@ yarn prettier --write .

test:
	@ $(shell $(HELM) env) deno test --allow-run tests/
