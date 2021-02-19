import * as fs from "https://deno.land/std@0.86.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.86.0/path/mod.ts"
import { parseHelmFetchArgs } from "../args/parse-helm-fetch-args.ts"
import { withErrorMsg } from "../std/mod.ts"

export async function fetchChart(
  chartPath: string,
  destination: string,
  args: readonly string[]
): Promise<void> {
  const destinationExists = await fs.exists(destination)
  if (!destinationExists) {
    return Promise.reject(`Could not find ${destination}`)
  }

  const helm = Deno.env.get("HELM_BIN") as string
  const cmd = Deno.run({
    cmd: [
      helm,
      "fetch",
      chartPath,
      "--untar",
      "--untardir",
      destination,
      ...parseHelmFetchArgs(args),
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
    console.log(new TextDecoder().decode(output))
    return Promise.reject(new TextDecoder().decode(error))
  }

  await withErrorMsg(
    fs.copy(path.join(destination, chartPath), destination, {
      overwrite: true,
    }),
    `Could not fetch chart ${chartPath}`
  )
}
