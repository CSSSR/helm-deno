// deno-lint-ignore-file
import * as path from "https://deno.land/std@0.160.0/path/mod.ts"
import { parseHelmArgs, supportedCommands } from "./args/parse-helm-args.ts"
import { parseArgs } from "./args/parse-helm-deno-args.ts"
import {
  bundleChart,
  cleanupBundle,
  renderDenoChart,
} from "./deno/render-chart.ts"
import {
  copyChart,
  isChartExist,
  getChartPackagePath,
  cleanupChartPackage,
} from "./helm/chart-utils.ts"
import { helmExecute } from "./helm/execute.ts"
import { fetchChart } from "./helm/fetch.ts"
import { getChartContext } from "./helm/get-chart-context.ts"
import { ignoreNotFoundError } from "./utils/ignore-not-found-error.ts"
import { withErrorMsg } from "./std/mod.ts"

function helmDenoUsage() {
  const pluginUsage = `\
This is a wrapper for "helm [command]". It will use Deno for rendering charts
before running "helm [command]"

Supported helm [command] is:
  - template
  - install
  - upgrade
  - push
  - diff (helm plugin)
  - secrets (helm plugin)
  - cm-push (helm plugin)

You must use the options of the supported commands in strict order:
  $ helm <secrets> <diff> [${supportedCommands.join(
    "/"
  )}] [RELEASE] [CHART] <flags>

Example:
  $ helm deno upgrade <HELM UPGRADE OPTIONS>

Typical usage:
  $ helm deno upgrade ingress stable/nginx-ingress -f values.yaml`

  console.log(pluginUsage)
  Deno.exit(0)
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

  debug(
    `Parsed options:\n${JSON.stringify(
      {
        command,
        releaseName,
        chartLocation,
        helmRestArgs,
      },
      null,
      2
    )}`
  )

  if (command.length === 1 && command[0] === "cm-push") {
    let helmExecuteResult: { exitCode?: number } = {}
    try {
      await bundleChart(chartLocation, options)
      helmExecuteResult = await helmExecute([
        "cm-push",
        chartLocation,
        ...helmRestArgs,
      ])
    } finally {
      await cleanupBundle(chartLocation)
    }

    if (helmExecuteResult.exitCode) {
      Deno.exit(helmExecuteResult.exitCode)
    }

    return
  }

  if (command.length === 1 && command[0] === "push") {
    let helmExecuteResult: { exitCode?: number } = {}
    const chartPackagePath = await getChartPackagePath(chartLocation)
    try {
      await bundleChart(chartLocation, options)
      await helmExecute([
        "package",
        chartLocation,
        "--destination",
        chartLocation,
      ])

      helmExecuteResult = await helmExecute([
        "push",
        chartPackagePath,
        ...helmRestArgs,
      ])
    } finally {
      await cleanupBundle(chartLocation)
      await cleanupChartPackage(chartPackagePath)
    }

    if (helmExecuteResult.exitCode) {
      Deno.exit(helmExecuteResult.exitCode)
    }

    return
  }

  const lastCommand = command[command.length - 1]
  if (command.length === 0 || !supportedCommands.includes(lastCommand)) {
    await helmExecute(args, { autoExitOnError: true })
    return
  }

  const tmpDir = await withErrorMsg(
    Deno.makeTempDir({ prefix: "chart-" }),
    "Could not create temp directory"
  )

  const tmpChartPath = path.join(tmpDir, "chart")

  debug(`Temporary directory ${tmpDir} has been created`)
  const isLocalChart = await isChartExist(chartLocation)

  try {
    // Fetch chart into temporaty directory
    if (isLocalChart) {
      debug(`Copying chart ${chartLocation} to temporary directory`)
      await copyChart(chartLocation, tmpChartPath)
      debug(`Successfuly copied chart ${chartLocation} to temporary directory`)
    } else {
      debug(`Fetching chart ${chartLocation} to temporary directory`)
      await fetchChart(chartLocation, tmpDir, tmpChartPath, args)
      debug(`Successfuly fetched chart ${chartLocation} to temporary directory`)
    }

    const chartContext = await getChartContext(
      releaseName,
      tmpDir,
      tmpChartPath,
      command,
      args
    )
    debug(`Chart context:\n${JSON.stringify(chartContext, null, 2)}`)

    await renderDenoChart(chartContext, tmpChartPath, options)
    debug("Deno templates were successfuly rendered")

    const helmExecuteArgs = [
      ...command,
      ...[releaseName].filter(Boolean),
      tmpChartPath,
      ...helmRestArgs,
    ]
    debug(`Executing: ${helmExecuteArgs.join(" ")}`)
    await helmExecute(helmExecuteArgs, { autoExitOnError: true })

    debug("Success")
  } catch (err) {
    const replaceChartPath = (str: string) => {
      if (options.keepTmpChart) {
        return str
      }

      return isLocalChart
        ? str.replaceAll(tmpChartPath, chartLocation)
        : str.replaceAll(`file://${tmpChartPath}`, "<chart-root>")
    }

    // Replace paths in error or error stacktrace with readable value
    if (err?.stack) {
      err.stack = replaceChartPath(err.stack)
    } else if (err?.message) {
      err.message = replaceChartPath(err.message)
    } else if (typeof err === "string") {
      throw replaceChartPath(err)
    }

    throw err
  } finally {
    if (!options.keepTmpChart) {
      // Remove temporary directory
      await ignoreNotFoundError(Deno.remove(tmpDir, { recursive: true }))
    }
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    Deno.exit(1)
  })
}
