/* global pdfjsLib, PDFLib, JSZip */

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const pickBtn = document.getElementById("pickBtn");
const fileList = document.getElementById("fileList");
const processBtn = document.getElementById("processBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const errEl = document.getElementById("err");

const DPI = 150;
const JPEG_QUALITY = 0.85;

/** Só em localhost (npm run web) usa a API Node + Sharp; em file:// ou GitHub Pages processa no navegador. */
const useLocalServer = (() => {
  const h = location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
})();

/** @type {File[]} */
let queue = [];

function isPdf(file) {
  const name = (file.name || "").toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
}

function setErr(msg) {
  if (msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  } else {
    errEl.hidden = true;
    errEl.textContent = "";
  }
}

function renderList() {
  fileList.innerHTML = "";
  if (!queue.length) {
    fileList.hidden = true;
    processBtn.disabled = true;
    clearBtn.disabled = true;
    return;
  }
  fileList.hidden = false;
  processBtn.disabled = false;
  clearBtn.disabled = false;

  queue.forEach((file, i) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "name";
    span.textContent = file.name;
    span.title = file.name;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "rm";
    rm.setAttribute("aria-label", "Remover");
    rm.textContent = "×";
    rm.addEventListener("click", () => {
      queue = queue.filter((_, j) => j !== i);
      renderList();
    });
    li.append(span, rm);
    fileList.append(li);
  });
}

function addFiles(fileListLike) {
  const incoming = Array.from(fileListLike).filter(isPdf);
  if (!incoming.length) {
    setErr("Nenhum PDF válido selecionado.");
    return;
  }
  setErr("");
  const seen = new Set(queue.map((f) => `${f.name}-${f.size}`));
  for (const f of incoming) {
    const key = `${f.name}-${f.size}`;
    if (!seen.has(key)) {
      seen.add(key);
      queue.push(f);
    }
  }
  renderList();
}

pickBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  if (fileInput.files?.length) addFiles(fileInput.files);
  fileInput.value = "";
});

["dragenter", "dragover"].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("dragover");
  });
});

dropzone.addEventListener("drop", (e) => {
  const dt = e.dataTransfer;
  if (dt?.files?.length) addFiles(dt.files);
});

clearBtn.addEventListener("click", () => {
  queue = [];
  setErr("");
  statusEl.textContent = "";
  renderList();
});

function stemPdfName(name) {
  const n = (name || "document.pdf").replace(/\.pdf$/i, "");
  return n || "document";
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseContentDispositionFilename(cd) {
  if (!cd) return null;
  const m = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (m) {
    try {
      return decodeURIComponent(m[1].trim());
    } catch {
      return m[1].trim();
    }
  }
  const m2 = /filename="([^"]+)"/i.exec(cd);
  if (m2) return m2[1];
  const m3 = /filename=([^;]+)/i.exec(cd);
  if (m3) return m3[1].trim().replace(/^"|"$/g, "");
  return null;
}

async function processViaServer() {
  const form = new FormData();
  queue.forEach((f) => form.append("pdfs", f, f.name));
  const res = await fetch(new URL("/api/process", location.origin), {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const ct = res.headers.get("content-type") || "";
    let msg = `Erro ${res.status}`;
    if (ct.includes("application/json")) {
      const j = await res.json();
      if (j.error) msg = j.error;
    } else {
      const t = await res.text();
      if (t) msg = t.slice(0, 200);
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition");
  const name =
    parseContentDispositionFilename(cd) ||
    (queue.length === 1
      ? `${stemPdfName(queue[0].name)}_digitalizado.pdf`
      : "pdfs_digitalizados.zip");
  downloadBlob(blob, name);
}

/**
 * @param {ArrayBuffer} arrayBuffer
 * @param {(cur: number, total: number) => void} [onProgress]
 */
async function processPdfInBrowser(arrayBuffer, onProgress) {
  if (typeof pdfjsLib === "undefined" || typeof PDFLib === "undefined") {
    throw new Error(
      "Bibliotecas não carregaram. Verifique a conexão (CDN) ou use Chrome/Edge."
    );
  }

  const data = new Uint8Array(arrayBuffer);
  const loadingTask = pdfjsLib.getDocument({ data, verbosity: 0 });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const outPdf = await PDFLib.PDFDocument.create();

  for (let p = 1; p <= numPages; p++) {
    onProgress?.(p, numPages);
    const page = await pdf.getPage(p);
    const vpPt = page.getViewport({ scale: 1 });
    const origW = vpPt.width;
    const origH = vpPt.height;
    const scale = DPI / 72;
    const viewport = page.getViewport({ scale });

    const w = Math.max(1, Math.floor(viewport.width));
    const h = Math.max(1, Math.floor(viewport.height));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D indisponível.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const filtered = document.createElement("canvas");
    filtered.width = w;
    filtered.height = h;
    const fctx = filtered.getContext("2d", { alpha: false });
    if (!fctx) throw new Error("Canvas 2D indisponível.");
    fctx.filter = "grayscale(100%) blur(0.5px)";
    fctx.drawImage(canvas, 0, 0);
    fctx.filter = "none";

    const jpegBlob = await new Promise((resolve, reject) => {
      filtered.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar JPEG"))),
        "image/jpeg",
        JPEG_QUALITY
      );
    });
    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    const jpgImage = await outPdf.embedJpg(jpegBytes);
    const newPage = outPdf.addPage([origW, origH]);
    newPage.drawImage(jpgImage, { x: 0, y: 0, width: origW, height: origH });

    await new Promise((r) => setTimeout(r, 0));
  }

  return outPdf.save({ useObjectStreams: false });
}

processBtn.addEventListener("click", async () => {
  if (!queue.length) return;
  setErr("");
  statusEl.textContent = "Processando… pode levar um tempo.";
  processBtn.disabled = true;
  clearBtn.disabled = true;

  try {
    if (useLocalServer) {
      await processViaServer();
      statusEl.textContent = "Download iniciado.";
      return;
    }

    if (typeof pdfjsLib === "undefined" || typeof PDFLib === "undefined") {
      throw new Error(
        "Bibliotecas PDF não carregaram. Confira a internet e recarregue a página."
      );
    }

    if (queue.length === 1) {
      const file = queue[0];
      const buf = await file.arrayBuffer();
      const bytes = await processPdfInBrowser(buf, (cur, tot) => {
        statusEl.textContent = `Processando… página ${cur}/${tot}`;
      });
      const blob = new Blob([bytes], { type: "application/pdf" });
      downloadBlob(blob, `${stemPdfName(file.name)}_digitalizado.pdf`);
      statusEl.textContent = "Download iniciado.";
    } else {
      if (typeof JSZip === "undefined") {
        throw new Error("JSZip não carregou. Verifique a conexão.");
      }
      const zip = new JSZip();
      for (let i = 0; i < queue.length; i++) {
        const file = queue[i];
        statusEl.textContent = `Arquivo ${i + 1}/${queue.length}: ${file.name}`;
        const buf = await file.arrayBuffer();
        const bytes = await processPdfInBrowser(buf, (cur, tot) => {
          statusEl.textContent = `${file.name} — página ${cur}/${tot}`;
        });
        const used = new Set();
        let zipName = `${stemPdfName(file.name)}_digitalizado.pdf`;
        let n = 1;
        while (used.has(zipName)) {
          zipName = `${stemPdfName(file.name)}_digitalizado (${n++}).pdf`;
        }
        used.add(zipName);
        zip.file(zipName, bytes);
        await new Promise((r) => setTimeout(r, 0));
      }
      statusEl.textContent = "Gerando ZIP…";
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      downloadBlob(zipBlob, "pdfs_digitalizados.zip");
      statusEl.textContent = "Download iniciado.";
    }
  } catch (e) {
    setErr(e.message || String(e));
    statusEl.textContent = "";
  } finally {
    processBtn.disabled = queue.length === 0;
    clearBtn.disabled = queue.length === 0;
  }
});
