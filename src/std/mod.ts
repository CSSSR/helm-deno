export interface Release {
  name: string
  namespace: string
  isInstall: string
  isUpgrade: string
  revision: number
  service: string
}

export interface ChartContext {
  release: Release
  // deno-lint-ignore no-explicit-any
  values: any
}

export function withErrorMsg<T>(p: Promise<T>, msg: string): Promise<T> {
  return p.catch((err) => Promise.reject(`${msg}: ${err}`))
}
