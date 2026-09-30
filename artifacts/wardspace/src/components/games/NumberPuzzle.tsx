import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw, Undo2 } from 'lucide-react';
import { londonDateKey, seededRandom, useGameStorage } from '@/lib/games/common';
import {
  createEmptyBoard,
  hasAvailableMove,
  moveBoard,
  PUZZLE_TARGET,
  spawnTile,
  type NumberPuzzleProgress,
  type PuzzleDirection,
  type PuzzleSnapshot,
} from '@/lib/games/number-puzzle';

const STORAGE_KEY = 'wardspace-number-puzzle-v1';

function nextSeed(): string {
  return `${londonDateKey()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function withRandomTile(board: number[][], seed: string, startIndex: number): { board: number[][]; randomIndex: number } {
  const random = seededRandom(seed);
  for (let index = 0; index < startIndex; index += 1) random();
  let randomIndex = startIndex;
  const countedRandom = () => {
    randomIndex += 1;
    return random();
  };
  return { board: spawnTile(board, countedRandom), randomIndex };
}

function initialProgress(): NumberPuzzleProgress {
  const randomSeed = nextSeed();
  let board = createEmptyBoard();
  let randomIndex = 0;
  for (let tile = 0; tile < 2; tile += 1) {
    const spawned = withRandomTile(board, randomSeed, randomIndex);
    board = spawned.board;
    randomIndex = spawned.randomIndex;
  }
  return { board, score: 0, bestScore: 0, reachedTarget: false, randomSeed, randomIndex, undo: null };
}

function spawnWithProgress(board: number[][], seed: string, index: number) {
  return withRandomTile(board, seed, index);
}

function snapshotOf(progress: NumberPuzzleProgress): PuzzleSnapshot {
  return {
    board: progress.board.map((row) => [...row]),
    score: progress.score,
    reachedTarget: progress.reachedTarget,
    randomIndex: progress.randomIndex,
  };
}

const tileColors: Record<number, string> = {
  2: 'bg-[#e5f0f4] text-[#2b3d73]',
  4: 'bg-[#c9e2e9] text-[#2b3d73]',
  8: 'bg-[#9bcbd6] text-[#173f5a]',
  16: 'bg-[#69b1c2] text-white',
  32: 'bg-[#3a91a7] text-white',
  64: 'bg-[#2b6f8c] text-white',
  128: 'bg-[#415181] text-white',
  256: 'bg-[#34456f] text-white',
  512: 'bg-[#28385f] text-white',
  1024: 'bg-[#027c96] text-white',
};

const directionButtons: Array<{ direction: PuzzleDirection; label: string; Icon: typeof ArrowUp }> = [
  { direction: 'up', label: 'Move up', Icon: ArrowUp },
  { direction: 'left', label: 'Move left', Icon: ArrowLeft },
  { direction: 'down', label: 'Move down', Icon: ArrowDown },
  { direction: 'right', label: 'Move right', Icon: ArrowRight },
];

export function NumberPuzzleGame() {
  const [progress, setProgress] = useGameStorage<NumberPuzzleProgress>(STORAGE_KEY, initialProgress);
  const [notice, setNotice] = useState('');
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  function play(direction: PuzzleDirection) {
    setProgress((current) => {
      const result = moveBoard(current.board, direction);
      if (!result.changed) return current;

      const spawned = spawnWithProgress(result.board, current.randomSeed, current.randomIndex);
      const score = current.score + result.score;
      return {
        ...current,
        board: spawned.board,
        score,
        bestScore: Math.max(current.bestScore, score),
        reachedTarget: current.reachedTarget || result.board.some((row) => row.some((value) => value >= PUZZLE_TARGET)),
        randomIndex: spawned.randomIndex,
        undo: snapshotOf(current),
      };
    });
    setNotice('');
  }

  function undoMove() {
    setProgress((current) => {
      if (!current.undo) return current;
      return {
        ...current,
        board: current.undo.board.map((row) => [...row]),
        score: current.undo.score,
        reachedTarget: current.undo.reachedTarget,
        randomIndex: current.undo.randomIndex,
        undo: null,
      };
    });
    setNotice('Last move undone.');
  }

  function restart() {
    if (progress.score > 0 || progress.undo) {
      const confirmed = window.confirm('Start a new puzzle? Your current board will be replaced.');
      if (!confirmed) return;
    }
    const fresh = initialProgress();
    setProgress({ ...fresh, bestScore: progress.bestScore });
    setCelebrationDismissed(false);
    setNotice('A new puzzle is ready.');
  }

  useEffect(() => {
    const keyDirections: Record<string, PuzzleDirection> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    };
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement) return;
      const direction = keyDirections[event.key];
      if (!direction) return;
      event.preventDefault();
      play(direction);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [play]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    swipeStart.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!swipeStart.current) return;
    const deltaX = event.clientX - swipeStart.current.x;
    const deltaY = event.clientY - swipeStart.current.y;
    swipeStart.current = null;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 28) return;
    if (Math.abs(deltaX) > Math.abs(deltaY)) play(deltaX > 0 ? 'right' : 'left');
    else play(deltaY > 0 ? 'down' : 'up');
  }

  const gameOver = !hasAvailableMove(progress.board);
  const completed = progress.reachedTarget;

  return (
    <section className="surface mx-auto w-full max-w-[620px] min-w-0 p-4 sm:p-6" aria-labelledby="number-puzzle-title" data-testid="game-number-puzzle">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow mb-1">Game zone</p>
          <h2 id="number-puzzle-title" className="display text-2xl sm:text-3xl">Number Puzzle</h2>
          <p className="mt-1 text-sm leading-relaxed text-[#425675]">Slide matching numbers together to combine them. Use arrow keys anywhere on this page, swipe, or tap the direction buttons. Reach 1024, or keep playing.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <div className="inset min-w-[76px] rounded-md px-3 py-2 text-center" data-testid="text-puzzle-score">
            <span className="block text-[.7rem] font-bold uppercase tracking-wide text-[#415181]">Score</span>
            <span className="display text-xl" aria-label={`Score ${progress.score}`}>{progress.score}</span>
          </div>
          <div className="inset min-w-[76px] rounded-md px-3 py-2 text-center" data-testid="text-puzzle-best">
            <span className="block text-[.7rem] font-bold uppercase tracking-wide text-[#415181]">Best</span>
            <span className="display text-xl" aria-label={`Best score ${progress.bestScore}`}>{progress.bestScore}</span>
          </div>
        </div>
      </div>

      <div
        className="relative mx-auto w-full max-w-[470px] select-none rounded-xl border border-[#b9d2dc] bg-[#dce9ee] p-2 sm:p-3"
        role="grid"
        aria-label="Number puzzle board. Use arrow keys, swipe, or the direction buttons."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { swipeStart.current = null; }}
        style={{ touchAction: 'none' }}
        data-testid="board-number-puzzle"
      >
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {progress.board.flatMap((row, rowIndex) =>
            row.map((value, columnIndex) => (
              <div
                key={`${rowIndex}-${columnIndex}`}
                role="gridcell"
                aria-label={value ? `${value}` : 'Empty'}
                className={`flex aspect-square min-w-0 items-center justify-center rounded-lg transition-all duration-150 motion-reduce:transition-none ${value ? 'scale-100' : 'scale-[.98]'} ${value ? (tileColors[value] ?? 'bg-[#28385f] text-white') : 'bg-[#c7d9e0]'} ${value > 99 ? 'text-[clamp(1.1rem,6vw,2rem)]' : 'text-[clamp(1.5rem,8vw,2.75rem)]'} font-bold`}
                data-testid={`puzzle-cell-${rowIndex}-${columnIndex}`}
              >
                {value || ''}
              </div>
            )),
          )}
        </div>
      </div>

      {gameOver ? (
        <div className="mt-3 rounded-lg border border-[#b9d2dc] bg-[#eef3f6] p-4 text-center" role="status" data-testid="status-puzzle-result">
          <p className="display text-xl">No more moves</p>
          <p className="mt-1 text-sm text-[#425675]">{completed ? 'You reached 1024, and there are no moves left.' : 'Undo a move or start a fresh puzzle.'}</p>
        </div>
      ) : completed && !celebrationDismissed ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 rounded-lg border border-[#b9d2dc] bg-[#eef3f6] p-3 text-center" role="status" data-testid="status-puzzle-result">
          <span className="text-sm font-semibold text-[#2b3d73]">1024 reached! Great combining — keep playing if you like.</span>
          <button type="button" className="btn btn-outline !min-h-[44px] !px-3" onClick={() => setCelebrationDismissed(true)} data-testid="button-puzzle-continue">Continue playing</button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="mx-auto grid w-[164px] grid-cols-3 gap-2 sm:mx-0" aria-label="Direction controls">
          <span aria-hidden="true" />
          {directionButtons.filter(({ direction }) => direction === 'up').map(({ direction, label, Icon }) => (
            <button key={direction} type="button" onClick={() => play(direction)} aria-label={label} className="btn btn-outline !h-12 !min-h-[48px] !w-full !p-2" data-testid={`button-puzzle-${direction}`}><Icon aria-hidden="true" /></button>
          ))}
          <span aria-hidden="true" />
          {directionButtons.filter(({ direction }) => direction === 'left' || direction === 'down' || direction === 'right').map(({ direction, label, Icon }) => (
            <button key={direction} type="button" onClick={() => play(direction)} aria-label={label} className="btn btn-outline !h-12 !min-h-[48px] !w-full !p-2" data-testid={`button-puzzle-${direction}`}><Icon aria-hidden="true" /></button>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
          <button type="button" onClick={undoMove} disabled={!progress.undo} className="btn btn-outline !min-h-[48px] !px-3" data-testid="button-puzzle-undo"><Undo2 size={18} aria-hidden="true" />Undo</button>
          <button type="button" onClick={restart} className="btn btn-outline !min-h-[48px] !px-3" data-testid="button-puzzle-restart"><RotateCcw size={18} aria-hidden="true" />New puzzle</button>
        </div>
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-[#415181]">Use the arrow keys, swipe the board, or tap a direction. Your puzzle is saved in this browser.</p>
      <p className="sr-only" role="status" aria-live="polite" data-testid="status-puzzle-message">{notice || (completed ? 'Target tile reached. Keep playing if you like.' : gameOver ? 'No more moves available.' : '')}</p>
    </section>
  );
}