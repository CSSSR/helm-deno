export function ignoreNotFoundError(promise: Promise<void>): Promise<void> {
  return promise.catch((err) => {
    if (!(err instanceof Deno.errors.NotFound)) {
      return Promise.reject(err)
    }
  })
}
