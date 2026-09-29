import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Shell, PageHeading } from '@/components/ward-ui';
import { AboutPage, ActivitiesPage, GuidePage, HomePage, MyStayPage, RequestsPage, ThingsPage } from '@/pages/public';
import { StaffPage } from '@/pages/staff';
import { Link } from 'wouter';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });
function NotFound() { return <><PageHeading eyebrow="Not found" title="This page isn’t here." description="No worries. You can find your way back to today."/><Link href="/" className="btn btn-primary" data-testid="link-not-found-home">Back to today</Link></>; }
function RoutedBoundary({children}:{children:ReactNode}) { const [location]=useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function Router() { return <Shell><RoutedBoundary><Switch>
  <Route path="/" component={HomePage}/>
  <Route path="/activities" component={ActivitiesPage}/>
  <Route path="/things-to-do" component={ThingsPage}/>
  <Route path="/guide" component={GuidePage}/>
  <Route path="/requests" component={RequestsPage}/>
  <Route path="/my-stay" component={MyStayPage}/>
  <Route path="/staff" component={StaffPage}/>
  <Route path="/about" component={AboutPage}/>
  <Route component={NotFound}/>
</Switch></RoutedBoundary></Shell>; }
function App() { return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router/></WouterRouter></QueryClientProvider>; }
export default App;