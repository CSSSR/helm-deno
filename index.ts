function helmDenoUsage() {
  const pluginUsage = `
helm deno $1

This is a wrapper for "helm [command]". It will use Deno for rendering charts
before running "helm [command]".

Example:
  $ helm deno upgrade <HELM UPGRADE OPTIONS>
  $ helm deno lint <HELM LINT OPTIONS>

Typical usage:
  $ helm deno upgrade i1 stable/nginx-ingress -f values.test.yaml
  $ helm deno lint ./my-chart -f values.test.yaml
`;
  console.log(pluginUsage);
  Deno.exit(0);
}

async function main() {
  const denoArgs = Deno.args[0];
  if (!denoArgs) {
    helmDenoUsage();
  }

  const cmd = Deno.run({
    cmd: [Deno.env.get("HELM_BINARY") || "helm3", ...Deno.args],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await cmd.output();
  const status = await cmd.status();
  const manifests = new TextDecoder().decode(output);
  const error = await cmd.stderrOutput();
  const errorStr = new TextDecoder().decode(error);

  if (!status.success) {
    throw new Error(errorStr);
  }

  console.log(manifests);
  cmd.close();
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    Deno.exit(1);
  });
}
