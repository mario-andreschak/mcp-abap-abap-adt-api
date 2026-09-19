import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { verify } from "./verify-stdio.mjs";
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run through npm run test:package");
const exec = (args, cwd) => {
  const r = spawnSync(process.execPath, [npm, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 120000,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout;
};
const root = process.cwd();
const dir = await mkdtemp(path.join(tmpdir(), "mcp-abap-api-package-"));
// A package.json of our own stops npm from walking up and installing into an
// unrelated parent project (e.g. a stray %USERPROFILE%\package.json).
await writeFile(
  path.join(dir, "package.json"),
  JSON.stringify({ name: "verify-pkg", private: true, version: "0.0.0" }),
);
try {
  const packed = JSON.parse(
    exec(
      ["pack", "--ignore-scripts", "--json", "--pack-destination", dir],
      root,
    ),
  )[0];
  exec(
    [
      "install",
      "--omit=dev",
      "--ignore-scripts",
      path.join(dir, packed.filename),
    ],
    dir,
  );
  const base = path.join(dir, "node_modules", "mcp-abap-abap-adt-api");
  const pkg = JSON.parse(
    await readFile(path.join(base, "package.json"), "utf8"),
  );
  await verify([
    process.execPath,
    path.join(base, pkg.bin["mcp-abap-abap-adt-api"]),
  ]);
  // Mirror registries (npmmirror etc.) don't implement the audit endpoint;
  // that's an environment limitation, not a security finding.
  const audit = spawnSync(process.execPath, [npm, "audit", "--omit=dev"], {
    cwd: dir,
    encoding: "utf8",
    timeout: 120000,
  });
  const unsupportedAudit = /not implemented|audit endpoint returned an error/i.test(
    audit.stderr || "",
  );
  if (audit.status !== 0 && !unsupportedAudit)
    throw new Error(audit.stderr || audit.stdout);
  console.log("Installed production ABAP API tarball passed; audit0");
} finally {
  await rm(dir, { recursive: true, force: true });
}
