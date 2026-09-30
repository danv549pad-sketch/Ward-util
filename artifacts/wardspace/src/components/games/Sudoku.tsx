import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Clock3, Pause, PencilLine, Play, RotateCcw, Shuffle, Undo2 } from 'lucide-react';
import { useGameStorage, londonDateKey } from '@/lib/games/common';
import { generateSudokuPuzzle, isValidSudoku, type SudokuDifficulty, type SudokuGrid } from '@/lib/games/sudoku';

type Snapshot = { board: SudokuGrid; notes: number[][] };
type GameProgress = Snapshot & {
  puzzle: SudokuGrid;
  solution: SudokuGrid;
  history: Snapshot[];
  elapsed: number;
};

const difficulties: SudokuDifficulty[] = ['Easy', 'Medium', 'Hard'];
const blankNotes = () => Array.from({ length: 81 }, () => [] as number[]);
const randomSeed = () => `sudoku-new-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function makeProgress(seed: string, difficulty: SudokuDifficulty): GameProgress {
  const { puzzle, solution } = generateSudokuPuzzle(seed, difficulty);
  return { puzzle, solution, board: [...puzzle], notes: blankNotes(), history: [], elapsed: 0 };
}

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function hasProgress(progress: GameProgress): boolean {
  return progress.elapsed > 0 ||
    progress.board.some((value, index) => value !== progress.puzzle[index]) ||
    progress.notes.some(cell => cell.length > 0);
}

export function SudokuGame() {
  const dateKey = londonDateKey();
  const [dailyMode, setDailyMode] = useState(() => new URLSearchParams(window.location.search).get('daily') === '1');
  const [difficulty, setDifficulty] = useState<SudokuDifficulty>('Medium');
  const [dailyProgress, setDailyProgress] = useGameStorage<GameProgress>(
    `wardspace-sudoku-daily-${dateKey}-${difficulty.toLowerCase()}`,
    () => makeProgress(`wardspace-sudoku:${dateKey}:${difficulty}`, difficulty),
  );
  const [randomProgress, setRandomProgress] = useGameStorage<GameProgress>(
    `wardspace-sudoku-random-${difficulty.toLowerCase()}`,
    () => makeProgress(randomSeed(), difficulty),
  );
  const progress = dailyMode ? dailyProgress : randomProgress;
  const setProgress = dailyMode ? setDailyProgress : setRandomProgress;
  const [selected, setSelected] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showMistakes, setShowMistakes] = useState(false);
  const [notice, setNotice] = useState('');
  const completed = progress.board.every(value => value !== 0) &&
    isValidSudoku(progress.board) &&
    progress.board.every((value, index) => value === progress.solution[index]);

  useEffect(() => {
    if (paused || completed) return;
    const timer = window.setInterval(() => {
      setProgress(current => ({ ...current, elapsed: current.elapsed + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused, completed, setProgress]);

  const conflicts = useMemo(() => {
    const result = new Set<number>();
    for (let index = 0; index < 81; index += 1) {
      const value = progress.board[index];
      if (!value) continue;
      const row = Math.floor(index / 9);
      const col = index % 9;
      for (let other = index + 1; other < 81; other += 1) {
        if (progress.board[other] !== value) continue;
        const otherRow = Math.floor(other / 9);
        const otherCol = other % 9;
        if (row === otherRow || col === otherCol ||
          (Math.floor(row / 3) === Math.floor(otherRow / 3) && Math.floor(col / 3) === Math.floor(otherCol / 3))) {
          result.add(index);
          result.add(other);
        }
      }
    }
    return result;
  }, [progress.board]);

  function applyValue(value: number | null) {
    if (selected === null || progress.puzzle[selected] !== 0 || completed || paused) return;
    setProgress(current => {
      if (current.puzzle[selected] !== 0) return current;
      const previous: Snapshot = { board: [...current.board], notes: current.notes.map(cell => [...cell]) };
      const board = [...current.board];
      const notes = current.notes.map(cell => [...cell]);
      if (value === null) {
        board[selected] = 0;
        notes[selected] = [];
      } else if (notesMode) {
        if (board[selected] !== 0) return current;
        notes[selected] = notes[selected].includes(value)
          ? notes[selected].filter(note => note !== value)
          : [...notes[selected], value].sort((a, b) => a - b);
      } else {
        board[selected] = value;
        notes[selected] = [];
      }
      return { ...current, board, notes, history: [...current.history, previous].slice(-100) };
    });
  }

  function undo() {
    if (progress.history.length === 0 || paused || completed) return;
    setProgress(current => {
      const previous = current.history[current.history.length - 1];
      if (!previous) return current;
      return {
        ...current,
        board: [...previous.board],
        notes: previous.notes.map(cell => [...cell]),
        history: current.history.slice(0, -1),
      };
    });
  }

  function confirmReplacement(message: string): boolean {
    if (!hasProgress(progress)) return true;
    return window.confirm(message);
  }

  function changeDifficulty(next: SudokuDifficulty) {
    if (next === difficulty) return;
    if (!confirmReplacement('Change difficulty? Your current game will be kept so you can return to it.')) return;
    setDifficulty(next);
    setSelected(null);
    setPaused(false);
    setNotice('');
  }

  function changeMode(nextDaily: boolean) {
    if (nextDaily === dailyMode) return;
    if (!confirmReplacement('Switch puzzle type? Your current puzzle and progress will be kept.')) return;
    setDailyMode(nextDaily);
    setSelected(null);
    setPaused(false);
    setNotice('');
  }

  function startNewPuzzle() {
    if (!confirmReplacement('Start a new puzzle? Your current progress will be replaced.')) return;
    if (dailyMode && hasProgress(randomProgress) &&
      !window.confirm('Your saved random-game progress will be replaced by this new puzzle. Continue?')) return;
    setRandomProgress(makeProgress(randomSeed(), difficulty));
    setDailyMode(false);
    setSelected(null);
    setPaused(false);
    setNotice('A fresh puzzle is ready.');
  }

  function restartPuzzle() {
    if (!hasProgress(progress)) return;
    if (!window.confirm('Restart this puzzle? Your entries and timer will be cleared.')) return;
    setProgress(current => ({
      ...current,
      board: [...current.puzzle],
      notes: blankNotes(),
      history: [],
      elapsed: 0,
    }));
    setSelected(null);
    setPaused(false);
    setNotice('Puzzle restarted.');
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        applyValue(Number(event.key));
      } else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
        event.preventDefault();
        applyValue(null);
      } else if (event.key.toLowerCase() === 'n') {
        setNotesMode(current => !current);
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      } else if (event.key === 'Escape') {
        setSelected(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const selectedRow = selected === null ? -1 : Math.floor(selected / 9);
  const selectedCol = selected === null ? -1 : selected % 9;
  const selectedValue = selected === null ? 0 : progress.board[selected];

  return <section className="mx-auto max-w-[820px] min-w-0" data-testid="game-sudoku">
    <header className="mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="eyebrow mb-2">WardSpace Game Zone</p>
        <h1 className="display text-[clamp(1.8rem,5vw,2.6rem)]">Sudoku</h1>
        <p className="mt-2 text-sm text-[#425675]">A quiet number puzzle for a little screen-free fun.</p>
      </div>
      <div className="inset flex items-center gap-2 px-3 py-2 text-sm font-bold tabular-nums" aria-label={`Time ${formatTime(progress.elapsed)}`} data-testid="text-sudoku-timer">
        <Clock3 size={18} aria-hidden="true" />{formatTime(progress.elapsed)}
      </div>
    </header>

    <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="segmented" aria-label="Puzzle difficulty">
        {difficulties.map(level => <button key={level} type="button" aria-pressed={difficulty === level} onClick={() => changeDifficulty(level)} data-testid={`button-sudoku-difficulty-${level.toLowerCase()}`}>{level}</button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`btn !min-h-[44px] !px-3 !py-2 !text-sm ${dailyMode ? 'btn-primary' : 'btn-outline'}`} aria-pressed={dailyMode} onClick={() => changeMode(true)} data-testid="button-sudoku-daily"><CalendarDays size={16} />Daily</button>
        <button type="button" className={`btn !min-h-[44px] !px-3 !py-2 !text-sm ${!dailyMode ? 'btn-primary' : 'btn-outline'}`} aria-pressed={!dailyMode} onClick={() => changeMode(false)} data-testid="button-sudoku-random"><Shuffle size={16} />New game</button>
      </div>
    </div>

    <div className="surface min-w-0 p-2 sm:p-4">
      <div role="grid" aria-label={`Sudoku ${difficulty} puzzle`} className="mx-auto grid aspect-square w-full max-w-[560px] grid-cols-9 overflow-hidden border-2 border-[#2B3D73]">
        {progress.board.map((value, index) => {
          const row = Math.floor(index / 9);
          const col = index % 9;
          const clue = progress.puzzle[index] !== 0;
          const isSelected = selected === index;
          const related = selected !== null && (row === selectedRow || col === selectedCol ||
            (Math.floor(row / 3) === Math.floor(selectedRow / 3) && Math.floor(col / 3) === Math.floor(selectedCol / 3)));
          const sameValue = !!value && value === selectedValue;
          const incorrect = showMistakes && conflicts.has(index);
          const cellNotes = progress.notes[index];
          const rightEdge = col === 2 || col === 5 ? 'border-r-2 border-r-[#2B3D73]' : 'border-r border-r-[#c8d7df]';
          const bottomEdge = row === 2 || row === 5 ? 'border-b-2 border-b-[#2B3D73]' : 'border-b border-b-[#c8d7df]';
          return <button
            key={index}
            type="button"
            role="gridcell"
            aria-label={`Row ${row + 1}, column ${col + 1}${value ? `, ${value}${clue ? ', given' : ''}` : ', empty'}${incorrect ? ', conflicts with another number' : ''}`}
            aria-selected={isSelected}
            onClick={() => setSelected(index)}
            className={`relative flex aspect-square min-w-0 items-center justify-center p-0 text-[clamp(.8rem,4.5vw,1.55rem)] leading-none tabular-nums ${rightEdge} ${bottomEdge} ${
              isSelected ? 'z-[1] bg-[#bce2eb] ring-2 ring-inset ring-[#027C96]' :
              sameValue ? 'bg-[#dcecf1]' : related ? 'bg-[#f0f6f8]' : 'bg-white'
            } ${clue ? 'font-extrabold text-[#24365c]' : 'font-medium text-[#027C96]'} ${incorrect ? 'underline decoration-2 decoration-[#9B2C2C] underline-offset-2' : ''}`}
            data-testid={`button-sudoku-cell-${index}`}
          >
            {paused && !completed ? <span aria-hidden="true">•</span> : value || (cellNotes.length > 0 ? <span className="grid h-full w-full grid-cols-3 grid-rows-3 items-center justify-items-center p-[1px] text-[clamp(6px,1.5vw,10px)] text-[#415181]">{Array.from({ length: 9 }, (_, i) => <span key={i}>{cellNotes.includes(i + 1) ? i + 1 : ''}</span>)}</span> : '')}
          </button>;
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#425675]">
        <span><strong className="text-[#24365c]">Bold</strong> numbers are puzzle clues; blue numbers are yours.</span>
        <label className="flex min-h-[44px] items-center gap-2 font-semibold">
          <input type="checkbox" checked={showMistakes} onChange={event => setShowMistakes(event.target.checked)} data-testid="checkbox-sudoku-mistakes" />
          Show conflicting entries
        </label>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-9" aria-label="Number pad">
      {Array.from({ length: 9 }, (_, i) => i + 1).map(number => <button key={number} type="button" className="btn btn-outline !min-h-[52px] !px-1 text-xl tabular-nums" onClick={() => applyValue(number)} disabled={paused || completed || selected === null} data-testid={`button-sudoku-number-${number}`} aria-label={`Enter ${number}`}>{number}</button>)}
      <button type="button" className="btn btn-outline col-span-2 !min-h-[52px] !px-2 !text-sm sm:col-span-1" onClick={() => applyValue(null)} disabled={paused || completed || selected === null} data-testid="button-sudoku-erase">Erase</button>
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className={`btn !min-h-[48px] !px-3 !text-sm ${notesMode ? 'btn-primary' : 'btn-outline'}`} aria-pressed={notesMode} onClick={() => setNotesMode(current => !current)} disabled={paused || completed} data-testid="button-sudoku-notes"><PencilLine size={17} />Notes {notesMode ? 'on' : 'off'}</button>
      <button type="button" className="btn btn-outline !min-h-[48px] !px-3 !text-sm" onClick={undo} disabled={progress.history.length === 0 || paused || completed} data-testid="button-sudoku-undo"><Undo2 size={17} />Undo</button>
      <button type="button" className="btn btn-outline !min-h-[48px] !px-3 !text-sm" onClick={() => setPaused(current => !current)} disabled={completed} data-testid="button-sudoku-pause">{paused ? <Play size={17} /> : <Pause size={17} />}{paused ? 'Resume' : 'Pause'}</button>
      <button type="button" className="btn btn-outline !min-h-[48px] !px-3 !text-sm" onClick={restartPuzzle} data-testid="button-sudoku-restart"><RotateCcw size={17} />Restart</button>
      <button type="button" className="btn btn-primary !min-h-[48px] !px-3 !text-sm" onClick={startNewPuzzle} data-testid="button-sudoku-new"><Shuffle size={17} />New puzzle</button>
    </div>

    {paused && !completed && <div role="status" className="inset mt-4 p-4 text-center font-semibold" data-testid="status-sudoku-paused">Puzzle paused — your board is hidden. Resume when you’re ready.</div>}
    {completed && <div role="status" className="mt-4 flex items-center gap-3 rounded-lg border border-[#8ab8a6] bg-[#edf8f1] p-4 font-semibold text-[#244f3b]" data-testid="status-sudoku-complete"><Check size={21} />Puzzle complete in {formatTime(progress.elapsed)}. Nicely done!</div>}
    {notice && <p role="status" className="mt-3 text-sm text-[#415181]" data-testid="status-sudoku-notice">{notice}</p>}
    <p className="mt-4 text-xs leading-relaxed text-[#52647a]">Use the number pad or keyboard digits. Backspace or Delete erases; N toggles notes; Ctrl/⌘+Z undoes.</p>
  </section>;
}