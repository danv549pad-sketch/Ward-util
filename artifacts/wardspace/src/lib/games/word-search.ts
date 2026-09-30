import { seededRandom } from '@/lib/games/common';

export type WordSearchPoint = { row: number; col: number };
export type WordSearchPuzzle = {
  seed: string;
  size: number;
  theme: string;
  grid: string[][];
  words: string[];
};

const THEMES: Array<{ name: string; words: string[] }> = [
  { name: 'Nature', words: ['FOREST', 'FLOWER', 'RIVER', 'MEADOW', 'BLOSSOM', 'LEAF', 'ACORN', 'BREEZE', 'MOSS', 'FERN', 'BIRD', 'CLOUD', 'SUNSHINE', 'RAINBOW'] },
  { name: 'Seaside', words: ['BEACH', 'OCEAN', 'SEASHELL', 'SAND', 'TIDE', 'HARBOR', 'ISLAND', 'SAIL', 'WAVE', 'CORAL', 'PEBBLE', 'DOLPHIN', 'ANCHOR', 'COAST'] },
  { name: 'Garden', words: ['GARDEN', 'TULIP', 'DAISY', 'PETAL', 'PANSY', 'SEED', 'SHOVEL', 'WATERING', 'HEDGE', 'ROSE', 'VIOLET', 'BEE', 'POT', 'BLOOM'] },
  { name: 'Travel', words: ['JOURNEY', 'TICKET', 'RAILWAY', 'LUGGAGE', 'MAP', 'COMPASS', 'VOYAGE', 'BRIDGE', 'STATION', 'CANAL', 'CASTLE', 'MARKET', 'TUNNEL', 'VILLAGE'] },
  { name: 'Music', words: ['MELODY', 'RHYTHM', 'PIANO', 'GUITAR', 'DRUM', 'HARMONY', 'SINGER', 'TUNE', 'FLUTE', 'CHORUS', 'LYRIC', 'BANJO', 'VIOLIN', 'CONCERT'] },
  { name: 'Sky', words: ['SUNRISE', 'MOON', 'STAR', 'PLANET', 'COMET', 'ORBIT', 'GALAXY', 'NEBULA', 'ROCKET', 'AURORA', 'SATURN', 'VENUS', 'METEOR', 'COSMOS'] },
  { name: 'Colours', words: ['PURPLE', 'ORANGE', 'SILVER', 'YELLOW', 'SCARLET', 'INDIGO', 'VIOLET', 'MAROON', 'TURQUOISE', 'GOLD', 'AMBER', 'LILAC', 'IVORY', 'CORAL'] },
  { name: 'Food', words: ['PANCAKE', 'NOODLE', 'PRETZEL', 'BISCUIT', 'MANGO', 'PEACH', 'WAFFLE', 'POPCORN', 'OLIVE', 'BAGEL', 'GINGER', 'COCOA', 'LEMON', 'BERRY'] },
];

const DIRECTIONS: WordSearchPoint[] = [
  { row: -1, col: -1 }, { row: -1, col: 0 }, { row: -1, col: 1 },
  { row: 0, col: -1 }, { row: 0, col: 1 },
  { row: 1, col: -1 }, { row: 1, col: 0 }, { row: 1, col: 1 },
];

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function wordFits(grid: string[][], word: string, row: number, col: number, direction: WordSearchPoint): boolean {
  for (let index = 0; index < word.length; index += 1) {
    const nextRow = row + direction.row * index;
    const nextCol = col + direction.col * index;
    if (nextRow < 0 || nextCol < 0 || nextRow >= grid.length || nextCol >= grid.length) return false;
    const existing = grid[nextRow][nextCol];
    if (existing !== '' && existing !== word[index]) return false;
  }
  return true;
}

function placeWord(grid: string[][], word: string, row: number, col: number, direction: WordSearchPoint): void {
  for (let index = 0; index < word.length; index += 1) {
    grid[row + direction.row * index][col + direction.col * index] = word[index];
  }
}

/**
 * Creates a deterministic 10x10 word-search from a seed. Every word is placed
 * before filler letters are added; a row-by-row fallback guarantees placement
 * if randomized placement runs out of its finite attempt budget.
 */
export function generateWordSearchPuzzle(seed: string): WordSearchPuzzle {
  const normalizedSeed = String(seed);
  const random = seededRandom(normalizedSeed);
  const theme = THEMES[Math.floor(random() * THEMES.length)];
  const words = shuffled(theme.words, random).slice(0, 10);
  const size = 10;
  let grid = Array.from({ length: size }, () => Array<string>(size).fill(''));
  let placedAll = true;

  for (const word of [...words].sort((left, right) => right.length - left.length)) {
    let placed = false;
    for (let attempt = 0; attempt < 220 && !placed; attempt += 1) {
      const direction = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)];
      const row = Math.floor(random() * size);
      const col = Math.floor(random() * size);
      if (wordFits(grid, word, row, col, direction)) {
        placeWord(grid, word, row, col, direction);
        placed = true;
      }
    }
    if (!placed) {
      placedAll = false;
      break;
    }
  }

  if (!placedAll) {
    grid = Array.from({ length: size }, () => Array<string>(size).fill(''));
    words.forEach((word, row) => placeWord(grid, word, row, 0, { row: 0, col: 1 }));
  }

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (grid[row][col] === '') grid[row][col] = letters[Math.floor(random() * letters.length)];
    }
  }

  return { seed: normalizedSeed, size, theme: theme.name, grid, words };
}

/**
 * Returns true when a list of adjacent cells spells the requested word in a
 * single straight horizontal, vertical, or diagonal direction (either way).
 */
export function isValidWordSearchPath(grid: string[][], path: WordSearchPoint[], word: string): boolean {
  const target = word.toUpperCase();
  if (!target || path.length !== target.length || grid.length === 0) return false;
  for (const point of path) {
    if (!Number.isInteger(point.row) || !Number.isInteger(point.col)
      || point.row < 0 || point.col < 0 || point.row >= grid.length
      || point.col >= grid[point.row]?.length) return false;
  }
  if (path.length > 1) {
    const rowStep = path[1].row - path[0].row;
    const colStep = path[1].col - path[0].col;
    if (Math.abs(rowStep) > 1 || Math.abs(colStep) > 1 || (rowStep === 0 && colStep === 0)) return false;
    if (path.some((point, index) => index > 0 && (
      point.row !== path[0].row + rowStep * index
      || point.col !== path[0].col + colStep * index
    ))) return false;
  }
  const spelled = path.map(({ row, col }) => grid[row][col]).join('').toUpperCase();
  return spelled === target || spelled.split('').reverse().join('') === target;
}