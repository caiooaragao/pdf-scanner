import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import * as mupdf from "mupdf";

const DPI = 150;

export function renderPageToPng(doc, pageIndex) {
  const page = doc.loadPage(pageIndex);
  const scale = DPI / 72;
  const matrix = mupdf.Matrix.scale(scale, scale);
  const pixmap = page.toPixmap(
    matrix,
    mupdf.ColorSpace.DeviceRGB,
    false,
    true
  );
  return Buffer.from(pixmap.asPNG());
}

export async function applyScanEffect(pngBuffer) {
  return sharp(pngBuffer)
    .grayscale()
    .blur(0.5)
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * @param {Buffer} data
 * @param {string} nameHint - nome usado pelo mupdf (ex.: "doc.pdf")
 * @param {{ onProgress?: (current: number, total: number) => void }} [options]
 * @returns {Promise<Buffer>}
 */
export async function processPdfBuffer(
  data,
  nameHint = "document.pdf",
  options = {}
) {
  const { onProgress } = options;
  const mupdfDoc = mupdf.Document.openDocument(data, nameHint);
  const pdfDoc = await PDFDocument.load(data);
  const pageCount = mupdfDoc.countPages();
  const originalPages = pdfDoc.getPages();

  const outputPdf = await PDFDocument.create();

  for (let i = 0; i < pageCount; i++) {
    onProgress?.(i + 1, pageCount);
    const pngBuffer = renderPageToPng(mupdfDoc, i);
    const scannedBuffer = await applyScanEffect(pngBuffer);
    const { width: origW, height: origH } = originalPages[i].getSize();
    const img = await outputPdf.embedJpg(scannedBuffer);
    const page = outputPdf.addPage([origW, origH]);
    page.drawImage(img, { x: 0, y: 0, width: origW, height: origH });
  }

  return Buffer.from(await outputPdf.save());
}
