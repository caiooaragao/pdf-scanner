import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as mupdf from "mupdf";
import { processPdfBuffer } from "./processor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = __dirname;
const OUTPUT_DIR = path.join(__dirname, "digitalizados");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getPdfFiles() {
  return fs
    .readdirSync(INPUT_DIR)
    .filter(
      (f) =>
        f.toLowerCase().endsWith(".pdf") &&
        !path.resolve(INPUT_DIR, f).startsWith(path.resolve(OUTPUT_DIR))
    );
}

async function processPdf(pdfFile) {
  const pdfPath = path.join(INPUT_DIR, pdfFile);
  const data = fs.readFileSync(pdfPath);
  const peek = mupdf.Document.openDocument(data, pdfFile);
  console.log(`  ${peek.countPages()} página(s) encontrada(s)`);

  const outputBytes = await processPdfBuffer(data, pdfFile, {
    onProgress: (cur, total) =>
      process.stdout.write(`\r  Página ${cur}/${total}...`),
  });
  process.stdout.write("\n");
  const outputPath = path.join(OUTPUT_DIR, pdfFile);
  fs.writeFileSync(outputPath, outputBytes);
  console.log(`  Salvo em: ${outputPath}\n`);
}

async function main() {
  console.log("=== PDF Scanner - Efeito de Digitalização ===\n");

  const pdfs = getPdfFiles();
  if (pdfs.length === 0) {
    console.log("Nenhum PDF encontrado na pasta.");
    console.log(`Coloque seus PDFs em: ${INPUT_DIR}`);
    return;
  }

  console.log(`Encontrados ${pdfs.length} PDF(s).\n`);
  ensureDir(OUTPUT_DIR);

  for (const pdf of pdfs) {
    console.log(`Processando: ${pdf}`);
    try {
      await processPdf(pdf);
    } catch (err) {
      console.error(`  ERRO ao processar ${pdf}: ${err.message}`);
      console.error(`  ${err.stack}`);
    }
  }

  console.log("Concluído! PDFs digitalizados estão na pasta 'digitalizados'.");
}

main().catch(console.error);
