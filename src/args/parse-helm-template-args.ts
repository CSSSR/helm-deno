import { CollectOption } from "https://deno.land/x/args@2.1.1/flag-types.ts"
import { Text } from "https://deno.land/x/args@2.1.1/value-types.ts"
import args from "https://deno.land/x/args@2.1.1/wrapper.ts"

const textOption = (flag: string, alias?: readonly string[]) =>
  CollectOption(flag, {
    type: Text,
    alias,
  })

const parser = args
  .describe("")
  .with(textOption("set"))
  .with(textOption("values", ["f"]))
  .with(textOption("set-file"))
  .with(textOption("set-string"))

export function parseHelmTemplateArgs(
  args: readonly string[]
): readonly string[] {
  const res = parser.parse(args)
  if (res.error) {
    res.error?.errors.forEach((err) => {
      console.error(err)
    })
    // TODO: return errors
    throw new Error("Has errors")
  }

  return [...res.consumedArgs.values()].map((v) => v.raw)
}
