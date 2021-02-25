export default function prebundled() {
  return [
    {
      kind: "ServiceAccount",
      apiVersion: "v1",
      metadata: {
        name: "not-bundled",
      },
    },
  ]
}
