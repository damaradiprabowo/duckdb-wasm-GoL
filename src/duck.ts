import * as duckdb from "@duckdb/duckdb-wasm";

/**
 * Boot DuckDB-WASM in the browser using the jsDelivr-hosted bundles.
 * Returns an open connection ready for queries.
 */
export async function initDuckDB(): Promise<duckdb.AsyncDuckDBConnection> {
  // Pick the smallest WASM bundle the current browser can run (mvp / eh / coi).
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);

  // The worker has to be loaded from a same-origin URL, so wrap the CDN
  // worker script in a Blob and spin the Worker up from that.
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: "text/javascript",
    }),
  );

  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);

  return db.connect();
}
