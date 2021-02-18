import type { ChartContext } from "../std/mod.ts"
import { HelmDenoOptions } from "../args/parse-helm-deno-args.ts"
import * as yaml from "https://deno.land/std@0.86.0/encoding/yaml.ts"
import * as fs from "https://deno.land/std@0.86.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.86.0/path/mod.ts"

// deno-lint-ignore no-explicit-any
function stringifyResource(manifest: any): string {
  return yaml.stringify(manifest, {
    lineWidth: -1,
    noRefs: true,
    skipInvalid: true,
    sortKeys: true,
  })
}

export async function renderDenoChart(
  chartContext: ChartContext,
  chartPath: string,
  denoOptions: HelmDenoOptions
): Promise<void> {
  const templateFolderPath = path.join(chartPath, "templates")
  await fs.ensureDir(templateFolderPath)

  const denoTemplateFilePath = path.join(chartPath, "deno-templates/index.ts")
  const isDenoChart = await fs.exists(denoTemplateFilePath)
  if (!isDenoChart) {
    return
  }
  const pluginFolderPath = Deno.env.get("HELM_PLUGIN_DIR") || ""

  const deno = path.join(pluginFolderPath, "bin/deno")
  const importer = path.join(pluginFolderPath, "src/deno/import-chart.ts")

  const isImportMap = await fs.exists(denoOptions.importMap)
  const importmap =
    denoOptions.importMap && isImportMap
      ? ["--importmap", denoOptions.importMap]
      : []

  const cmd = Deno.run({
    cmd: [
      deno,
      "run",
      "--unstable",
      "--allow-net",
      "--allow-read",
      "--allow-write",
      "--allow-run",
      "--allow-env",
      "--quiet",
      ...importmap,
      importer,
      JSON.stringify({
        chartPath: denoTemplateFilePath,
        chartContext: chartContext,
      }),
    ],
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
    return Promise.reject(new TextDecoder().decode(error))
  }

  const denoResources = JSON.parse(new TextDecoder().decode(output))
  const templates = denoResources.map(stringifyResource).join("\n---\n")
  await Deno.writeTextFile(
    path.join(templateFolderPath, `import-rendered-templates.yaml`),
    '{{ .Files.Get "rendered-deno-templates.yaml" }}'
  )
  await Deno.writeTextFile(
    path.join(chartPath, `rendered-deno-templates.yaml`),
    templates
  )
}
