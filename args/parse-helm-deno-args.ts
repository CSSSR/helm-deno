import args from "https://deno.land/x/args@2.0.7/wrapper.ts"
import { PartialOption } from "https://deno.land/x/args@2.0.7/flag-types.ts"
import { Choice } from "https://deno.land/x/args@2.0.7/value-types.ts"

type LogLevel = "info" | "debug"
export interface HelmDenoOptions {
  readonly logLevel: LogLevel
}

const parser = args.describe("Add or subtract two numbers").with(
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

function toEnum<T>(value: string): T {
  // deno-lint-ignore no-explicit-any
  return value as any
}

interface ParseArgsResult {
  readonly options: HelmDenoOptions
  readonly helmArgs: readonly string[]
}

export function parseArgs(args: string[]): ParseArgsResult {
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
    },
    helmArgs: res.remaining().rawArgs(),
  }
}
