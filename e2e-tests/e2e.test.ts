// Use fork until https://github.com/piyush-bhatt/deno-port/pull/1 is merged
import { getAvailablePort } from "https://raw.githubusercontent.com/Nitive/deno-port/fix-getting-random-port/mod.ts"
import { exists } from "https://deno.land/std@0.160.0/fs/exists.ts"
import * as path from "https://deno.land/std@0.160.0/path/mod.ts"
import * as yaml from "https://deno.land/std@0.160.0/encoding/yaml.ts"
import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.160.0/testing/asserts.ts"
import { ignoreNotFoundError } from "../src/utils/ignore-not-found-error.ts"
import { waitForProcess } from "../src/utils/process.ts"

const runAllTests = Deno.env.get("RUN_ALL_TESTS") === "true"

const helmPluginDir = path.join(import.meta.url.replace("file://", ""), "../..")
const helmDenoBin = path.join(helmPluginDir, "scripts/dev.sh")
const chartsBin = path.join(helmPluginDir, "e2e-tests/charts")

async function removeIfExists(filePath: string) {
  await ignoreNotFoundError(Deno.remove(filePath, { recursive: true }))
}

interface RunOptions {
  env?: { [key: string]: string }
}

async function run(args: string[], { env = {} }: RunOptions = {}) {
  const cmd = Deno.run({
    cmd: args,
    env: {
      ...env,
      HELM_PLUGIN_DIR: helmPluginDir,
    },
    stdout: "piped",
    stderr: "piped",
  })

  return await waitForProcess(cmd)
}

async function runShellCmd(shellCmd: string, opts?: RunOptions) {
  const result = await run(["/bin/sh", "-c", shellCmd], opts)

  if (!result.status.success) {
    throw new Error(result.stderr)
  }

  return result
}

async function runHelm(args: string[], opts?: RunOptions) {
  return await run([Deno.env.get("HELM_BIN") as string, ...args], opts)
}

async function runHelmDeno(args: string[], opts?: RunOptions) {
  return await run([helmDenoBin, ...args], opts)
}

async function assertYamlParsable(yamlFileContent: string) {
  try {
    await yaml.parseAll(yamlFileContent)
  } catch (err) {
    throw new Error(`Could not parse yaml context ${err} ${yamlFileContent}`)
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
    assertEquals(stdout.trim(), "")
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
  - push
  - diff (helm plugin)
  - secrets (helm plugin)
  - cm-push (helm plugin)

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
    try {
      const chartPath = path.join(chartsBin, "one-service")

      await removeIfExists("age-tmp-test-key.txt")
      await runShellCmd("age-keygen -o age-tmp-test-key.txt")
      await runShellCmd(
        `echo '${JSON.stringify({
          selector: { app: "my-app" },
        })}' > tmp-test-values.txt.yaml`
      )
      await runShellCmd(
        "sops --encrypt --age $(cat age-tmp-test-key.txt | grep public | cut -c 15-) tmp-test-values.txt.yaml > tmp-secrets.test-values.yaml"
      )

      const { status, stdout, stderr } = await runHelmDeno(
        [
          "secrets",
          "template",
          "my-release-name",
          chartPath,
          "-f",
          "tmp-secrets.test-values.yaml",
        ],
        {
          env: {
            SOPS_AGE_KEY_FILE: "age-tmp-test-key.txt",
          },
        }
      )

      assertEquals(
        stderr,
        "[helm-secrets] Decrypt: tmp-secrets.test-values.yaml\n\n[helm-secrets] Removed: tmp-secrets.test-values.yaml.dec\n"
      )
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
    } finally {
      await removeIfExists("age-tmp-test-key.txt")
      await removeIfExists("tmp-secrets.test-values.yaml")
      await removeIfExists("tmp-test-values.txt.yaml")
    }
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
    "--env=STORAGE_LOCAL_ROOTDIR=/charts",
    "--user=0", // To have write permission to /charts
    "ghcr.io/helm/chartmuseum:v0.13.1@sha256:79350ffbf8b0c205cf8b45988de899db594618b24fefd17cdbcdbbc8eb795d72",
  ])

  if (!status.success) {
    throw new Error(`Could not start chartmuseum ${stderr}`)
  }
  const containerID = stdout.trim()

  let errorsCount = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (errorsCount > 10) {
      throw new Error("Too many errors")
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

async function startOCIRegistry() {
  const port = await getAvailablePort()
  const { status, stdout, stderr } = await run([
    "docker",
    "run",
    "--rm",
    "--detach",
    `--publish=${port}:5000`,
    "registry:2.8.1@sha256:11bb1b1a54493dc3626f4bd3cdd74f83e4e5157239ea607a70cbe634f50bb89c",
  ])

  if (!status.success) {
    throw new Error(`Could not start oci registry ${stderr}`)
  }
  const containerID = stdout.trim()

  let errorsCount = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (errorsCount > 10) {
      throw new Error("Too many errors")
    }
    try {
      const response = await fetch(`http://localhost:${port}/v2/`)
      await response.text()
      if (response.ok) {
        break
      }
    } catch {
      errorsCount++
    }
    await sleep(200)
  }

  return {
    url: `oci://localhost:${port}`,
    async stop() {
      const { status, stderr } = await run(["docker", "stop", containerID])

      if (!status.success) {
        const dockerStopError = stderr
        throw new Error(
          `Could not stop oci registry docker container ${containerID} ${dockerStopError}`
        )
      }
    },
  }
}

Deno.test({
  name: "should precompile chart during helm deno cm-push",
  ignore: !runAllTests,
  async fn() {
    const helmRegistry = await startHelmRegistry()
    const fetchDirectory = await Deno.makeTempDir({
      prefix: "helm-deno-tests-",
    })

    try {
      const chartPath = path.join(chartsBin, "one-service")

      const { status, stderr } = await runHelmDeno([
        "cm-push",
        chartPath,
        helmRegistry.url,
      ])

      if (!status.success) {
        console.log(stderr)
      }
      assertEquals(status.success, true, "should successfully push")

      const isDenoBundleExists = await exists(
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

      const isDenoBundleInFetchedChartExists = await exists(
        path.join(fetchDirectory, "one-service/deno-bundle.js")
      )
      assertEquals(
        isDenoBundleInFetchedChartExists,
        true,
        "should have file deno-bundle.js in fetched chart"
      )
    } finally {
      await removeIfExists(fetchDirectory)
      await helmRegistry.stop()
    }
  },
})

Deno.test({
  name: "should precompile chart during helm deno push",
  ignore: !runAllTests,
  async fn() {
    const ociRegistry = await startOCIRegistry()
    const fetchDirectory = await Deno.makeTempDir({
      prefix: "helm-deno-tests-",
    })

    try {
      const chartPath = path.join(chartsBin, "one-service")

      const { status, stderr } = await runHelmDeno([
        "push",
        chartPath,
        ociRegistry.url,
      ])

      if (!status.success) {
        console.log(stderr)
      }
      assertEquals(status.success, true, "should successfully push")

      const isDenoBundleExists = await exists(
        path.join(chartPath, "deno-bundle.js")
      )
      assertEquals(
        isDenoBundleExists,
        false,
        "should not have left temporary file deno-bundle.js"
      )

      const isHelmPackageExists = await exists(
        path.join(chartPath, "one-service-1.0.0.tgz")
      )
      assertEquals(
        isHelmPackageExists,
        false,
        "should not have left temporary file one-service-1.0.0.tgz"
      )

      const fetchResult = await runHelmDeno([
        "fetch",
        `${ociRegistry.url}/one-service`,
        "--untar",
        "--untardir",
        fetchDirectory,
      ])
      assertEquals(
        fetchResult.status.success,
        true,
        "should successfully fetch"
      )

      const isDenoBundleInFetchedChartExists = await exists(
        path.join(fetchDirectory, "one-service/deno-bundle.js")
      )
      assertEquals(
        isDenoBundleInFetchedChartExists,
        true,
        "should have file deno-bundle.js in fetched chart"
      )
    } finally {
      await removeIfExists(fetchDirectory)
      await ociRegistry.stop()
    }
  },
})

Deno.test({
  name: "should clean deno-bundle.js if cm-push wasn't successful",
  ignore: !runAllTests,
  async fn() {
    const chartPath = path.join(chartsBin, "one-service")
    const denoBundlePath = path.join(chartPath, "deno-bundle.js")

    try {
      const { status } = await runHelmDeno([
        "cm-push",
        chartPath,
        "http://127.0.0.1:1",
      ])

      if (status.success) {
        assertEquals(status.success, false, "should not successfully push")
      }

      const isDenoBundleExists = await exists(denoBundlePath)
      assertEquals(
        isDenoBundleExists,
        false,
        "should not have left temporary file deno-bundle.js"
      )
    } finally {
      await removeIfExists(denoBundlePath)
    }
  },
})

Deno.test({
  name:
    "should clean deno-bundle.js and helm package if push wasn't successful",
  ignore: !runAllTests,
  async fn() {
    const chartPath = path.join(chartsBin, "one-service")
    const denoBundlePath = path.join(chartPath, "deno-bundle.js")

    try {
      const { status } = await runHelmDeno([
        "push",
        chartPath,
        "http://127.0.0.1:1",
      ])

      if (status.success) {
        assertEquals(status.success, false, "should not successfully push")
      }

      const isDenoBundleExists = await exists(denoBundlePath)
      assertEquals(
        isDenoBundleExists,
        false,
        "should not have left temporary file deno-bundle.js"
      )

      const isHelmPackageExists = await exists(
        path.join(chartPath, "one-service-1.0.0.tgz")
      )
      assertEquals(
        isHelmPackageExists,
        false,
        "should not have left temporary file one-service-1.0.0.tgz"
      )
    } finally {
      await removeIfExists(denoBundlePath)
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
    "should throw error if `--deno-bundle require` have been passed but deno-bundle.js do not exist",
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
    "should not throw error if `--deno-bundle prefer` have been passed and deno-bundle.js do not exist",
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
