// deno-lint-ignore-file
import * as fs from "https://deno.land/std@0.86.0/fs/mod.ts"
import { parseArgs } from "./args/parse-helm-deno-args.ts"
import { renderDenoChart } from "./lib/deno/index.ts"
import {
  checkChartPath,
  fetchChart,
  getReleaseAndValues as getChartContext,
  helmExecute,
  ignoreNotFoundError,
} from "./lib/helm/index.ts"

const supportedHelmCommand = ["template", "install", "upgrade"]

function helmDenoUsage() {
  const pluginUsage = `
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

function getArgsWithoutPlugins(args: string[]): string[] {
  // TODO: get current installed plugins
  const plugins = ["conftest", "diff", "push", "secrets"]

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg.startsWith("-")) {
      continue
    }

    if (plugins.some((plugin) => plugin === arg)) {
      return getArgsWithoutPlugins([...args.slice(0, i - 1), ...args.slice(i)])
    }

    break
  }

  return args
}

function normalizeArgs(args: string[]): string[] {
  return getArgsWithoutPlugins(args)
}

async function main() {
  const { helmArgs: args, options } = parseArgs(normalizeArgs(Deno.args))
  const debug: typeof console.error = (...args) => {
    if (options.logLevel === "debug") {
      console.error(...args)
    }
  }
  debug(`Running with options:\n${JSON.stringify(options, null, 2)}`)

  const helmCommand = args[0]
  const releaseName = args[1]
  const chartPath = args[2]

  if (!helmCommand || helmCommand === "-h" || helmCommand === "--help") {
    helmDenoUsage()
    return
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

  debug(`Temporary directory ${workdir} has been created`)
  const isLocalChart = isChartExist(chartPath)

  try {
    // Fetch chart into temporaty directory
    if (isLocalChart) {
      debug(`Copying chart ${chartPath} to temporary directory`)
      await copyChart(chartPath, workdir)
      debug(`Successfuly copied chart ${chartPath} to temporary directory`)
    } else {
      debug(`Fetching chart ${chartPath} to temporary directory`)
      await fetchChart(chartPath, workdir)
      debug(`Successfuly fetched chart ${chartPath} to temporary directory`)
    }

    const chartContext = await getChartContext(releaseName, workdir, args)
    debug(`Chart context:\n${JSON.stringify(chartContext, null, 2)}`)

    await renderDenoChart(chartContext, workdir)
    debug("Deno templates were successfuly rendered")

    debug(
      `Executing: ${helmCommand} ${releaseName} ${workdir} ${args
        .slice(3)
        .join(" ")}`
    )
    await helmExecute(helmCommand, releaseName, workdir, args.slice(3))
  } catch (err) {
    if (err?.message) {
      // Replace paths in stacktrace with readable versions
      err.message = isLocalChart
        ? err.message.replaceAll(workdir, chartPath)
        : err.message.replaceAll(`file://${workdir}`, "<chart-root>")
    }
    throw err
  } finally {
    // Remove temporary directory
    await ignoreNotFoundError(Deno.remove(workdir, { recursive: true }))
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    Deno.exit(1)
  })
}
