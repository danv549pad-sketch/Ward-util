import { seededRandom } from '@/lib/games/common';

export type SudokuDifficulty = 'Easy' | 'Medium' | 'Hard';
export type SudokuGrid = number[];

const TARGET_CLUES: Record<SudokuDifficulty, number> = {
  Easy: 40,
  Medium: 34,
  Hard: 28,
};

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function candidates(grid: SudokuGrid, index: number): number[] {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const used = new Set<number>();
  for (let i = 0; i < 9; i += 1) {
    used.add(grid[row * 9 + i]);
    used.add(grid[i * 9 + col]);
    used.add(grid[Math.floor(row / 3) * 27 + Math.floor(col / 3) * 3 + Math.floor(i / 3) * 9 + (i % 3)]);
  }
  return Array.from({ length: 9 }, (_, i) => i + 1).filter(value => !used.has(value));
}

function fillGrid(grid: SudokuGrid, random: () => number): boolean {
  let bestIndex = -1;
  let bestCandidates: number[] | null = null;
  for (let index = 0; index < 81; index += 1) {
    if (grid[index] !== 0) continue;
    const options = candidates(grid, index);
    if (options.length === 0) return false;
    if (!bestCandidates || options.length < bestCandidates.length) {
      bestIndex = index;
      bestCandidates = options;
      if (options.length === 1) break;
    }
  }
  if (bestIndex < 0 || !bestCandidates) return true;
  for (const value of shuffled(bestCandidates, random)) {
    grid[bestIndex] = value;
    if (fillGrid(grid, random)) return true;
  }
  grid[bestIndex] = 0;
  return false;
}

/**
 * Count solutions up to a limit. The default limit of two is enough to
 * distinguish a unique puzzle from one with multiple solutions.
 */
export function countSudokuSolutions(puzzle: SudokuGrid, limit = 2): number {
  if (puzzle.length !== 81 || !isValidSudoku(puzzle)) return 0;
  const grid = [...puzzle];
  let count = 0;
  function search(): void {
    if (count >= limit) return;
    let bestIndex = -1;
    let best: number[] | null = null;
    for (let index = 0; index < 81; index += 1) {
      if (grid[index] !== 0) continue;
      const options = candidates(grid, index);
      if (options.length === 0) return;
      if (!best || options.length < best.length) {
        bestIndex = index;
        best = options;
        if (options.length === 1) break;
      }
    }
    if (bestIndex < 0) {
      count += 1;
      return;
    }
    for (const value of best ?? []) {
      grid[bestIndex] = value;
      search();
      if (count >= limit) break;
    }
    grid[bestIndex] = 0;
  }
  search();
  return count;
}

/** True when all filled digits obey Sudoku row, column, and box rules. */
export function isValidSudoku(grid: SudokuGrid): boolean {
  if (grid.length !== 81 || grid.some(value => !Number.isInteger(value) || value < 0 || value > 9)) return false;
  const validGroup = (values: number[]) => {
    const filled = values.filter(value => value !== 0);
    return new Set(filled).size === filled.length;
  };
  for (let row = 0; row < 9; row += 1) {
    if (!validGroup(grid.slice(row * 9, row * 9 + 9))) return false;
    if (!validGroup(Array.from({ length: 9 }, (_, col) => grid[row + col * 9]))) return false;
  }
  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      const box = Array.from({ length: 9 }, (_, i) =>
        grid[(boxRow * 3 + Math.floor(i / 3)) * 9 + boxCol * 3 + (i % 3)],
      );
      if (!validGroup(box)) return false;
    }
  }
  return true;
}

/**
 * Generate a deterministic puzzle from a seed and difficulty.
 * Difficulty is approximated by the number of starting clues.
 */
export function generateSudokuPuzzle(
  seed: string,
  difficulty: SudokuDifficulty = 'Medium',
): { puzzle: SudokuGrid; solution: SudokuGrid } {
  const random = seededRandom(`${seed}:solution`);
  const solution = Array<number>(81).fill(0);
  fillGrid(solution, random);
  const puzzle = [...solution];
  const removals = shuffled(Array.from({ length: 81 }, (_, i) => i), seededRandom(`${seed}:removals`));
  let clues = 81;
  for (const index of removals) {
    if (clues <= TARGET_CLUES[difficulty]) break;
    const previous = puzzle[index];
    puzzle[index] = 0;
    if (countSudokuSolutions(puzzle, 2) === 1) clues -= 1;
    else puzzle[index] = previous;
  }
  return { puzzle, solution };
}