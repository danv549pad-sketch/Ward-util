import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Shell, PageHeading } from '@/components/ward-ui';
import { AboutPage, MyStuffPage } from '@/pages/personal';
import { StaffPage } from '@/pages/staff';
import { TodayPage, DiscoverPage, AskPage } from '@/pages/experience';
import { NoticeboardPage } from '@/pages/noticeboard';
import { Link } from 'wouter';
import type { ReactNode } from 'react';
import { DeviceProvider, SharedActivityMonitor, useDevice } from '@/lib/device-mode';
import { GameZoneHome } from '@/pages/games';
import { SudokuGame } from '@/components/games/Sudoku';
import { WordSearchGame } from '@/components/games/WordSearch';
import { WordScrambleGame } from '@/components/games/WordScramble';
import { NumberPuzzleGame } from '@/components/games/NumberPuzzle';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });
function NotFound() { return <><PageHeading eyebrow="Not found" title="This page isn’t here." description="No worries. You can find your way back to today."/><Link href="/" className="btn btn-primary" data-testid="link-not-found-home">Back to today</Link></>; }
function RoutedBoundary({children}:{children:ReactNode}) { const [location]=useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function GameRoute({ title, children }: { title: string; children: ReactNode }) {
  const { mode, sessionActive, startSession } = useDevice();
  return <div className="max-w-[1000px] mx-auto min-w-0">
    <Link href="/games" className="btn btn-outline mb-6" data-testid="link-back-game-zone">← Back to Game Zone</Link>
    {mode === 'shared' && !sessionActive
      ? <section className="surface p-6 md:p-8" aria-labelledby="game-session-heading">
        <p className="eyebrow">Shared device</p>
        <h1 id="game-session-heading" className="display text-3xl mt-2">Start a temporary session to play {title}</h1>
        <p className="mt-3 text-[#415181]">Your game progress stays on this device only during this session. Finish and clear it before the next person uses the tablet.</p>
        <button type="button" className="btn btn-primary mt-6" onClick={startSession} data-testid="button-start-game-session">Start shared session</button>
      </section>
      : children}
  </div>;
}
function SudokuRoute(){return <GameRoute title="Sudoku"><SudokuGame/></GameRoute>}
function WordSearchRoute(){return <GameRoute title="Word Search"><WordSearchGame/></GameRoute>}
function WordScrambleRoute(){return <GameRoute title="Word Scramble"><WordScrambleGame/></GameRoute>}
function NumberPuzzleRoute(){return <GameRoute title="Number Puzzle"><NumberPuzzleGame/></GameRoute>}
function Router() { const {resetVersion}=useDevice(); return <Switch><Route path="/noticeboard" component={NoticeboardPage}/><Route><Shell><SharedActivityMonitor/><RoutedBoundary key={resetVersion}><Switch>
  <Route path="/" component={TodayPage}/>
  <Route path="/discover" component={DiscoverPage}/>
  <Route path="/ask" component={AskPage}/>
  <Route path="/my-stuff" component={MyStuffPage}/>
  <Route path="/games" component={GameZoneHome}/>
  <Route path="/games/sudoku" component={SudokuRoute}/>
  <Route path="/games/word-search" component={WordSearchRoute}/>
  <Route path="/games/word-scramble" component={WordScrambleRoute}/>
  <Route path="/games/number-puzzle" component={NumberPuzzleRoute}/>
  <Route path="/activities"><Redirect to="/discover#activities"/></Route>
  <Route path="/things-to-do"><Redirect to="/discover#things"/></Route>
  <Route path="/guide"><Redirect to="/discover#guide"/></Route>
  <Route path="/requests"><Redirect to="/ask"/></Route>
  <Route path="/my-stay"><Redirect to="/my-stuff"/></Route>
  <Route path="/staff" component={StaffPage}/>
  <Route path="/about" component={AboutPage}/>
  <Route component={NotFound}/>
</Switch></RoutedBoundary></Shell></Route></Switch>; }
function App() { return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><DeviceProvider><Router/></DeviceProvider></WouterRouter></QueryClientProvider>; }
export default App;