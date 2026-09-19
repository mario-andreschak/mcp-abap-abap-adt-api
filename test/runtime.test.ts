import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer as httpServer } from "node:http";
import { once } from "node:events";
import { Runtime, createServer } from "../src/server.js";
import { SourceCache } from "../src/lib/sourceCache.js";
import { ResultPages, stringify } from "../src/lib/results.js";
import { safeError } from "../src/lib/errors.js";
import { validateJson } from "../src/schema.js";
const url = "/sap/bc/adt/programs/programs/ztest/source/main";
const decode = (result: any) => JSON.parse(result.content[0].text);
export async function fixture(timeout = 2000) {
  const requests: any[] = [];
  let source = "REPORT ztest.\nWRITE 'MCP Unicode 🧪'.";
  let mode = "normal";
  let closed = false;
  let startedResolve: () => void;
  let started = new Promise<void>((resolve) => (startedResolve = resolve));
  const server = httpServer(async (req, res) => {
    const parts: Buffer[] = [];
    for await (const chunk of req) parts.push(chunk);
    const body = Buffer.concat(parts).toString();
    requests.push({
      url: req.url,
      method: req.method,
      body,
      headers: req.headers,
    });
    const path = new URL(req.url!, "http://fixture").pathname;
    if (path === "/sap/bc/adt/compatibility/graph") {
      res.setHeader("x-csrf-token", "fixture-csrf");
      res.setHeader("set-cookie", ["SAP_SESSIONID=fixture-session; Path=/"]);
      res.end("<graph/>");
      return;
    }
    if (path === "/sap/public/bc/icf/logoff") {
      res.end("logged out");
      return;
    }
    if (mode === "hang") {
      req.socket.once("close", () => {
        closed = true;
      });
      startedResolve!();
      return;
    }
    if (mode === "redirect") {
      res.writeHead(302, { location: "http://localhost:1/secret" });
      res.end();
      return;
    }
    if (mode === "big") {
      res.writeHead(200, { "content-length": String(5 * 1024 * 1024) });
      res.end("big");
      return;
    }
    if (mode === "entity") {
      res.setHeader("content-type", "application/xml");
      res.end('<?xml version="1.0"?><!DOCTYPE a [<!ENTITY z "x">]><a>&z;</a>');
      return;
    }
    if (mode === "error") {
      res.writeHead(400, { "content-type": "application/xml" });
      res.end(
        '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><type id="LOCKED"/><message lang="EN">Object is locked fixture-password</message><localizedMessage lang="EN">Use a valid lock handle</localizedMessage><namespace id="ADT"/><properties><entry key="hint">lock owner</entry></properties></exc:exception>',
      );
      return;
    }
    if (path === url) {
      if (req.method === "PUT") {
        source = body;
        res.statusCode = 204;
        res.end();
      } else res.end(source);
      return;
    }
    if (path === "/sap/bc/adt/checkruns") {
      res.setHeader("content-type", "application/xml");
      res.end(
        '<chkrun:checkRunReports xmlns:chkrun="http://www.sap.com/adt/checkrun"/>',
      );
      return;
    }
    if (path === "/sap/bc/adt/checkruns/reporters") {
      res.setHeader("content-type", "application/xml");
      res.end(
        '<chkrun:checkReporters xmlns:chkrun="http://www.sap.com/adt/checkrun"><chkrun:reporter chkrun:name="abap"><chkrun:supportedType>PROG/P</chkrun:supportedType></chkrun:reporter></chkrun:checkReporters>',
      );
      return;
    }
    if (path === "/sap/bc/adt/oo/classes/ztest") {
      res.setHeader("content-type", "application/xml");
      res.end(
        '<class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:adtcore="http://www.sap.com/adt/core" class:visibility="public" class:final="true" adtcore:description="Keep &amp; preserve  spaces"><class:include class:includeType="main"><atom:link href="/sap/bc/adt/oo/classes/ztest/source/main" rel="http://www.sap.com/adt/relations/source" type="text/plain"/></class:include></class:abapClass>',
      );
      return;
    }
    res.end("<ok/>");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const env = {
    SAP_URL: base,
    SAP_USER: "fixture-user",
    SAP_PASSWORD: "fixture-password",
    SAP_CLIENT: "100",
    SAP_REQUEST_TIMEOUT_MS: String(timeout),
  };
  const runtime = new Runtime(env);
  return {
    runtime,
    env,
    requests,
    base,
    source: () => source,
    setSource: (s: string) => (source = s),
    mode: (value: string) => (mode = value),
    started: () => started,
    closed: () => closed,
    close: async () => {
      await runtime.close();
      server.closeAllConnections();
      server.close();
      await once(server, "close");
    },
  };
}
test("all129 handlers register with current SDK and missing config remains discoverable", async () => {
  const r = new Runtime({});
  const s = createServer(r);
  // 126 upstream tools + 3 new tools (downloadObjectSource,
  // setDataElementProperties, setDomainProperties)
  assert.equal(r.tools.length, 129);
  assert.equal(new Set(r.tools.map((t) => t.definition.name)).size, 129);
  assert.equal(decode(await r.invoke("healthcheck", {})).sapConfigured, false);
  await assert.rejects(r.invoke("login", {}), /Configure SAP/);
  await r.close();
  await s.close();
});
test("real library login produces valid repeat results and sends expected auth, client, state and cookies", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 2; i++)
      assert.equal(
        decode(await f.runtime.invoke("login", {})).status,
        "logged in",
      );
    await f.runtime.invoke("getObjectSource", { objectSourceUrl: url });
    const r = f.requests.at(-1);
    assert.equal(
      r.headers.authorization,
      "Basic " +
        Buffer.from("fixture-user:fixture-password").toString("base64"),
    );
    assert.equal(r.headers.cookie, "SAP_SESSIONID=fixture-session");
    assert.equal(r.headers["x-sap-adt-sessiontype"], "stateful");
    assert.match(f.requests[0].url, /sap-client=100/);
  } finally {
    await f.close();
  }
});
test("write, cached syntax, empty source, session reset and failed write invalidation", async () => {
  const f = await fixture();
  try {
    const source = "REPORT ztest.\nWRITE 'cache 🧪'.";
    await f.runtime.invoke("setObjectSource", {
      objectSourceUrl: url,
      source,
      lockHandle: "lock1",
    });
    assert.equal(f.source(), source);
    let r = decode(await f.runtime.invoke("syntaxCheckCode", { url }));
    assert.equal(r.usedCachedSource, true);
    assert.match(
      f.requests.at(-1).body,
      new RegExp(Buffer.from(source).toString("base64").replace(/[+]/g, "\\+")),
    );
    r = decode(await f.runtime.invoke("syntaxCheckCode", { url, code: "" }));
    assert.equal(r.usedCachedSource, false);
    await f.runtime.invoke("dropSession", {});
    await assert.rejects(
      f.runtime.invoke("syntaxCheckCode", { url }),
      /none cached/,
    );
    await f.runtime.invoke("getObjectSource", { objectSourceUrl: url });
    f.mode("error");
    await assert.rejects(
      f.runtime.invoke("setObjectSource", {
        objectSourceUrl: url,
        source: "changed",
        lockHandle: "wrong",
      }),
    );
    f.mode("normal");
    await assert.rejects(
      f.runtime.invoke("syntaxCheckCode", { url }),
      /none cached/,
    );
  } finally {
    await f.close();
  }
});
test("source options accept structured JSON and paging never reports negative line counts", async () => {
  const f = await fixture();
  try {
    const result = decode(
      await f.runtime.invoke("getObjectSource", {
        objectSourceUrl: url,
        options: '{"version":"inactive"}',
        startLine: 500,
        maxLines: 2,
      }),
    );
    assert.equal(result.returnedLines, 0);
    assert.equal(result.hasMore, false);
    assert.match(f.requests.at(-1).url, /version=inactive/);
    await assert.rejects(
      f.runtime.invoke("getObjectSource", {
        objectSourceUrl: url,
        options: '"bad"',
      }),
      /SAP structure/,
    );
  } finally {
    await f.close();
  }
});
test("class includes fetch class structure and Map results preserve content", async () => {
  const f = await fixture();
  try {
    const r = decode(
      await f.runtime.invoke("classIncludes", { clas: "ZTEST" }),
    );
    assert.equal(r.result.main, "/sap/bc/adt/oo/classes/ztest/source/main");
    const map = decode(await f.runtime.invoke("syntaxCheckTypes", {}));
    assert.deepEqual(map.result, { abap: ["PROG/P"] });
  } finally {
    await f.close();
  }
});
test("cancel closes the actual SAP socket, rejects overlap, and requires deliberate session recovery", async () => {
  const f = await fixture();
  try {
    f.mode("hang");
    const abort = new AbortController();
    const pending = f.runtime.invoke(
      "getObjectSource",
      { objectSourceUrl: url },
      abort.signal,
    );
    await f.started();
    await assert.rejects(f.runtime.invoke("login", {}), /busy/);
    abort.abort();
    await assert.rejects(pending, /cancelled/);
    for (let i = 0; i < 50 && !f.closed(); i++)
      await new Promise((r) => setTimeout(r, 10));
    assert.equal(f.closed(), true);
    await assert.rejects(
      f.runtime.invoke("getObjectSource", { objectSourceUrl: url }),
      /Previous operation/,
    );
    f.mode("normal");
    await f.runtime.invoke("login", {});
    assert.equal(
      decode(
        await f.runtime.invoke("getObjectSource", { objectSourceUrl: url }),
      ).source,
      f.source(),
    );
  } finally {
    await f.close();
  }
});
test("total deadline ends a pending request and no mutating request is retried", async () => {
  const f = await fixture(1000);
  try {
    f.mode("hang");
    await assert.rejects(
      f.runtime.invoke("setObjectSource", {
        objectSourceUrl: url,
        source: "uncertain",
        lockHandle: "lock",
      }),
      /timed out/,
    );
    assert.equal(f.requests.filter((r) => r.method === "PUT").length, 1);
  } finally {
    await f.close();
  }
});
test("cross-origin, redirects, oversized and entity responses fail before unbounded parsing", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      f.runtime.invoke("getObjectSource", {
        objectSourceUrl: "http://localhost:1/sap/secret",
      }),
    );
    for (const mode of ["redirect", "big", "entity"]) {
      f.mode(mode);
      await assert.rejects(
        f.runtime.invoke("getObjectSource", { objectSourceUrl: url }),
      );
    }
  } finally {
    await f.close();
  }
});
test("SAP error context is preserved and configured credentials are redacted", async () => {
  const f = await fixture();
  try {
    f.mode("error");
    let failure;
    try {
      await f.runtime.invoke("getObjectSource", { objectSourceUrl: url });
    } catch (e) {
      failure = e;
    }
    const text = safeError(failure, ["fixture-password"]);
    assert.match(text, /LOCKED/);
    assert.match(text, /valid lock/);
    assert.doesNotMatch(text, /fixture-password/);
  } finally {
    await f.close();
  }
});
test("declared library structures validate objects, booleans and both debugger overloads before any SAP call", async () => {
  const r = new Runtime({});
  try {
    const tool = (name: string) =>
      r.tools.find((t) => t.definition.name === name)!.validation;
    assert.equal(
      tool("debuggerStep").schema.safeParse({ steptype: "stepInto" }).success,
      true,
    );
    assert.equal(
      tool("debuggerStep").schema.safeParse({ steptype: "nonsense" }).success,
      false,
    );
    assert.equal(
      tool("userTransports").schema.safeParse({ user: "TEST", targets: true })
        .success,
      true,
    );
    assert.equal(
      tool("nodeContents").schema.safeParse({
        parent_type: "DEVC/K",
        parentnodes: ["bad"],
      }).success,
      false,
    );
    assert.equal(
      tool("extractMethodEvaluate").schema.safeParse({
        uri: url,
        range: { start: { line: 1, column: 0 }, end: { line: 2, column: 0 } },
      }).success,
      true,
    );
    await assert.rejects(
      r.invoke("getObjectSource", { objectSourceUrl: url, maxLines: -1 }),
      /schema/,
    );
    await assert.rejects(
      r.invoke("runQuery", { sqlQuery: "select * from t", rowNumber: 1001 }),
      /schema/,
    );
  } finally {
    await r.close();
  }
});
test("large results remain retrievable without repeating SAP operations and Unicode pages are complete", () => {
  const pages = new ResultPages();
  const original = {
    content: [
      { type: "text", text: stringify({ source: "🧪".repeat(50000) }) },
    ],
  };
  let page = decode(pages.wrap(original)),
    all = page.page;
  while (page.nextOffset !== null) {
    page = pages.read(page.resultId, page.nextOffset, 15001);
    all += page.page;
  }
  assert.deepEqual(JSON.parse(all), original);
  pages.clear();
  assert.throws(() => pages.read(page.resultId, 0, 100), /expired/);
});
test("source cache is bounded, expires and keeps independent runtime snapshots; unsafe deep JSON rejected", async () => {
  const cache = new SourceCache(10, 5, 2);
  cache.set("a", "12345");
  cache.set("b", "67890");
  cache.set("c", "x");
  assert.equal(cache.get("a"), undefined);
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(cache.get("b"), undefined);
  const other = new SourceCache();
  other.set("c", "independent");
  cache.clear();
  assert.equal(other.get("c"), "independent");
  assert.throws(
    () => validateJson(JSON.parse('{"__proto__":{"x":1}}')),
    /Unsafe/,
  );
  let deep: any = {};
  for (let i = 0; i < 20; i++) deep = { next: deep };
  assert.throws(() => validateJson(deep), /limits/);
});
