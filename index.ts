import * as path from "https://deno.land/std@0.70.0/path/mod.ts"
import { compileDenoChart } from "./lib/compiler/index.ts"
import { renderDenoChart } from "./lib/renderer/index.ts"
import { helmTemplate, helmExecute } from "./lib/common/helm.ts"

function helmDenoUsage() {
  const pluginUsage = `
helm deno $1

This is a wrapper for "helm [command]". It will use Deno for rendering charts
before running "helm [command]".

Example:
  $ helm deno upgrade <HELM UPGRADE OPTIONS>
  $ helm deno lint <HELM LINT OPTIONS>

Typical usage:
  $ helm deno upgrade i1 stable/nginx-ingress -f values.test.yaml
  $ helm deno lint ./my-chart -f values.test.yaml
`
  console.log(pluginUsage)
  Deno.exit(0)
}

async function main() {
  const denoArgs = Deno.args[0]
  const chartPath = Deno.args[2]

  if (!denoArgs) {
    helmDenoUsage()
  }

  await compileDenoChart(Deno.args[2])

  const manifests = await helmTemplate(Deno.args)

  await renderDenoChart(manifests, chartPath)

  await helmExecute(Deno.args)

  // Remove templates directory
  await Deno.remove(path.join(chartPath, "./templates"), { recursive: true })
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    Deno.exit(1)
  })
}
