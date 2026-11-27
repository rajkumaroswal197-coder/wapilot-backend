const $ = id => document.getElementById(id);
let lastJobId = null;
async function api(path, options={}) {
  const res = await fetch('/api'+path, {headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function notify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') new Notification(title,{body});
}
async function loadContacts() {
  try {
    const data=await api('/contacts'); const sel=$('contact'); sel.innerHTML='<option value="">Select a contact</option>';
    data.contacts.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.name;sel.appendChild(o)});
    sel.disabled=false; $('start').disabled=false; $('feedback').textContent=`${data.contacts.length} contacts loaded.`;
  } catch(e){$('feedback').textContent=e.message}
}
async function refresh() {
  try {
    const s=await api('/status');
    $('state').textContent=s.state; $('dot').classList.toggle('on',s.connected);
    $('qr').style.display=s.qr?'block':'none'; $('qr').src=s.qr||'';
    $('qrhelp').style.display=s.qr?'block':'none'; $('connected').classList.toggle('hidden',!s.connected);
    $('loadContacts').disabled=!s.connected;
    $('error').textContent=s.lastError||'';
    if(s.connected && $('contact').disabled) await loadContacts();
    const j=s.activeJob;
    if(j){
      $('activity').textContent=`Status: ${j.status} · Sent: ${j.sent}/${j.maxMessages}${j.stopReason?' · '+j.stopReason:''}`;
      $('stop').disabled=j.status!=='running'; $('start').disabled=!s.connected || j.status==='running';
      if(lastJobId!==j.id && j.status==='running') lastJobId=j.id;
      if(j.status==='stopped' && j.stopReason?.includes('Reply received')) {
        notify('waPilot stopped','The selected contact replied. No more messages will be sent.');
        $('feedback').textContent='Reply received — automation stopped.';
      }
    } else {$('stop').disabled=true;$('start').disabled=!s.connected}
  } catch(e){$('state').textContent='Server not reachable';$('feedback').textContent=e.message}
}
$('loadContacts').onclick=loadContacts;
$('start').onclick=async()=>{
  try{
    if('Notification'in window && Notification.permission==='default') await Notification.requestPermission();
    const data=await api('/start',{method:'POST',body:JSON.stringify({chatId:$('contact').value,message:$('message').value,maxMessages:Number($('count').value),intervalSeconds:Number($('interval').value)})});
    $('feedback').textContent='Automation started.'; lastJobId=data.job.id; await refresh();
  }catch(e){$('feedback').textContent=e.message}
};
$('stop').onclick=async()=>{try{await api('/stop',{method:'POST'});$('feedback').textContent='Stopped manually.';await refresh()}catch(e){$('feedback').textContent=e.message}};
setInterval(refresh,2500); refresh();