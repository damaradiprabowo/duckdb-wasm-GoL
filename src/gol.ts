import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";

/**
 * Conway's Game of Life, run entirely in SQL inside DuckDB-WASM.
 *
 * Board model: SPARSE + BOUNDED.
 *   - Only live cells are stored, as rows in `cells(x, y)`.
 *   - The world is a fixed width x height rectangle; anything that would
 *     be born outside it simply dies (no wrap-around).
 *
 * One generation == one SQL query. The rule "born on 3, survives on 2-3"
 * is expressed as a neighbour-count aggregation over the live set.
 */
export class GameOfLife {
  private conn: AsyncDuckDBConnection;
  readonly width: number;
  readonly height: number;
  generation = 0;

  constructor(conn: AsyncDuckDBConnection, width: number, height: number) {
    this.conn = conn;
    this.width = width;
    this.height = height;
  }

  /** Create the tables: the live-cell set and the 8 neighbour offsets. */
  async init(): Promise<void> {
    await this.conn.query(`CREATE TABLE cells (x INTEGER, y INTEGER);`);
    await this.conn.query(`
      CREATE TABLE deltas(dx INTEGER, dy INTEGER);
      INSERT INTO deltas VALUES
        (-1,-1),(-1,0),(-1,1),
        ( 0,-1),       ( 0,1),
        ( 1,-1),( 1,0),( 1,1);
    `);
  }

  /**
   * Advance one generation. This is the heart of the project: a single
   * statement that reads `cells`, counts neighbours, applies Conway's rule,
   * and writes the next live set.
   */
  async step(): Promise<void> {
    await this.conn.query(`
      CREATE OR REPLACE TEMP TABLE next_cells AS
      WITH neighbours AS (
        -- explode every live cell into the 8 coordinates it contributes to
        SELECT cells.x + deltas.dx AS x, cells.y + deltas.dy AS y
        FROM cells CROSS JOIN deltas
      ),
      counts AS (
        -- how many live neighbours does each in-bounds coordinate have?
        SELECT x, y, COUNT(*) AS n
        FROM neighbours
        WHERE x BETWEEN 0 AND ${this.width - 1}
          AND y BETWEEN 0 AND ${this.height - 1}
        GROUP BY x, y
      )
      SELECT x, y FROM counts
      WHERE n = 3                                   -- birth
         OR (n = 2 AND EXISTS (                     -- survival
               SELECT 1 FROM cells WHERE cells.x = counts.x AND cells.y = counts.y));
    `);
    await this.conn.query(`CREATE OR REPLACE TABLE cells AS SELECT * FROM next_cells;`);
    this.generation++;
  }

  /** Read back the current live cells as parallel typed arrays for drawing. */
  async snapshot(): Promise<{ xs: Int32Array; ys: Int32Array }> {
    const res = await this.conn.query(`SELECT x, y FROM cells;`);
    const xs = (res.getChild("x")?.toArray() ?? new Int32Array()) as Int32Array;
    const ys = (res.getChild("y")?.toArray() ?? new Int32Array()) as Int32Array;
    return { xs, ys };
  }

  async liveCount(): Promise<number> {
    const res = await this.conn.query(`SELECT COUNT(*)::INTEGER AS n FROM cells;`);
    return res.getChild("n")?.at(0) ?? 0;
  }

  /** Remove every live cell and reset the generation counter. */
  async clear(): Promise<void> {
    await this.conn.query(`DELETE FROM cells;`);
    this.generation = 0;
  }

  /** Seed a random board at the given live-cell density (0..1). */
  async randomFill(density = 0.25): Promise<void> {
    const count = Math.round(this.width * this.height * density);
    await this.conn.query(`
      CREATE OR REPLACE TABLE cells AS
      SELECT DISTINCT
        (random() * ${this.width})::INTEGER  AS x,
        (random() * ${this.height})::INTEGER AS y
      FROM range(${count});
    `);
    this.generation = 0;
  }

  /** Toggle a single cell (used for click-to-edit). Returns the new state. */
  async toggle(x: number, y: number): Promise<boolean> {
    const res = await this.conn.query(
      `SELECT COUNT(*)::INTEGER AS n FROM cells WHERE x = ${x} AND y = ${y};`,
    );
    const alive = (res.getChild("n")?.at(0) ?? 0) > 0;
    if (alive) {
      await this.conn.query(`DELETE FROM cells WHERE x = ${x} AND y = ${y};`);
    } else {
      await this.conn.query(`INSERT INTO cells VALUES (${x}, ${y});`);
    }
    return !alive;
  }

  /** Force a single cell to a given state (used for drag-to-paint). */
  async setCell(x: number, y: number, alive: boolean): Promise<void> {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    if (alive) {
      await this.conn.query(
        `INSERT INTO cells SELECT ${x}, ${y}
         WHERE NOT EXISTS (SELECT 1 FROM cells WHERE x = ${x} AND y = ${y});`,
      );
    } else {
      await this.conn.query(`DELETE FROM cells WHERE x = ${x} AND y = ${y};`);
    }
  }

  /** Insert a list of cells, offset to the given top-left origin. */
  async addCells(cells: [number, number][], ox = 0, oy = 0): Promise<void> {
    if (cells.length === 0) return;
    const values = cells
      .map(([x, y]) => `(${x + ox}, ${y + oy})`)
      .join(",");
    await this.conn.query(`INSERT INTO cells VALUES ${values};`);
  }
}
