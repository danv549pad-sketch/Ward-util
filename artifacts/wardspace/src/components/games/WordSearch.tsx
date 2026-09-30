import { useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Check, Lightbulb, RotateCcw } from 'lucide-react';
import { londonDateKey, seededRandom, useGameStorage } from '@/lib/games/common';
import { generateWordSearchPuzzle, isValidWordSearchPath, type WordSearchPoint } from '@/lib/games/word-search';

type SavedWordSearch = {
  seed: string;
  foundWords: string[];
  foundPaths: Record<string, WordSearchPoint[]>;
};

function makeRandomSeed(): string {
  return `puzzle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function dailySeed(dateKey: string): string {
  const random = seededRandom(`wardspace-word-search:${dateKey}`);
  return `daily-${dateKey}-${Math.floor(random() * 1_000_000_000)}`;
}

function cellFromTarget(target: EventTarget | null): WordSearchPoint | null {
  if (!(target instanceof Element)) return null;
  const cell = target.closest<HTMLElement>('[data-word-row][data-word-col]');
  if (!cell) return null;
  return { row: Number(cell.dataset.wordRow), col: Number(cell.dataset.wordCol) };
}

function pathBetween(start: WordSearchPoint, end: WordSearchPoint): WordSearchPoint[] {
  const rowDiff = end.row - start.row;
  const colDiff = end.col - start.col;
  if (rowDiff !== 0 && colDiff !== 0 && Math.abs(rowDiff) !== Math.abs(colDiff)) return [];
  const steps = Math.max(Math.abs(rowDiff), Math.abs(colDiff));
  const rowStep = Math.sign(rowDiff);
  const colStep = Math.sign(colDiff);
  return Array.from({ length: steps + 1 }, (_, index) => ({
    row: start.row + rowStep * index,
    col: start.col + colStep * index,
  }));
}

export function WordSearchGame() {
  const dateKey = londonDateKey();
  const daily = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('daily') === '1';
  const storageKey = `wardspace-word-search:${daily ? `daily-${dateKey}` : 'random'}`;
  const [progress, setProgress] = useGameStorage<SavedWordSearch>(storageKey, () => ({
    seed: daily ? dailySeed(dateKey) : makeRandomSeed(),
    foundWords: [],
    foundPaths: {},
  }));
  const puzzle = useMemo(() => generateWordSearchPuzzle(progress.seed), [progress.seed]);
  const [activePath, setActivePath] = useState<WordSearchPoint[]>([]);
  const [message, setMessage] = useState('Select a word by dragging across the letters, or tap its first and last letters.');
  const [hintedWord, setHintedWord] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<WordSearchPoint | null>(null);
  const pointerActive = useRef(false);
  const pointerMoved = useRef(false);
  const [dragPath, setDragPath] = useState<WordSearchPoint[]>([]);

  const foundWords = progress.foundWords.filter((word) => puzzle.words.includes(word));
  const foundSet = new Set(foundWords);
  const allFound = foundWords.length === puzzle.words.length;
  const selectedSet = new Set([...activePath, ...dragPath].map(({ row, col }) => `${row},${col}`));
  const foundCells = new Set(foundWords.flatMap((word) => (progress.foundPaths[word] ?? [])
    .map(({ row, col }) => `${row},${col}`)));
  const remainingCount = puzzle.words.length - foundWords.length;

  function completePath(path: WordSearchPoint[]) {
    const match = puzzle.words.find((word) => !foundSet.has(word) && isValidWordSearchPath(puzzle.grid, path, word));
    if (match) {
      const nextFound = [...foundWords, match];
      setProgress((current) => ({
        ...current,
        foundWords: [...new Set([...current.foundWords, match])],
        foundPaths: { ...current.foundPaths, [match]: path },
      }));
      setMessage(nextFound.length === puzzle.words.length
        ? `Puzzle complete! You found all ${puzzle.words.length} words.`
        : `Found ${match.toLowerCase()}! ${puzzle.words.length - nextFound.length} words left.`);
      setHintedWord(null);
    } else if (path.length > 1) {
      setMessage('That line did not match a word. Try another direction.');
    }
    setActivePath([]);
  }

  function chooseEndpoint(point: WordSearchPoint) {
    if (activePath.length === 0) {
      setActivePath([point]);
      setMessage(`Start selected at row ${point.row + 1}, column ${point.col + 1}. Now tap the last letter.`);
    } else {
      completePath(pathBetween(activePath[0], point));
    }
  }

  function onBoardPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const point = cellFromTarget(event.target);
    if (!point) return;
    pointerStart.current = point;
    pointerActive.current = true;
    pointerMoved.current = false;
    setDragPath([point]);
    boardRef.current?.setPointerCapture(event.pointerId);
  }

  function onBoardPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointerActive.current || !pointerStart.current) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const end = cellFromTarget(target);
    if (end) {
      if (end.row !== pointerStart.current.row || end.col !== pointerStart.current.col) pointerMoved.current = true;
      const nextPath = pathBetween(pointerStart.current, end);
      setDragPath(nextPath);
    }
  }

  function onBoardPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!pointerActive.current || !pointerStart.current) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const end = cellFromTarget(target) ?? pointerStart.current;
    const path = pathBetween(pointerStart.current, end);
    const wasDrag = pointerMoved.current
      || end.row !== pointerStart.current.row
      || end.col !== pointerStart.current.col;
    pointerActive.current = false;
    pointerStart.current = null;
    pointerMoved.current = false;
    setDragPath([]);
    if (wasDrag) completePath(path);
    else chooseEndpoint(end);
  }

  function onBoardPointerCancel() {
    pointerActive.current = false;
    pointerStart.current = null;
    pointerMoved.current = false;
    setDragPath([]);
  }

  function onCellClick(event: MouseEvent<HTMLDivElement>) {
    // Pointer taps are handled on pointerup, including when pointer capture
    // retargets the following click to the board instead of the letter.
    if (event.detail !== 0) return;
    const point = cellFromTarget(event.target);
    if (!point) return;
    chooseEndpoint(point);
  }

  function restart() {
    if (foundWords.length > 0 && !window.confirm('Restart this puzzle and clear the words you have found?')) return;
    setProgress({
      seed: daily ? dailySeed(dateKey) : makeRandomSeed(),
      foundWords: [],
      foundPaths: {},
    });
    setActivePath([]);
    setDragPath([]);
    setHintedWord(null);
    setMessage(daily ? 'Daily puzzle restarted.' : 'A fresh puzzle is ready.');
  }

  function showHint() {
    const nextWord = puzzle.words.find((word) => !foundSet.has(word));
    if (!nextWord) return;
    setHintedWord(nextWord);
    setMessage(`Hint: look for “${nextWord.toLowerCase()}” in the grid.`);
  }

  return (
    <section className="surface min-w-0 p-4 sm:p-6 md:p-8" aria-labelledby="word-search-title" data-testid="game-word-search">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Game zone · {daily ? 'Daily puzzle' : 'Word game'}</p>
          <h2 id="word-search-title" className="display text-3xl">Word search</h2>
          <p className="mt-2 text-sm text-[#425675]">Theme: <strong>{puzzle.theme}</strong>. Find all {puzzle.words.length} words.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline !min-h-[48px] !px-3 sm:!px-4" onClick={showHint} disabled={allFound} data-testid="button-word-search-hint">
            <Lightbulb size={18} aria-hidden="true" /> Hint
          </button>
          <button type="button" className="btn btn-outline !min-h-[48px] !px-3 sm:!px-4" onClick={restart} data-testid="button-word-search-restart">
            <RotateCcw size={18} aria-hidden="true" /> Restart
          </button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite" data-testid="status-word-search">{message}</p>
      <p className="mt-4 min-h-6 text-sm text-[#425675]" aria-hidden="true">{message}</p>

      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(220px,.65fr)]">
        <div className="min-w-0">
          <div
            ref={boardRef}
            role="grid"
            aria-label={`${puzzle.theme} word search grid, 10 rows and 10 columns.`}
            aria-describedby="word-search-instructions"
            className="mx-auto grid w-full max-w-[560px] touch-none select-none overflow-hidden rounded-lg border border-[#b7cfda] bg-[#f7fafb]"
            style={{ gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))` }}
            onPointerDown={onBoardPointerDown}
            onPointerMove={onBoardPointerMove}
            onPointerUp={onBoardPointerUp}
            onPointerCancel={onBoardPointerCancel}
            onClick={onCellClick}
            data-testid="grid-word-search"
          >
            {puzzle.grid.flatMap((row, rowIndex) => row.map((letter, colIndex) => {
              const key = `${rowIndex},${colIndex}`;
              const isFound = foundCells.has(key);
              const isSelected = selectedSet.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}, ${letter}${isFound ? ', found word letter' : ''}`}
                  aria-pressed={isFound || isSelected}
                  className={`flex aspect-square min-h-0 min-w-0 items-center justify-center border-r border-b border-[#dce7ec] p-0 text-[clamp(.78rem,3.4vw,1.15rem)] font-bold leading-none text-[#2B3D73] sm:text-lg ${
                    isFound ? 'bg-[#cce9df] text-[#174c3b]' : isSelected ? 'bg-[#d6edf3] text-[#174c64]' : 'bg-white'
                  }`}
                  data-word-row={rowIndex}
                  data-word-col={colIndex}
                  data-testid={`cell-word-search-${rowIndex}-${colIndex}`}
                >
                  {letter}
                </button>
              );
            }))}
          </div>
          <p id="word-search-instructions" className="mt-2 text-center text-sm text-[#50617a]" data-testid="text-word-search-instructions">
            Tap a letter to start, then tap the last letter using a mouse, touch, or keyboard (Enter or Space). You can also drag in a straight line.
          </p>
        </div>

        <aside className="min-w-0 rounded-lg bg-[#f1f6f8] p-4 sm:p-5" aria-label="Words to find">
          <div className="flex items-center justify-between gap-2">
            <h3 className="display text-xl">Find these</h3>
            <span className="pill" data-testid="text-word-search-progress">{foundWords.length} / {puzzle.words.length}</span>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-1">
            {puzzle.words.map((word) => {
              const found = foundSet.has(word);
              return (
                <li key={word} className={`flex min-h-10 min-w-0 items-center gap-2 text-sm font-semibold ${found ? 'text-[#426b5e]' : 'text-[#2B3D73]'}`} data-testid={`word-search-word-${word.toLowerCase()}`}>
                  {found ? <Check size={16} aria-hidden="true" /> : <span className="inline-block w-4" aria-hidden="true" />}
                  <span className={`min-w-0 break-words ${found ? 'line-through' : ''}`}>{word}</span>
                  {hintedWord === word && !found && <span className="ml-auto text-xs font-normal text-[#50617a]">hint</span>}
                </li>
              );
            })}
          </ul>
          {allFound && (
            <div className="mt-4 rounded-md border border-[#b7d9cb] bg-[#e5f3ec] p-3 text-sm font-bold text-[#174c3b]" role="status" data-testid="status-word-search-complete">
              Puzzle complete — lovely finding!
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}