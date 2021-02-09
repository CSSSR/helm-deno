import * as yaml from "https://deno.land/std@0.70.0/encoding/yaml.ts"

// deno-lint-ignore no-explicit-any
export type Manifest = any

export function stringifyResource(manifest: Manifest): string {
  return yaml.stringify(manifest, {
    lineWidth: -1,
    noRefs: true,
    skipInvalid: true,
    sortKeys: true,
  })
}
