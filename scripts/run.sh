#!/bin/sh
set -eu

# Temporary allow to use DENO_IMPORT_MAP env to use deno import maps
# TODO: use flag instead
if [ ! -z "${DENO_IMPORT_MAP:-}" ]; then
  importmap="--importmap=$DENO_IMPORT_MAP"
fi

$HELM_PLUGIN_DIR/bin/deno run --unstable --allow-net --allow-read --allow-write --allow-run --allow-env --quiet ${importmap:-} $HELM_PLUGIN_DIR/bin/bundle.js $@
