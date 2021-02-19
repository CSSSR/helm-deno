# helm-deno

> **⚠️ Work in progress, breaking changes are to be expected ⚠️**  
> There is also no documentation yet but we'll write some in upcoming weeks

helm-deno allows write helm charts with JavaScript and TypeScript

## Current limitations

- Does not support passing options via equal sign `--values=values-file.yaml`
- Require strict order of command-line arguments: `helm deno <secrets> <diff> upgrade/template/install [RELEASE] [CHART] <flags>`
- helm-deno was not tested on Windows but it should probably works
