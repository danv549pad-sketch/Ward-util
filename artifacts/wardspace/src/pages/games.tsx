import { ArrowLeft, ArrowRight, Grid2X2, Hash, LetterText, Search, Shuffle } from 'lucide-react';
import { Link } from 'wouter';
import { GameCard, type GameCardProps } from '@/components/games/GameCard';
import '@/components/games/games.css';

const dailyPuzzles = [
  { title: 'Sudoku', detail: 'Medium · daily grid', href: '/games/sudoku?daily=1&difficulty=medium', icon: Grid2X2, id: 'sudoku' },
  { title: 'Word Search', detail: 'Today’s word list', href: '/games/word-search?daily=1', icon: Search, id: 'word-search' },
  { title: 'Word Scramble', detail: 'Today’s letters', href: '/games/word-scramble?daily=1', icon: Shuffle, id: 'word-scramble' },
] as const;

const games: GameCardProps[] = [
  { title: 'Sudoku', description: 'Fill the grid, one number at a time. Choose a level that suits you.', cue: 'Easy · Medium · Hard', href: '/games/sudoku', icon: Grid2X2, tone: 'teal', testId: 'link-game-sudoku' },
  { title: 'Word Search', description: 'Find the hidden words in a grid of letters. Go at your own pace.', cue: 'Find the words', href: '/games/word-search', icon: Search, tone: 'blue', testId: 'link-game-word-search' },
  { title: 'Word Scramble', description: 'Rearrange the letters to make a word. A quick puzzle for a spare moment.', cue: 'Unscramble letters', href: '/games/word-scramble', icon: LetterText, tone: 'sand', testId: 'link-game-word-scramble' },
  { title: 'Number Puzzle', description: 'Slide the numbered tiles into order. Simple to start, satisfying to solve.', cue: 'Arrange the tiles', href: '/games/number-puzzle', icon: Hash, tone: 'ice', testId: 'link-game-number-puzzle' },
];

export function GameZoneHome() {
  return (
    <div className="game-zone">
      <Link href="/discover" className="gz-back" data-testid="link-back-discover"><ArrowLeft size={18} aria-hidden="true" /> Back to Discover</Link>

      <header className="gz-hero">
        <div className="gz-hero-copy">
          <span className="gz-kicker">WardSpace · Ablett</span>
          <h1 className="gz-title" data-testid="heading-game-zone">Game Zone</h1>
          <p className="gz-subtitle" data-testid="text-game-zone-subtitle">A few games for when you’ve got some time to fill.</p>
        </div>
        <div className="gz-hero-art" aria-hidden="true">
          <span>1</span><span></span><span>8</span>
          <span></span><span>5</span><span></span>
          <span>3</span><span></span><span>9</span>
        </div>
      </header>

      <section className="gz-section" aria-labelledby="gz-daily-title">
        <div className="gz-section-head">
          <h2 className="gz-section-title" id="gz-daily-title">Today’s puzzles</h2>
          <p className="gz-section-note">A little something different each day.</p>
        </div>
        <div className="gz-daily">
          {dailyPuzzles.map(({ title, detail, href, icon: Icon, id }) => (
            <Link href={href} className="gz-daily-link" key={id} data-testid={`link-daily-${id}`} aria-label={`Play today's ${title}${id === 'sudoku' ? ' on medium difficulty' : ''}`}>
              <span className="gz-daily-icon" aria-hidden="true"><Icon size={23} strokeWidth={1.8} /></span>
              <span>
                <span className="gz-daily-label">{title}</span>
                <span className="gz-daily-detail">{detail}</span>
              </span>
              <ArrowRight className="gz-daily-arrow" size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className="gz-section" aria-labelledby="gz-games-title">
        <div className="gz-section-head">
          <h2 className="gz-section-title" id="gz-games-title">Pick a game</h2>
          <p className="gz-section-note">No sign-in. Just choose and play.</p>
        </div>
        <div className="gz-games">
          {games.map((game) => <GameCard key={game.title} {...game} />)}
        </div>
        <p className="gz-endnote">Take your time. There’s no rush to finish.</p>
      </section>
    </div>
  );
}