import type { ChartContext } from "../std/mod.ts"
import type { HelmDenoOptions } from "../args/parse-helm-deno-args.ts"
import * as yaml from "https://deno.land/std@0.86.0/encoding/yaml.ts"
import * as fs from "https://deno.land/std@0.86.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.86.0/path/mod.ts"
import { ignoreNotFoundError } from "../utils/ignore-not-found-error.ts"

// deno-lint-ignore no-explicit-any
function stringifyResource(manifest: any): string {
  return yaml.stringify(manifest, {
    lineWidth: -1,
    noRefs: true,
    skipInvalid: true,
    sortKeys: true,
  })
}

async function getImportMapFlags(denoOptions: HelmDenoOptions) {
  if (!denoOptions.importMap) {
    return []
  }

  const hasImportMap = await fs.exists(denoOptions.importMap)

  if (!hasImportMap) {
    throw new Error(`Could not find import map ${denoOptions.importMap}`)
  }

  const importMapArgs =
    denoOptions.importMap && hasImportMap
      ? ["--importmap", denoOptions.importMap]
      : []

  return importMapArgs
}

async function getDenoTemplateFilePath(
  chartPath: string,
  denoOptions: HelmDenoOptions
) {
  const { bundlePath, indexFilePath } = getPaths(chartPath)
  if (denoOptions.bundlePolicy === "ignore") {
    return indexFilePath
  }

  const bundleExists = await fs.exists(bundlePath)

  if (denoOptions.bundlePolicy === "require") {
    if (!bundleExists) {
      throw new Error("Bundle for chart does not exist")
    }
    return bundlePath
  }

  if (denoOptions.bundlePolicy === "prefer") {
    return bundleExists ? bundlePath : indexFilePath
  }
}

function getPaths(chartPath: string) {
  const pluginFolderPath = Deno.env.get("HELM_PLUGIN_DIR") || ""
  const bundlePath = path.join(chartPath, "deno-bundle.js")
  const indexFilePath = path.join(chartPath, "deno-templates/index.ts")

  return {
    pluginFolderPath,
    bundlePath,
    indexFilePath,
    templateFolderPath: path.join(chartPath, "templates"),
    deno: path.join(pluginFolderPath, "bin/deno"),
    importer: path.join(pluginFolderPath, "src/deno/import-chart.ts"),
  }
}

export async function bundleChart(
  chartPath: string,
  denoOptions: HelmDenoOptions
): Promise<void> {
  const { deno, bundlePath, indexFilePath } = getPaths(chartPath)
  const cmd = Deno.run({
    cmd: [
      deno,
      "bundle",
      "--unstable",
      "--quiet",
      ...(await getImportMapFlags(denoOptions)),
      indexFilePath,
      bundlePath,
    ],
    stdout: "piped",
    stderr: "piped",
  })

  const [status, , error] = await Promise.all([
    cmd.status(),
    cmd.output(),
    cmd.stderrOutput(),
  ])
  cmd.close()

  if (!status.success) {
    throw new Error(new TextDecoder().decode(error))
  }
}

export async function cleanupBundle(chartPath: string): Promise<void> {
  const { bundlePath } = getPaths(chartPath)
  await ignoreNotFoundError(Deno.remove(bundlePath))
}

export async function renderDenoChart(
  chartContext: ChartContext,
  chartPath: string,
  denoOptions: HelmDenoOptions
): Promise<void> {
  const {
    deno,
    importer,
    templateFolderPath,
    bundlePath,
    indexFilePath,
  } = getPaths(chartPath)
  await fs.ensureDir(templateFolderPath)

  const isDenoChart =
    (await fs.exists(bundlePath)) || (await fs.exists(indexFilePath))
  if (!isDenoChart) {
    return
  }

  const denoTemplateFilePath = await getDenoTemplateFilePath(
    chartPath,
    denoOptions
  )

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
      ...(await getImportMapFlags(denoOptions)),
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
