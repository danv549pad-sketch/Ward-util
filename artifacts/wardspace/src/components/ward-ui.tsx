import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, BookOpen, CalendarDays, ClipboardList, Compass, Heart, Home, Info, Lightbulb, MessageSquareText, Shield, Sparkles } from 'lucide-react';
import { addWardInterest, getListWardItemsQueryKey, type WardItem } from '@workspace/api-client-react';
import { useWardActions, type Kind } from '@/hooks/use-ward';
import { useDevice, useFinishSharedSession } from '@/lib/device-mode';
import { useQueryClient } from '@tanstack/react-query';

const nav = [
  { to: '/', label: 'Today', icon: Home },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/ask', label: 'Ask / Suggest', icon: MessageSquareText },
  { to: '/my-stuff', label: 'My Stuff', icon: ClipboardList },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const {mode,clearedNotice,logoutError,dismissNotice}=useDevice();
  const finish=useFinishSharedSession();
  const finishWithConfirmation=()=>{if(window.confirm('Finish and clear everything entered on this shared device?')) void finish()};
  const active = (to:string) => path === to || (to === '/discover' && ['/activities','/things-to-do','/guide'].includes(path)) || (to === '/ask' && path === '/requests') || (to === '/my-stuff' && path === '/my-stay');
  return <div className="app-shell min-h-[100dvh] lg:flex">
    <aside className="sidebar hidden lg:flex lg:w-[246px] xl:w-[280px] fixed inset-y-0 left-0 flex-col px-5 py-8 z-20">
      <Link href="/" className="flex items-center gap-3 px-3 mb-11" data-testid="link-brand"><Mark /><span className="display text-[25px]">WardSpace<span className="text-[#b77e61]">.</span></span></Link>
      <p className="eyebrow px-4 mb-4">Your ward, at a glance</p>
      <nav aria-label="Main navigation" className="space-y-1.5">{nav.map(({ to, label, icon: Icon }) => <Link key={to} href={to} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ','-')}`} aria-current={active(to)?'page':undefined} className={`nav-link ${active(to) ? 'active' : ''}`}><Icon size={19} strokeWidth={1.8} />{label}</Link>)}</nav>
       <div className="mt-auto px-3 pt-8 text-xs leading-relaxed text-[#758579]"><p className="mb-3">Everyday information, in one place.</p><p className="mb-3 font-semibold" data-testid="device-mode-indicator">{mode==='shared'?'Shared device':'Personal device'}</p>{mode==='shared'&&<button type="button" className="btn btn-outline !min-h-[42px] mb-4 w-full !text-xs" onClick={finishWithConfirmation} data-testid="button-finish-shared">Finish & clear my session</button>}<Link href="/staff" className="underline underline-offset-4 inline-flex items-center gap-2" data-testid="link-staff"><Shield size={14}/> Staff access</Link></div>
    </aside>
    <div className="flex-1 min-w-0 lg:ml-[246px] xl:ml-[280px]">
      <header className="lg:hidden sticky top-0 z-30 bg-[#f8f6ef]/95 backdrop-blur-md border-b border-[#e1dfd5] px-5 h-[68px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" data-testid="link-mobile-brand"><Mark /><span className="display text-[24px]">WardSpace<span className="text-[#b77e61]">.</span></span></Link>
         <span className="eyebrow text-[10px]" data-testid="mobile-device-mode-indicator">{mode==='shared'?'Shared device':'Personal device'}</span>
      </header>
        <nav aria-label="Main navigation" className="lg:hidden grid grid-cols-4 gap-1 px-2 py-2 bg-[#f8f6ef] border-b border-[#e1dfd5]">{nav.map(({ to, label, icon:Icon }) => <Link key={to} href={to} aria-current={active(to)?'page':undefined} data-testid={`link-mobile-${label.toLowerCase().replaceAll(' ','-')}`} className={`mobile-nav-link min-w-0 min-h-[54px] flex flex-col items-center justify-center gap-1 px-1 rounded-xl text-[11px] leading-tight font-bold text-center ${active(to) ? 'is-active bg-[#355a4e]' : ''}`}><Icon size={18}/><span>{label}</span></Link>)}</nav>
       {mode==='shared'&&<div className="lg:hidden flex justify-end px-5 py-2 bg-[#e8eee6]"><button type="button" className="text-sm font-bold text-[#31594b] underline underline-offset-4 min-h-[36px]" onClick={finishWithConfirmation} data-testid="button-mobile-finish-shared">Finish & clear my session</button></div>}
       <main className="max-w-[1190px] mx-auto px-5 sm:px-8 lg:px-10 xl:px-14 py-9 md:py-12 pb-24 fade-in">{clearedNotice&&<div role="status" className="inset p-4 mb-6 flex flex-wrap justify-between gap-3" data-testid="status-shared-cleared"><span>{logoutError?'Your session has been cleared. Staff sign-out could not be confirmed; please tell a member of staff.':'Your session has been cleared.'}</span><button className="underline" onClick={dismissNotice}>Dismiss</button></div>}{children}</main>
       <footer className="max-w-[1190px] mx-auto px-5 sm:px-8 lg:px-10 xl:px-14 pb-9 text-sm text-[#6b7b70] border-t border-[#e3e0d7] pt-6 flex flex-wrap justify-between gap-3"><span>WardSpace · Everyday information, in one place.</span><span className="flex gap-5"><Link href="/about" className="underline underline-offset-4" data-testid="link-footer-about">Privacy & about</Link><Link href="/staff" className="underline underline-offset-4 lg:hidden" data-testid="link-footer-staff">Staff access</Link></span></footer>
    </div>
  </div>;
}
function Mark() { return <span className="w-8 h-8 rounded-[10px] bg-[#365b50] flex items-center justify-center"><span className="block w-[13px] h-[13px] rounded-full border-[3px] border-[#e7bd99] relative after:absolute after:w-[7px] after:h-[3px] after:bg-[#e7bd99] after:top-[2px] after:left-[10px] after:rotate-[-30deg]" /></span>; }
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8 md:mb-10"><div><p className="eyebrow mb-3">{eyebrow}</p><h1 className="display text-[clamp(2.55rem,5vw,4.5rem)] max-w-[760px]">{title}</h1>{description && <p className="mt-4 max-w-[640px] text-[#66766d] text-[1.05rem] leading-relaxed">{description}</p>}</div>{action}</div>;
}
export function SectionTitle({ title, aside }: { title: string; aside?: ReactNode }) { return <div className="flex items-end justify-between gap-3 mb-5"><h2 className="display text-[clamp(1.6rem,2.6vw,2.15rem)]">{title}</h2>{aside}</div>; }
export function State({ loading, error, empty, retry, children }: { loading?: boolean; error?: boolean; empty?: boolean; retry?: () => void; children: ReactNode }) {
  if (loading) return <div className="space-y-3" aria-label="Loading content"><div className="surface h-28 animate-pulse bg-[#e9ece3]" /><div className="surface h-28 animate-pulse bg-[#e9ece3]" /></div>;
  if (error) return <div className="surface p-8 text-center"><h3 className="display text-2xl">Couldn't load this just now.</h3><p className="text-[#66766d] mt-2 mb-5">The information is still here; please try again.</p><button className="btn btn-outline" onClick={retry} data-testid="button-retry">Try again</button></div>;
  if (empty) return <div className="surface p-8 md:p-10 text-center"><Compass size={27} className="mx-auto text-[#9baf9c] mb-3" /><h3 className="display text-2xl">Nothing here at the moment.</h3><p className="text-[#718075] mt-2">Check back another time for something new.</p></div>;
  return <>{children}</>;
}
export function ItemCard({ item, kind, compact = false }: { item: WardItem; kind?: Kind; compact?: boolean }) {
  const actions = useWardActions();
  const {mode}=useDevice();
  const qc=useQueryClient();
  const [sharedThanks,setSharedThanks]=useState(false);
  const [sending,setSending]=useState(false);
  const [sharedError,setSharedError]=useState(false);
  const resetTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(resetTimer.current)clearTimeout(resetTimer.current)},[]);
  async function recordSharedInterest() {
    if(kind!=='activities'&&kind!=='activity-suggestions')return;
    setSending(true);setSharedError(false);
    try {
      await addWardInterest(kind,item.id,{headers:{'X-WardSpace-Device-Mode':'shared'}});
      setSharedThanks(true);
      await qc.invalidateQueries({queryKey:getListWardItemsQueryKey(kind)});
      if(resetTimer.current)clearTimeout(resetTimer.current);
      resetTimer.current=setTimeout(()=>setSharedThanks(false),8000);
    } catch {setSharedError(true)}
    finally {setSending(false)}
  }
  const canInterest = kind === 'activities' || kind === 'activity-suggestions';
  const date = item.date ? new Date(`${item.date}T12:00:00`) : null;
  const dateText = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : undefined;
  return <article className={`surface p-5 md:p-6 ${compact ? '' : 'h-full'} flex flex-col`} data-testid={`card-item-${item.id}`}>
    <div className="flex flex-wrap items-center gap-2 mb-4">{item.category && <span className="pill">{item.category}</span>}{item.status && <span className="pill bg-[#f5e8db] text-[#93674f]">{item.status}</span>}{item.difficulty && <span className="pill">{item.difficulty}</span>}</div>
    <h3 className="display text-[1.38rem] leading-tight">{item.title}</h3>
    {item.description && <p className="text-[#69786d] text-[.93rem] mt-2 leading-relaxed whitespace-pre-line">{item.description}</p>}
    {item.content && <div className="mt-4 text-[#4c6156] whitespace-pre-line text-[.94rem] leading-relaxed">{item.content}</div>}
    {(dateText || item.time || item.location || item.duration || item.preferredTime) && <div className="mt-5 pt-4 border-t border-[#e7e4d9] flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold text-[#567062]">
      {dateText && <span>{dateText}</span>}{item.time && <span>{item.time}{item.endTime ? `–${item.endTime}` : ''}</span>}{item.location && <span>{item.location}</span>}{item.duration && <span>{item.duration}</span>}{item.preferredTime && <span>Preferred: {item.preferredTime}</span>}
    </div>}
    {item.response && <div className="inset mt-5 p-4 text-sm"><span className="eyebrow">What we did</span><p className="mt-1 whitespace-pre-line">{item.response}</p></div>}
    {canInterest && <div className="mt-auto pt-5">{mode==='shared'?<><button type="button" disabled={sending||sharedThanks} onClick={recordSharedInterest} className={`btn ${sharedThanks?'btn-primary':'btn-outline'} !min-h-[43px] !text-[.82rem]`} data-testid={`button-interest-${item.id}`} aria-pressed={false}><Heart size={16}/>{sharedThanks?'Thanks — interest recorded':sending?'Recording…':'I’m in'}</button><p className="text-xs text-[#6d7e71] mt-2">{item.interestCount} interested · Anonymous count is an indication, not attendance.</p>{sharedError&&<p role="alert" className="text-[#9d5547] text-xs mt-2">Couldn't record interest. Try again.</p>}</>:<><button type="button" disabled={actions.addInterest.isPending || actions.removeInterest.isPending} onClick={() => item.interested ? actions.removeInterest.mutate({ kind, id: item.id }) : actions.addInterest.mutate({ kind, id: item.id })} className={`btn ${item.interested ? 'btn-primary' : 'btn-outline'} !min-h-[43px] !text-[.82rem]`} data-testid={`button-interest-${item.id}`} aria-pressed={item.interested}><Heart size={16} fill={item.interested ? 'currentColor' : 'none'} />{item.interested ? 'Interested' : 'I’m interested'} · {item.interestCount}</button>{(actions.addInterest.isError || actions.removeInterest.isError) && <p className="text-[#9d5547] text-xs mt-2">Couldn't save your interest. Try again.</p>}</>}</div>}
  </article>;
}
export function LinkCard({ to, label, text, icon: Icon, tone = 'sage' }: { to: string; label: string; text: string; icon: typeof Home; tone?: 'sage' | 'peach' }) { return <Link href={to} className={`group block rounded-[20px] p-6 min-h-[190px] relative transition-transform hover:-translate-y-1 ${tone === 'sage' ? 'bg-[#e5eae0]' : 'bg-[#f2e5d9]'}`} data-testid={`link-card-${to.replaceAll('/','')}`}><Icon className="text-[#527263]" size={23} strokeWidth={1.6} /><h3 className="display text-[1.6rem] mt-6">{label}</h3><p className="text-sm text-[#66766d] mt-1 pr-7">{text}</p><ArrowRight size={19} className="absolute right-6 bottom-6 group-hover:translate-x-1 transition-transform" /></Link>; }
export { ArrowRight, BookOpen, CalendarDays, ClipboardList, Compass, Heart, Home, Info, Lightbulb, MessageSquareText, Shield, Sparkles };