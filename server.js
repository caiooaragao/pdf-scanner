import express from "express";
import multer from "multer";
import archiver from "archiver";
import path from "path";
import { fileURLToPath } from "url";
import { processPdfBuffer } from "./processor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024, files: 50 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      /\.pdf$/i.test(file.originalname || "");
    cb(null, ok);
  },
});

function safeBasename(name) {
  const base = path.basename(name || "document.pdf");
  const cleaned = base.replace(/[^a-zA-Z0-9._()\-À-ÿ\s]+/g, "_").trim();
  return cleaned.slice(0, 180) || "document.pdf";
}

function stemFromPdfName(name) {
  const n = name.toLowerCase().endsWith(".pdf") ? name.slice(0, -4) : name;
  return n || "document";
}

function contentDispositionAttachment(filename) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/process", upload.array("pdfs", 50), async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ error: "Envie pelo menos um PDF." });
  }

  try {
    if (files.length === 1) {
      const f = files[0];
      const name = safeBasename(f.originalname);
      const stem = stemFromPdfName(name);
      const out = await processPdfBuffer(f.buffer, name);
      const outName = `${stem}_digitalizado.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", contentDispositionAttachment(outName));
      return res.send(out);
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="pdfs_digitalizados.zip"'
    );

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err) => {
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });
    archive.pipe(res);

    const used = new Set();
    for (const f of files) {
      const name = safeBasename(f.originalname);
      const stem = stemFromPdfName(name);
      let zipName = `${stem}_digitalizado.pdf`;
      let n = 1;
      while (used.has(zipName)) {
        zipName = `${stem}_digitalizado (${n++}).pdf`;
      }
      used.add(zipName);
      const out = await processPdfBuffer(f.buffer, name);
      archive.append(out, { name: zipName });
    }
    await archive.finalize();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message || "Falha ao processar." });
    }
  }
});

const PORT = Number(process.env.PORT) || 3847;
app.listen(PORT, () => {
  console.log(`Interface web: http://localhost:${PORT}`);
});
