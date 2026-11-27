const $ = id => document.getElementById(id);
let currentTab = 'qr';
let previousQr = '';

function notice(message, error=false) {
  $('notice').textContent = message;
  $('notice').style.color = error ? '#ff9aa8' : '#9eabc0';
}
async function api(url, options={}) {
  const res = await fetch(url, { headers:{'Content-Type':'application/json'}, ...options });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
function setTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  $('qrPane').classList.toggle('hidden',tab!=='qr');
  $('pairPane').classList.toggle('hidden',tab!=='pair');
  if (tab==='qr') api('/api/qr',{method:'POST',body:'{}'}).catch(()=>{});
}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));

async function refresh() {
  try {
    const s = await api('/api/status');
    const pill = $('status');
    pill.textContent = s.state[0].toUpperCase()+s.state.slice(1);
    pill.className = 'pill '+(s.state==='connected'?'good':s.state==='disconnected'?'bad':'');
    $('totalSent').textContent = s.totalSent;
    $('jobSent').textContent = s.jobSent;
    $('jobState').textContent = s.active?'Running':'Stopped';
    if (s.qrDataUrl && currentTab==='qr' && s.qrDataUrl!==previousQr) {
      previousQr=s.qrDataUrl;
      $('qrBox').innerHTML=`<img alt="WhatsApp QR code" src="${s.qrDataUrl}">`;
    } else if (!s.qrDataUrl && s.state!=='connected' && !s.pairingCode && currentTab==='qr' && !previousQr) {
      $('qrBox').innerHTML='<div class="loader"></div><span>Waiting for QR…</span>';
    }
    if (s.pairingCode && currentTab==='pair') $('codeBox').textContent=s.pairingCode;
    if (s.state==='connected') $('qrBox').innerHTML='<strong>WhatsApp connected ✓</strong>';
    if (s.lastError) notice(s.lastError,true);
  } catch(e) { notice(e.message,true); }
}
async function loadContacts() {
  try {
    const data=await api('/api/contacts');
    $('contact').innerHTML='<option value="">Select a contact</option>'+data.contacts.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    notice(`${data.contacts.length} chats loaded.`);
  } catch(e) { notice(e.message,true); }
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
$('getCode').addEventListener('click',async()=>{
  try{
    $('getCode').disabled=true; $('codeBox').textContent='…';
    const d=await api('/api/pair',{method:'POST',body:JSON.stringify({phone:$('phone').value})});
    $('codeBox').textContent=d.pairingCode;
    notice('Enter this code in WhatsApp Linked Devices.');
  }catch(e){$('codeBox').textContent='--------';notice(e.message,true);}
  finally{$('getCode').disabled=false;}
});
$('refreshQr').addEventListener('click',async()=>{
  previousQr=''; try{await api('/api/qr',{method:'POST',body:'{}'});}catch(e){}
  notice('QR refresh requested.');
});
$('loadContacts').addEventListener('click',loadContacts);
$('start').addEventListener('click',async()=>{
  try{
    const body={chatId:$('contact').value,message:$('message').value,count:Number($('count').value),interval:Number($('interval').value)};
    const d=await api('/api/start',{method:'POST',body:JSON.stringify(body)});
    notice(d.message); refresh();
  }catch(e){notice(e.message,true);}
});
$('stop').addEventListener('click',async()=>{
  try{await api('/api/stop',{method:'POST',body:'{}'});notice('Stopped.');refresh();}
  catch(e){notice(e.message,true);}
});
setInterval(refresh,2000);
refresh();
