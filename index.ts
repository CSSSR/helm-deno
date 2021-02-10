import * as fs from "https://deno.land/std@0.70.0/fs/mod.ts"
import { prepareDenoChart, renderDenoChart } from "./lib/deno/index.ts"
import {
  checkChartPath,
  fetchChart,
  helmTemplate,
  helmExecute,
} from "./lib/helm/index.ts"

const supportedHelmCommand = ["template", "install", "upgrade"]

function helmDenoUsage() {
  const pluginUsage = `
helm deno $1

This is a wrapper for "helm [command]". It will use Deno for rendering charts
before running "helm [command]"

Supported helm [command] is:
  - template
  - install
  - upgrade

You must use the options of the supported commands in strict order:
  $ helm [command] [RELEASE] [CHART] [flags]

Example:
  $ helm deno upgrade <HELM UPGRADE OPTIONS>

Typical usage:
  $ helm deno upgrade ingress stable/nginx-ingress -f values.yaml
`
  console.log(pluginUsage)
  Deno.exit(0)
}

async function copyChart(path: string, destination: string) {
  const destinationExists = await fs.exists(path)
  if (!destinationExists) {
    return Promise.reject(`Could not find ${path}`)
  }
  await withErrorMsg(
    fs.copy(path, destination, { overwrite: true }),
    "Cloud not copy chart directory"
  )
}

async function isChartExist(path: string) {
  try {
    await checkChartPath(path)
    return true
  } catch (err) {
    return false
  }
}

function withErrorMsg<T>(p: Promise<T>, msg: string): Promise<T> {
  return p.catch((err) => Promise.reject(`${msg}: ${err}`))
}

async function main() {
  const helmCommand = Deno.args[0]
  const releaseName = Deno.args[1]
  const chartPath = Deno.args[2]

  if (!helmCommand || helmCommand === "-h" || helmCommand === "--help") {
    helmDenoUsage()
  }

  if (!supportedHelmCommand.includes(helmCommand)) {
    throw new Error(
      `${helmCommand} command not supported, please check documentation.`
    )
  }

  const workdir = await withErrorMsg(
    Deno.makeTempDir({ prefix: "chart-" }),
    "Could not create temp directory"
  )

  try {
    // Fetch chart into temporaty directory
    if (isChartExist(chartPath)) {
      await copyChart(chartPath, workdir)
    } else {
      await fetchChart(chartPath, workdir)
    }

    // Create values-and-release.yaml file in temporaty directory
    await prepareDenoChart(workdir)

    // Render values-and-release.yaml
    const manifests = await helmTemplate(
      releaseName,
      workdir,
      Deno.args.slice(3)
    )

    // Render deno source code
    await renderDenoChart(manifests, workdir)

    // Execute helm command
    await helmExecute(helmCommand, releaseName, workdir, Deno.args.slice(3))
  } finally {
    // Remove temporary directory
    await Deno.remove(workdir, { recursive: true })
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    Deno.exit(1)
  })
}
