// Platform glue: PWA install, offline cache, phone layout, Android save/share, file opening.
(() => {
  const ua = navigator.userAgent, electron = /Electron/.test(ua);
  const native = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
  document.head.insertAdjacentHTML('beforeend', '<style>@media(max-width:600px){header{padding:12px 12px 0}main{padding:0 10px 30px}.bar{gap:6px}button,.btn,select{padding:9px 11px}#stage{padding:6px;max-height:68vh}.tabs{overflow-x:auto}.tab{white-space:nowrap}.sub{display:none}}</style>');
  if (electron) { const s = document.createElement('script'); s.src = 'renderer-hq.js'; document.head.appendChild(s); }  // optional Python engine
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});

  // Install button (Chrome/Edge/Android) and iOS hint
  const ib = document.createElement('button'); ib.className = 'pri'; ib.textContent = 'Install app'; ib.hidden = true;
  document.querySelector('.bar').appendChild(ib);
  let ip = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); ip = e; ib.hidden = false; });
  ib.onclick = async () => { if (ip) { ip.prompt(); await ip.userChoice; ip = null; ib.hidden = true; } };
  addEventListener('appinstalled', () => ib.hidden = true);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (/iPhone|iPad|iPod/.test(ua) && !standalone && !native) { ib.hidden = false; ib.onclick = () => st('On iPhone/iPad: tap Share, then “Add to Home Screen”.'); }
  if (electron || native) ib.remove();

  // Open PDFs: installed-app file association, drag and drop
  const openFile = async f => { name = f.name.replace(/\.pdf$/i, ''); try { await loadBytes(new Uint8Array(await f.arrayBuffer())); st(''); } catch (e) { st('Could not open this PDF: ' + e.message); } };
  if ('launchQueue' in window) launchQueue.setConsumer(async p => { if (p.files && p.files.length) openFile(await p.files[0].getFile()); });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => { e.preventDefault(); const f = [...(e.dataTransfer.files || [])].find(x => /\.pdf$/i.test(x.name)); if (f) openFile(f); });

  // Touch screens can't drag thumbnails: add move buttons
  const bar = document.querySelector('#tools .card .bar');
  [['◀ Move earlier', -1], ['Move later ▶', 1]].forEach(([t, d]) => {
    const b = document.createElement('button'); b.textContent = t;
    b.onclick = async () => { if (sel.size !== 1) return st('Select one page to move.'); const i = [...sel][0], j = i + d;
      if (!pdf || j < 0 || j >= pdf.numPages) return; await move(i, j); sel = new Set([j]); thumbs(); };
    bar.appendChild(b);
  });

  // Android/iOS app: save via the share sheet (WebViews ignore download links)
  if (native) window.save = async (fn, data) => {
    try {
      const b = data instanceof Blob ? data : new Blob([data]);
      const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(b); });
      const P = Capacitor.Plugins, { uri } = await P.Filesystem.writeFile({ path: fn, data: b64, directory: 'CACHE' });
      await P.Share.share({ title: fn, url: uri }); st('Saved ' + fn);
    } catch (e) { st('Save failed: ' + (e.message || e)); }
  };
})();
