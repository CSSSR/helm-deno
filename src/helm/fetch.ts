import * as fs from "https://deno.land/std@0.86.0/fs/mod.ts"

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
