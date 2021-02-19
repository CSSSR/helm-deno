import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts"
import { parseHelmFetchArgs } from "../parse-helm-fetch-args.ts"

Deno.test("Should parse helm fetch args", () => {
  const args = parseHelmFetchArgs([
    "upgrade",
    "--install",
    "one-service-release",
    "tests/charts/one-service",
    "--set",
    "selector.app=my-app",
    "-f",
    "prod-values.yaml",
    "--values",
    "prod-values-2.yaml",
    "--set-file",
    "set-file-1.yaml",
    "--set-string",
    "my-string",
    "--values=prod-values-3.yaml",
    "--set=selector.app2=my-app-2",
    "--set-file=set-file-2.yaml",
    "--set-string=my-string",
    "--repo",
    "https://repo.com/helm/charts",
    "--version",
    "0.0.1",
    "--deno-log-level",
    "debug",
  ])

  assertEquals(args, [
    "--repo",
    "https://repo.com/helm/charts",
    "--version",
    "0.0.1",
  ])
})
