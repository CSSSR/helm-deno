export function toText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}
