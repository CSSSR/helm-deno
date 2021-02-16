import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts"
import { parseArgs } from "../args/parse-helm-deno-args.ts"

Deno.test("Should parse --deno-log-level flag", () => {
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
  ])

  assertEquals(options.logLevel, "debug")
  assertEquals(options.keepTmpChart, true)
  assertEquals(helmArgs, [
    "upgrade",
    "--install",
    "one-service-release",
    "tests/charts/one-service",
    "--set",
    "selector.app=my-app",
  ])
})
