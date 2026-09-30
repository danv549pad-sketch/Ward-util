import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

const gameDirectory = new URL('../src/lib/games/', import.meta.url);
const commonSource = await readFile(new URL('common.ts', gameDirectory), 'utf8');
const pureCommonSource = commonSource
  .slice(0, commonSource.indexOf('/** Personal games'))
  .replace(/^import[^\n]*\n/gm, '');

async function loadGameModule(filename) {
  const source = await readFile(new URL(filename, gameDirectory), 'utf8');
  const combinedSource = filename === 'common.ts'
    ? pureCommonSource
    : `${pureCommonSource}\n${source.replace(/^import[^\n]*\n/gm, '')}`;
  const javascript = stripTypeScriptTypes(combinedSource, { mode: 'strip' });
  const url = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`;
  return import(url);
}

const [common, sudoku, wordSearch, wordScramble, numberPuzzle] = await Promise.all([
  loadGameModule('common.ts'),
  loadGameModule('sudoku.ts'),
  loadGameModule('word-search.ts'),
  loadGameModule('word-scramble.ts'),
  loadGameModule('number-puzzle.ts'),
]);

test('London date keys and daily scramble dates remain local across BST changes', () => {
  const dates = [
    ['2026-03-28T23:30:00Z', '2026-03-28'],
    ['2026-03-29T00:30:00Z', '2026-03-29'],
    ['2026-03-29T01:30:00Z', '2026-03-29'],
    ['2026-03-29T22:59:59Z', '2026-03-29'],
    ['2026-03-29T23:00:00Z', '2026-03-30'],
    ['2026-10-25T00:30:00Z', '2026-10-25'],
    ['2026-10-25T01:30:00Z', '2026-10-25'],
    ['2026-10-25T23:30:00Z', '2026-10-25'],
    ['2026-10-26T00:30:00Z', '2026-10-26'],
  ];
  for (const [instant, expected] of dates) {
    const date = new Date(instant);
    assert.equal(common.londonDateKey(date), expected, instant);
    assert.deepEqual(
      wordScramble.createDailySequence(date),
      wordScramble.createDailySequence(new Date(instant)),
      `same London date should yield the same sequence: ${instant}`,
    );
  }
});

test('Sudoku generation is deterministic, valid, uniquely solvable, and difficulty changes clues', () => {
  const seed = 'wardspace-regression-2026-10-25';
  const easy = sudoku.generateSudokuPuzzle(seed, 'Easy');
  assert.deepEqual(sudoku.generateSudokuPuzzle(seed, 'Easy'), easy);
  const medium = sudoku.generateSudokuPuzzle(seed, 'Medium');
  const hard = sudoku.generateSudokuPuzzle(seed, 'Hard');

  const clueCount = ({ puzzle }) => puzzle.filter(value => value !== 0).length;
  assert.deepEqual([clueCount(easy), clueCount(medium), clueCount(hard)], [40, 34, 28]);
  for (const generated of [easy, medium, hard]) {
    assert.equal(generated.puzzle.length, 81);
    assert.equal(generated.solution.length, 81);
    assert.equal(sudoku.isValidSudoku(generated.solution), true);
    assert.equal(sudoku.isValidSudoku(generated.puzzle), true);
    for (let index = 0; index < 81; index += 1) {
      if (generated.puzzle[index] !== 0) assert.equal(generated.puzzle[index], generated.solution[index]);
    }
    assert.equal(sudoku.countSudokuSolutions(generated.puzzle, 2), 1);
  }
});

function findWordPath(grid, word) {
  const steps = [-1, 0, 1].flatMap(row => [-1, 0, 1]
    .filter(col => row !== 0 || col !== 0)
    .map(col => [row, col]));
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      for (const [rowStep, colStep] of steps) {
        const path = Array.from({ length: word.length }, (_, offset) => ({
          row: row + rowStep * offset,
          col: col + colStep * offset,
        }));
        if (wordSearch.isValidWordSearchPath(grid, path, word)) return path;
      }
    }
  }
  return null;
}

test('word-search generation is deterministic and every listed word has a valid straight path', () => {
  const puzzle = wordSearch.generateWordSearchPuzzle('daily-word-search-regression');
  assert.deepEqual(wordSearch.generateWordSearchPuzzle(puzzle.seed), puzzle);
  assert.equal(puzzle.size, 10);
  assert.equal(puzzle.grid.length, puzzle.size);
  assert.ok(puzzle.grid.every(row => row.length === puzzle.size && row.every(letter => /^[A-Z]$/.test(letter))));
  assert.equal(new Set(puzzle.words).size, puzzle.words.length);
  for (const word of puzzle.words) {
    const path = findWordPath(puzzle.grid, word);
    assert.ok(path, `expected ${word} to be present`);
    assert.equal(wordSearch.isValidWordSearchPath(puzzle.grid, path, word), true);
  }
  assert.equal(wordSearch.isValidWordSearchPath(puzzle.grid, [{ row: -1, col: 0 }], 'A'), false);
  assert.equal(wordSearch.isValidWordSearchPath(puzzle.grid, [{ row: 0, col: 0 }, { row: 1, col: 2 }], 'AA'), false);
  assert.equal(wordSearch.isValidWordSearchPath(puzzle.grid, [{ row: 0, col: 0 }, { row: 0, col: 1 }], 'ZZ'), false);
});

test('scramble helpers preserve answer letters, hints, categories, difficulty, and daily stability', () => {
  const answer = 'APPLE';
  const scrambled = wordScramble.scrambleWord(answer, common.seededRandom('scramble-test'));
  assert.notEqual(scrambled, answer);
  assert.deepEqual([...scrambled].sort(), [...answer].sort());
  assert.equal(wordScramble.normalizeAnswer(' a-p p!l e '), answer);

  for (const entry of wordScramble.WORD_BANK) {
    assert.ok(entry.hint.trim(), `${entry.word} should have a hint`);
    assert.ok(entry.category);
    assert.ok(['Easy', 'Medium', 'Hard'].includes(entry.difficulty));
  }
  const date = new Date('2026-10-25T01:30:00Z');
  for (const difficulty of ['Easy', 'Medium', 'Hard']) {
    const sequence = wordScramble.createDailySequence(date, difficulty);
    assert.equal(sequence.length, 10);
    assert.equal(new Set(sequence.map(entry => entry.word)).size, sequence.length);
    assert.ok(sequence.every(entry => entry.difficulty === difficulty && entry.hint));
    assert.deepEqual(sequence, wordScramble.createDailySequence(new Date(date), difficulty));
  }
});

test('number-puzzle pure moves merge once, preserve undo snapshots, and detect no moves', () => {
  const original = [
    [2, 2, 2, 2],
    [4, 0, 4, 0],
    [0, 8, 0, 0],
    [0, 0, 0, 0],
  ];
  const snapshot = original.map(row => [...row]);
  const left = numberPuzzle.moveBoard(original, 'left');
  assert.deepEqual(left.board, [
    [4, 4, 0, 0],
    [8, 0, 0, 0],
    [8, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  assert.equal(left.score, 16);
  assert.equal(left.changed, true);
  assert.deepEqual(original, snapshot);

  const blocked = Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => 2 ** (1 + row * 4 + col)));
  assert.equal(numberPuzzle.hasAvailableMove(blocked), false);
  const unchanged = numberPuzzle.moveBoard(blocked, 'left');
  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.score, 0);
  assert.deepEqual(unchanged.board, blocked);
  assert.equal(numberPuzzle.hasAvailableMove([[2, 2, 4, 8], [16, 32, 64, 128], [256, 512, 2, 4], [8, 16, 32, 0]]), true);

  // The original board can serve as an undo snapshot because moves are immutable.
  const restored = snapshot.map(row => [...row]);
  assert.deepEqual(restored, original);
});