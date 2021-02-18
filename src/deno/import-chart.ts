async function main() {
  const ctx = JSON.parse(Deno.args[0])
  const denoResources = await import(ctx.chartPath).then((chart) => {
    return chart.default(ctx.chartContext)
  })
  console.log(JSON.stringify(denoResources))
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    Deno.exit(1)
  })
}
