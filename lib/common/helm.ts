import * as fs from "https://deno.land/std@0.70.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.70.0/path/mod.ts"


export async function checkChartPath(chartPath: string) {
  if (!chartPath) {
    return Promise.reject("Chart path must be specified")
  }

  const chartYamlPath = path.join(chartPath, "Chart.yaml")
  const chartExists = await fs.exists(chartYamlPath)

  if (!chartExists) {
    return Promise.reject(`Cloud not find ${chartYamlPath}`)
  }
}

export async function helmTemplate(options: string[]): Promise<string> {
  const helm = Deno.env.get("HELM_BINARY") || "helm3"
  const cmd = Deno.run({
    cmd: [helm, ...options],
    stdout: "piped",
    stderr: "piped",
  })

  const output = await cmd.output()
  const manifests = new TextDecoder().decode(output)

  const error = await cmd.stderrOutput()
  const errorStr = new TextDecoder().decode(error)

  cmd.close()

  if (errorStr) {
    return Promise.reject(errorStr)
  }

  return manifests
}

export async function helmExecute(options: string[]) {
  const helm = Deno.env.get("HELM_BINARY") || "helm3"
  const cmd = Deno.run({
    cmd: [helm, ...options],
    stdout: "piped",
    stderr: "piped",
  })

  const output = await cmd.output()
  const outputStr = new TextDecoder().decode(output)

  const error = await cmd.stderrOutput()
  const errorStr = new TextDecoder().decode(error)

  cmd.close()

  if (errorStr) {
    throw new Error(errorStr)
  }

  console.log(outputStr)
}
