// app.js - simplified core logic
const db = new Dexie('universal_dashboard');
db.version(1).stores({
  notes: '++id,title,updatedAt,createdAt,*tags',
  tasks: '++id,title,status,dueDate,priority,updatedAt',
  events: '++id,title,start,end,updatedAt',
  attachments: '++id,name,mime,size,createdAt',
  settings: 'id'
});

async function deriveKeyFromPassword(password, saltHex, iterations=200000){
  const enc = new TextEncoder();
  const salt = saltHex ? hexToUint8(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), {name:'PBKDF2'}, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({
    name:'PBKDF2', salt, iterations, hash:'SHA-256'
  }, baseKey, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
  return {key, salt: uint8ToHex(salt)};
}

async function encryptString(key, plaintext){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, enc.encode(plaintext));
  return ivToHex(iv) + ':' + bufferToHex(ct);
}
async function decryptString(key, cipherText){
  const [ivHex, ctHex] = cipherText.split(':');
  const iv = hexToUint8(ivHex);
  const ct = hexToArrayBuffer(ctHex);
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, ct);
  return new TextDecoder().decode(plain);
}

// small helpers to convert hex <-> arraybuffers
function bufferToHex(buf){ return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}
function hexToUint8(hex){ if(typeof hex==='string') return new Uint8Array(hex.match(/.{1,2}/g).map(b=>parseInt(b,16))); return hex;}
function uint8ToHex(u){ return Array.from(u).map(b=>b.toString(16).padStart(2,'0')).join('');}
function ivToHex(u){ return uint8ToHex(u); }
function hexToArrayBuffer(h){ const u = hexToUint8(h); return u.buffer; }

// simple app state
let sessionKey = null;
let sessionSalt = null;
async function lockWithPassword(pwd){
  const {key,salt} = await deriveKeyFromPassword(pwd);
  sessionKey = key;
  sessionSalt = salt;
  // store salt and iterations in settings for future deriving
  await db.table('settings').put({id: 'crypto', salt, iterations: 200000});
}
async function encryptAndStoreNote(title, htmlContent, tags=[]){
  const ct = await encryptString(sessionKey, htmlContent);
  const note = {title, contentEncrypted: ct, encrypted: true, tags, createdAt: Date.now(), updatedAt: Date.now()};
  await db.notes.add(note);
  rebuildSearchIndex();
}
async function decryptNote(note){
  if(!note.encrypted) return note.contentHTML || '';
  return await decryptString(sessionKey, note.contentEncrypted);
}

// Fuse.js index
let fuse = null;
async function rebuildSearchIndex(){
  const all = await db.notes.toArray();
  const plain = [];
  for(const n of all){
    const text = n.encrypted ? '[encrypted]' : (n.contentHTML || '');
    plain.push({id:n.id, title: n.title, content: text, tags: n.tags});
  }
  fuse = new Fuse(plain, {keys:['title','content','tags'], includeScore:true, threshold:0.35});
}

document.getElementById('btn-new-note').addEventListener('click', async ()=>{
  const title = prompt('Title?') || 'Untitled';
  const html = prompt('Quick content (HTML ok)') || '';
  if(!sessionKey){ alert('Please lock/unlock with a password first (top-right lock).'); return; }
  await encryptAndStoreNote(title, html, []);
  alert('Saved encrypted note');
});

document.getElementById('btn-lock').addEventListener('click', async ()=>{
  const pwd = prompt('Enter password for encryption');
  if(!pwd) return;
  await lockWithPassword(pwd);
  alert('Session keyed (in-memory). Rebuild search index...');
  await rebuildSearchIndex();
});

document.getElementById('search').addEventListener('input', (e)=>{
  if(!fuse) return;
  const q = e.target.value;
  const res = fuse.search(q, {limit:20});
  const out = res.map(r=>`${r.item.title} — score:${r.score.toFixed(3)}`).join('\n');
  alert('Search results:\\n' + out);
});

// export/import
document.getElementById('btn-export').addEventListener('click', async ()=>{
  const all = {
    notes: await db.notes.toArray(),
    tasks: await db.tasks.toArray(),
    events: await db.events.toArray(),
    attachments: await db.attachments.toArray(),
    settings: await db.settings.toArray()
  };
  const blob = new Blob([JSON.stringify(all, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'dashboard-backup.json'; a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import').addEventListener('click', ()=>{
  const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json';
  inp.onchange = async ()=> {
    const f = inp.files[0]; const text = await f.text(); const data = JSON.parse(text);
    await db.transaction('rw', db.notes, db.tasks, db.events, db.attachments, async ()=>{
      await db.notes.bulkPut(data.notes || []);
      await db.tasks.bulkPut(data.tasks || []);
      await db.events.bulkPut(data.events || []);
      await db.attachments.bulkPut(data.attachments || []);
    });
    alert('Imported');
    rebuildSearchIndex();
  };
  inp.click();
});
