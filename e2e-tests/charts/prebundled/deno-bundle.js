// This chart is prebundled and than changed to check that helm-deno will use
// deno-bundle.js when --deno-use-bundle flag has been provided and
// deno-templates/index.ts otherwise

export default function prebundled() {
  return [
    {
      kind: "ServiceAccount",
      apiVersion: "v1",
      metadata: {
        name: "prebundled",
      },
    },
  ]
}
