// Lights up when the Python engine is running; otherwise the built-in browser engine is used.
(async () => {
  const API = 'http://127.0.0.1:8765';
  let up = false;
  for (let i = 0; i < 12 && !up; i++) {
    try { up = (await fetch(API + '/health')).ok; } catch (e) { await new Promise(r => setTimeout(r, 1000)); }
  }
  if (!up) return;
  st('High-fidelity engine connected (PyMuPDF + LibreOffice).');
  const post = async (path, blob, fn, extra = {}) => {
    const fd = new FormData(); fd.append('file', blob, fn);
    for (const k in extra) fd.append(k, extra[k]);
    const r = await fetch(API + path, { method: 'POST', body: fd });
    if (!r.ok) throw new Error((await r.text()).slice(0, 200));
    return r.blob();
  };
  window.HQ = true; window.hqPost = post;
  const pdfBlob = () => new Blob([bytes], { type: 'application/pdf' });

  // PDF -> DOCX / XLSX through the engine (true layout, real tables)
  const baseExport = window.exportAs;
  window.exportAs = async k => {
    if (!need()) return;
    if (k !== 'docx' && k !== 'xlsx') return baseExport(k);
    try { st('Converting with the engine…'); await save(`${name}.${k}`, await post('/convert/pdf-to-' + k, pdfBlob(), name + '.pdf')); }
    catch (e) { st('Engine failed (' + e.message + '), using built-in converter.'); baseExport(k); }
  };

  // Edit PDF: redact old words, re-insert with the original embedded font when possible
  const builtinSave = $('sv').onclick;
  $('sv').onclick = async () => {
    if (!need()) return;
    if (Object.values(edits).flat().some(o => o.img || o.f)) return builtinSave(); // signatures/custom fonts: built-in path
    const list = [];
    for (const k in edits) for (const o of edits[k]) if (o.add ? o.t.trim() : o.t !== o.o) list.push({ page: +k, ...o });
    if (!list.length) return st('No changes to save yet.');
    try { st('Applying edits with the engine…'); await save(name + '-edited.pdf', await post('/pdf/edit', pdfBlob(), name + '.pdf', { edits: JSON.stringify(list) })); }
    catch (e) { st('Engine failed: ' + e.message); }
  };

  // OCR button (scanned PDFs -> searchable PDF)
  const b = document.createElement('button'); b.className = 'fmt'; b.textContent = 'OCR → searchable PDF';
  b.onclick = async () => { if (!need()) return; try { st('Running OCR (can take a while)…'); await save(name + '-ocr.pdf', await post('/pdf/ocr', pdfBlob(), name + '.pdf', { lang: 'eng' })); } catch (e) { st('OCR failed: ' + e.message); } };
  $('fmts').appendChild(b);

  // Office files -> PDF through LibreOffice (exact layout)
  const baseMk = $('mk').onclick;
  $('mk').onclick = async () => {
    const f = files.find(x => /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i.test(x.name));
    if (!f) return baseMk();
    try { st('Converting with LibreOffice…'); await save(f.name.replace(/\.\w+$/, '') + '.pdf', await post('/convert/to-pdf', f, f.name)); }
    catch (e) { st('LibreOffice failed (' + e.message + '), using built-in converter.'); baseMk(); }
  };
})();
