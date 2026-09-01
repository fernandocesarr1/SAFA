import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("renders the SAFA dashboard and core routes", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("routes", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  };
  const context = { waitUntil() {}, passThroughOnException() {} };

  const cases = [
    ["/", /Fila Deep Max/i],
    ["/fundos/HGLG11", /16 blocos e/i],
    ["/operacao?ticker=HGLG11", /Matriz de esgotamento/i],
    ["/comparador?a=HGLG11&b=BTLG11", /Coloque as teses lado a lado/i],
    ["/metodologia", /O que precisa existir antes de uma nota/i],
  ];

  for (const [pathname, expected] of cases) {
    const response = await worker.fetch(
      new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
      env,
      context,
    );
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), expected, pathname);
  }
});
