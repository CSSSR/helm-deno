export const supportedCommands = ["upgrade", "template", "install"]

export function parseHelmArgs(
  args: readonly string[]
): {
  readonly command: readonly string[]
  readonly releaseName: string
  readonly chartLocation: string
  readonly options: readonly string[]
} {
  const restArgs = args.slice()
  const command: string[] = []

  if (restArgs[0] === "cm-push") {
    return {
      command: ["cm-push"],
      releaseName: "",
      chartLocation: restArgs[1],
      options: restArgs.slice(2),
    }
  }

  if (restArgs[0] === "push") {
    return {
      command: ["push"],
      releaseName: "",
      chartLocation: restArgs[1],
      options: restArgs.slice(2),
    }
  }

  if (restArgs[0] === "secrets") {
    command.push(restArgs.shift() as string)
  }

  if (restArgs[0] === "diff") {
    command.push(restArgs.shift() as string)
  }

  if (supportedCommands.includes(restArgs[0])) {
    command.push(restArgs.shift() as string)
  }

  return {
    command,
    releaseName: restArgs[0],
    chartLocation: restArgs[1],
    options: restArgs.slice(2),
  }
}
