import { useState } from 'react';
import { Link } from 'wouter';
import { BookOpen, Heart, Trash2 } from 'lucide-react';
import { PageHeading, SectionTitle } from '@/components/ward-ui';
import { sharedStuffKey, useDevice, useFinishSharedSession, type DeviceMode } from '@/lib/device-mode';
import { BrandIdentity, PrototypeLabel } from '@/components/branding';
import { branding } from '@/lib/branding';

type StuffTask = { id: string; text: string; done: boolean };
type ListKey = 'ask' | 'sort' | 'today';
type StuffData = { tasks: Record<ListKey, StuffTask[]>; notes: string };

const lists: { key: ListKey; title: string; placeholder: string }[] = [
  { key: 'ask', title: 'Things I want to ask', placeholder: 'Something I’d like to ask about' },
  { key: 'sort', title: 'Things I need to sort', placeholder: 'Something to remember' },
  { key: 'today', title: 'Things I want to do today', placeholder: 'A small plan for today' },
];
// Keep the legacy key so existing tasks and notes survive the rename.
const storageKey = 'wardspace-my-stay';
const emptyStuff = (): StuffData => ({ tasks: { ask: [], sort: [], today: [] }, notes: '' });

function loadStuff(mode: DeviceMode): StuffData {
  try {
    const storage = mode === 'shared' ? sessionStorage : localStorage;
    const key = mode === 'shared' ? sharedStuffKey : storageKey;
    const raw = storage.getItem(key);
    if (!raw) return emptyStuff();
    const parsed: unknown = JSON.parse(raw);
    const source = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    const oldTasks = source.tasks && typeof source.tasks === 'object' ? source.tasks as Record<string, unknown> : {};
    const tasks = emptyStuff().tasks;
    for (const { key } of lists) {
      const entries = oldTasks[key];
      tasks[key] = Array.isArray(entries)
        ? entries.filter((task: unknown): task is StuffTask =>
            !!task && typeof task === 'object' &&
            typeof (task as StuffTask).id === 'string' &&
            typeof (task as StuffTask).text === 'string' &&
            typeof (task as StuffTask).done === 'boolean')
        : [];
    }
    const clean = { tasks, notes: typeof source.notes === 'string' ? source.notes : '' };
    // Discards the old check-in field even when the person never edits their notes.
    storage.setItem(key, JSON.stringify(clean));
    return clean;
  } catch {
    return emptyStuff();
  }
}

export function MyStuffPage() {
  const {mode,sessionActive,resetVersion,startSession}=useDevice();
  const [error,setError]=useState('');
  if (mode==='shared'&&!sessionActive) return <>
    <PageHeading eyebrow="My Stuff" title="This is a shared device" description="Anything you add to My Stuff during this session will be removed when you finish." />
    <div className="surface p-6 md:p-9 max-w-[680px]">
      <p className="text-[#415181] mb-5">Personal notes on this shared device are temporary and will be removed when you finish your session. They are never sent to WardSpace.</p>
      <button className="btn btn-primary" onClick={()=>{if(!startSession())setError('Temporary storage is unavailable. Please ask staff for help.')}} data-testid="button-start-shared-session">Start My Session</button>
      {error&&<p role="alert" className="mt-4 text-[#9d5547]">{error}</p>}
    </div>
  </>;
  return <StuffEditor key={`${mode}-${resetVersion}`} mode={mode}/>;
}

function StuffEditor({mode}:{mode:DeviceMode}) {
  const [data, setData] = useState<StuffData>(()=>loadStuff(mode));
  const [drafts, setDrafts] = useState<Record<ListKey, string>>({ ask: '', sort: '', today: '' });
  const [saved, setSaved] = useState(true);
  const finish = useFinishSharedSession();
  function update(next: StuffData) {
    setData(next);
    try {
      (mode==='shared'?sessionStorage:localStorage).setItem(mode==='shared'?sharedStuffKey:storageKey, JSON.stringify(next));
      setSaved(true);
    }
    catch { setSaved(false); }
  }
  function changeTasks(key: ListKey, tasks: StuffTask[]) {
    update({ ...data, tasks: { ...data.tasks, [key]: tasks } });
  }
  function addTask(key: ListKey) {
    const text = drafts[key].trim();
    if (!text) return;
    changeTasks(key, [...data.tasks[key], { id: crypto.randomUUID(), text, done: false }]);
    setDrafts(d => ({ ...d, [key]: '' }));
  }
  return <>
    <PageHeading eyebrow="Just for you" title="My Stuff" description="Keep track of everyday plans, questions and reminders. Nothing here is sent to WardSpace." action={mode==='shared'?<button className="btn btn-outline" onClick={()=>{if(window.confirm('Finish and clear everything entered on this shared device?'))void finish()}} data-testid="button-finish-my-stuff">Finish & clear my session</button>:undefined} />
    <div className="rounded-[7px] bg-[#E5F0F4] border-l-4 border-[#027C96] p-5 mb-9 max-w-[850px]">
      <strong>{mode==='shared'?'Temporary on this shared device.':'Only on this device.'}</strong>
      <p className="text-sm text-[#334969] mt-1">{mode==='shared'?'Personal notes on this shared device are temporary and will be removed when you finish your session or after inactivity. They are not sent to the server. Please finish your session before handing over the tablet.':'These notes are stored on this device only and are not part of your medical record. They are not sent to the server or shared with staff. Anyone using this browser may be able to see them.'}</p>
    </div>
    <div className="grid lg:grid-cols-2 gap-5">
      {lists.map(({ key, title, placeholder }) => {
        const completed = data.tasks[key].filter(task => task.done).length;
        return <section key={key} className="surface p-6 md:p-8">
          <SectionTitle title={title} />
          <p className="text-[#708075] text-sm mb-4" data-testid={`progress-${key}`}>{completed} of {data.tasks[key].length} done</p>
           <div className="h-1.5 rounded-full bg-[#d4e0e8] mb-5 overflow-hidden">
             <div className="h-full bg-[#027C96] transition-[width]" style={{ width: `${data.tasks[key].length ? 100 * completed / data.tasks[key].length : 0}%` }} />
          </div>
          <div className="space-y-2 mb-5">
             {data.tasks[key].map(task => <div key={task.id} className="flex items-center gap-3 rounded-md bg-[#F5F8FA] p-3 min-h-[56px]">
              <label className="flex flex-1 items-center gap-3 cursor-pointer min-w-0">
                 <input type="checkbox" className="w-5 h-5 shrink-0 accent-[#027C96]" checked={task.done} onChange={() => changeTasks(key, data.tasks[key].map(x => x.id === task.id ? { ...x, done: !x.done } : x))} data-testid={`checkbox-task-${task.id}`} />
                <span className={`break-words min-w-0 ${task.done ? 'line-through text-[#859086]' : ''}`}>{task.text}</span>
              </label>
              <button type="button" className="btn btn-danger !p-2 !min-w-[44px] shrink-0" aria-label={`Delete ${task.text}`} onClick={() => changeTasks(key, data.tasks[key].filter(x => x.id !== task.id))} data-testid={`button-delete-task-${task.id}`}><Trash2 size={17} /></button>
            </div>)}
          </div>
          <form onSubmit={e => { e.preventDefault(); addTask(key); }} className="flex gap-2">
            <label htmlFor={`task-${key}`} className="sr-only">Add to {title}</label>
            <input id={`task-${key}`} className="field min-w-0" value={drafts[key]} maxLength={180} placeholder={placeholder} onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))} data-testid={`input-task-${key}`} />
            <button className="btn btn-primary shrink-0" disabled={!drafts[key].trim()} data-testid={`button-add-task-${key}`}>Add</button>
          </form>
        </section>;
      })}
    </div>
    <section className="surface p-6 md:p-8 mt-5">
      <label htmlFor="stay-notes" className="display text-2xl block mb-2">Notes to myself</label>
      <p className="text-[#708075] text-sm mb-5">A thought, a reminder, or simply a place to write.</p>
      <textarea id="stay-notes" className="field min-h-[180px]" value={data.notes} onChange={e => update({ ...data, notes: e.target.value })} placeholder="Write whatever you’d like to remember…" data-testid="textarea-stay-notes" />
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <span role="status" className="text-xs text-[#708075]" data-testid="status-local-save">{saved ? mode==='shared'?'Saved temporarily for this session':'Saved in this browser' : 'Could not save in this browser'}</span>
        {mode==='personal'&&<button className="btn btn-danger" onClick={() => { if (window.confirm('Clear your tasks and notes from this browser?')) { try { localStorage.removeItem(storageKey); } catch { /* storage may be unavailable */ } setData(emptyStuff()); } }} data-testid="button-clear-stay">Clear my local information</button>}
      </div>
    </section>
  </>;
}

export function AboutPage() {
  const {mode}=useDevice();
  return <>
    <PageHeading eyebrow="About & privacy" title="About WardSpace" description="Everyday information, activities and practical communication for people on the ward." />
    <div className="grid md:grid-cols-2 gap-5 max-w-[950px]">
      <div className="surface p-7 md:col-span-2 border-l-4 !border-l-[#027C96]"><div className="flex flex-wrap gap-4 items-start justify-between"><BrandIdentity /><PrototypeLabel /></div><p className="mt-6 text-[#334969]">WardSpace is an experimental project exploring how simple technology could improve everyday life on inpatient wards by making information, activities and practical communication easier to access.</p><p className="mt-3 text-[#334969]">WardSpace is an independent prototype exploring how digital tools could improve everyday inpatient ward experience. It is not currently an official NHS Wales or {branding.organisationName} service.</p></div>
      <div className="surface p-7"><BookOpen className="text-[#027C96] mb-6" /><h2 className="display text-2xl">What you’ll find</h2><p className="mt-3 text-[#425675]">Today’s schedule, activities, things to do, everyday answers, and a way to share non-urgent practical requests and ideas.</p></div>
      <div className="surface p-7"><Heart className="text-[#027C96] mb-6" /><h2 className="display text-2xl">Privacy in this prototype</h2><div className="mt-3 text-[#425675] space-y-2"><p>This prototype does not form part of a medical record.</p><p>Do not enter confidential medical information.</p><p>Patient-facing features are designed to work without names or NHS numbers.</p><p>{mode==='shared'?'On this shared device, My Stuff notes are kept only in a temporary session and cleared when you finish or after inactivity. Please finish before someone else uses the tablet.':'On a personal device, My Stuff notes remain in this browser. They are not sent to the server, but another person using this browser may see them.'}</p></div></div>
      <div className="surface p-7 md:col-span-2"><h2 className="display text-2xl">A note about help</h2><p className="mt-3 text-[#425675]">WardSpace is an information and activity companion. It does not provide medical advice, assess risk, or monitor messages for emergencies. For urgent help, speak directly to a member of staff in person.</p><div className="mt-6 flex gap-3 flex-wrap"><Link href="/discover#guide" className="btn btn-primary" data-testid="link-about-guide">Explore the guide</Link><Link href="/" className="btn btn-outline" data-testid="link-about-home">Back to today</Link></div></div>
    </div>
  </>;
}