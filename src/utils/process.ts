import { toText } from "./text.ts"

export function isSigterm(signal: number | undefined) {
  return signal === 15
}

export async function waitForProcess(
  ps: Deno.Process,
  opts: { autoReject?: boolean } = {}
) {
  const [status, output, error] = await Promise.all([
    ps.status(),
    ps.output(),
    ps.stderrOutput(),
  ])
  ps.close()

  const stdout = toText(output)
  let stderr = toText(error)
  if (isSigterm(status.signal)) {
    stderr = `Child process terminated via SIGTERM\n${stderr}`
  }

  if (opts.autoReject) {
    if (!status.success) {
      console.log(stdout)
      return Promise.reject(stderr)
    }
  }

  return { status, stdout, stderr }
}
