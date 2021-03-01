interface ChartContext {
  release: {
    name: string
    namespace: string
  }
  values: {
    serviceName?: string
    selector: Record<string, string>
    annotations: Record<string, string>
  }
}

export default function oneService(c: ChartContext) {
  if (!c.values.selector) {
    throw new Error("values.selector is required")
  }

  return [
    {
      kind: "Service",
      apiVersion: "v1",
      metadata: {
        name: c.values.serviceName || c.release.name,
        annotations: c.values.annotations,
      },
      spec: {
        selector: c.values.selector,
        ports: [
          {
            name: "http",
            port: 80,
            targetPort: "http",
          },
        ],
      },
    },
  ]
}
