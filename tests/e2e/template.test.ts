import * as path from "https://deno.land/std@0.86.0/path/mod.ts"
import * as yaml from "https://deno.land/std@0.86.0/encoding/yaml.ts"
import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.86.0/testing/asserts.ts"

const runCluserDependentTests =
  Deno.env.get("RUN_CLUSER_DEPENDENT_TESTS") === "true"

const helmPluginDir = path.join(
  import.meta.url.replace("file://", ""),
  "../../.."
)
const helmDenoBin = path.join(helmPluginDir, "scripts/dev.sh")

function toText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

async function runHelmDeno(args: string[]) {
  const cmd = Deno.run({
    cmd: [helmDenoBin, ...args],
    env: {
      HELM_PLUGIN_DIR: helmPluginDir,
    },
    stdout: "piped",
    stderr: "piped",
  })

  const [status, output, error] = await Promise.all([
    cmd.status(),
    cmd.output(),
    cmd.stderrOutput(),
  ])
  cmd.close()

  return { status, stdout: toText(output), stderr: toText(error) }
}

Deno.test(
  "should successfuly run `helm deno template` with deno chart",
  async () => {
    const chartPath = path.join(helmPluginDir, "tests/charts/one-service")

    const { status, stdout, stderr } = await runHelmDeno([
      "template",
      "my-release-name",
      chartPath,
      "--set",
      "selector.app=my-app",
    ])

    assertEquals(stderr, "")
    assertEquals(yaml.parseAll(stdout), [
      {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
          name: "my-release-name",
        },
        spec: {
          ports: [
            {
              name: "http",
              port: 80,
              targetPort: "http",
            },
          ],
          selector: {
            app: "my-app",
          },
        },
      },
    ])
    assertEquals(status.success, true)
  }
)

Deno.test(
  "should handle error in deno chart during `helm deno template`",
  async () => {
    const chartPath = path.join(helmPluginDir, "tests/charts/one-service")

    const { status, stdout, stderr } = await runHelmDeno([
      "template",
      "my-release-name",
      chartPath,
    ])

    assertStringIncludes(stderr, "values.selector is required")
    assertStringIncludes(
      stderr,
      path.join(chartPath, "deno-templates/index.ts")
    )
    assertEquals(stdout, "")
    assertEquals(status.success, false)
  }
)

Deno.test(
  "should successfuly run `helm deno template` with regular chart",
  async () => {
    const chartPath = path.join(helmPluginDir, "tests/charts/no-deno-chart")

    const { status, stdout, stderr } = await runHelmDeno([
      "template",
      "my-release-name",
      chartPath,
      "--set",
      "selector.app=my-app",
    ])

    assertEquals(stderr, "")
    assertEquals(yaml.parseAll(stdout), [
      {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
          name: "my-release-name",
        },
        spec: {
          ports: [
            {
              name: "http",
              port: 80,
              targetPort: "http",
            },
          ],
          selector: {
            app: "my-app",
          },
        },
      },
    ])
    assertEquals(status.success, true)
  }
)
Deno.test("should support helm-secrets plugin", async () => {
  const chartPath = path.join(helmPluginDir, "tests/charts/one-service")

  const { status, stdout, stderr } = await runHelmDeno([
    "secrets",
    "template",
    "my-release-name",
    chartPath,
    "--set",
    "selector.app=my-app",
  ])

  assertEquals(stderr, "")
  assertEquals(yaml.parseAll(stdout), [
    {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: "my-release-name",
      },
      spec: {
        ports: [
          {
            name: "http",
            port: 80,
            targetPort: "http",
          },
        ],
        selector: {
          app: "my-app",
        },
      },
    },
  ])
  assertEquals(status.success, true)
})

Deno.test({
  name: "should support helm-diff plugin",
  ignore: !runCluserDependentTests,
  async fn() {
    const chartPath = path.join(helmPluginDir, "tests/charts/one-service")

    const { status, stdout, stderr } = await runHelmDeno([
      "diff",
      "upgrade",
      "my-release-name",
      chartPath,
      "--set",
      "selector.app=my-app",
      "--namespace",
      "default",
      "--allow-unreleased",
      "--output",
      "json",
    ])

    assertEquals(stderr, "")
    const stripAllowUnreleadesWarning = (str: string) =>
      str.split("\n").slice(5).join("\n")

    assertEquals(JSON.parse(stripAllowUnreleadesWarning(stdout)), [
      {
        api: "v1",
        kind: "Service",
        namespace: "default",
        name: "my-release-name",
        change: "ADD",
      },
    ])
    assertEquals(status.success, true)
  },
})

Deno.test({
  name: "should support helm-diff and helm-secrets plugins together",
  ignore: !runCluserDependentTests,
  async fn() {
    const chartPath = path.join(helmPluginDir, "tests/charts/one-service")

    const { status, stdout, stderr } = await runHelmDeno([
      "secrets",
      "diff",
      "upgrade",
      "my-release-name",
      chartPath,
      "--set",
      "selector.app=my-app",
      "--namespace",
      "default",
      "--allow-unreleased",
      "--output",
      "json",
    ])

    assertEquals(stderr, "")
    const stripAllowUnreleadesWarning = (str: string) =>
      str.split("\n").slice(5).join("\n")

    assertEquals(JSON.parse(stripAllowUnreleadesWarning(stdout)), [
      {
        api: "v1",
        kind: "Service",
        namespace: "default",
        name: "my-release-name",
        change: "ADD",
      },
    ])
    assertEquals(status.success, true)
  },
})
