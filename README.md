# helm-deno

helm-deno allows write helm charts with JavaScript and TypeScript

## Current limitations

- Does not support passing options via equal sign `--values=values-file.yaml`
- Require strict order of command-line arguments: `helm <diff> upgrade/template/install [RELEASE] [CHART] <flags>`
