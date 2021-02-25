import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts"
import { parseArgs } from "../parse-helm-deno-args.ts"

Deno.test("Should parse --deno-* flags", () => {
  const { options, helmArgs } = parseArgs([
    "upgrade",
    "--install",
    "one-service-release",
    "tests/charts/one-service",
    "--set",
    "selector.app=my-app",
    "--deno-log-level",
    "debug",
    "--deno-keep-tmp-chart",
    "--deno-import-map",
    "test/import_map.json",
    "--deno-bundle",
    "require",
  ])

  assertEquals(options.logLevel, "debug")
  assertEquals(options.keepTmpChart, true)
  assertEquals(options.importMap, "test/import_map.json")
  assertEquals(options.bundlePolicy, "require")
  assertEquals(helmArgs, [
    "upgrade",
    "--install",
    "one-service-release",
    "tests/charts/one-service",
    "--set",
    "selector.app=my-app",
  ])
})
