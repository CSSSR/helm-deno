.PHONY: fmt test install

install:
	@ HELM_PLUGIN_DIR="$$PWD" ./scripts/install.sh v1.4.6

fmt:
	@ yarn prettier --write .

test:
	@ deno test tests/
