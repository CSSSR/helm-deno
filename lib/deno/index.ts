import * as yaml from "https://deno.land/std@0.70.0/encoding/yaml.ts"
import * as fs from "https://deno.land/std@0.70.0/fs/mod.ts"
import * as path from "https://deno.land/std@0.70.0/path/mod.ts"
import { checkChartPath } from "../helm/index.ts"

// deno-lint-ignore no-explicit-any
type Manifest = any

interface HelmRelease {
  Name: string
  Namespace: string
  IsInstall: string
  IsUpgrade: string
  Revision: number
  Service: string
}

const valuesAndReleaseData = `
kind: ChartData
spec:
  release: | {{- .Release | toYaml | nindent 4 }}
  values: | {{- .Values | toYaml | nindent 4 }}
`

const helmignore = `
# Patterns to ignore when building packages.
# This supports shell glob matching, relative path matching, and
# negation (prefixed with !). Only one pattern per line.
.DS_Store
# Common VCS dirs
.git/
.gitignore
.bzr/
.bzrignore
.hg/
.hgignore
.svn/
# Common backup files
*.swp
*.bak
*.tmp
*.orig
*~
# Various IDEs
.project
.idea/
*.tmproj
.vscode/

# ---
Makefile
*.dec

# Deno
deno-templates/
.snapshots/
example-values/
`

function getTemplateName(manifest: Manifest): string {
  const name = manifest?.metadata?.name
  const namespace = manifest?.metadata?.namespace
  const kind = manifest?.kind?.toLowerCase()

  if ([name, kind].every(Boolean)) {
    return `${kind}-${name}${namespace ? `-${namespace}` : ""}`
  }

  throw new Error(
    `Bad manifest with name “${name}”, namespace “${namespace}” and kind “${manifest?.kind}”`
  )
}

function normalizeRelease(r: HelmRelease) {
  return {
    name: r.Name,
    namespace: r.Namespace,
    isInstall: r.IsInstall,
    isUpgrade: r.IsUpgrade,
    revision: r.Revision,
    service: r.Service,
  }
}

function parseChartData(spec: Record<string, unknown>) {
  const { release, values } = spec

  if (typeof release !== "string") {
    throw new Error("Invalid chart data: release is not a string")
  }

  if (typeof values !== "string") {
    throw new Error("Invalid chart data: values is not a string")
  }

  return {
    release: normalizeRelease(yaml.parse(release) as HelmRelease),
    values: yaml.parse(values),
  }
}

function removeUselessForSnapshotsFields(manifest: Manifest): Manifest {
  const clone = JSON.parse(JSON.stringify(manifest))

  if (clone.metadata?.labels?.["helm.sh/chart"]) {
    clone.metadata.labels["helm.sh/chart"] = undefined
  }

  if (clone.spec?.template?.metadata?.labels?.["helm.sh/chart"]) {
    clone.spec.template.metadata.labels["helm.sh/chart"] = undefined
  }

  return clone
}

function stringifyResource(manifest: Manifest): string {
  return yaml.stringify(manifest, {
    lineWidth: -1,
    noRefs: true,
    skipInvalid: true,
    sortKeys: true,
  })
}

export async function prepareDenoChart(chartPath: string) {
  await checkChartPath(chartPath)
  await fs.ensureDir(path.join(chartPath, "templates"))

  await Deno.writeFile(
    path.join(chartPath, "templates/values-and-release.yaml"),
    new TextEncoder().encode(valuesAndReleaseData)
  )

  await Deno.writeFile(
    path.join(chartPath, ".helmignore"),
    new TextEncoder().encode(helmignore)
  )
}

export async function renderDenoChart(chartData: string, chartPath: string) {
  await checkChartPath(chartPath)
  await fs.ensureDir(path.join(chartPath, "templates"))
  const templateFolderPath = path.join(chartPath, "templates")

  // deno-lint-ignore no-explicit-any
  const data = yaml.parseAll(chartData) as any[]

  const chartDataDocs = data.filter((doc) => doc.kind === "ChartData")
  if (chartDataDocs.length === 0) {
    console.log(chartData)
    return
  }

  if (chartDataDocs.length > 1) {
    throw new Error("Invalid chart data: more then 1 ChartData resource")
  }

  const manifestData = chartDataDocs[0]

  const { release, values } = parseChartData(manifestData.spec)

  try {
    const denoTemplateFilePath = path.join(chartPath, "deno-templates/index.ts")
    const denoResources = await import(denoTemplateFilePath).then((chart) => {
      return chart.default({ release, values })
    })

    for await (const rawManifest of denoResources) {
      const manifest = removeUselessForSnapshotsFields(rawManifest)
      const templateName = getTemplateName(manifest)
      const templatePath = path.join(templateFolderPath, `${templateName}.yaml`)

      const updateTemplate = async () => {
        await fs.ensureDir(path.dirname(templatePath))
        await Deno.writeTextFile(templatePath, stringifyResource(manifest))
      }
      updateTemplate()
    }
  } finally {
    await Deno.remove(path.join(templateFolderPath, "values-and-release.yaml"))
  }
}
