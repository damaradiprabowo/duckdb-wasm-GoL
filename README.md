# Game of Life · DuckDB-WASM

Conway's Game of Life where **every generation is a single SQL query** running in
[DuckDB-WASM](https://duckdb.org/docs/current/clients/wasm/overview) in the browser.
The JavaScript layer only handles rendering and input — the simulation lives in SQL.

**Live demo → [gol.damar.fyi](https://gol.damar.fyi/)** (with an essay below the board on what
one tiny rule says about emergence and free will).

## How it works

The board is stored **sparsely**: a table `cells(x, y)` holds only the live cells.
The world is a fixed `COLS × ROWS` rectangle; cells that would be born outside it die.

A generation is computed by exploding each live cell into its 8 neighbours,
counting how many times each coordinate appears, and applying Conway's rule
(*born on 3, survives on 2–3*):

```sql
WITH neighbours AS (
  -- every living cell votes for its 8 neighbours (deltas = the 8 offsets)
  SELECT cells.x + deltas.dx AS x, cells.y + deltas.dy AS y
  FROM cells CROSS JOIN deltas
),
counts AS (
  -- count the votes on each in-bounds square
  SELECT x, y, COUNT(*) AS n FROM neighbours
  WHERE x BETWEEN 0 AND :maxX AND y BETWEEN 0 AND :maxY
  GROUP BY x, y
)
-- born on 3, survive on 2
SELECT x, y FROM counts
WHERE n = 3
   OR (n = 2 AND EXISTS (SELECT 1 FROM cells WHERE cells.x = counts.x AND cells.y = counts.y));
```

## Run it

```bash
npm install
npm run dev
```

Then open the printed URL. **Play / Pause / Step / Clear / Random**, pick a preset
(glider, pulsar, Gosper gun, LWSS), or edit the board while paused: click & drag to paint
on desktop, tap to toggle a cell on mobile.

## Deploy

It's a static Vite build — `npm run build` outputs `dist/`. The DuckDB engine loads from the
jsDelivr CDN at runtime, so there are no `.wasm` files to host and no special headers needed.
Any static host (Vercel, Netlify, GitHub Pages) works with zero config.

## Layout

| File | Responsibility |
| --- | --- |
| `src/duck.ts` | Boot DuckDB-WASM, return a connection |
| `src/gol.ts` | The SQL engine — tables, the step query, seeding, editing |
| `src/patterns.ts` | Classic patterns as coordinate lists |
| `src/main.ts` | Canvas rendering, animation loop, controls, input |
| `src/style.css` | Styling (clean minimalist look, responsive) |
