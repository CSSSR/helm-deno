import * as yaml from "https://deno.land/std@0.86.0/encoding/yaml.ts"
import * as fs from "https://deno.land/std@0.86.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.86.0/path/mod.ts"
import type { ChartContext } from "../helm/index.ts"

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
  chartPath: string
) {
  const templateFolderPath = path.join(chartPath, "templates")
  await fs.ensureDir(templateFolderPath)

  const denoTemplateFilePath = path.join(chartPath, "deno-templates/index.ts")
  const denoResources = await import(denoTemplateFilePath).then((chart) => {
    return chart.default(chartContext)
  })

  const templates = denoResources.map(stringifyResource).join("\n---\n")
  await Deno.writeTextFile(
    path.join(templateFolderPath, `rendered-deno-templates.yaml`),
    templates
  )
}
