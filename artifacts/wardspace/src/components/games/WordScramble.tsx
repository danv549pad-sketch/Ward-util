import { useMemo } from 'react';
import { ArrowRight, Lightbulb, RotateCcw, SkipForward, Sparkles } from 'lucide-react';
import { useGameStorage, londonDateKey, seededRandom } from '@/lib/games/common';
import {
  chooseRandomWord,
  createDailySequence,
  normalizeAnswer,
  scrambleWord,
  type ScrambleDifficulty,
  type ScrambleWord,
} from '@/lib/games/word-scramble';

type GameProgress = {
  daily: boolean;
  dailyDate: string;
  difficulty: ScrambleDifficulty;
  words: ScrambleWord[];
  index: number;
  word: ScrambleWord;
  scrambled: string;
  answer: string;
  hintShown: boolean;
  attempts: number;
  score: number;
  streak: number;
  solved: boolean;
  completed: boolean;
  feedback: string;
};

function dailyRequested(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('daily') === '1';
}

function makeProgress(daily: boolean, difficulty: ScrambleDifficulty): GameProgress {
  const date = new Date();
  const words = daily ? createDailySequence(date, difficulty) : [];
  const word = daily ? words[0] : chooseRandomWord(difficulty);
  const random = daily ? seededRandom(`${londonDateKey(date)}-${difficulty}-scramble-0`) : Math.random;
  return {
    daily,
    dailyDate: londonDateKey(date),
    difficulty,
    words,
    index: 0,
    word,
    scrambled: scrambleWord(word.word, random),
    answer: '',
    hintShown: false,
    attempts: 0,
    score: 0,
    streak: 0,
    solved: false,
    completed: false,
    feedback: '',
  };
}

export function WordScrambleGame() {
  const daily = dailyRequested();
  const dailyDate = daily ? londonDateKey() : '';
  const storageKey = daily
    ? `wardspace-word-scramble-daily-${dailyDate}`
    : 'wardspace-word-scramble-normal';
  const [progress, setProgress] = useGameStorage<GameProgress>(
    storageKey,
    () => makeProgress(daily, 'Easy'),
  );

  const availableLetters = useMemo(() => {
    const used = new Map<string, number>();
    for (const letter of normalizeAnswer(progress.answer)) used.set(letter, (used.get(letter) ?? 0) + 1);
    const seen = new Map<string, number>();
    return [...progress.scrambled].map((letter, index) => {
      const occurrence = seen.get(letter) ?? 0;
      seen.set(letter, occurrence + 1);
      return { letter, index, disabled: occurrence < (used.get(letter) ?? 0) };
    });
  }, [progress.answer, progress.scrambled]);

  function setAnswer(value: string) {
    setProgress((current) => ({ ...current, answer: value, feedback: '' }));
  }

  function submitAnswer(event?: { preventDefault: () => void }) {
    event?.preventDefault();
    setProgress((current) => {
      if (current.solved || current.completed) return current;
      if (normalizeAnswer(current.answer) === current.word.word) {
        return {
          ...current,
          score: current.score + (current.difficulty === 'Hard' ? 3 : current.difficulty === 'Medium' ? 2 : 1),
          streak: current.streak + 1,
          solved: true,
          feedback: 'That’s right — nicely done!',
        };
      }
      return {
        ...current,
        attempts: current.attempts + 1,
        streak: 0,
        answer: '',
        feedback: 'Not quite. Give it another try!',
      };
    });
  }

  function nextWord(skipped = false) {
    setProgress((current) => {
      if (current.daily && current.index + 1 >= current.words.length) {
        return {
          ...current,
          completed: true,
          solved: true,
          streak: skipped ? 0 : current.streak,
          feedback: skipped ? `The answer was ${current.word.word}. Daily challenge complete!` : 'Daily challenge complete — great playing!',
        };
      }
      const index = current.index + 1;
      const word = current.daily ? current.words[index] : chooseRandomWord(current.difficulty);
      const random = current.daily
        ? seededRandom(`${current.dailyDate}-${current.difficulty}-scramble-${index}`)
        : Math.random;
      return {
        ...current,
        index,
        word,
        scrambled: scrambleWord(word.word, random),
        answer: '',
        hintShown: false,
        attempts: 0,
        solved: false,
        streak: skipped ? 0 : current.streak,
        feedback: skipped ? `The answer was ${current.word.word}.` : '',
      };
    });
  }

  function resetGame(difficulty = progress.difficulty) {
    const meaningfulProgress = progress.score > 0 || progress.streak > 0 || progress.attempts > 0
      || progress.hintShown || progress.answer.length > 0 || progress.solved || progress.completed;
    if (meaningfulProgress && !window.confirm('Start a new game? Your current game progress will be cleared.')) return;
    setProgress(makeProgress(daily, difficulty));
  }

  function chooseDifficulty(difficulty: ScrambleDifficulty) {
    if (difficulty !== progress.difficulty) resetGame(difficulty);
  }

  function newWord() {
    const meaningfulPuzzleProgress = progress.attempts > 0 || progress.hintShown
      || progress.answer.length > 0 || progress.solved;
    if (meaningfulPuzzleProgress && !window.confirm('Move to a new word? This puzzle progress will be cleared.')) return;
    if (progress.daily) {
      setProgress(makeProgress(true, progress.difficulty));
      return;
    }
    const word = chooseRandomWord(progress.difficulty);
    setProgress((current) => ({
      ...current,
      index: current.index + 1,
      word,
      scrambled: scrambleWord(word.word),
      answer: '',
      hintShown: false,
      attempts: 0,
      streak: 0,
      solved: false,
      completed: false,
      feedback: '',
    }));
  }

  const dailyFinished = progress.daily && progress.completed;

  return (
    <section className="mx-auto w-full max-w-[760px] min-w-0" aria-labelledby="word-scramble-title" data-testid="game-word-scramble">
      <header className="mb-6">
        <p className="eyebrow mb-2">WardSpace Game Zone · Just for fun</p>
        <h1 id="word-scramble-title" className="display text-[clamp(2rem,5vw,3rem)]">Word scramble</h1>
        <p className="mt-3 max-w-[620px] leading-relaxed text-[#425675]">
          Rearrange the letters to find the word. Take your time, use a hint, or skip whenever you like.
        </p>
      </header>

      <div className="surface min-w-0 p-4 sm:p-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label mb-2">Choose a level</p>
            <div className="segmented" role="group" aria-label="Difficulty">
              {(['Easy', 'Medium', 'Hard'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={progress.difficulty === level}
                  onClick={() => chooseDifficulty(level)}
                  data-testid={`button-difficulty-${level.toLowerCase()}`}
                >{level}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-4 text-sm font-bold text-[#415181]" aria-label="Current game score" data-testid="status-game-score">
            <span>Score: {progress.score}</span><span>Streak: {progress.streak}</span>
          </div>
        </div>

        {progress.daily && (
          <div className="inset mb-5 flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm" data-testid="status-daily-challenge">
            <span className="font-bold">Daily challenge · {progress.dailyDate}</span>
            <span>Word {Math.min(progress.index + (progress.completed ? 1 : 0), progress.words.length)} of {progress.words.length}</span>
          </div>
        )}

        {dailyFinished ? (
          <div className="rounded-lg bg-[#E5F0F4] p-5 text-center sm:p-8" role="status" data-testid="status-daily-complete">
            <Sparkles size={30} className="mx-auto mb-3 text-[#027C96]" aria-hidden="true" />
            <h2 className="display text-2xl">You finished today’s challenge!</h2>
            <p className="mt-2 text-[#425675]">Lovely playing. Come back for another set tomorrow.</p>
            <p className="mt-3 font-bold">Today’s score: {progress.score}</p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="pill">{progress.word.category}</span>
              {!progress.daily && <span className="pill">{progress.difficulty}</span>}
              {!progress.daily && <span className="text-[#415181]" data-testid="text-session-puzzle">New puzzle</span>}
            </div>

            <div className="rounded-lg bg-[#EEF3F6] px-3 py-6 text-center sm:px-6 sm:py-8">
              <p className="eyebrow mb-3">Unscramble this word</p>
              <div className="flex min-w-0 flex-wrap justify-center gap-2" aria-label={`Scrambled letters ${[...progress.scrambled].join(' ')}`} data-testid="text-scrambled-word">
                {[...progress.scrambled].map((letter, index) => (
                  <span key={`${letter}-${index}`} className="flex h-12 w-10 items-center justify-center rounded-md border border-[#b9d2dc] bg-white text-2xl font-extrabold text-[#2B3D73] sm:h-14 sm:w-12 sm:text-3xl" aria-hidden="true">
                    {letter}
                  </span>
                ))}
              </div>
            </div>

            <form className="mt-5" onSubmit={submitAnswer}>
              <label htmlFor="scramble-answer" className="label">Your answer</label>
              <div className="flex min-w-0 flex-wrap gap-2">
                <input
                  id="scramble-answer"
                  className="field min-w-0 flex-1 uppercase"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={progress.word.word.length}
                  value={progress.answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  disabled={progress.solved}
                  aria-describedby="scramble-help"
                  data-testid="input-scramble-answer"
                />
                <button type="submit" className="btn btn-primary flex-1 sm:flex-none" disabled={progress.solved || !progress.answer.trim()} data-testid="button-check-answer">Check answer</button>
              </div>
              <p id="scramble-help" className="mt-2 text-sm text-[#415181]">Type your answer, or tap the letters below.</p>
            </form>

            <div className="mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Letter choices">
              {availableLetters.map(({ letter, index, disabled }) => (
                <button
                  key={`${index}-${letter}`}
                  type="button"
                  disabled={disabled || progress.solved}
                  onClick={() => setAnswer(`${progress.answer}${letter}`)}
                  aria-label={`Add letter ${letter}, choice ${index + 1}`}
                  data-testid={`button-letter-${index}`}
                  className="min-h-[52px] min-w-[48px] rounded-md border-2 border-[#b9d2dc] bg-white px-3 text-xl font-extrabold text-[#2B3D73] hover:bg-[#E5F0F4] disabled:opacity-40"
                >{letter}</button>
              ))}
              {progress.answer && !progress.solved && (
                <button type="button" onClick={() => setAnswer('')} className="btn btn-outline !min-h-[52px]" data-testid="button-clear-answer">Clear letters</button>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-soft flex-1 sm:flex-none"
                onClick={() => setProgress((current) => ({ ...current, hintShown: true }))}
                disabled={progress.hintShown || progress.solved}
                data-testid="button-show-hint"
              ><Lightbulb size={18} aria-hidden="true" />{progress.hintShown ? 'Hint shown' : 'Hint'}</button>
              <button type="button" className="btn btn-outline flex-1 sm:flex-none" onClick={() => nextWord(true)} disabled={progress.solved} data-testid="button-skip-word"><SkipForward size={18} aria-hidden="true" />Skip</button>
              {!progress.daily && <button type="button" className="btn btn-outline flex-1 sm:flex-none" onClick={newWord} disabled={progress.solved} data-testid="button-new-word">New word</button>}
              <button type="button" className="btn btn-outline flex-1 sm:flex-none" onClick={() => resetGame()} data-testid="button-new-game"><RotateCcw size={17} aria-hidden="true" />New game</button>
            </div>

            {progress.hintShown && <div className="inset mt-4 p-4" role="note" data-testid="text-word-hint"><span className="font-bold">Hint: </span>{progress.word.hint}</div>}
            {progress.feedback && (
              <p className={`mt-4 rounded-md p-3 font-bold ${progress.solved && !progress.completed || progress.completed ? 'bg-[#E5F0F4] text-[#245b50]' : 'bg-[#fff4e5] text-[#7a4b12]'}`} role="status" aria-live="polite" data-testid="status-answer-feedback">
                {progress.feedback}
              </p>
            )}
            {progress.solved && !progress.completed && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[#425675]">Answer: <strong>{progress.word.word}</strong></p>
                <button type="button" className="btn btn-primary" onClick={() => nextWord(false)} data-testid="button-next-word">
                  {progress.daily && progress.index + 1 >= progress.words.length ? 'Finish daily challenge' : 'Next word'} <ArrowRight size={18} aria-hidden="true" />
                </button>
              </div>
            )}
            {progress.attempts > 0 && !progress.solved && <p className="mt-3 text-sm text-[#415181]" data-testid="text-attempt-count">Tries: {progress.attempts}</p>}
          </>
        )}
      </div>
      <p className="mt-4 text-center text-xs leading-relaxed text-[#586a7e]">A little word game for enjoyment. Personal progress stays on this device; shared progress clears when the session ends.</p>
    </section>
  );
}