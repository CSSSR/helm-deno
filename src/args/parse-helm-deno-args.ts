import args from "https://deno.land/x/args@2.0.7/wrapper.ts"
import {
  PartialOption,
  BinaryFlag,
} from "https://deno.land/x/args@2.0.7/flag-types.ts"
import { Choice, Text } from "https://deno.land/x/args@2.0.7/value-types.ts"

type LogLevel = "info" | "debug"
export interface HelmDenoOptions {
  readonly logLevel: LogLevel
  readonly keepTmpChart: boolean
  readonly importMap: string
  readonly useBundle: boolean
}

const parser = args
  .describe("Add or subtract two numbers")
  .with(
    PartialOption("deno-log-level", {
      type: Choice<LogLevel>(
        {
          value: "debug",
          describe: "Log everything",
        },
        {
          value: "info",
          describe: "Log only important",
        }
      ),
      default: "info",
      describe: "Log level",
    })
  )
  .with(
    BinaryFlag("deno-keep-tmp-chart", {
      describe: "Keep downloaded chart in temporary directory",
    })
  )
  .with(
    PartialOption("deno-import-map", {
      type: Text,
      default: "",
      describe: "Path to import_map.json",
    })
  )
  .with(
    BinaryFlag("deno-use-bundle", {
      describe:
        "Use prebundled chart. File <chart>/deno-bundle.js is required for that. deno-bundle.js is automaticly created by `helm deno push`",
    })
  )

function toEnum<T>(value: string): T {
  // deno-lint-ignore no-explicit-any
  return value as any
}

interface ParseArgsResult {
  readonly options: HelmDenoOptions
  readonly helmArgs: readonly string[]
}

export function parseArgs(args: readonly string[]): ParseArgsResult {
  const res = parser.parse(args)
  if (res.error) {
    res.error?.errors.forEach((err) => {
      console.error(err)
    })
    // TODO: return errors
    throw new Error("Has errors")
  }

  return {
    options: {
      logLevel: toEnum(res.value?.["deno-log-level"]) || "info",
      keepTmpChart: !!res.value?.["deno-keep-tmp-chart"],
      importMap: res.value?.["deno-import-map"],
      useBundle: !!res.value?.["deno-keep-tmp-chart"],
    },
    helmArgs: res.remaining().rawArgs(),
  }
}
