import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { fixture, until } from "./fixture.mjs";
const meta = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
};
export async function verify(
  command = [
    process.execPath,
    fileURLToPath(new URL("../dist/index.js", import.meta.url)),
  ],
  offline = false,
) {
  for (const era of ["modern", "legacy"]) {
    const f = offline ? null : await fixture();
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("SAP_")),
    );
    if (f)
      Object.assign(env, {
        SAP_URL: f.url,
        SAP_USER: "fixture-user",
        SAP_PASSWORD: "fixture-password",
        SAP_CLIENT: "100",
      });
    const child = spawn(command[0], command.slice(1), {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const waiting = new Map();
    let stderr = "";
    let protocolError;
    child.stderr.on("data", (x) => {
      stderr += x;
    });
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined) {
          const callback = waiting.get(msg.id);
          if (callback) {
            waiting.delete(msg.id);
            callback.resolve(msg);
          }
        }
      } catch (error) {
        protocolError = error;
      }
    });
    function send(method, params = {}, id = 1) {
      child.stdin.write(
        JSON.stringify({
          jsonrpc: "2.0",
          ...(id === null ? {} : { id }),
          method,
          params: { ...params, ...(era === "modern" ? { _meta: meta } : {}) },
        }) + "\n",
      );
    }
    function request(method, params, id) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(new Error(`Wire deadline ${method}/${params?.name ?? ""}`)),
          10000,
        );
        waiting.set(id, {
          resolve: (value) => {
            clearTimeout(timer);
            resolve(value);
          },
        });
        send(method, params, id);
      });
    }
    const exited = new Promise((resolve) =>
      child.once("exit", (code, signal) => resolve({ code, signal })),
    );
    const deadline = setTimeout(() => child.kill(), 60000);
    try {
      const init = await request(
        era === "modern" ? "server/discover" : "initialize",
        era === "modern"
          ? {}
          : {
              protocolVersion: "2025-11-25",
              capabilities: {},
              clientInfo: { name: "abap-wire", version: "1" },
            },
        1,
      );
      if (era === "modern") assert.equal(init.result.resultType, "complete");
      else {
        assert.equal(init.result.protocolVersion, "2025-11-25");
        send("notifications/initialized", {}, null);
      }
      const catalog = (await request("tools/list", {}, 2)).result;
      // 129 handler tools (126 upstream + 3 new) + healthcheck + initialize
      assert.equal(catalog.tools.length, 131);
      if (era === "modern") {
        assert.equal(catalog.resultType, "complete");
        assert.ok("ttlMs" in catalog && "cacheScope" in catalog);
      }
      let id = 3;
      const health = (
        await request(
          "tools/call",
          { name: "healthcheck", arguments: {} },
          id++,
        )
      ).result;
      assert.equal(JSON.parse(health.content[0].text).sapConfigured, !offline);
      for (const [name, args] of [
        ["login", {}],
        [
          "getObjectSource",
          {
            objectSourceUrl: "/sap/bc/adt/programs/programs/ztest/source/main",
          },
        ],
        [
          "setObjectSource",
          {
            objectSourceUrl: "/sap/bc/adt/programs/programs/ztest/source/main",
            source: "REPORT ztest.\nWRITE 'wire only'.",
            lockHandle: "test-lock",
          },
        ],
        [
          "syntaxCheckCode",
          { url: "/sap/bc/adt/programs/programs/ztest/source/main" },
        ],
        ["dropSession", {}],
      ]) {
        const result = (
          await request("tools/call", { name, arguments: args }, id++)
        ).result;
        if (offline) assert.equal(result.isError, true);
        else assert.ok(!result.isError, JSON.stringify(result));
      }
      for (const [name, args] of [
        ["getObjectSource", { objectSourceUrl: "/sap/test", maxLines: -1 }],
        ["login", { extra: true }],
        ["missing", {}],
        ["readResultPage", { resultId: "123" }],
      ]) {
        const result = await request(
          "tools/call",
          { name, arguments: args },
          id++,
        );
        assert.ok(result.error || result.result?.isError);
      }
      if (f) {
        send(
          "tools/call",
          {
            name: "getObjectSource",
            arguments: {
              objectSourceUrl: "/sap/bc/adt/programs/programs/ztest/slow",
            },
          },
          0,
        );
        await until(() => f.slowStarted);
        send("notifications/cancelled", { requestId: 0 }, null);
        await until(() => f.cancelled);
        const recovery = (
          await request("tools/call", { name: "login", arguments: {} }, id++)
        ).result;
        assert.ok(!recovery.isError, JSON.stringify(recovery));
      }
      child.stdin.end();
      const end = await exited;
      assert.equal(end.code, 0);
      assert.ok(!protocolError);
      assert.ok(
        !stderr.includes("fixture-password") &&
          !stderr.includes("wire only") &&
          !stderr.includes("SECRET_PRIVATE"),
        stderr,
      );
      console.log(
        `${era}: actual131tool catalog, SAP workflow/errors/ID0/EOF passed (offline=${offline})`,
      );
    } finally {
      clearTimeout(deadline);
      if (child.exitCode === null && !child.killed) child.kill();
      lines.close();
      await f?.close();
    }
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const offline = process.argv.includes("--offline");
  const args = process.argv.slice(2).filter((x) => x !== "--offline");
  await verify(args.length ? args : undefined, offline);
}
