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

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });
function NotFound() { return <><PageHeading eyebrow="Not found" title="This page isn’t here." description="No worries. You can find your way back to today."/><Link href="/" className="btn btn-primary" data-testid="link-not-found-home">Back to today</Link></>; }
function RoutedBoundary({children}:{children:ReactNode}) { const [location]=useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function Router() { return <Switch><Route path="/noticeboard" component={NoticeboardPage}/><Route><Shell><RoutedBoundary><Switch>
  <Route path="/" component={TodayPage}/>
  <Route path="/discover" component={DiscoverPage}/>
  <Route path="/ask" component={AskPage}/>
  <Route path="/my-stuff" component={MyStuffPage}/>
  <Route path="/activities"><Redirect to="/discover#activities"/></Route>
  <Route path="/things-to-do"><Redirect to="/discover#things"/></Route>
  <Route path="/guide"><Redirect to="/discover#guide"/></Route>
  <Route path="/requests"><Redirect to="/ask"/></Route>
  <Route path="/my-stay"><Redirect to="/my-stuff"/></Route>
  <Route path="/staff" component={StaffPage}/>
  <Route path="/about" component={AboutPage}/>
  <Route component={NotFound}/>
</Switch></RoutedBoundary></Shell></Route></Switch>; }
function App() { return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router/></WouterRouter></QueryClientProvider>; }
export default App;