.PHONY: fmt test

fmt:
	@ yarn prettier --write .

test:
	@ deno test tests/
