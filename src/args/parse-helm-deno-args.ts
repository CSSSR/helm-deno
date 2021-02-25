import args from "https://deno.land/x/args@2.0.7/wrapper.ts"
import {
  PartialOption,
  BinaryFlag,
} from "https://deno.land/x/args@2.0.7/flag-types.ts"
import { Choice, Text } from "https://deno.land/x/args@2.0.7/value-types.ts"

type LogLevel = "info" | "debug"

type BundlePolicy = "ignore" | "prefer" | "require"
export interface HelmDenoOptions {
  readonly logLevel: LogLevel
  readonly keepTmpChart: boolean
  readonly importMap: string
  readonly bundlePolicy: BundlePolicy
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
      default: "info" as LogLevel,
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
    PartialOption("deno-bundle", {
      type: Choice<BundlePolicy>(
        {
          value: "ignore",
          describe: "Do not use prebundled code. This is a default behavior",
        },
        {
          value: "require",
          describe:
            "Require chart to be prebundled, exit with status code 1 otherwise ",
        },
        {
          value: "prefer",
          describe: "Use deno-bundle.js if it exists",
        }
      ),
      default: "ignore" as BundlePolicy,
      describe: "Use prebundled chart code instead of original one",
    })
  )

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
      logLevel: res.value?.["deno-log-level"],
      keepTmpChart: !!res.value?.["deno-keep-tmp-chart"],
      importMap: res.value?.["deno-import-map"],
      bundlePolicy: res.value?.["deno-bundle"],
    },
    helmArgs: res.remaining().rawArgs(),
  }
}
