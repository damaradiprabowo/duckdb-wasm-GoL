# Game of Life · DuckDB-WASM

Conway's Game of Life where **every generation is a single SQL query** running in
[DuckDB-WASM](https://duckdb.org/docs/current/clients/wasm/overview) in the browser.
The JavaScript layer only handles rendering and input — the simulation lives in SQL.

## How it works

The board is stored **sparsely**: a table `cells(x, y)` holds only the live cells.
The world is a fixed `COLS × ROWS` rectangle; cells that would be born outside it die.

A generation is computed by exploding each live cell into its 8 neighbours,
counting how many times each coordinate appears, and applying Conway's rule
(*born on 3, survives on 2–3*):

```sql
WITH neighbours AS (
  SELECT c.x + d.dx AS x, c.y + d.dy AS y
  FROM cells c CROSS JOIN deltas d        -- deltas = the 8 offsets
),
counts AS (
  SELECT x, y, COUNT(*) AS n FROM neighbours
  WHERE x BETWEEN 0 AND :maxX AND y BETWEEN 0 AND :maxY
  GROUP BY x, y
)
SELECT x, y FROM counts
WHERE n = 3
   OR (n = 2 AND EXISTS (SELECT 1 FROM cells c WHERE c.x = counts.x AND c.y = counts.y));
```

## Run it

```bash
npm install
npm run dev
```

Then open the printed URL. **Play / Pause / Step / Clear / Random**, pick a preset
(glider, pulsar, Gosper gun, LWSS), or click & drag on the grid to draw cells while paused.

## Layout

| File | Responsibility |
| --- | --- |
| `src/duck.ts` | Boot DuckDB-WASM, return a connection |
| `src/gol.ts` | The SQL engine — tables, the step query, seeding, editing |
| `src/patterns.ts` | Classic patterns as coordinate lists |
| `src/main.ts` | Canvas rendering, animation loop, controls |
