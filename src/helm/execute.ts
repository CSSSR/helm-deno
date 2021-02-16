export async function helmExecute(args: string[]): Promise<void> {
  const helm = Deno.env.get("HELM_BIN") as string
  const cmd = Deno.run({
    cmd: [helm, ...args],
    stdout: "inherit",
    stderr: "inherit",
  })

  const status = await cmd.status()
  if (!status.success) {
    Deno.exit(status.code)
  }
}
