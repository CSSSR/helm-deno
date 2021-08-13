import * as fs from "https://deno.land/std@0.93.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.93.0/path/mod.ts"
import { parseHelmFetchArgs } from "../args/parse-helm-fetch-args.ts"
import { withErrorMsg } from "../std/mod.ts"
import { waitForProcess } from "../utils/process.ts"

export async function fetchChart(
  chartBlob: string,
  tmpDirectory: string,
  chartPath: string,
  args: readonly string[]
): Promise<void> {
  const destinationExists = await fs.exists(tmpDirectory)
  if (!destinationExists) {
    return Promise.reject(`Could not find ${tmpDirectory}`)
  }
  const fetchDestination = path.join(tmpDirectory, "fetch-destination")

  const helm = Deno.env.get("HELM_BIN") as string
  const cmd = Deno.run({
    cmd: [
      helm,
      "fetch",
      chartBlob,
      "--untar",
      "--untardir",
      fetchDestination,
      ...parseHelmFetchArgs(args),
    ],
    stdout: "piped",
    stderr: "piped",
  })

  await waitForProcess(cmd, { autoReject: true })

  const directories = []
  for await (const file of fs.expandGlob("*/", {
    root: fetchDestination,
  })) {
    if (file.isDirectory && !file.path.endsWith(".tgz")) {
      directories.push(file.path)
    }
  }

  if (directories.length !== 1) {
    throw new Error("Found more then one directory")
  }

  await withErrorMsg(
    fs.copy(directories[0], chartPath),
    `Could not fetch chart ${chartBlob}`
  )
}
