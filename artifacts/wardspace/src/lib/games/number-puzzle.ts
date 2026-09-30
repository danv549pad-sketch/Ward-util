/** Pure, side-effect-free board helpers exported for unit testing. */
export type PuzzleDirection = 'up' | 'down' | 'left' | 'right';
export type PuzzleBoard = number[][];

export type PuzzleMoveResult = {
  board: PuzzleBoard;
  score: number;
  changed: boolean;
};

export type PuzzleSnapshot = {
  board: PuzzleBoard;
  score: number;
  reachedTarget: boolean;
  randomIndex: number;
};

export type NumberPuzzleProgress = {
  board: PuzzleBoard;
  score: number;
  bestScore: number;
  reachedTarget: boolean;
  randomSeed: string;
  randomIndex: number;
  undo: PuzzleSnapshot | null;
};

export const PUZZLE_SIZE = 4;
export const PUZZLE_TARGET = 1024;

export function createEmptyBoard(): PuzzleBoard {
  return Array.from({ length: PUZZLE_SIZE }, () => Array(PUZZLE_SIZE).fill(0));
}

/** Compresses one line toward its start and combines each matching pair once. */
export function mergeLine(line: readonly number[]): { line: number[]; score: number } {
  const compact = line.filter((value) => value !== 0);
  const merged: number[] = [];
  let score = 0;

  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === compact[index + 1]) {
      const value = compact[index] * 2;
      merged.push(value);
      score += value;
      index += 1;
    } else {
      merged.push(compact[index]);
    }
  }

  while (merged.length < line.length) merged.push(0);
  return { line: merged, score };
}

/** Moves and merges a 4x4 board. A tile created by a merge cannot merge again in that move. */
export function moveBoard(board: readonly (readonly number[])[], direction: PuzzleDirection): PuzzleMoveResult {
  const next = createEmptyBoard();
  let score = 0;

  for (let lineIndex = 0; lineIndex < PUZZLE_SIZE; lineIndex += 1) {
    const coordinates = Array.from({ length: PUZZLE_SIZE }, (_, offset) => {
      if (direction === 'left') return [lineIndex, offset] as const;
      if (direction === 'right') return [lineIndex, PUZZLE_SIZE - 1 - offset] as const;
      if (direction === 'up') return [offset, lineIndex] as const;
      return [PUZZLE_SIZE - 1 - offset, lineIndex] as const;
    });
    const values = coordinates.map(([row, column]) => board[row]?.[column] ?? 0);
    const result = mergeLine(values);
    score += result.score;
    coordinates.forEach(([row, column], offset) => {
      next[row][column] = result.line[offset];
    });
  }

  const changed = next.some((row, rowIndex) =>
    row.some((value, columnIndex) => value !== (board[rowIndex]?.[columnIndex] ?? 0)),
  );
  return { board: next, score, changed };
}

export function hasAvailableMove(board: readonly (readonly number[])[]): boolean {
  for (let row = 0; row < PUZZLE_SIZE; row += 1) {
    for (let column = 0; column < PUZZLE_SIZE; column += 1) {
      if ((board[row]?.[column] ?? 0) === 0) return true;
      if (column + 1 < PUZZLE_SIZE && board[row][column] === board[row][column + 1]) return true;
      if (row + 1 < PUZZLE_SIZE && board[row][column] === board[row + 1][column]) return true;
    }
  }
  return false;
}

/** Adds a 2 (90%) or 4 (10%) in a randomly selected empty cell. */
export function spawnTile(board: readonly (readonly number[])[], random: () => number): PuzzleBoard {
  const next = board.map((row) => [...row]);
  const empty: Array<[number, number]> = [];
  next.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (value === 0) empty.push([rowIndex, columnIndex]);
  }));
  if (!empty.length) return next;

  const position = Math.min(empty.length - 1, Math.floor(random() * empty.length));
  const [row, column] = empty[position];
  next[row][column] = random() < 0.9 ? 2 : 4;
  return next;
}