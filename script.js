(function(){
  const shell = document.getElementById('organizerShell');
  if (!shell) return;

  const dropzone = document.getElementById('dropzone');
  const urlInput = document.getElementById('urlInput');
  const saveBtn = document.getElementById('saveBtn');
  const fileInput = document.getElementById('fileInput');
  const preview = document.getElementById('preview');
  const toast = document.getElementById('toast');
  const homeView = document.getElementById('homeView');
  const dashboardView = document.getElementById('dashboardView');
  const folderGrid = document.getElementById('folderGrid');
  const itemsSection = document.getElementById('itemsSection');
  const sideButtons = document.querySelectorAll('.side-item');

  let state = loadState();

  sideButtons.forEach(btn => btn.addEventListener('click', () => {
    sideButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    [homeView, dashboardView].forEach(v => { v.hidden = v !== (view==='home'?homeView:dashboardView); v.classList.toggle('view-active', v=== (view==='home'?homeView:dashboardView)); });
    if (view === 'dashboard') renderDashboard();
  }));

  // Enable drag/paste anywhere inside the entire Home view
  const pasteArea = homeView;
  const setDrag = (on) => dropzone && dropzone.classList.toggle('is-dragover', on);
  ['dragenter','dragover'].forEach(t => pasteArea && pasteArea.addEventListener(t, (e)=>{e.preventDefault(); setDrag(true);}));
  ['dragleave','drop'].forEach(t => pasteArea && pasteArea.addEventListener(t, (e)=>{e.preventDefault(); setDrag(false);}));
  pasteArea && pasteArea.addEventListener('drop', async (e)=>{
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) { await handleFile(f); return; }
    const text = e.dataTransfer.getData('text');
    if (text) { urlInput.value = text; showPreview({ type: 'text', content: text }); autoClassifyAndStore(buildItem({ kind: guessKind(text), text })); }
  });
  pasteArea && pasteArea.addEventListener('paste', async (e)=>{
    const item = Array.from(e.clipboardData.items || []).find(i => i.kind === 'file');
    if (item) { await handleFile(item.getAsFile()); return; }
    const text = e.clipboardData.getData('text');
    if (text) { urlInput.value = text; showPreview({ type: 'text', content: text }); autoClassifyAndStore(buildItem({ kind: guessKind(text), text })); }
  });
  dropzone && dropzone.addEventListener('click', e=>{
    const label = e.target.closest('label[for="fileInput"]');
    if (label) fileInput.click();
  });
  fileInput && fileInput.addEventListener('change', async ()=>{
    const f = fileInput.files && fileInput.files[0];
    if (f) await handleFile(f);
  });
  saveBtn && saveBtn.addEventListener('click', ()=>{
    const text = (urlInput && urlInput.value || '').trim();
    if (!text) return toastify('Paste a link or some text');
    const item = buildItem({ kind: guessKind(text), text });
    autoClassifyAndStore(item);
  });

  function guessKind(text){
    try { const u = new URL(text); if (/(png|jpg|jpeg|gif|webp|svg)$/i.test(u.pathname)) return 'image-url'; return 'link'; } catch(_) {}
    return text.length > 120 ? 'note' : 'text';
  }
  async function handleFile(file){
    const dataUrl = await new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(file); });
    showPreview({ type:'image', content:dataUrl, name:file.name });
    const item = buildItem({ kind:'image', image:dataUrl, name:file.name });
    autoClassifyAndStore(item);
  }
  function showPreview(info){
    preview.hidden = false;
    preview.innerHTML = info.type==='image'
      ? `<img alt="preview" src="${info.content}"><span class="meta">${info.name||''}</span>`
      : `<div class="meta">${String(info.content||'').slice(0,140)}</div>`;
  }
  function buildItem(payload){ return { id: Date.now()+'-'+Math.random().toString(36).slice(2), createdAt: new Date().toISOString(), ...payload }; }
  function classify(item){
    const text = (item.text || item.name || '').toLowerCase();
    const url = (item.text || '').toLowerCase();
    if (item.kind==='image' || item.kind==='image-url') return 'Screenshots';
    if (/drive|docs\.google|notion|dropbox/.test(url)) return 'Docs';
    if (/youtube|vimeo|mp4|video/.test(url)) return 'Videos';
    if (/amazon|flipkart|order|invoice|receipt/.test(text)) return 'Receipts';
    if (/calendar|meet|zoom/.test(text)) return 'Meetings';
    return 'Inbox';
  }
  function autoClassifyAndStore(item){
    const folder = classify(item);
    state.folders[folder] = state.folders[folder] || [];
    state.folders[folder].unshift(item);
    saveState(); toastify(`Saved to ${folder}`); renderDashboard();
  }
  function renderDashboard(){
    const entries = Object.entries(state.folders);
    folderGrid.innerHTML = entries.map(([name,items])=>`<div class="folder-card" data-folder="${name}"><div class="folder-name">${name}</div><div class="folder-count">${items.length} item${items.length!==1?'s':''}</div></div>`).join('');
    const recent = entries.flatMap(([,arr])=>arr.map(i=>({...i,__f: classify(i)}))).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,8);
    itemsSection.innerHTML = recent.map(it=>{
      const thumb = it.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"></svg>';
      const open = it.text && it.text.startsWith('http') ? `<a class="link" href="${it.text}" target="_blank">Open</a>` : '';
      return `<div class="item"><img class="item-thumb" alt="thumb" src="${thumb}"><div><div class="item-title">${(it.text||it.name||'Item')}</div><div class="item-meta">${it.__f} • ${new Date(it.createdAt).toLocaleString()}</div></div>${open}</div>`;
    }).join('');
    folderGrid.querySelectorAll('.folder-card').forEach(card=>card.addEventListener('click', ()=>showFolder(card.dataset.folder)));
  }
  function showFolder(name){
    const items = state.folders[name] || [];
    itemsSection.innerHTML = items.map(it=>{
      const thumb = it.image || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"></svg>';
      const open = it.text && it.text.startsWith('http') ? `<a class="link" href="${it.text}" target="_blank">Open</a>` : '';
      return `<div class="item"><img class="item-thumb" alt="thumb" src="${thumb}"><div><div class="item-title">${(it.text||it.name||'Item')}</div><div class="item-meta">${name} • ${new Date(it.createdAt).toLocaleString()}</div></div>${open}</div>`;
    }).join('');
  }
  function toastify(msg){ toast.textContent = msg; toast.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(()=>{ toast.hidden = true; }, 1800); }
  function loadState(){ try{ const raw = localStorage.getItem('organizerState'); if(!raw) return { folders:{Inbox:[],Screenshots:[],Docs:[],Videos:[],Receipts:[],Meetings:[]} }; const parsed=JSON.parse(raw); return { folders: parsed.folders || {} }; } catch(_){ return { folders:{} }; } }
  function saveState(){ localStorage.setItem('organizerState', JSON.stringify(state)); }

  renderDashboard();
})();


