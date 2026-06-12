/** Classic Game of Life patterns as lists of [x, y] live-cell offsets. */
export const PATTERNS: Record<string, [number, number][]> = {
  glider: [
    [1, 0],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],

  // Lightweight spaceship
  lwss: [
    [1, 0], [4, 0],
    [0, 1],
    [0, 2], [4, 2],
    [0, 3], [1, 3], [2, 3], [3, 3],
  ],

  pulsar: parse(`
    ..OOO...OOO..
    .............
    O....O.O....O
    O....O.O....O
    O....O.O....O
    ..OOO...OOO..
    .............
    ..OOO...OOO..
    O....O.O....O
    O....O.O....O
    O....O.O....O
    .............
    ..OOO...OOO..
  `),

  gun: parse(`
    ........................O...........
    ......................O.O...........
    ............OO......OO............OO
    ...........O...O....OO............OO
    OO........O.....O...OO..............
    OO........O...O.OO....O.O...........
    ..........O.....O.......O...........
    ...........O...O....................
    ............OO......................
  `),
};

/** Turn an ASCII-art block (O = live) into [x, y] offsets. */
function parse(art: string): [number, number][] {
  const cells: [number, number][] = [];
  const rows = art.split("\n").map((r) => r.trim()).filter((r) => r.length > 0);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "O") cells.push([x, y]);
    });
  });
  return cells;
}
