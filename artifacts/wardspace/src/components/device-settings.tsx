import { useState } from 'react';
import { hasPersonalNotes, useDevice, type DeviceMode } from '@/lib/device-mode';

export function DeviceSettings() {
  const {mode,setMode,configurationNotice}=useDevice();
  const [message,setMessage]=useState('');
  const [warning,setWarning]=useState(false);
  const [oldPersonalNotes,setOldPersonalNotes]=useState<boolean|null>(()=>hasPersonalNotes());
  function change(next:DeviceMode) {
    if(next===mode)return;
    setMessage('');
    if(next==='personal'&&mode==='shared'){
      const saved=hasPersonalNotes();
      setOldPersonalNotes(saved);
      if(saved!==false){
        setMessage(saved===null
          ? 'Could not check for saved personal notes. Do not switch this browser to Personal until storage is available.'
          : 'Clear the older Personal-mode notes below before switching back to Personal, so they cannot reappear.');
        return;
      }
    }
    if(next==='shared'){
      const saved=hasPersonalNotes();
      setOldPersonalNotes(saved);
      if(saved===null){setMessage('Could not check for existing personal notes. Do not switch this browser to Shared until storage is available.');return}
      if(saved){setWarning(true);return}
    }
    if(!setMode(next)) {setMessage('Could not save the device setting. Do not hand this tablet over as a shared device.');return}
    setWarning(false);
  }
  function deleteAndSwitch() {
    try {
      localStorage.removeItem('wardspace-my-stay');
      if(localStorage.getItem('wardspace-my-stay')!==null)throw new Error('Personal notes were not removed');
      setOldPersonalNotes(false);
    } catch {
      setMessage('Could not remove personal notes. The device remains in Personal mode.');
      return;
    }
    if(!setMode('shared')) {
      setMessage('Personal notes were removed, but the device could not be set to Shared. Please ask staff for help.');
      return;
    }
    setWarning(false);
  }
  function clearOldPersonalNotes() {
    if(!window.confirm('Permanently delete My Stuff notes saved on this browser in Personal mode? This cannot be undone.'))return;
    try {
      localStorage.removeItem('wardspace-my-stay');
      setOldPersonalNotes(false);
      setMessage('Previously saved personal notes were removed from this browser.');
    } catch {
      setMessage('Could not remove saved notes. Do not use this tablet as a shared device until this is resolved.');
    }
  }
  return <section className="surface p-5 md:p-7 mb-9" aria-labelledby="device-settings-title">
    <p className="eyebrow">This browser only</p>
    <h2 id="device-settings-title" className="display text-2xl md:text-3xl mt-2">Device configuration</h2>
    <p className="text-sm text-[#415181] mt-3 max-w-[75ch]">Set a communal ward tablet to Shared. The choice is saved on this browser, not across all WardSpace devices. A person scanning the noticeboard QR on their own phone remains in Personal mode by default.</p>
    <div className="flex flex-wrap gap-2 mt-5" role="group" aria-label="Device mode">
      {(['personal','shared'] as const).map(value=><button type="button" key={value} className={`btn ${mode===value?'btn-primary':'btn-outline'}`} aria-pressed={mode===value} onClick={()=>change(value)} data-testid={`button-mode-${value}`}>{value==='shared'?'Shared device':'Personal device'}</button>)}
    </div>
    {mode==='shared'&&oldPersonalNotes===true&&<p role="alert" className="mt-5 border-l-4 border-[#B87918] bg-[#FFF6E6] px-4 py-3 text-[#503509]">Older Personal-mode notes are still saved in this browser. They are hidden in Shared mode but could reappear if staff later switch back to Personal. Remove them below before handing over this tablet.</p>}
    {warning&&<div role="alertdialog" aria-labelledby="personal-notes-warning" aria-describedby="personal-notes-description" className="mt-5 rounded-lg border-2 border-[#B87918] bg-[#FFF6E6] p-5" data-testid="warning-personal-notes">
      <h3 id="personal-notes-warning" className="font-bold text-lg text-[#503509]">Personal notes are stored on this browser</h3>
      <p id="personal-notes-description" className="mt-2 text-[#4D3A1C]">This device contains My Stuff information from Personal mode. Before using this browser as a shared ward device, those notes should be removed so they cannot reappear if the device is later switched back to Personal mode. Deleting them cannot be undone.</p>
      <div className="flex flex-wrap gap-3 mt-5">
        <button type="button" className="btn btn-danger" onClick={deleteAndSwitch} data-testid="button-delete-notes-switch">Delete notes and switch to Shared</button>
        <button type="button" className="btn btn-outline" onClick={()=>{setWarning(false);setMessage('')}} data-testid="button-cancel-switch">Cancel</button>
      </div>
    </div>}
    <p className="text-sm text-[#41536C] mt-5">Shared mode never opens locally saved Personal-mode notes. If saved notes are found, WardSpace will ask you to remove them before switching this browser to Shared.</p>
    <button type="button" className="btn btn-danger mt-4" onClick={clearOldPersonalNotes} data-testid="button-clear-old-personal">Clear previously saved personal notes from this browser</button>
    {(message||configurationNotice)&&<p role="status" className="mt-4 text-sm font-semibold text-[#2B3D73]">{message||configurationNotice}</p>}
  </section>;
}