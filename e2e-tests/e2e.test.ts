import { getAvailablePort } from "https://deno.land/x/port@1.0.0/mod.ts"
import * as fs from "https://deno.land/std@0.86.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.86.0/path/mod.ts"
import * as yaml from "https://deno.land/std@0.86.0/encoding/yaml.ts"
import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.86.0/testing/asserts.ts"

const runAllTests = Deno.env.get("RUN_ALL_TESTS") === "true"

const helmPluginDir = path.join(import.meta.url.replace("file://", ""), "../..")
const helmDenoBin = path.join(helmPluginDir, "scripts/dev.sh")
const chartsBin = path.join(helmPluginDir, "e2e-tests/charts")

function toText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

async function run(args: string[]) {
  const cmd = Deno.run({
    cmd: args,
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

async function runHelm(args: string[]) {
  return await run([Deno.env.get("HELM_BIN") as string, ...args])
}

async function runHelmDeno(args: string[]) {
  return await run([helmDenoBin, ...args])
}

async function assertYamlParsable(yamlFileContent: string) {
  try {
    await yaml.parseAll(yamlFileContent)
  } catch (err) {
    throw new Error(`Cloud parse yaml context ${err} ${yamlFileContent}`)
  }
}

Deno.test({
  name: "should successfuly run `helm deno template` with deno chart",
  async fn() {
    const chartPath = path.join(chartsBin, "one-service")

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
          annotations: {
            "default-annotation": "default-value",
          },
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
  },
})

Deno.test(
  "should handle error in deno chart during `helm deno template`",
  async () => {
    const chartPath = path.join(chartsBin, "one-service")

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
  "should successfuly run `helm deno lint` with deno chart",
  async () => {
    const chartPath = path.join(chartsBin, "one-service")

    const { status, stdout, stderr } = await runHelmDeno(["lint", chartPath])

    assertEquals(stderr, "")
    assertEquals(
      stdout.replaceAll(helmPluginDir, ""),
      `\
==> Linting /e2e-tests/charts/one-service
[WARNING] templates/: directory not found

1 chart(s) linted, 0 chart(s) failed
`
    )
    assertEquals(status.success, true)
  }
)

Deno.test("should successfuly run `helm deno --help`", async () => {
  const { status, stdout, stderr } = await runHelmDeno(["--help"])

  assertEquals(stderr, "")
  assertEquals(
    stdout,
    `\
This is a wrapper for "helm [command]". It will use Deno for rendering charts
before running "helm [command]"

Supported helm [command] is:
  - template
  - install
  - upgrade
  - diff (helm plugin)
  - secrets (helm plugin)
  - push (helm plugin)

You must use the options of the supported commands in strict order:
  $ helm <secrets> <diff> [upgrade/template/install] [RELEASE] [CHART] <flags>

Example:
  $ helm deno upgrade <HELM UPGRADE OPTIONS>

Typical usage:
  $ helm deno upgrade ingress stable/nginx-ingress -f values.yaml
`
  )
  assertEquals(status.success, true)
})

Deno.test({
  name: "should successfuly run `helm deno template` with regular chart",
  ignore: !runAllTests,
  async fn() {
    const chartPath = path.join(chartsBin, "no-deno-chart")

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
  },
})

Deno.test({
  name: "should support helm-secrets plugin",
  ignore: !runAllTests,
  async fn() {
    const chartPath = path.join(chartsBin, "one-service")

    const { status, stdout, stderr } = await runHelmDeno([
      "secrets",
      "template",
      "my-release-name",
      chartPath,
      "--set",
      "selector.app=my-app",
    ])

    assertEquals(stderr.trim(), "")
    assertEquals(yaml.parseAll(stdout), [
      {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
          name: "my-release-name",
          annotations: {
            "default-annotation": "default-value",
          },
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
  },
})

Deno.test({
  name: "should support helm-diff plugin",
  ignore: !runAllTests,
  async fn() {
    const chartPath = path.join(chartsBin, "one-service")

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
  ignore: !runAllTests,
  async fn() {
    const chartPath = path.join(chartsBin, "one-service")

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

    assertEquals(stderr.trim(), "")
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function startHelmRegistry() {
  const port = await getAvailablePort()
  const { status, stdout, stderr } = await run([
    "docker",
    "run",
    "--rm",
    "--detach",
    `--publish=${port}:8080`,
    "--env=STORAGE=local",
    "--env=STORAGE_LOCAL_ROOTDIR=/home/chartmuseum/charts",
    "chartmuseum/chartmuseum:v0.12.0@sha256:38c5ec3b30046d7a02a55b4c8bd8a0cd279538c2e36090973798a858e900b18e",
  ])

  if (!status.success) {
    throw new Error(`Could not start chartmuseum ${stderr}`)
  }
  const containerID = stdout.trim()

  let errorsCount = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (errorsCount > 10) {
      throw new Error("To many errors")
    }
    try {
      const response = await fetch(`http://localhost:${port}/health`)
      const json = await response.json()
      if (json.healthy) {
        break
      }
    } catch {
      errorsCount++
    }
    await sleep(200)
  }

  return {
    url: `http://localhost:${port}`,
    async stop() {
      const { status, stderr } = await run(["docker", "stop", containerID])

      if (!status.success) {
        const dockerStopError = stderr
        throw new Error(
          `Could not stop helm registry docker container ${containerID} ${dockerStopError}`
        )
      }
    },
  }
}

Deno.test({
  name: "should precompile chart during helm deno push",
  ignore: !runAllTests,
  async fn() {
    const helmRegistry = await startHelmRegistry()
    const fetchDirectory = await Deno.makeTempDir({
      prefix: "helm-deno-tests-",
    })

    try {
      const chartPath = path.join(chartsBin, "one-service")

      const { status, stderr } = await runHelmDeno([
        "push",
        chartPath,
        helmRegistry.url,
      ])

      if (!status.success) {
        console.log(stderr)
      }
      assertEquals(status.success, true, "should successfully push")

      const isDenoBundleExists = await fs.exists(
        path.join(chartPath, "deno-bundle.js")
      )
      assertEquals(
        isDenoBundleExists,
        false,
        "should not have left temporary file deno-bundle.js"
      )

      const fetchResult = await runHelmDeno([
        "fetch",
        "one-service",
        "--repo",
        helmRegistry.url,
        "--untar",
        "--untardir",
        fetchDirectory,
      ])
      assertEquals(
        fetchResult.status.success,
        true,
        "should successfully fetch"
      )

      const isDenoBundleInFetchedChartExists = await fs.exists(
        path.join(fetchDirectory, "one-service/deno-bundle.js")
      )
      assertEquals(
        isDenoBundleInFetchedChartExists,
        true,
        "should have file deno-bundle.js in fetched chart"
      )
    } finally {
      await Deno.remove(fetchDirectory, { recursive: true })
      await helmRegistry.stop()
    }
  },
})

Deno.test({
  name: "should use deno-bundle.js if `--deno-bundle require` have been passed",
  async fn() {
    const chartPath = path.join(chartsBin, "prebundled")

    const { status, stdout, stderr } = await runHelmDeno([
      "template",
      "my-release-name",
      chartPath,
      "--deno-bundle",
      "require",
    ])

    assertEquals(stderr, "")
    assertEquals(yaml.parseAll(stdout), [
      {
        kind: "ServiceAccount",
        apiVersion: "v1",
        metadata: {
          name: "prebundled",
        },
      },
    ])
    assertEquals(status.success, true)
  },
})

Deno.test({
  name:
    "should use deno-bundle.js if `--deno-bundle prefer` have been passed and deno-bundle.js exists",
  async fn() {
    const chartPath = path.join(chartsBin, "prebundled")

    const { status, stdout, stderr } = await runHelmDeno([
      "template",
      "my-release-name",
      chartPath,
      "--deno-bundle",
      "prefer",
    ])

    assertEquals(stderr, "")
    assertEquals(yaml.parseAll(stdout), [
      {
        kind: "ServiceAccount",
        apiVersion: "v1",
        metadata: {
          name: "prebundled",
        },
      },
    ])
    assertEquals(status.success, true)
  },
})

Deno.test({
  name:
    "should use deno-templates/index.ts if `--deno-bundle ignore` have been passed",
  async fn() {
    const chartPath = path.join(chartsBin, "prebundled")

    const { status, stdout, stderr } = await runHelmDeno([
      "template",
      "my-release-name",
      chartPath,
      "--deno-bundle",
      "ignore",
    ])

    assertEquals(stderr, "")
    assertEquals(yaml.parseAll(stdout), [
      {
        kind: "ServiceAccount",
        apiVersion: "v1",
        metadata: {
          name: "not-bundled",
        },
      },
    ])
    assertEquals(status.success, true)
  },
})

Deno.test({
  name:
    "should use deno-templates/index.ts if --deno-bundle have not been passed",
  async fn() {
    const chartPath = path.join(chartsBin, "prebundled")

    const { status, stdout, stderr } = await runHelmDeno([
      "template",
      "my-release-name",
      chartPath,
    ])

    assertEquals(stderr, "")
    assertEquals(yaml.parseAll(stdout), [
      {
        kind: "ServiceAccount",
        apiVersion: "v1",
        metadata: {
          name: "not-bundled",
        },
      },
    ])
    assertEquals(status.success, true)
  },
})

Deno.test({
  name:
    "should throw error if`--deno-bundle require` have been passed but deno-bundle.js do not exist",
  async fn() {
    const chartPath = path.join(chartsBin, "one-service")

    const { status, stderr } = await runHelmDeno([
      "template",
      "my-release-name",
      chartPath,
      "--deno-bundle",
      "require",
    ])

    assertEquals(status.success, false)
    assertStringIncludes(stderr, "Bundle for chart does not exist")
  },
})

Deno.test({
  name:
    "should not throw error if`--deno-bundle prefer` have been passed and deno-bundle.js do not exist",
  async fn() {
    const chartPath = path.join(chartsBin, "one-service")

    const { status, stdout, stderr } = await runHelmDeno([
      "template",
      "my-release-name",
      chartPath,
      "--set",
      "selector.app=my-app",
      "--deno-bundle",
      "prefer",
    ])

    assertEquals(stderr, "")
    assertEquals(yaml.parseAll(stdout), [
      {
        apiVersion: "v1",
        kind: "Service",
        metadata: {
          name: "my-release-name",
          annotations: {
            "default-annotation": "default-value",
          },
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
  },
})

Deno.test({
  name: "should ignore --deno-bundle flag for regular charts",
  ignore: !runAllTests,
  async fn() {
    const chartPath = path.join(chartsBin, "no-deno-chart")

    const { status, stdout, stderr } = await runHelmDeno([
      "template",
      "my-release-name",
      chartPath,
      "--set",
      "selector.app=my-app",
      "--deno-bundle",
      "require",
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
  },
})

Deno.test({
  name:
    "should successfuly run `helm deno template` with remote deno chart (with --repo option)",
  ignore: !runAllTests,
  async fn() {
    const { status, stdout, stderr } = await runHelmDeno([
      "template",
      "ingress",
      "nginx-ingress",
      "--repo",
      "https://charts.helm.sh/stable",
      "--version",
      "1.41.3",
    ])

    await assertYamlParsable(stdout)
    assertEquals(status.success, true, stderr)
  },
})

async function addStableRepo() {
  const tmpRepoName = `tmp-repo-${Math.random().toFixed(10).slice(2)}`
  const repoAddCmd = await runHelm([
    "repo",
    "add",
    tmpRepoName,
    "https://charts.helm.sh/stable",
  ])

  assertEquals(repoAddCmd.status.success, true)
  return {
    name: tmpRepoName,
    async cleanup() {
      const repoAddCmd = await runHelm(["repo", "remove", tmpRepoName])

      if (!repoAddCmd.status.success) {
        throw new Error(`Could not remove repo ${tmpRepoName}`)
      }
    },
  }
}

Deno.test({
  name:
    "should successfuly run `helm deno template` with remote chart (with helm repo add)",
  ignore: !runAllTests,
  async fn() {
    const tmpRepo = await addStableRepo()

    try {
      const templateCmd = await runHelmDeno([
        "template",
        "ingress",
        `${tmpRepo.name}/nginx-ingress`,
        "--version",
        "1.41.3",
      ])

      await assertYamlParsable(templateCmd.stdout)
      assertEquals(templateCmd.status.success, true, templateCmd.stderr)
    } finally {
      await tmpRepo.cleanup()
    }
  },
})
