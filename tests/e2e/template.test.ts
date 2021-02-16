import * as path from "https://deno.land/std@0.86.0/path/mod.ts"
import * as yaml from "https://deno.land/std@0.86.0/encoding/yaml.ts"
import { assertEquals } from "https://deno.land/std@0.86.0/testing/asserts.ts"

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
  "helm deno template charts/one-service --set selector.app=my-app",
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
