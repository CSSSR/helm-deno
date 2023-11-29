import { copy } from "https://deno.land/std@0.208.0/fs/copy.ts"
import { exists } from "https://deno.land/std@0.208.0/fs/exists.ts"
import * as path from "https://deno.land/std@0.208.0/path/mod.ts"
import * as yaml from "https://deno.land/std@0.208.0/yaml/mod.ts"
import { withErrorMsg } from "../std/mod.ts"
import { ignoreNotFoundError } from "../utils/ignore-not-found-error.ts"
import { Chart } from "./chart-types.ts"

export async function copyChart(chartPath: string, destination: string) {
  const destinationExists = await exists(chartPath)
  if (!destinationExists) {
    return Promise.reject(`Could not find ${chartPath}`)
  }
  await withErrorMsg(
    copy(chartPath, destination, { overwrite: true }),
    "Could not copy chart directory"
  )
}

export async function isChartExist(chartPath: string) {
  const chartYamlPath = path.join(chartPath, "Chart.yaml")
  return await exists(chartYamlPath)
}

export async function getChartPackagePath(chartPath: string): Promise<string> {
  const chartYamlPath = path.join(chartPath, "Chart.yaml")
  const chartYaml = await Deno.readTextFile(chartYamlPath)
  const chartData = yaml.parse(chartYaml) as Chart

  return path.join(chartPath, `${chartData.name}-${chartData.version}.tgz`)
}

export async function cleanupChartPackage(
  chartPackagePath: string
): Promise<void> {
  await ignoreNotFoundError(Deno.remove(chartPackagePath))
}
