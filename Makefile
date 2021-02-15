.PHONY: fmt test install

install:
	@ HELM_PLUGIN_DIR="$$PWD" ./scripts/install.sh

fmt:
	@ yarn prettier --write .

test:
	@ deno test tests/
