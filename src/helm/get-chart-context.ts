import type { ChartContext, Release } from "../std/mod.ts"
import * as fs from "https://deno.land/std@0.86.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.86.0/path/mod.ts"
import * as yaml from "https://deno.land/std@0.86.0/encoding/yaml.ts"
import { parseHelmTemplateArgs } from "../args/parse-helm-template-args.ts"
import { ignoreNotFoundError } from "../utils/ignore-not-found-error.ts"

const valuesAndReleaseData = `
kind: ChartContext
spec:
  release: | {{- .Release | toYaml | nindent 4 }}
  values: | {{- .Values | toYaml | nindent 4 }}
`

interface HelmRelease {
  Name: string
  Namespace: string
  IsInstall: string
  IsUpgrade: string
  Revision: number
  Service: string
}

function normalizeRelease(r: HelmRelease): Release {
  return {
    name: r.Name,
    namespace: r.Namespace,
    isInstall: r.IsInstall,
    isUpgrade: r.IsUpgrade,
    revision: r.Revision,
    service: r.Service,
  }
}

export async function getChartContext(
  release: string,
  chartPath: string,
  args: readonly string[]
): Promise<ChartContext> {
  const chartContextTemplatePath = path.join(
    chartPath,
    "templates/values-and-release.yaml"
  )
  try {
    await fs.ensureDir(path.join(chartPath, "templates"))

    await Deno.writeFile(
      chartContextTemplatePath,
      new TextEncoder().encode(valuesAndReleaseData)
    )

    const helm = Deno.env.get("HELM_BIN") as string
    const cmd = Deno.run({
      cmd: [
        helm,
        "template",
        release,
        chartPath,
        ...parseHelmTemplateArgs(args),
      ],
      stdout: "piped",
      stderr: "piped",
    })

    const [output, error, status] = await Promise.all([
      cmd.output(),
      cmd.stderrOutput(),
      cmd.status(),
    ])
    cmd.close()

    const manifests = new TextDecoder().decode(output)
    const errorStr = new TextDecoder().decode(error)

    if (!status.success) {
      return Promise.reject(errorStr)
    }

    // deno-lint-ignore no-explicit-any
    const data = yaml.parseAll(manifests) as any[]

    const x = data.find((doc) => doc.kind === "ChartContext").spec
    return {
      // deno-lint-ignore no-explicit-any
      release: normalizeRelease(yaml.parse(x.release) as any),
      values: yaml.parse(x.values),
    }
  } finally {
    await ignoreNotFoundError(Deno.remove(chartContextTemplatePath))
  }
}