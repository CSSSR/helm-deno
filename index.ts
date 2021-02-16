// deno-lint-ignore-file
import * as fs from "https://deno.land/std@0.86.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.86.0/path/mod.ts"
import { parseHelmArgs } from "./args/parse-helm-args.ts"
import { parseArgs } from "./args/parse-helm-deno-args.ts"
import { renderDenoChart } from "./lib/deno/index.ts"
import {
  fetchChart,
  getReleaseAndValues as getChartContext,
  helmExecute,
  ignoreNotFoundError,
} from "./lib/helm/index.ts"

function helmDenoUsage() {
  const pluginUsage = `
This is a wrapper for "helm [command]". It will use Deno for rendering charts
before running "helm [command]"

Supported helm [command] is:
  - template
  - install
  - upgrade
  - diff (helm plugin)
  - secrets (helm plugin)

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

async function copyChart(chartPath: string, destination: string) {
  const destinationExists = await fs.exists(chartPath)
  if (!destinationExists) {
    return Promise.reject(`Could not find ${chartPath}`)
  }
  await withErrorMsg(
    fs.copy(chartPath, destination, { overwrite: true }),
    "Cloud not copy chart directory"
  )
}

async function isChartExist(chartPath: string) {
  const chartYamlPath = path.join(chartPath, "Chart.yaml")
  return await fs.exists(chartYamlPath)
}

function withErrorMsg<T>(p: Promise<T>, msg: string): Promise<T> {
  return p.catch((err) => Promise.reject(`${msg}: ${err}`))
}

async function main() {
  const { helmArgs: args, options } = parseArgs(Deno.args)
  const startTime = Date.now()
  const debug: typeof console.error = (...args) => {
    if (options.logLevel === "debug") {
      console.error(`[${Date.now() - startTime} ms]`, ...args)
    }
  }
  debug(`Running with options:\n${JSON.stringify(options, null, 2)}`)

  if (!args[0] || args[0] === "-h" || args[0] === "--help") {
    helmDenoUsage()
    return
  }

  const {
    command,
    releaseName,
    chartLocation,
    options: helmRestArgs,
  } = parseHelmArgs(args)

  // TODO: validate command is allowed

  const workdir = await withErrorMsg(
    Deno.makeTempDir({ prefix: "chart-" }),
    "Could not create temp directory"
  )

  debug(`Temporary directory ${workdir} has been created`)
  const isLocalChart = isChartExist(chartLocation)

  try {
    // Fetch chart into temporaty directory
    if (isLocalChart) {
      debug(`Copying chart ${chartLocation} to temporary directory`)
      await copyChart(chartLocation, workdir)
      debug(`Successfuly copied chart ${chartLocation} to temporary directory`)
    } else {
      debug(`Fetching chart ${chartLocation} to temporary directory`)
      await fetchChart(chartLocation, workdir)
      debug(`Successfuly fetched chart ${chartLocation} to temporary directory`)
    }

    const chartContext = await getChartContext(releaseName, workdir, args)
    debug(`Chart context:\n${JSON.stringify(chartContext, null, 2)}`)

    await renderDenoChart(chartContext, workdir)
    debug("Deno templates were successfuly rendered")

    const helmExecuteArgs = [...command, releaseName, workdir, ...helmRestArgs]
    debug(`Executing: ${helmExecuteArgs.join(" ")}`)
    await helmExecute(helmExecuteArgs)

    debug("Success")
  } catch (err) {
    const replaceChartPath = (str: string) => {
      return isLocalChart
        ? str.replaceAll(workdir, chartLocation)
        : str.replaceAll(`file://${workdir}`, "<chart-root>")
    }

    // Replace paths in stacktrace with readable value
    if (err?.stack) {
      err.stack = replaceChartPath(err.stack)
    }

    throw err
  } finally {
    if (!options.keepTmpChart) {
      // Remove temporary directory
      await ignoreNotFoundError(Deno.remove(workdir, { recursive: true }))
    }
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    Deno.exit(1)
  })
}
