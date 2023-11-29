import {
  BinaryFlag,
  PartialOption,
} from "https://deno.land/x/args@2.1.1/flag-types.ts"
import { Text } from "https://deno.land/x/args@2.1.1/value-types.ts"
import args from "https://deno.land/x/args@2.1.1/wrapper.ts"

const textOption = (flag: string) =>
  PartialOption(flag, {
    type: Text,
    default: "",
  })

const parser = args
  .describe("")
  .with(textOption("ca-file"))
  .with(textOption("cert-file"))
  .with(BinaryFlag("devel"))
  .with(BinaryFlag("insecure-skip-tls-verify"))
  .with(textOption("key-file"))
  .with(textOption("keyring"))
  .with(textOption("password"))
  .with(textOption("repo"))
  .with(textOption("username"))
  .with(BinaryFlag("verify"))
  .with(textOption("version"))
  .with(textOption("registry-config"))
  .with(textOption("repository-cache"))
  .with(textOption("repository-config"))

export function parseHelmFetchArgs(args: readonly string[]): readonly string[] {
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
