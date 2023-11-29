import { copy } from "https://deno.land/std@0.208.0/fs/copy.ts"
import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts"
import * as path from "https://deno.land/std@0.208.0/path/mod.ts"
import * as yaml from "https://deno.land/std@0.208.0/yaml/mod.ts"
import { parseHelmTemplateArgs } from "../args/parse-helm-template-args.ts"
import type { ChartContext, Release } from "../std/mod.ts"
import { ignoreNotFoundError } from "../utils/ignore-not-found-error.ts"
import { waitForProcess } from "../utils/process.ts"

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
  tmpDir: string,
  chartDir: string,
  commands: readonly string[],
  args: readonly string[]
): Promise<ChartContext> {
  const getValuesChartDir = path.join(tmpDir, "get-values-chart")
  try {
    await copy(chartDir, getValuesChartDir)
    const getValuesTemplatesDir = path.join(getValuesChartDir, "templates")
    await ignoreNotFoundError(
      Deno.remove(getValuesTemplatesDir, { recursive: true })
    )
    await ensureDir(getValuesTemplatesDir)

    await Deno.writeFile(
      path.join(getValuesChartDir, "templates/values-and-release.yaml"),
      new TextEncoder().encode(valuesAndReleaseData)
    )

    await Deno.writeFile(
      path.join(getValuesChartDir, "Chart.yaml"),
      new TextEncoder().encode(
        "apiVersion: v2\nname: get-values\nversion: 1.0.0"
      )
    )

    const helm = Deno.env.get("HELM_BIN") as string
    const cmd = Deno.run({
      cmd: [
        helm,
        ...(commands.includes("secrets") ? ["secrets"] : []),
        "template",
        release,
        getValuesChartDir,
        ...parseHelmTemplateArgs(args),
      ],
      stdout: "piped",
      stderr: "piped",
    })

    const { stdout: manifests } = await waitForProcess(cmd, {
      autoReject: true,
    })

    // deno-lint-ignore no-explicit-any
    const data = yaml.parseAll(manifests) as any[]

    const x = data.find((doc) => doc.kind === "ChartContext").spec
    return {
      // deno-lint-ignore no-explicit-any
      release: normalizeRelease(yaml.parse(x.release) as any),
      values: yaml.parse(x.values),
    }
  } finally {
    await ignoreNotFoundError(
      Deno.remove(getValuesChartDir, { recursive: true })
    )
  }
}
