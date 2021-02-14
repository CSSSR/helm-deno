import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts"
import { parseHelmArgs } from "../args/parse-helm-args.ts"

Deno.test("Should parse helm template args for `helm upgrade`", () => {
  const res = parseHelmArgs([
    "upgrade",
    "my-app",
    "charts/my-app",
    "--set",
    "releaseID=main",
    "--set",
    "image.tag=test",
    "-n",
    "helm-deno-test",
    "--install",
  ])

  const expected: ReturnType<typeof parseHelmArgs> = {
    command: ["upgrade"],
    releaseName: "my-app",
    chartLocation: "charts/my-app",
    options: [
      "--set",
      "releaseID=main",
      "--set",
      "image.tag=test",
      "-n",
      "helm-deno-test",
      "--install",
    ],
  }

  assertEquals(res, expected)
})

Deno.test("Should parse helm template args for `helm diff upgrade`", () => {
  const res = parseHelmArgs([
    "diff",
    "upgrade",
    "my-app",
    "charts/my-app",
    "--set",
    "releaseID=main",
    "--set",
    "image.tag=test",
    "-n",
    "helm-deno-test",
    "--install",
  ])

  const expected: ReturnType<typeof parseHelmArgs> = {
    command: ["diff", "upgrade"],
    releaseName: "my-app",
    chartLocation: "charts/my-app",
    options: [
      "--set",
      "releaseID=main",
      "--set",
      "image.tag=test",
      "-n",
      "helm-deno-test",
      "--install",
    ],
  }

  assertEquals(res, expected)
})
