export function parseHelmArgs(
  args: readonly string[]
): {
  command: string[]
  releaseName: string
  chartLocation: string
  options: readonly string[]
} {
  if (args[0] === "diff") {
    return {
      command: args.slice(0, 2),
      releaseName: args[2],
      chartLocation: args[3],
      options: args.slice(4),
    }
  }

  return {
    command: args.slice(0, 1),
    releaseName: args[1],
    chartLocation: args[2],
    options: args.slice(3),
  }
}
