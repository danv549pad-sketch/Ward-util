import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Clock3 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getGetCurrentDailyChallengeQueryKey, getListWardItemsQueryKey, useGetCurrentDailyChallenge, useListWardItems, type WardItem } from '@workspace/api-client-react';
import { currentAndNext, todayEvents } from '@/lib/public-timeline';

const visible=(x:WardItem)=>x.published!==false&&x.active!==false&&!['draft','cancelled','declined','archived'].includes(x.status?.toLowerCase()||'');
function publicUrl() {
  try {
    const url = new URL(import.meta.env.VITE_WARDSPACE_PUBLIC_URL || import.meta.env.BASE_URL || '/', window.location.origin);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export function NoticeboardPage(){
  const [time,setTime]=useState(new Date()),[panel,setPanel]=useState(0);
  const schedule=useListWardItems('schedule',{query:{queryKey:getListWardItemsQueryKey('schedule'),refetchInterval:60000}}),activities=useListWardItems('activities',{query:{queryKey:getListWardItemsQueryKey('activities'),refetchInterval:60000}}),announcements=useListWardItems('announcements',{query:{queryKey:getListWardItemsQueryKey('announcements'),refetchInterval:60000}}),ideas=useListWardItems('activity-suggestions',{query:{queryKey:getListWardItemsQueryKey('activity-suggestions'),refetchInterval:60000}}),suggestions=useListWardItems('suggestions',{query:{queryKey:getListWardItemsQueryKey('suggestions'),refetchInterval:60000}});
  const challenge=useGetCurrentDailyChallenge({query:{queryKey:getGetCurrentDailyChallengeQueryKey(),refetchInterval:60000}});
  useEffect(()=>{const tick=setInterval(()=>setTime(new Date()),15000),rotate=setInterval(()=>setPanel(v=>v+1),12000);return()=>{clearInterval(tick);clearInterval(rotate)}},[]);
  const events=todayEvents(schedule.data||[],activities.data||[],time);
  const {current,next}=currentAndNext(events,time);
  const notices=(announcements.data||[]).filter(visible).slice(0,3);
  const popular=(ideas.data||[]).filter(x=>visible(x)&&x.status?.toLowerCase()==='approved').sort((a,b)=>b.interestCount-a.interestCount).slice(0,3);
  // Only explicitly published staff-reviewed responses, never the private suggestion queue.
  const responses=(suggestions.data||[]).filter(x=>x.published===true&&visible(x)&&!!x.response).slice(0,2);
  const link=publicUrl();
  const panels=[
    {label:current?'Happening now':'Next up',content:<>{(current||next)?<><h1 className="board-title">{(current||next)?.title}</h1><p className="board-detail mt-7">{[(current||next)?.time,(current||next)?.location].filter(Boolean).join(' · ')}</p></>:<><h1 className="board-title">Welcome to today.</h1><p className="board-detail mt-7">No activities scheduled just now.</p></>}</>},
    {label:'Today’s timeline',content:events.length?<div className="grid md:grid-cols-2 gap-x-10 gap-y-4">{events.slice(0,8).map(x=><div key={`${x.kind}-${x.id}`} className="flex gap-6 border-b border-[#dbe3d8] pb-3 board-detail"><strong className="tabular-nums">{x.time?.slice(0,5)||'—'}</strong><span>{x.title}</span></div>)}</div>:<p className="board-detail">Nothing scheduled yet. Check back soon.</p>},
    {label:'From the noticeboard',content:notices.length?<div className="space-y-8">{notices.map(x=><div key={x.id}><h1 className="board-title !text-[clamp(2.5rem,4vw,5rem)]">{x.title}</h1>{x.description&&<p className="board-detail mt-2">{x.description}</p>}</div>)}</div>:<p className="board-detail">No announcements at the moment.</p>},
    ...(challenge.data?.challenge?[{label:'Today’s challenge',content:<><h1 className="board-title">{challenge.data.challenge.title}</h1><p className="board-detail mt-7">{challenge.data.challenge.instructions}</p></>}]:[]),
    ...(popular.length?[{label:'What should we do next?',content:<div className="space-y-6">{popular.map(x=><div key={x.id} className="board-detail border-b border-[#dbe3d8] pb-4 flex justify-between gap-5"><strong>{x.title}</strong><span>{x.interestCount} interested</span></div>)}</div>}]:[]),
    ...(responses.length?[{label:'You said / We did',content:<div className="space-y-9">{responses.map(x=><div key={x.id}><p className="uppercase tracking-wider font-bold text-[#638374]">You said</p><h2 className="board-detail font-bold">{x.title}</h2><p className="uppercase tracking-wider font-bold text-[#638374] mt-4">We did</p><p className="board-detail">{x.response}</p></div>)}</div>}]:[]),
  ];
  const active=panels[panel%panels.length];
  return <div className="board"><header className="flex flex-wrap items-center justify-between gap-5 mb-7"><div><p className="uppercase text-sm font-bold tracking-[.16em] text-[#638374]">WardSpace · Noticeboard</p><p className="display text-2xl mt-1">{time.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})}</p></div><div className="flex items-center gap-3 display text-[clamp(2rem,4vw,4rem)] tabular-nums"><Clock3 size={32}/>{time.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</div></header>
    <main className="board-panel" key={active.label}><p className="eyebrow mb-8 !text-[#638374]">{active.label}</p>{schedule.isLoading||activities.isLoading||announcements.isLoading?<div className="h-40 bg-[#e8eee7] rounded-2xl animate-pulse"/>:schedule.isError||activities.isError||announcements.isError?<div><p className="board-detail">The noticeboard couldn’t update.</p><button className="btn btn-outline mt-5" onClick={()=>{schedule.refetch();activities.refetch();announcements.refetch()}}>Try again</button></div>:active.content}</main>
    <footer className="flex flex-wrap items-center justify-between gap-5 mt-6">
      <div><span className="text-lg font-semibold text-[#536d5d]">Everyday information for our ward</span><div className="flex gap-2 mt-3" aria-label={`Panel ${(panel%panels.length)+1} of ${panels.length}`}>{panels.map((x,i)=><span key={x.label} className={`h-2 rounded-full ${i===panel%panels.length?'w-10 bg-[#325e4d]':'w-2 bg-[#a6bdad]'}`}/>)}</div></div>
      {link && <div className="flex items-center gap-4 bg-[#fcfaf4] rounded-2xl p-3 pr-5"><div className="bg-[#fcfaf4] p-2 rounded-xl" aria-hidden="true"><QRCodeSVG value={link} size={112} level="M" bgColor="#fcfaf4" fgColor="#23483b" marginSize={0}/></div><div><p className="text-xl font-bold text-[#274a3e]">Scan to open WardSpace</p><p className="text-sm text-[#596d5f] break-all max-w-64">{link}</p><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4 mt-2" data-testid="link-board-home">Open on this device <ArrowRight size={17}/></Link></div></div>}
    </footer>
  </div>;
}