import { isSigterm } from "../utils/process.ts"

export async function helmExecute(
  args: readonly string[],
  { autoExitOnError = false }: { autoExitOnError?: boolean } = {}
): Promise<{ exitCode?: number }> {
  const helm = Deno.env.get("HELM_BIN") as string
  const cmd = Deno.run({
    cmd: [helm, ...args],
    stdout: "inherit",
    stderr: "inherit",
  })

  const status = await cmd.status()
  if (!status.success) {
    if (isSigterm(status.signal)) {
      console.error("Child process terminated via SIGTERM")
    }

    if (autoExitOnError) {
      Deno.exit(status.code)
    }
    return { exitCode: status.code }
  }

  return {}
}
