import * as fs from "https://deno.land/std@0.86.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.86.0/path/mod.ts"
import * as yaml from "https://deno.land/std@0.86.0/encoding/yaml.ts"
import { parseHelmTemplateArgs } from "../../args/parse-helm-template-args.ts"

export async function checkChartPath(chartPath: string) {
  if (!chartPath) {
    return Promise.reject("Chart path must be specified")
  }

  const chartYamlPath = path.join(chartPath, "Chart.yaml")
  const chartExists = await fs.exists(chartYamlPath)

  if (!chartExists) {
    return Promise.reject(`Could not find ${chartYamlPath}`)
  }
}

export async function fetchChart(chartPath: string, destination: string) {
  const destinationExists = await fs.exists(chartPath)
  if (!destinationExists) {
    return Promise.reject(`Could not find ${chartPath}`)
  }

  const helm = Deno.env.get("HELM_BIN")!
  const cmd = Deno.run({
    cmd: [helm, "fetch", chartPath, "--untar", "--untardir", destination],
    stdout: "piped",
    stderr: "piped",
  })

  const error = await cmd.stderrOutput()
  const errorStr = new TextDecoder().decode(error)

  cmd.close()

  if (errorStr) {
    return Promise.reject(errorStr)
  }
}

export async function helmExecute(args: string[]) {
  const helm = Deno.env.get("HELM_BIN")!
  const cmd = Deno.run({
    cmd: [helm, ...args],
    stdout: "inherit",
    stderr: "inherit",
  })

  const status = await cmd.status()
  if (!status.success) {
    Deno.exit(status.code)
  }
}

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

interface Release {
  name: string
  namespace: string
  isInstall: string
  isUpgrade: string
  revision: number
  service: string
}

export interface ChartContext {
  release: Release
  // deno-lint-ignore no-explicit-any
  values: any
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

export function ignoreNotFoundError(promise: Promise<void>): Promise<void> {
  return promise.catch((err) => {
    if (!(err instanceof Deno.errors.NotFound)) {
      return Promise.reject(err)
    }
  })
}

export async function getReleaseAndValues(
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

    const helm = Deno.env.get("HELM_BIN")!
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
