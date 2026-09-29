import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { ArrowRight, BookOpen, CalendarDays, ClipboardList, Clock3, MessageSquareText, Search, Sparkles, WashingMachine, BedDouble, Utensils, DoorOpen, UserRound, Package, Puzzle } from 'lucide-react';
import { getGetCurrentDailyChallengeQueryKey, useGetCurrentDailyChallenge, useListWardItems, useSubmitChallengeEntry, type WardItem } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage, useWardActions } from '@/hooks/use-ward';
import { ItemCard, PageHeading, SectionTitle, State } from '@/components/ward-ui';
import { currentAndNext, localDay, todayEvents } from '@/lib/public-timeline';

const timeLabel = (s?:string) => s ? s.slice(0,5) : 'Time to be confirmed';
const isPublic = (x:WardItem) => x.published !== false && x.active !== false && !['cancelled','declined','archived','draft'].includes(x.status?.toLowerCase()||'');

export function TodayPage() {
  const [now,setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = window.setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, []);
  const clock = now.toTimeString().slice(0,5);
  const schedule = useListWardItems('schedule'), activities = useListWardItems('activities'), announcements = useListWardItems('announcements');
  const events = todayEvents(schedule.data||[],activities.data||[],now);
  const {current,next} = currentAndNext(events,now);
  const nextIndex = events.findIndex(x=>x.id===next?.id && x.kind===next?.kind);
  const evening = events.filter(x=>x.time && x.time>clock && x.time>='17:00').slice(0,3);
  const greeting = now.getHours()<12?'Good morning':now.getHours()<17?'Good afternoon':'Good evening';
  return <>
    <div className="mb-7 md:mb-9"><p className="date-line mb-2">{now.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})} · WardSpace</p><h1 className="today-title">{greeting}.</h1><p className="text-[#526e60] mt-3 text-lg">Here’s what’s happening today.</p></div>
    <section className="feature-card mb-9" aria-label="Now and next">
      <p className="eyebrow mb-4">{current?'Happening now':'Next up'}</p>
      {schedule.isLoading||activities.isLoading?<div className="h-24 rounded-xl bg-[#527768] animate-pulse"/>:schedule.isError||activities.isError?<div><p>Couldn’t load today’s plans.</p><button className="btn btn-light mt-4" onClick={()=>{schedule.refetch();activities.refetch()}}>Try again</button></div>:next?<div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5"><div><h2 className="display text-[clamp(2rem,4vw,3.5rem)]">{next.title}</h2><p className="text-[#dce9dd] mt-3 text-lg">{[timeLabel(next.time),next.location].filter(Boolean).join(' · ')}</p>{next.kind==='activities'&&<p className="text-[#c8ddce] mt-2 text-sm">{next.interestCount} interested</p>}</div><Link href="/discover#activities" className="btn btn-light self-start md:self-auto" data-testid="link-view-today-activity">View activities <ArrowRight size={17}/></Link></div>:<div><h2 className="display text-3xl">Nothing scheduled just now.</h2><p className="text-[#dce9dd] mt-2">Explore something to do at your own pace.</p><Link href="/discover#things" className="btn btn-light mt-5">Find something to do <ArrowRight size={17}/></Link></div>}
    </section>
    <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-8 lg:gap-10 mb-11">
      <section><SectionTitle title="Today’s timeline" /><State loading={schedule.isLoading||activities.isLoading} error={schedule.isError||activities.isError} empty={!events.length} retry={()=>{schedule.refetch();activities.refetch()}}><div className="timeline">{events.map((item,i)=><div key={`${item.kind}-${item.id}`} className={`timeline-row ${i===nextIndex?'highlight':(nextIndex>=0&&i<nextIndex)||(nextIndex<0&&!!item.time&&item.time<clock)?'past':''}`}><span className="font-bold text-[#3e6655] tabular-nums">{item.time?timeLabel(item.time):'Anytime'}</span><div className="min-w-0"><strong className="text-[#284a3f]">{item.title}</strong>{item.location&&<p className="text-sm text-[#6b7e70]">{item.location}</p>}</div></div>)}</div></State></section>
      <section><SectionTitle title="A few useful places" /><div className="grid grid-cols-2 gap-3">{[
        {to:'/discover#activities',title:'What’s on',Icon:CalendarDays},
        {to:'/discover#things',title:'Find something to do',Icon:Sparkles},
        {to:'/ask',title:'Request something',Icon:MessageSquareText},
        {to:'/discover#guide',title:'Ward guide',Icon:BookOpen},
      ].map(({to,title,Icon})=><Link key={title} href={to} className="quick-tile group" data-testid={`link-quick-${title.toLowerCase().replaceAll(' ','-')}`}><Icon size={25} strokeWidth={1.7} className="text-[#416b58]"/><span className="flex justify-between items-end gap-2 font-bold text-[#2e5345] leading-tight">{title}<ArrowRight size={16} className="shrink-0 group-hover:translate-x-1 transition-transform"/></span></Link>)}</div></section>
    </div>
    {evening.length>0&&<section className="mb-10"><SectionTitle title="Later today" /><div className="grid sm:grid-cols-2 gap-3">{evening.map(x=><div key={`${x.kind}-${x.id}`} className="surface p-5 flex items-start gap-4"><div className="rounded-xl bg-[#e3eae0] p-3 text-[#436b58]"><Clock3 size={22}/></div><div><span className="eyebrow">{timeLabel(x.time)}</span><h3 className="display text-xl mt-1">{x.title}</h3>{x.location&&<p className="text-sm text-[#687b6d] mt-1">{x.location}</p>}</div></div>)}</div></section>}
    <section><SectionTitle title="Noticeboard" /><State loading={announcements.isLoading} error={announcements.isError} empty={!announcements.data?.filter(isPublic).length} retry={()=>announcements.refetch()}><div className="surface divide-y divide-[#e8e7dc]">{announcements.data?.filter(isPublic).slice(0,3).map(item=><div className="px-5 py-4" key={item.id}><strong className="text-[#2b5142]">{item.title}</strong>{item.description&&<p className="text-sm text-[#697b6f] mt-1">{item.description}</p>}</div>)}</div></State></section>
  </>;
}

function ActivitySection() {
  const activities = useListWardItems('activities');
  const ideas = useListWardItems('activity-suggestions');
  const upcoming = (activities.data||[]).filter(isPublic).filter(x=>!x.date||x.date>=localDay(new Date())).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''));
  const approved = (ideas.data||[]).filter(x=>isPublic(x)&&x.status?.toLowerCase()==='approved').sort((a,b)=>b.interestCount-a.interestCount);
  return <section id="activities" className="scroll-mt-36 mb-14"><SectionTitle title="What’s on" aside={<Link href="/ask?type=activity" className="text-sm font-bold text-[#315b4b] underline underline-offset-4">Suggest an activity</Link>}/><State loading={activities.isLoading} error={activities.isError} empty={!upcoming.length} retry={()=>activities.refetch()}><div className="grid md:grid-cols-2 gap-4">{upcoming.map(x=><ItemCard key={x.id} item={x} kind="activities"/>)}</div></State>
    <div className="mt-10 rounded-[22px] bg-[#e7ebe3] p-5 md:p-8"><p className="eyebrow mb-2">Ideas from the ward</p><SectionTitle title="What should we do next?" /><p className="text-[#5d7566] mb-5">See an idea you’d join? Let us know.</p><State loading={ideas.isLoading} error={ideas.isError} empty={!approved.length} retry={()=>ideas.refetch()}><div className="grid md:grid-cols-2 gap-4">{approved.map(x=><ItemCard key={x.id} item={x} kind="activity-suggestions"/>)}</div></State></div>
  </section>;
}

const moods = ['Something easy','Something creative','Something social','Learn something','Use my brain','Move around','Just kill some time'];
const timeOptions = ['Any time','5 minutes','15 minutes','30 minutes','1 hour','Longer'];
function durationMinutes(text?:string) { if(!text)return null; const n=Number(text.match(/\d+/)?.[0]); if(!Number.isFinite(n))return null; return /hour/i.test(text)?n*60:n; }
function matchesMood(item:WardItem,mood:string) { if(!mood)return true; const text=`${item.category||''} ${item.difficulty||''} ${item.title||''}`.toLowerCase(); const words:Record<string,string[]>={'Something easy':['easy','quiet','relax','simple'],'Something creative':['creativ','art','draw','writ','craft'],'Something social':['social','game','group','conversation'],'Learn something':['learn','skill','technology','language'],'Use my brain':['puzzle','quiz','brain','logic','word'],'Move around':['mov','walk','exercise','outdoor'],'Just kill some time':['game','film','fun','entertainment']}; return words[mood]?.some(word=>text.includes(word))??true; }
function ThingsSection(){
  const things=useListWardItems('things-to-do'),learning=useListWardItems('learning');
  const [time,setTime]=useState('Any time'),[mood,setMood]=useState('');
  const minutes=durationMinutes(time);
  const results=(things.data||[]).filter(isPublic).filter(x=>(minutes===null||durationMinutes(x.duration)===null||(durationMinutes(x.duration)??0)<=minutes)&&matchesMood(x,mood));
  const lessons=(learning.data||[]).filter(isPublic);
  return <section id="things" className="scroll-mt-36 mb-14"><p className="eyebrow mb-2">At your own pace</p><SectionTitle title="What do you feel like doing?" /><div className="surface p-5 md:p-7 mb-6"><h3 className="font-bold mb-3">How much time have you got?</h3><div className="segmented mb-6">{timeOptions.map(t=><button key={t} aria-pressed={time===t} onClick={()=>setTime(t)} data-testid={`button-time-${t.toLowerCase().replaceAll(' ','-')}`}>{t}</button>)}</div><h3 className="font-bold mb-3">What are you in the mood for? <span className="font-normal text-[#718074]">(optional)</span></h3><div className="segmented">{moods.map(m=><button key={m} aria-pressed={mood===m} onClick={()=>setMood(mood===m?'':m)} data-testid={`button-mood-${m.toLowerCase().replaceAll(' ','-')}`}>{m}</button>)}</div></div>
    <State loading={things.isLoading} error={things.isError} empty={!results.length} retry={()=>things.refetch()}><div className="grid md:grid-cols-2 gap-4">{results.map(x=><ItemCard key={x.id} item={x} kind="things-to-do"/>)}</div></State>
    <div className="mt-10"><SectionTitle title="Learn something new" /><State loading={learning.isLoading} error={learning.isError} empty={!lessons.length} retry={()=>learning.refetch()}><div className="grid md:grid-cols-2 gap-4">{lessons.map(x=><details className="surface group" key={x.id}><summary className="cursor-pointer list-none p-5 md:p-6 [&::-webkit-details-marker]:hidden"><span className="pill mb-3">{x.category||'Learning'}{x.duration?` · ${x.duration}`:''}</span><span className="display text-2xl block">{x.title}</span><span className="text-sm text-[#5c7866] underline underline-offset-4 mt-3 inline-block group-open:hidden">Read more</span></summary><div className="px-5 md:px-6 pb-6 text-[#4a6455] whitespace-pre-wrap leading-relaxed">{x.description}{x.content&&<p className="mt-4 pt-4 border-t border-[#e5e6dc]">{x.content}</p>}</div></details>)}</div></State></div>
  </section>;
}

const guideCategories=['Daily Routine','Staff Roles','Meals','Visiting','Phones & Devices','Laundry','Activities','Ward Round','Leave','Advocacy','Feedback','Discharge Planning'];
function GuideSection(){
  const guide=useListWardItems('ward-guide');
  const [search,setSearch]=useState(''),[category,setCategory]=useState('');
  const articles=(guide.data||[]).filter(isPublic).filter(x=>!category||x.category?.toLowerCase()===category.toLowerCase()).filter(x=>`${x.title} ${x.category||''} ${x.description||''} ${x.content||''}`.toLowerCase().includes(search.toLowerCase()));
  return <section id="guide" className="scroll-mt-36 mb-8"><p className="eyebrow mb-2">Everyday answers</p><SectionTitle title="Ward guide" /><p className="text-[#607568] mb-6">Arrangements may vary between wards. Check with staff if you’re unsure.</p><div className="relative max-w-[640px] mb-5"><Search size={18} className="absolute left-4 top-4 text-[#698373]"/><label htmlFor="discover-guide-search" className="sr-only">Search the ward guide</label><input id="discover-guide-search" type="search" className="field !pl-11" placeholder="Search meals, visits, laundry…" value={search} onChange={e=>setSearch(e.target.value)} data-testid="input-guide-search"/></div>
    <div className="flex flex-wrap gap-2 mb-6"><button className={`btn !min-h-[41px] !text-sm ${!category?'btn-primary':'btn-soft'}`} onClick={()=>setCategory('')} aria-pressed={!category}>All topics</button>{guideCategories.map(x=><button key={x} onClick={()=>setCategory(x===category?'':x)} aria-pressed={x===category} className={`btn !min-h-[41px] !text-sm ${x===category?'btn-primary':'btn-soft'}`}>{x}</button>)}</div>
    <State loading={guide.isLoading} error={guide.isError} empty={!articles.length} retry={()=>guide.refetch()}><div className="space-y-3">{articles.map(x=><details key={x.id} className="surface group"><summary className="cursor-pointer list-none p-5 flex justify-between gap-4 items-center [&::-webkit-details-marker]:hidden"><span><span className="eyebrow block mb-1">{x.category||'Ward guide'}</span><strong className="text-lg">{x.title}</strong></span><span className="text-2xl text-[#5b7969] group-open:rotate-45 transition-transform">+</span></summary><div className="px-5 pb-5 pt-4 border-t border-[#e5e6dc] whitespace-pre-wrap leading-relaxed text-[#566d5f]">{x.description}{x.content&&<p className="mt-3">{x.content}</p>}</div></details>)}</div></State>
  </section>;
}

export function DiscoverPage(){
  useEffect(()=>{const target=decodeURIComponent(window.location.hash.slice(1));if(target){const frame=requestAnimationFrame(()=>document.getElementById(target)?.scrollIntoView());return()=>cancelAnimationFrame(frame)}return undefined},[]);
  return <><PageHeading eyebrow="Discover" title="Find your next thing." description="Join what’s happening, fill a little time, or find an everyday answer."/><div className="grid sm:grid-cols-3 gap-3 mb-12"><a href="#activities" className="quick-tile !min-h-[110px]"><CalendarDays size={22}/><strong>What’s on</strong></a><a href="#things" className="quick-tile !min-h-[110px]"><Sparkles size={22}/><strong>Things to do</strong></a><a href="#guide" className="quick-tile !min-h-[110px]"><BookOpen size={22}/><strong>Ward guide</strong></a></div><ChallengeSection/><ActivitySection/><ThingsSection/><GuideSection/></>;
}

function ChallengeSection(){
  const challenge=useGetCurrentDailyChallenge();
  const send=useSubmitChallengeEntry();
  const qc=useQueryClient();
  const [text,setText]=useState(''),[message,setMessage]=useState('');
  const current=challenge.data?.challenge;
  if(challenge.isLoading)return <div className="surface h-40 animate-pulse mb-12"/>;
  if(challenge.isError)return <section className="surface p-6 mb-12"><h2 className="display text-2xl">Today’s challenge is unavailable.</h2><button className="btn btn-outline mt-4" onClick={()=>challenge.refetch()}>Try again</button></section>;
  if(!current)return null;
  return <section className="rounded-[22px] bg-[#e9e4d7] p-6 md:p-9 mb-14" aria-labelledby="challenge-title"><p className="eyebrow mb-2">Today’s challenge · {current.category}</p><h2 id="challenge-title" className="display text-3xl md:text-4xl">{current.title}</h2><p className="text-[#4b6355] mt-4 whitespace-pre-wrap max-w-[65ch]">{current.instructions}</p>
    {current.allowSubmissions&&<form className="mt-7 max-w-[650px]" onSubmit={async e=>{e.preventDefault();setMessage('');try{await send.mutateAsync({data:{text:text.trim()}});setText('');setMessage('Thanks. Your entry has been sent for review.');await qc.invalidateQueries({queryKey:getGetCurrentDailyChallengeQueryKey()})}catch(err){setMessage(errorMessage(err))}}}><label className="label" htmlFor="challenge-entry">Share a text entry (optional, anonymous)</label><textarea id="challenge-entry" className="field" required maxLength={1000} value={text} onChange={e=>setText(e.target.value)} placeholder="Your idea or answer…" data-testid="input-challenge-entry"/><button className="btn btn-primary mt-3" disabled={!text.trim()||send.isPending} data-testid="button-send-challenge">{send.isPending?'Sending…':'Send entry'}</button></form>}
    {message&&<p role="status" className="mt-4 text-[#375c4a]">{message}</p>}
    {!!challenge.data?.submissions.length&&<div className="mt-8 border-t border-[#d4d0c3] pt-5"><h3 className="font-bold mb-3">Shared entries</h3><div className="grid sm:grid-cols-2 gap-3">{challenge.data.submissions.map(x=><p key={x.id} className="bg-[#f9f7ee] rounded-xl p-4 whitespace-pre-wrap">{x.text}</p>)}</div></div>}
  </section>;
}

const requestCategories=[
  {name:'Toiletries',Icon:Package},{name:'Bedding',Icon:BedDouble},{name:'Clothes / Laundry',Icon:WashingMachine},{name:'Books / Games',Icon:Puzzle},
  {name:'Food / Drink Question',Icon:Utensils},{name:'Something In My Room',Icon:DoorOpen},{name:'I’d Like To Speak To Someone',Icon:UserRound},{name:'Something Else',Icon:ClipboardList},
];
const requestCategoryValue:Record<string,string>={
  'Clothes / Laundry':'Laundry',
  'Food / Drink Question':'Food / Drink question',
  'Something In My Room':'Room issue',
  'I’d Like To Speak To Someone':'Speak to someone',
  'Something Else':'Other practical request',
};
export function AskPage(){
  const [tab,setTab]=useState<'request'|'activity'|'suggestion'>(()=>{const t=new URLSearchParams(window.location.search).get('type');return t==='activity'?'activity':t==='suggestion'?'suggestion':'request'});
  const [category,setCategory]=useState(''),[title,setTitle]=useState(''),[detail,setDetail]=useState(''),[location,setLocation]=useState(''),[notice,setNotice]=useState('');
  const actions=useWardActions(),suggestions=useListWardItems('suggestions');
  const published=(suggestions.data||[]).filter(x=>x.response && isPublic(x));
  const submit=async(e:FormEvent)=>{e.preventDefault();setNotice('');try{
    await actions.create.mutateAsync({kind:tab==='request'?'requests':tab==='activity'?'activity-suggestions':'suggestions',data:{category:tab==='request'?(requestCategoryValue[category]||category):category,title:title.trim(),description:detail.trim(),location:tab==='request'?location.trim():undefined}});
    setTitle('');setDetail('');setCategory('');setLocation('');setNotice('Thank you. Your message has been shared. For anything urgent, please speak directly to staff.');
  }catch(err){setNotice(errorMessage(err))}};
  return <><PageHeading eyebrow="Ask / Suggest" title="Have your say." description="Ask for an everyday item or share an idea. No name needed."/>
    <div className="rounded-[16px] bg-[#f2e9db] border border-[#e5d5be] p-5 mb-8 text-[#614d3a]"><strong>Need help now?</strong><p className="text-sm mt-1">WardSpace is for non-urgent messages and is not monitored for emergencies. Please speak directly to a member of staff for urgent help.</p></div>
    <div className="segmented mb-7" role="group" aria-label="Choose what to share">{([['request','Request something'],['activity','Suggest an activity'],['suggestion','Share an idea']] as const).map(([key,label])=><button key={key} aria-pressed={tab===key} onClick={()=>{setTab(key);setCategory('');setNotice('')}}>{label}</button>)}</div>
    <div className="grid lg:grid-cols-[1.08fr_.92fr] gap-9">
      <section><div className="surface p-5 md:p-8"><h2 className="display text-2xl md:text-3xl mb-3">{tab==='request'?'What do you need?':tab==='activity'?'What could we do together?':'What could be better?'}</h2><p className="text-[#64796c] mb-6 text-sm">{tab==='request'?'Choose a category, then tell us a little more.':tab==='activity'?'An activity you would like to see on the ward.':'Your ideas can help make everyday life here better.'}</p>
      {tab==='request'&&<div className="grid sm:grid-cols-2 gap-2 mb-6">{requestCategories.map(({name,Icon})=><button type="button" key={name} className={`choice ${category===name?'selected':''}`} aria-pressed={category===name} onClick={()=>setCategory(name)}><Icon size={21} strokeWidth={1.8}/><span>{name}</span></button>)}</div>}
      {category==='I’d Like To Speak To Someone'&&tab==='request'&&<div className="inset p-4 mb-5 text-sm text-[#425d4e]"><strong>Want to speak with someone?</strong><p className="mt-1">You can leave a non-urgent request to speak with staff. If you need help now, feel unsafe, or need urgent assistance, please speak directly to a member of staff rather than using WardSpace.</p></div>}
      <form onSubmit={submit} className="space-y-4">
        {tab!=='request'&&<div><label htmlFor="ask-category" className="label">Category</label><select className="field" id="ask-category" value={category} required onChange={e=>setCategory(e.target.value)}><option value="">Choose a category</option>{(tab==='activity'?['Creative','Games','Movement','Music','Social','Quiet time','Other']:['Activities','Ward Environment','Entertainment','Food','Facilities','General Improvement']).map(x=><option key={x}>{x}</option>)}</select></div>}
        {(!tab||tab!=='request'||category)&&<><div><label htmlFor="ask-title" className="label">{tab==='request'?'What do you need?':tab==='activity'?'Activity idea':'Give your idea a short title'}</label><input className="field" id="ask-title" maxLength={180} required value={title} onChange={e=>setTitle(e.target.value)} placeholder={tab==='request'?'Tell us in a sentence':'A short title'} data-testid="input-ask-title"/></div>
        {tab!=='request'&&<div><label htmlFor="ask-detail" className="label">A little more detail (optional)</label><textarea id="ask-detail" className="field" maxLength={3000} value={detail} onChange={e=>setDetail(e.target.value)} data-testid="input-ask-detail"/></div>}
        {tab==='request'&&<div><label htmlFor="ask-location" className="label">Room or location (optional)</label><input id="ask-location" className="field" maxLength={100} value={location} onChange={e=>setLocation(e.target.value)} data-testid="input-ask-location"/></div>}
        <button disabled={actions.create.isPending} className="btn btn-primary" data-testid="button-ask-submit">{actions.create.isPending?'Sending…':tab==='request'?'Submit request':'Share anonymously'} <ArrowRight size={16}/></button></>}
      </form>{notice&&<p role="status" className="inset p-4 mt-5" data-testid="status-ask">{notice}</p>}</div></section>
      <section><p className="eyebrow mb-2">Your voice matters</p><SectionTitle title="You said / We did" /><p className="text-[#607568] mb-5">Ideas from the ward and what happened next.</p><State loading={suggestions.isLoading} error={suggestions.isError} empty={!published.length} retry={()=>suggestions.refetch()}><div className="space-y-3">{published.map(item=><article key={item.id} className="surface p-5 md:p-6"><span className="eyebrow">You said</span><h3 className="display text-xl mt-2">{item.title}</h3><div className="mt-5 pt-4 border-t border-[#dce4d9]"><span className="eyebrow">We did</span><p className="text-[#41634e] mt-2">{item.response}</p></div>{item.status&&<span className="pill mt-4">{item.status}</span>}</article>)}</div></State></section>
    </div>
  </>;
}