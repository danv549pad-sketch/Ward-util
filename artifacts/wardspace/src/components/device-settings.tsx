import { useState } from 'react';
import { useDevice, type DeviceMode } from '@/lib/device-mode';

export function DeviceSettings() {
  const {mode,setMode}=useDevice();
  const [message,setMessage]=useState('');
  function change(next:DeviceMode) {
    if(next===mode)return;
    if(!setMode(next)) {setMessage('Could not save the device setting. Do not hand this tablet over as a shared device.');return}
    setMessage(`This browser is now set as a ${next} device.`);
  }
  function clearOldPersonalNotes() {
    if(!window.confirm('Permanently delete My Stuff notes saved on this browser in Personal mode? This cannot be undone.'))return;
    try {
      localStorage.removeItem('wardspace-my-stay');
      setMessage('Previously saved personal notes were removed from this browser.');
    } catch {
      setMessage('Could not remove saved notes. Do not use this tablet as a shared device until this is resolved.');
    }
  }
  return <section className="surface p-5 md:p-7 mb-9" aria-labelledby="device-settings-title">
    <p className="eyebrow">This browser only</p>
    <h2 id="device-settings-title" className="display text-2xl md:text-3xl mt-2">Device configuration</h2>
    <p className="text-sm text-[#617768] mt-3 max-w-[75ch]">Set a communal ward tablet to Shared. The choice is saved on this browser, not across all WardSpace devices. A person scanning the noticeboard QR on their own phone remains in Personal mode by default.</p>
    <div className="flex flex-wrap gap-2 mt-5" role="group" aria-label="Device mode">
      {(['personal','shared'] as const).map(value=><button type="button" key={value} className={`btn ${mode===value?'btn-primary':'btn-outline'}`} aria-pressed={mode===value} onClick={()=>change(value)} data-testid={`button-mode-${value}`}>{value==='shared'?'Shared device':'Personal device'}</button>)}
    </div>
    <p className="text-sm text-[#66796b] mt-5">Shared mode never opens locally saved Personal-mode notes. Changing mode does not delete those older notes; switching back to Personal would show them again. Before handing over a communal tablet, remove old personal notes if any were saved on it.</p>
    <button type="button" className="btn btn-danger mt-4" onClick={clearOldPersonalNotes} data-testid="button-clear-old-personal">Clear previously saved personal notes from this browser</button>
    {message&&<p role="status" className="mt-4 text-sm font-semibold text-[#355c49]">{message}</p>}
  </section>;
}