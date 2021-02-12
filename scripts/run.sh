#!/bin/sh
$HELM_PLUGIN_DIR/bin/deno run --unstable --allow-net --allow-read --allow-write --allow-run --allow-env --quiet $HELM_PLUGIN_DIR/index.ts $@
