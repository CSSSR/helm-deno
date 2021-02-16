import type { ChartContext, Release } from "../std/mod.ts"
import * as fs from "https://deno.land/std@0.86.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.86.0/path/mod.ts"
import * as yaml from "https://deno.land/std@0.86.0/encoding/yaml.ts"
import { parseHelmTemplateArgs } from "../../args/parse-helm-template-args.ts"

export async function fetchChart(
  chartPath: string,
  destination: string
): Promise<void> {
  const destinationExists = await fs.exists(chartPath)
  if (!destinationExists) {
    return Promise.reject(`Could not find ${chartPath}`)
  }

  const helm = Deno.env.get("HELM_BIN") as string
  const cmd = Deno.run({
    cmd: [helm, "fetch", chartPath, "--untar", "--untardir", destination],
    stdout: "piped",
    stderr: "piped",
  })

  const [status, output, error] = await Promise.all([
    cmd.status(),
    cmd.output(),
    cmd.stderrOutput(),
  ])
  cmd.close()

  if (!status.success) {
    console.log(new TextDecoder().decode(output))
    return Promise.reject(new TextDecoder().decode(error))
  }
}

export async function helmExecute(args: string[]): Promise<void> {
  const helm = Deno.env.get("HELM_BIN") as string
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
