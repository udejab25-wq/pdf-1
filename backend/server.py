"""PDF Studio engine: high-fidelity editing, Office conversion and OCR.
Run:  uvicorn server:app --host 127.0.0.1 --port 8765
Needs: pip install -r requirements.txt ; LibreOffice (soffice) ; Tesseract (for OCR)."""
import io, json, os, subprocess, tempfile
from pathlib import Path
import fitz  # PyMuPDF
from fastapi import FastAPI, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI(title="PDF Studio engine")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
SOFFICE = os.environ.get("SOFFICE", "soffice")


@app.get("/health")
def health():
    return {"ok": True}


# ---------- LibreOffice ----------
def lo_convert(data: bytes, filename: str, target: str, infilter: str | None = None) -> bytes:
    with tempfile.TemporaryDirectory() as d:
        src = Path(d, Path(filename).name)
        src.write_bytes(data)
        cmd = [SOFFICE, "--headless", "--norestore", f"-env:UserInstallation={Path(d, 'profile').as_uri()}"]
        if infilter:
            cmd.append(f"--infilter={infilter}")
        cmd += ["--convert-to", target, "--outdir", d, str(src)]
        subprocess.run(cmd, check=True, timeout=300, capture_output=True)
        out = next(p for p in Path(d).glob(f"*.{target.split(':')[0]}") if p != src)
        return out.read_bytes()


@app.post("/convert/to-pdf")  # docx/xlsx/pptx/odt/rtf ... -> PDF with real layout
async def to_pdf(file: UploadFile):
    return Response(lo_convert(await file.read(), file.filename, "pdf"), media_type=PDF)


@app.post("/convert/pdf-to-docx")
async def pdf_to_docx(file: UploadFile):
    data = await file.read()
    try:  # pdf2docx (built on PyMuPDF) keeps paragraphs, tables and images
        from pdf2docx import Converter
        with tempfile.TemporaryDirectory() as d:
            src, out = Path(d, "in.pdf"), Path(d, "out.docx")
            src.write_bytes(data)
            cv = Converter(str(src)); cv.convert(str(out)); cv.close()
            return Response(out.read_bytes(), media_type=DOCX)
    except Exception:  # fallback: LibreOffice's PDF importer
        return Response(lo_convert(data, "in.pdf", "docx", "writer_pdf_import"), media_type=DOCX)


@app.post("/convert/pdf-to-xlsx")
async def pdf_to_xlsx(file: UploadFile):
    import openpyxl
    doc = fitz.open(stream=await file.read(), filetype="pdf")
    wb = openpyxl.Workbook(); wb.remove(wb.active)
    for i, page in enumerate(doc, 1):
        ws = wb.create_sheet(f"Page {i}")
        tables = page.find_tables().tables  # real table detection
        if tables:
            for t in tables:
                for row in t.extract():
                    ws.append([c or "" for c in row])
                ws.append([])
        else:
            for line in page.get_text("text").splitlines():
                ws.append([line])
    buf = io.BytesIO(); wb.save(buf)
    return Response(buf.getvalue(), media_type=XLSX)


# ---------- OCR ----------
@app.post("/pdf/ocr")
async def ocr(file: UploadFile, lang: str = Form("eng")):
    src, out = fitz.open(stream=await file.read(), filetype="pdf"), fitz.open()
    for page in src:  # image + invisible text layer, page by page
        pix = page.get_pixmap(dpi=300)
        out.insert_pdf(fitz.open("pdf", pix.pdfocr_tobytes(language=lang)))
    return Response(out.tobytes(garbage=3, deflate=True), media_type=PDF)


# ---------- Editing with original fonts ----------
def style_at(page, rect):
    """Find the text span under rect: gives font name, size, colour, flags."""
    best = None
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                area = (fitz.Rect(s["bbox"]) & rect).get_area()
                if area > 0 and (best is None or area > best[0]):
                    best = (area, s)
    return best[1] if best else None


def embedded_font(doc, page, font_name):
    """Raw bytes of the embedded font file, if the PDF has one."""
    want = font_name.split("+")[-1]
    for f in page.get_fonts():
        if f[3].split("+")[-1] == want:
            try:
                buf = doc.extract_font(f[0])[3]
            except Exception:
                continue
            if buf:
                return buf
    return None


def base14(flags, name):
    low = name.lower()
    bold = bool(flags & 16) or "bold" in low
    ital = bool(flags & 2) or "italic" in low or "oblique" in low
    fam = "cour" if flags & 8 else "tiro" if flags & 4 else "helv"
    table = {"helv": ["helv", "hebo", "heit", "hebi"], "tiro": ["tiro", "tibo", "tiit", "tibi"],
             "cour": ["cour", "cobo", "coit", "cobi"]}
    return table[fam][int(bold) + 2 * int(ital)]


@app.post("/pdf/edit")
async def pdf_edit(file: UploadFile, edits: str = Form(...)):
    """edits: [{page, x, y, w, s, o, t, add}] in PDF points (origin bottom-left, y = baseline)."""
    doc = fitz.open(stream=await file.read(), filetype="pdf")
    by_page = {}
    for e in json.loads(edits):
        by_page.setdefault(e["page"] - 1, []).append(e)
    for pno, items in by_page.items():
        page, H, plan = doc[pno], doc[pno].rect.height, []
        for e in items:
            rect = fitz.Rect(e["x"] - 1, H - e["y"] - e["s"] * 0.8, e["x"] + e["w"] + 1, H - e["y"] + e["s"] * 0.25)
            span = None if e.get("add") else style_at(page, rect)
            if not e.get("add"):
                page.add_redact_annot(rect, fill=False)  # truly removes the old text
            plan.append((e, span))
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
        for i, (e, span) in enumerate(plan):
            text = e["t"]
            if not text.strip():
                continue
            fontname = None
            if span:
                buf = embedded_font(doc, page, span["font"])
                # Subset fonts only hold glyphs already used, so check coverage first.
                if buf:
                    try:
                        if all(fitz.Font(fontbuffer=buf).has_glyph(ord(c)) for c in text if c != " "):
                            fontname = f"E{pno}_{i}"
                            page.insert_font(fontname=fontname, fontbuffer=buf)
                    except Exception:
                        fontname = None
            if not fontname:
                fontname = base14(span["flags"] if span else 0, span["font"] if span else "")
            page.insert_text((e["x"], H - e["y"]), text, fontname=fontname,
                             fontsize=span["size"] if span else e["s"],
                             color=fitz.sRGB_to_pdf(span["color"]) if span else (0, 0, 0))
    return Response(doc.tobytes(garbage=3, deflate=True), media_type=PDF)


# ---------- Compression (keeps text and vectors; recompresses images) ----------
@app.post("/pdf/compress")
async def compress(file: UploadFile, level: str = Form("strong")):
    dpi, q = {"light": (200, 80), "strong": (120, 55), "max": (72, 35)}.get(level, (120, 55))
    doc = fitz.open(stream=await file.read(), filetype="pdf")
    try:
        doc.rewrite_images(dpi_threshold=dpi + 30, dpi_target=dpi, quality=q)  # PyMuPDF >= 1.24.2
    except AttributeError:
        pass
    try:
        doc.subset_fonts()  # needs fonttools
    except Exception:
        pass
    try:
        data = doc.tobytes(garbage=4, deflate=True, clean=True, use_objstms=1)
    except TypeError:
        data = doc.tobytes(garbage=4, deflate=True, clean=True)
    return Response(data, media_type=PDF)
