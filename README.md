# helm-deno

helm-deno allows write helm charts with JavaScript and TypeScript

## ️Project status: Alpha️

Project currently in its early stage. Breaking changes are to be expected. Please read [changelog](https://github.com/CSSSR/helm-deno/releases) before upgrade.

- [Known bugs](https://github.com/CSSSR/helm-deno/issues?q=is%3Aopen+is%3Aissue+label%3A%22issue+is+bug%22)
- [Missign features](https://github.com/CSSSR/helm-deno/issues?q=is%3Aopen+is%3Aissue+label%3A%22priority+4+%28must%29%22)
- [Expected breaking changes](https://github.com/CSSSR/helm-deno/issues?q=is%3Aopen+is%3Aissue+label%3A%22issue+is+breaking+suggestion%22+label%3A%22priority+4+%28must%29%22)

## Features

- Write charts in JavaScript and TypeScript
- Easy to extend with deno modules
- Can be used with helm-secrets, helm-diff and helm-push

## What deno is?

Deno is a simple, modern and secure runtime for JavaScript and TypeScript that uses V8 and is built in Rust. Learn more on [Deno official website](https://deno.land).

## Installation

```sh
helm plugin install https://github.com/CSSSR/helm-deno
```

There is no need to install Deno, it will be installed automatically.

## Getting started

```sh
helm deno create chart-name # TODO: currently does not work (issue #10)
```

It will create a directory structure that looks
something like this:

```
chart-name/
├── .helmignore     # Contains patterns to ignore when packaging Helm charts.
├── Chart.yaml      # Information about your chart
├── values.yaml     # The default values for your templates
└── deno-templates/ # The template files
    ├── mod.ts
    └── resources/
        ├── deployment.ts
        ├── service.ts
        └── ingress.ts
```

Render templates and print the result

```sh
helm deno template my-release chart-name/
```

## Use cases

We have written this plugin because we wasn't happy with default helm's templates system: Go templates. There is some of things which wasn't possible with it or was too complex to deal with.

**Working with data structures, not templates.** Programming languages are much more suitable for working with data such as kubernetes objects. And using functions instead of `define` and `template` is so much simpler.
**Modules.** Deno has a big set of [standard](https://deno.land/std) and [third-party](https://deno.land/x) modules. Publishing your own modules is as easy as pushing file to git repository or serving static files.
**Type System and static analysis.** Types for your chart values is a good documentaion which is always up-to-date. You are also safe from errors like typos and using variables that do not exist.
**Ability to work with file system and network.** You can replace kubernetes operators or helm plugins with just a function. For example, decode a sops-encrypted file or fetch secrets from Hashicorp Vault.

## Current limitations

- Does not support passing options via equal sign `--values=values-file.yaml`
- Require strict order of command-line arguments: `helm deno <secrets> <diff> upgrade/template/install [RELEASE] [CHART] <flags>`
- Does not support `--reuse-values`
- Slower that go templates
- Possible have bugs: doesn't have much tests yet
- Was not tested on Windows but it should probably works
