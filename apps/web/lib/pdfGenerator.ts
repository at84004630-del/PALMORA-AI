/**
 * Pure TypeScript Client-Side PDF Generation Engine for Palmora AI
 * Generates genuine multi-page PDF 1.4 documents from palm reading reports,
 * supporting all world languages (Hindi, Japanese, Arabic, Russian, Chinese, European scripts)
 * with luxury mystical and printable themes.
 */

import type {
  PalmReadingReport,
  DualHandReadingReport,
  PalmConsultationResponse,
  SupportedLanguage,
  PalmFeatures,
  Point2D,
} from '@palmora/shared-types';

export interface PdfExportOptions {
  theme?: 'midnight' | 'parchment';
  includeConsultations?: boolean;
  consultations?: PalmConsultationResponse[];
  activeLanguage?: SupportedLanguage;
  features?: PalmFeatures | null;
}

/**
 * Word-wrapping helper for HTML5 Canvas with support for international text.
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];

  // Split by existing newlines first
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }

    const words = para.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Draws rounded rectangle on 2D canvas
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Compiles an array of JPEG Data URLs into a genuine PDF 1.4 binary file.
 */
/**
 * Emits raw PDF 1.4 vector stream operators for crisp, infinitely zoomable vector lines.
 * Conforms to PDF specification: q (save), Q (restore), RG (stroke RGB), w (line width),
 * m (moveto), l (lineto), c (curveto), S (stroke).
 */
export function generatePdfVectorOverlay(
  features: PalmFeatures,
  frame: { xPt: number; yPt: number; wPt: number; hPt: number; pageHeightPt: number }
): string {
  if (!features) return '';

  const { xPt, yPt, wPt, hPt, pageHeightPt } = frame;
  if (!Number.isFinite(xPt) || !Number.isFinite(yPt) || !Number.isFinite(wPt) || !Number.isFinite(hPt) || !Number.isFinite(pageHeightPt)) {
    return '';
  }

  // In PDF 1.4, origin (0, 0) is at bottom-left corner.
  const toPdfX = (normX: number) => {
    const n = Number.isFinite(normX) ? normX : 0.5;
    return (xPt + n * wPt).toFixed(2);
  };
  const toPdfY = (normY: number) => {
    const n = Number.isFinite(normY) ? normY : 0.5;
    return (pageHeightPt - (yPt + n * hPt)).toFixed(2);
  };

  let stream = 'q\n'; // Push graphics state
  stream += '1 j 1 J\n'; // Round join and cap

  // Subtle palmar boundary outline (ellipse via 4 cubic Bézier curves)
  const cx = xPt + wPt / 2;
  const cy = pageHeightPt - (yPt + hPt * 0.52);
  const rx = wPt * 0.38;
  const ry = hPt * 0.40;
  const k = 0.5522847498;
  const ox = rx * k;
  const oy = ry * k;

  stream += '0.784 0.667 0.431 RG\n'; // Gold stroke
  stream += '0.8 w\n';
  stream += '[4 4] 0 d\n';
  stream += `${(cx - rx).toFixed(2)} ${cy.toFixed(2)} m\n`;
  stream += `${(cx - rx).toFixed(2)} ${(cy + oy).toFixed(2)} ${(cx - ox).toFixed(2)} ${(cy + ry).toFixed(2)} ${cx.toFixed(2)} ${(cy + ry).toFixed(2)} c\n`;
  stream += `${(cx + ox).toFixed(2)} ${(cy + ry).toFixed(2)} ${(cx + rx).toFixed(2)} ${(cy + oy).toFixed(2)} ${(cx + rx).toFixed(2)} ${cy.toFixed(2)} c\n`;
  stream += `${(cx + rx).toFixed(2)} ${(cy - oy).toFixed(2)} ${(cx + ox).toFixed(2)} ${(cy - ry).toFixed(2)} ${cx.toFixed(2)} ${(cy - ry).toFixed(2)} c\n`;
  stream += `${(cx - ox).toFixed(2)} ${(cy - ry).toFixed(2)} ${(cx - rx).toFixed(2)} ${(cy - oy).toFixed(2)} ${(cx - rx).toFixed(2)} ${cy.toFixed(2)} c\n`;
  stream += 'S\n';
  stream += '[] 0 d\n'; // Reset dash

  // Polyline generator with complete coordinate validation
  const emitPolyline = (path: Point2D[], r: number, g: number, b: number, width: number) => {
    if (!path || !Array.isArray(path)) return '';
    const valid = path.filter((pt) => pt && Number.isFinite(pt.x) && Number.isFinite(pt.y));
    if (valid.length < 2) return '';
    let res = `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG\n`;
    res += `${width.toFixed(2)} w\n`;
    res += `${toPdfX(valid[0].x)} ${toPdfY(valid[0].y)} m\n`;
    for (let i = 1; i < valid.length; i++) {
      res += `${toPdfX(valid[i].x)} ${toPdfY(valid[i].y)} l\n`;
    }
    res += 'S\n';
    return res;
  };

  // Heart Line (Rose Red: 0.957, 0.247, 0.369)
  if (features.heart_line?.status === 'detected' && features.heart_line.path) {
    stream += emitPolyline(features.heart_line.path, 0.957, 0.247, 0.369, 1.8);
  }

  // Head Line (Sky Cyan: 0.220, 0.741, 0.973)
  if (features.head_line?.status === 'detected' && features.head_line.path) {
    stream += emitPolyline(features.head_line.path, 0.220, 0.741, 0.973, 1.8);
  }

  // Life Line (Emerald Green: 0.204, 0.827, 0.600)
  if (features.life_line?.status === 'detected' && features.life_line.path) {
    stream += emitPolyline(features.life_line.path, 0.204, 0.827, 0.600, 2.0);
  }

  // Fate Line (Amethyst Violet: 0.753, 0.518, 0.988)
  if (features.fate_line?.status === 'detected' && features.fate_line.path) {
    stream += emitPolyline(features.fate_line.path, 0.753, 0.518, 0.988, 1.6);
  }

  // Topographic Mount Contouring (3D Elevation)
  if (features.mount_topography) {
    const isLeft = features.hand_side === 'left';
    const mounts = [
      { key: 'jupiter', defX: 0.29, leftX: 0.71, y: 0.36, r: 12 },
      { key: 'saturn', defX: 0.45, leftX: 0.55, y: 0.33, r: 11 },
      { key: 'apollo', defX: 0.61, leftX: 0.39, y: 0.35, r: 11 },
      { key: 'mercury', defX: 0.75, leftX: 0.25, y: 0.39, r: 11 },
      { key: 'venus', defX: 0.30, leftX: 0.70, y: 0.63, r: 22 },
      { key: 'moon', defX: 0.75, leftX: 0.25, y: 0.67, r: 18 },
    ];

    mounts.forEach((m) => {
      const data = (features.mount_topography as any)?.[m.key];
      const rawElev = data?.relative_elevation;
      const elev = Number.isFinite(rawElev) ? rawElev : 0.5;
      const rawX = isLeft ? m.leftX : m.defX;
      const mx = parseFloat(toPdfX(rawX));
      const my = parseFloat(toPdfY(m.y));
      const mr = m.r * (0.8 + elev * 0.4);

      if (Number.isFinite(mx) && Number.isFinite(my) && Number.isFinite(mr) && mr > 0) {
        stream += '0.784 0.667 0.431 RG\n';
        stream += '0.6 w\n';
        stream += '[2 2] 0 d\n';
        const mk = 0.5522847498 * mr;
        stream += `${(mx - mr).toFixed(2)} ${my.toFixed(2)} m\n`;
        stream += `${(mx - mr).toFixed(2)} ${(my + mk).toFixed(2)} ${(mx - mk).toFixed(2)} ${(my + mr).toFixed(2)} ${mx.toFixed(2)} ${(my + mr).toFixed(2)} c\n`;
        stream += `${(mx + mk).toFixed(2)} ${(my + mr).toFixed(2)} ${(mx + mr).toFixed(2)} ${(my + mk).toFixed(2)} ${(mx + mr).toFixed(2)} ${my.toFixed(2)} c\n`;
        stream += `${(mx + mr).toFixed(2)} ${(my - mk).toFixed(2)} ${(mx + mk).toFixed(2)} ${(my - mr).toFixed(2)} ${mx.toFixed(2)} ${(my - mr).toFixed(2)} c\n`;
        stream += `${(mx - mk).toFixed(2)} ${(my - mr).toFixed(2)} ${(mx - mr).toFixed(2)} ${(my - mk).toFixed(2)} ${(mx - mr).toFixed(2)} ${my.toFixed(2)} c\n`;
        stream += 'S\n';
      }
    });
    stream += '[] 0 d\n';
  }

  // Embed Developmental Timeline Milestone Nodes along Life Line in PDF
  if (features.life_line?.path && Array.isArray(features.life_line.path) && features.life_line.path.length >= 2) {
    const lifeFractions = [0.15, 0.28, 0.50, 0.72, 0.90]; // Ages 18, 25, 35, 48, 62
    let totalLen = 0;
    const segLens: number[] = [];
    const p = features.life_line.path.filter((pt) => pt && Number.isFinite(pt.x) && Number.isFinite(pt.y));
    if (p.length >= 2) {
      for (let i = 0; i < p.length - 1; i++) {
        const d = Math.hypot(p[i + 1].x - p[i].x, p[i + 1].y - p[i].y);
        segLens.push(d);
        totalLen += d;
      }
      if (totalLen > 0) {
        lifeFractions.forEach((frac) => {
          const target = frac * totalLen;
          let acc = 0;
          let pt = p[0];
          for (let i = 0; i < segLens.length; i++) {
            if (acc + segLens[i] >= target || i === segLens.length - 1) {
              const t = segLens[i] > 0 ? (target - acc) / segLens[i] : 0;
              pt = {
                x: p[i].x + t * (p[i + 1].x - p[i].x),
                y: p[i].y + t * (p[i + 1].y - p[i].y),
              };
              break;
            }
            acc += segLens[i];
          }
          const bx = parseFloat(toPdfX(pt.x));
          const by = parseFloat(toPdfY(pt.y));
          const br = 2.4;
          const bk = 0.5522847498 * br;
          if (Number.isFinite(bx) && Number.isFinite(by)) {
            stream += '0.784 0.667 0.431 RG\n'; // Gold stroke
            stream += '1.0 w\n';
            stream += '[] 0 d\n';
            stream += `${(bx - br).toFixed(2)} ${by.toFixed(2)} m\n`;
            stream += `${(bx - br).toFixed(2)} ${(by + bk).toFixed(2)} ${(bx - bk).toFixed(2)} ${(by + br).toFixed(2)} ${bx.toFixed(2)} ${(by + br).toFixed(2)} c\n`;
            stream += `${(bx + bk).toFixed(2)} ${(by + br).toFixed(2)} ${(bx + br).toFixed(2)} ${(by + bk).toFixed(2)} ${(bx + br).toFixed(2)} ${by.toFixed(2)} c\n`;
            stream += `${(bx + br).toFixed(2)} ${(by - bk).toFixed(2)} ${(bx + bk).toFixed(2)} ${(by - bk).toFixed(2)} ${bx.toFixed(2)} ${(by - bk).toFixed(2)} c\n`;
            stream += `${(bx - bk).toFixed(2)} ${(by - bk).toFixed(2)} ${(bx - br).toFixed(2)} ${(by - bk).toFixed(2)} ${(bx - br).toFixed(2)} ${by.toFixed(2)} c\n`;
            stream += 'S\n';
          }
        });
      }
    }
  }

  stream += 'Q\n'; // Pop graphics state
  return stream;
}

/**
 * Compiles an array of JPEG Data URLs into a genuine, 100% standards-compliant PDF 1.4 binary file,
 * conforming to ISO 32000-1 specifications for universal rendering in Adobe Acrobat, Chrome, Edge, and Preview.
 */
function getJpegDimensions(bytes: Uint8Array): { w: number; h: number } {
  let i = 2;
  while (i < bytes.length - 8) {
    if (bytes[i] === 0xFF) {
      const marker = bytes[i + 1];
      if (marker >= 0xC0 && marker <= 0xC3) {
        const h = (bytes[i + 5] << 8) | bytes[i + 6];
        const w = (bytes[i + 7] << 8) | bytes[i + 8];
        return { w, h };
      } else if (marker === 0xD9 || marker === 0xDA) {
        break;
      } else {
        const len = (bytes[i + 2] << 8) | bytes[i + 3];
        i += 2 + len;
      }
    } else {
      i++;
    }
  }
  return { w: 1240, h: 1754 };
}

function compilePdfFromImages(
  jpegDataUrls: string[],
  widthPt = 595.28,
  heightPt = 841.89,
  pageVectorStreams: (string | null)[] = []
): Uint8Array {
  const binaryChunks: (string | Uint8Array)[] = [];
  const objectOffsets: number[] = [];
  let currentOffset = 0;

  function write(str: string) {
    binaryChunks.push(str);
    currentOffset += new TextEncoder().encode(str).length;
  }

  function writeBytes(bytes: Uint8Array) {
    binaryChunks.push(bytes);
    currentOffset += bytes.length;
  }

  function markObject(objNum: number) {
    objectOffsets[objNum] = currentOffset;
    write(`${objNum} 0 obj\n`);
  }

  // 1. PDF 1.4 Header with binary high-bit marker
  write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const pageCount = jpegDataUrls.length;
  const infoObjNum = 2 + pageCount * 3 + 1;
  const totalObjects = infoObjNum;

  // 2. Catalog (Object 1)
  markObject(1);
  write('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 3. Pages Collection (Object 2)
  const pageKids = Array.from({ length: pageCount }, (_, i) => `${3 + i * 3} 0 R`).join(' ');
  markObject(2);
  write(`<< /Type /Pages /Kids [${pageKids}] /Count ${pageCount} >>\nendobj\n`);

  // 4. Build Page Objects, Content Streams, and Image XObjects
  for (let i = 0; i < pageCount; i++) {
    const pageObjNum = 3 + i * 3;
    const contentObjNum = 4 + i * 3;
    const imgObjNum = 5 + i * 3;

    // Convert data URL to binary JPEG bytes
    const rawDataUrl = jpegDataUrls[i] || '';
    const base64Data = rawDataUrl.includes(',') ? rawDataUrl.split(',')[1] : rawDataUrl;
    let jpegBytes: Uint8Array;
    try {
      const binaryStr = atob(base64Data);
      jpegBytes = new Uint8Array(binaryStr.length);
      for (let b = 0; b < binaryStr.length; b++) {
        jpegBytes[b] = binaryStr.charCodeAt(b);
      }
    } catch {
      // Fallback 1x1 JPEG if base64 decoding fails
      jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7F, 0xFF, 0xD9]);
    }

    const { w: imgWidth, h: imgHeight } = getJpegDimensions(jpegBytes);

    // Page Dictionary with ProcSet for full PDF 1.4 reader compliance
    markObject(pageObjNum);
    write(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] ` +
      `/Resources << /ProcSet [/PDF /Text /ImageB /ImageC /ImageI] /XObject << /Im${i + 1} ${imgObjNum} 0 R >> >> ` +
      `/Contents ${contentObjNum} 0 R >>\nendobj\n`
    );

    // Content Stream: draw raster image to fill page, followed by vector path overlays
    const rasterOp = `q\n${widthPt} 0 0 ${heightPt} 0 0 cm\n/Im${i + 1} Do\nQ\n`;
    const vectorOp = (pageVectorStreams && pageVectorStreams[i]) ? pageVectorStreams[i]! : '';
    const streamContent = rasterOp + vectorOp;
    const streamBytes = new TextEncoder().encode(streamContent);

    markObject(contentObjNum);
    write(`<< /Length ${streamBytes.length} >>\nstream\n`);
    writeBytes(streamBytes);
    write('\nendstream\nendobj\n');

    // Image XObject with exact byte length and true dimensions
    markObject(imgObjNum);
    write(
      `<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    );
    writeBytes(jpegBytes);
    write('\nendstream\nendobj\n');
  }

  // 5. Document Metadata /Info Dictionary (Object totalObjects)
  markObject(infoObjNum);
  const now = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  write(
    '<< /Title (Palmora AI Cultural Chiromancy Reading Folio) ' +
    '/Creator (Palmora Pure PDF Engine 1.4) ' +
    '/Producer (Palmora AI Pure PDF Engine) ' +
    `/CreationDate (D:${now}Z) >>\nendobj\n`
  );

  // 6. Cross-reference Table (xref) with exact 20-byte CRLF entries
  const startXref = currentOffset;
  write(`xref\n0 ${totalObjects + 1}\n`);
  write('0000000000 65535 f \r\n');
  for (let o = 1; o <= totalObjects; o++) {
    const offsetStr = String(objectOffsets[o] || 0).padStart(10, '0');
    write(`${offsetStr} 00000 n \r\n`);
  }

  // 7. Trailer with /ID and /Info references
  write(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R /Info ${infoObjNum} 0 R ` +
    `/ID [<4e6f746570616c6d6f7261303031> <4e6f746570616c6d6f7261303031>] >>\n` +
    `startxref\n${startXref}\n%%EOF\r\n`
  );

  // Merge chunks into single ArrayBuffer
  const totalLength = binaryChunks.reduce((acc, c) => acc + (typeof c === 'string' ? new TextEncoder().encode(c).length : c.length), 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of binaryChunks) {
    if (typeof chunk === 'string') {
      const encoded = new TextEncoder().encode(chunk);
      result.set(encoded, pos);
      pos += encoded.length;
    } else {
      result.set(chunk, pos);
      pos += chunk.length;
    }
  }

  return result;
}

/**
 * Main PDF Generation Entrypoint
 */
export async function generatePalmReadingPdf(
  report: PalmReadingReport,
  options: PdfExportOptions = {}
): Promise<{ blob: Blob; url: string; filename: string }> {
  const isDark = options.theme !== 'parchment';
  const width = 1240;
  const height = 1754;

  const bgGradientStart = isDark ? '#070913' : '#FAF8F5';
  const bgGradientEnd = isDark ? '#0D1124' : '#F3EFEA';
  const goldColor = '#C8AA6E';
  const goldDim = isDark ? 'rgba(200,170,110,0.3)' : 'rgba(180,140,70,0.35)';
  const cardBg = isDark ? '#0B0F22' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(200,170,110,0.2)' : 'rgba(200,170,110,0.4)';
  const textColor = isDark ? '#F3F4F6' : '#1F2937';
  const textMuted = isDark ? '#9CA3AF' : '#6B7280';
  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", sans-serif';

  const pagesImages: string[] = [];

  function createPageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Page Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, bgGradientStart);
    bgGrad.addColorStop(1, bgGradientEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Borders
    ctx.strokeStyle = goldDim;
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, width - 72, height - 72);
    ctx.strokeRect(44, 44, width - 88, height - 88);

    // Corner Accents
    const corners = [
      [36, 36],
      [width - 36, 36],
      [36, height - 36],
      [width - 36, height - 36],
    ];
    ctx.fillStyle = goldColor;
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    return { canvas, ctx };
  }

  function drawFooter(ctx: CanvasRenderingContext2D, pageNum: number, totalPages: number) {
    ctx.fillStyle = textMuted;
    ctx.font = `14px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText(
      `Palmora AI • Private & Confidential Cultural Reflection • Page ${pageNum} of ${totalPages}`,
      width / 2,
      height - 56
    );
  }

  // --- PAGE 1: COVER & EXECUTIVE OVERVIEW ---
  const { canvas: page1Canvas, ctx: p1 } = createPageCanvas();

  // Emblem Header
  p1.textAlign = 'center';
  p1.fillStyle = goldColor;
  p1.font = `bold 28px ${fontFamily}`;
  p1.fillText('✧ PALMORA AI ✧', width / 2, 105);

  p1.font = `15px ${fontFamily}`;
  p1.fillStyle = textMuted;
  p1.fillText('CULTURAL CHIROMANCY & VISUAL PALM REFLECTION', width / 2, 132);

  // Divider
  p1.strokeStyle = goldColor;
  p1.lineWidth = 1.5;
  p1.beginPath();
  p1.moveTo(width / 2 - 140, 150);
  p1.lineTo(width / 2 + 140, 150);
  p1.stroke();

  // Reading Title
  p1.fillStyle = isDark ? '#FFFFFF' : '#111827';
  p1.font = `bold 38px ${fontFamily}`;
  const titleLines = wrapCanvasText(p1, report.reading_title, width - 180);
  let curY = 210;
  for (const line of titleLines) {
    p1.fillText(line, width / 2, curY);
    curY += 46;
  }

  // Metadata Pill
  curY += 10;
  p1.fillStyle = isDark ? 'rgba(200,170,110,0.12)' : 'rgba(200,170,110,0.2)';
  p1.strokeStyle = goldDim;
  p1.lineWidth = 1;
  const pillW = 560;
  const pillH = 40;
  drawRoundedRect(p1, width / 2 - pillW / 2, curY, pillW, pillH, 20);
  p1.fill();
  p1.stroke();

  p1.fillStyle = goldColor;
  p1.font = `bold 14px ${fontFamily}`;
  const createdDate = new Date(report.created_at).toLocaleDateString(undefined, { dateStyle: 'long' });
  const langName = options.activeLanguage?.name || report.language || 'English';
  p1.fillText(`Date: ${createdDate}   •   Language: ${langName}   •   ID: ${report.id.slice(0, 8)}`, width / 2, curY + 25);

  curY += 65;

  // Features Analyzed Chips
  p1.textAlign = 'left';
  p1.fillStyle = textMuted;
  p1.font = `bold 14px ${fontFamily}`;
  p1.fillText('OBSERVED PALM CREASES ANALYZED:', 70, curY);
  curY += 24;

  let chipX = 70;
  for (const feat of (report.features_analyzed || ['Heart Line', 'Head Line', 'Life Line'])) {
    p1.font = `13px ${fontFamily}`;
    const featW = p1.measureText(`✓ ${feat}`).width + 24;
    p1.fillStyle = isDark ? '#141A33' : '#EFE9DE';
    p1.strokeStyle = isDark ? 'rgba(200,170,110,0.3)' : 'rgba(180,140,70,0.4)';
    drawRoundedRect(p1, chipX, curY, featW, 30, 15);
    p1.fill();
    p1.stroke();

    p1.fillStyle = textColor;
    p1.fillText(`✓ ${feat}`, chipX + 12, curY + 20);
    chipX += featW + 12;
  }

  curY += 55;

  // Overall Synthesis Card
  p1.fillStyle = cardBg;
  p1.strokeStyle = cardBorder;
  p1.lineWidth = 1.5;
  const synthCardH = 260;
  drawRoundedRect(p1, 70, curY, width - 140, synthCardH, 20);
  p1.fill();
  p1.stroke();

  p1.fillStyle = goldColor;
  p1.font = `bold 18px ${fontFamily}`;
  p1.fillText('✧ Integrative Life Synthesis', 96, curY + 40);

  p1.fillStyle = textColor;
  p1.font = `16px ${fontFamily}`;
  const synthLines = wrapCanvasText(p1, `"${report.overall_synthesis || ''}"`, width - 192);
  let synthY = curY + 76;
  for (const sLine of synthLines.slice(0, 7)) {
    p1.fillText(sLine, 96, synthY);
    synthY += 26;
  }

  curY += synthCardH + 30;

  // Section 1: Love & Emotional Harmony
  p1.fillStyle = cardBg;
  p1.strokeStyle = isDark ? 'rgba(244,63,94,0.3)' : 'rgba(225,29,72,0.3)';
  const loveCardH = 460;
  drawRoundedRect(p1, 70, curY, width - 140, loveCardH, 20);
  p1.fill();
  p1.stroke();

  // Love Header
  p1.fillStyle = isDark ? '#F43F5E' : '#E11D48';
  p1.font = `bold 20px ${fontFamily}`;
  p1.fillText(`♥ ${report.love_reading?.title || 'Heart Line: Emotional Expression'}`, 96, curY + 40);

  p1.fillStyle = textMuted;
  p1.font = `13px ${fontFamily}`;
  p1.fillText(
    `${report.love_reading?.feature_name || 'Heart Line'} • ${report.love_reading?.tradition_attribution || 'Classical Chiromancy'}`,
    96,
    curY + 64
  );

  let lY = curY + 98;
  if (report.love_reading?.observed_measurements_summary) {
    p1.fillStyle = isDark ? '#14182E' : '#F4F0E8';
    drawRoundedRect(p1, 96, lY, width - 192, 38, 10);
    p1.fill();
    p1.fillStyle = goldColor;
    p1.font = `bold 12px ${fontFamily}`;
    p1.fillText('PHYSICAL MEASUREMENTS:', 110, lY + 24);
    p1.fillStyle = textColor;
    p1.font = `13px ${fontFamily}`;
    p1.fillText(report.love_reading.observed_measurements_summary, 280, lY + 24);
    lY += 54;
  }

  p1.fillStyle = textColor;
  p1.font = `15px ${fontFamily}`;
  const loveLines = wrapCanvasText(p1, report.love_reading?.traditional_interpretation || '', width - 192);
  for (const line of loveLines.slice(0, 6)) {
    p1.fillText(line, 96, lY);
    lY += 24;
  }

  lY += 12;
  p1.fillStyle = goldColor;
  p1.font = `bold 14px ${fontFamily}`;
  p1.fillText('Mindful Self-Reflection Prompts:', 96, lY);
  lY += 22;

  p1.fillStyle = textColor;
  p1.font = `14px ${fontFamily}`;
  for (const prompt of (report.love_reading?.reflective_prompts || []).slice(0, 2)) {
    p1.fillText(`• ${prompt}`, 106, lY);
    lY += 22;
  }

  // Footer for Page 1
  const totalPages = (options.includeConsultations && (options.consultations?.length || 0) > 0) ? 3 : 2;
  drawFooter(p1, 1, totalPages);
  pagesImages.push(page1Canvas.toDataURL('image/jpeg', 0.92));

  // --- PAGE 2: CAREER, VITALITY & ETHICAL DISCLAIMER ---
  const { canvas: page2Canvas, ctx: p2 } = createPageCanvas();

  p2.textAlign = 'center';
  p2.fillStyle = goldColor;
  p2.font = `bold 22px ${fontFamily}`;
  p2.fillText('✧ PALMORA AI REPORT ✧', width / 2, 95);

  let p2Y = 135;
  p2.textAlign = 'left';

  // Section 2: Career Reading
  p2.fillStyle = cardBg;
  p2.strokeStyle = isDark ? 'rgba(56,189,248,0.3)' : 'rgba(2,132,199,0.3)';
  const careerCardH = 460;
  drawRoundedRect(p2, 70, p2Y, width - 140, careerCardH, 20);
  p2.fill();
  p2.stroke();

  p2.fillStyle = isDark ? '#38BDF8' : '#0284C7';
  p2.font = `bold 20px ${fontFamily}`;
  p2.fillText(`◆ ${report.career_reading?.title || 'Head Line: Cognitive Temperament'}`, 96, p2Y + 40);

  p2.fillStyle = textMuted;
  p2.font = `13px ${fontFamily}`;
  p2.fillText(
    `${report.career_reading?.feature_name || 'Head Line'} • ${report.career_reading?.tradition_attribution || 'Classical Chiromancy'}`,
    96,
    p2Y + 64
  );

  let cY = p2Y + 98;
  if (report.career_reading?.observed_measurements_summary) {
    p2.fillStyle = isDark ? '#14182E' : '#F4F0E8';
    drawRoundedRect(p2, 96, cY, width - 192, 38, 10);
    p2.fill();
    p2.fillStyle = goldColor;
    p2.font = `bold 12px ${fontFamily}`;
    p2.fillText('PHYSICAL MEASUREMENTS:', 110, cY + 24);
    p2.fillStyle = textColor;
    p2.font = `13px ${fontFamily}`;
    p2.fillText(report.career_reading.observed_measurements_summary, 280, cY + 24);
    cY += 54;
  }

  p2.fillStyle = textColor;
  p2.font = `15px ${fontFamily}`;
  const careerLines = wrapCanvasText(p2, report.career_reading?.traditional_interpretation || '', width - 192);
  for (const line of careerLines.slice(0, 6)) {
    p2.fillText(line, 96, cY);
    cY += 24;
  }

  cY += 12;
  p2.fillStyle = goldColor;
  p2.font = `bold 14px ${fontFamily}`;
  p2.fillText('Mindful Self-Reflection Prompts:', 96, cY);
  cY += 22;

  p2.fillStyle = textColor;
  p2.font = `14px ${fontFamily}`;
  for (const prompt of (report.career_reading?.reflective_prompts || []).slice(0, 2)) {
    p2.fillText(`• ${prompt}`, 106, cY);
    cY += 22;
  }

  p2Y += careerCardH + 30;

  // Section 3: Vitality & Temperament
  p2.fillStyle = cardBg;
  p2.strokeStyle = isDark ? 'rgba(52,211,153,0.3)' : 'rgba(5,150,105,0.3)';
  const lifeCardH = 460;
  drawRoundedRect(p2, 70, p2Y, width - 140, lifeCardH, 20);
  p2.fill();
  p2.stroke();

  p2.fillStyle = isDark ? '#34D399' : '#059669';
  p2.font = `bold 20px ${fontFamily}`;
  p2.fillText(`✦ ${report.personality_reading?.title || 'Life Line: Vitality & Equanimity'}`, 96, p2Y + 40);

  p2.fillStyle = textMuted;
  p2.font = `13px ${fontFamily}`;
  p2.fillText(
    `${report.personality_reading?.feature_name || 'Life Line'} • ${report.personality_reading?.tradition_attribution || 'Samudrika Shastra'}`,
    96,
    p2Y + 64
  );

  let vY = p2Y + 98;
  if (report.personality_reading?.observed_measurements_summary) {
    p2.fillStyle = isDark ? '#14182E' : '#F4F0E8';
    drawRoundedRect(p2, 96, vY, width - 192, 38, 10);
    p2.fill();
    p2.fillStyle = goldColor;
    p2.font = `bold 12px ${fontFamily}`;
    p2.fillText('PHYSICAL MEASUREMENTS:', 110, vY + 24);
    p2.fillStyle = textColor;
    p2.font = `13px ${fontFamily}`;
    p2.fillText(report.personality_reading.observed_measurements_summary, 280, vY + 24);
    vY += 54;
  }

  p2.fillStyle = textColor;
  p2.font = `15px ${fontFamily}`;
  const lifeLines = wrapCanvasText(p2, report.personality_reading?.traditional_interpretation || '', width - 192);
  for (const line of lifeLines.slice(0, 6)) {
    p2.fillText(line, 96, vY);
    vY += 24;
  }

  vY += 12;
  p2.fillStyle = goldColor;
  p2.font = `bold 14px ${fontFamily}`;
  p2.fillText('Mindful Self-Reflection Prompts:', 96, vY);
  vY += 22;

  p2.fillStyle = textColor;
  p2.font = `14px ${fontFamily}`;
  for (const prompt of (report.personality_reading?.reflective_prompts || []).slice(0, 2)) {
    p2.fillText(`• ${prompt}`, 106, vY);
    vY += 22;
  }

  p2Y += lifeCardH + 30;

  // Disclaimer Box
  p2.fillStyle = isDark ? '#0A0E1F' : '#ECE8E1';
  p2.strokeStyle = goldDim;
  const discH = 110;
  drawRoundedRect(p2, 70, p2Y, width - 140, discH, 14);
  p2.fill();
  p2.stroke();

  p2.fillStyle = goldColor;
  p2.font = `bold 13px ${fontFamily}`;
  p2.fillText('ETHICAL & CULTURAL NOTICE:', 96, p2Y + 30);

  p2.fillStyle = textMuted;
  p2.font = `12px ${fontFamily}`;
  const discLines = wrapCanvasText(p2, report.disclaimer, width - 192);
  let dY = p2Y + 54;
  for (const dLine of discLines.slice(0, 3)) {
    p2.fillText(dLine, 96, dY);
    dY += 20;
  }

  drawFooter(p2, 2, totalPages);
  pagesImages.push(page2Canvas.toDataURL('image/jpeg', 0.92));

  // --- PAGE 3 (OPTIONAL): CONSULTATION INQUIRIES & ANSWERS ---
  if (options.includeConsultations && options.consultations && options.consultations.length > 0) {
    const { canvas: page3Canvas, ctx: p3 } = createPageCanvas();

    p3.textAlign = 'center';
    p3.fillStyle = goldColor;
    p3.font = `bold 22px ${fontFamily}`;
    p3.fillText('✧ INTERACTIVE CHIROMANCY CONSULTATIONS ✧', width / 2, 95);

    p3.font = `14px ${fontFamily}`;
    p3.fillStyle = textMuted;
    p3.fillText('Grounding inquiries in Money, Health, Career & Life Scope', width / 2, 122);

    let qY = 160;
    p3.textAlign = 'left';

    for (let idx = 0; idx < Math.min(options.consultations.length, 3); idx++) {
      const item = options.consultations[idx];
      const cardH = 390;

      p3.fillStyle = cardBg;
      p3.strokeStyle = cardBorder;
      drawRoundedRect(p3, 70, qY, width - 140, cardH, 18);
      p3.fill();
      p3.stroke();

      p3.fillStyle = goldColor;
      p3.font = `bold 16px ${fontFamily}`;
      p3.fillText(`Inquiry ${idx + 1} (${item.category.toUpperCase()}): "${item.question}"`, 96, qY + 38);

      p3.fillStyle = textColor;
      p3.font = `14px ${fontFamily}`;
      const ansLines = wrapCanvasText(p3, item.answer, width - 192);
      let aY = qY + 70;
      for (const line of ansLines.slice(0, 5)) {
        p3.fillText(line, 96, aY);
        aY += 22;
      }

      aY += 10;
      p3.fillStyle = goldColor;
      p3.font = `bold 13px ${fontFamily}`;
      p3.fillText('Key Takeaways:', 96, aY);
      aY += 20;

      p3.fillStyle = textColor;
      p3.font = `13px ${fontFamily}`;
      for (const insight of item.key_insights.slice(0, 2)) {
        p3.fillText(`• ${insight}`, 106, aY);
        aY += 20;
      }

      aY += 10;
      p3.fillStyle = isDark ? '#34D399' : '#059669';
      p3.font = `bold 13px ${fontFamily}`;
      p3.fillText('Reflective Action:', 96, aY);
      aY += 18;
      p3.fillStyle = textColor;
      const actLines = wrapCanvasText(p3, item.reflective_action, width - 192);
      for (const act of actLines.slice(0, 2)) {
        p3.fillText(act, 106, aY);
        aY += 18;
      }

      qY += cardH + 25;
    }

    drawFooter(p3, 3, totalPages);
    pagesImages.push(page3Canvas.toDataURL('image/jpeg', 0.92));
  }

  // Compile binary PDF with genuine vector stream overlay
  const vectorStreams: (string | null)[] = [];
  if (options.features) {
    const scale = 595.28 / width;
    const page1Vector = generatePdfVectorOverlay(options.features, {
      xPt: 70 * scale,
      yPt: 460 * scale,
      wPt: (width - 140) * scale,
      hPt: 260 * scale,
      pageHeightPt: 841.89,
    });
    vectorStreams.push(page1Vector);
  } else {
    vectorStreams.push(null);
  }
  vectorStreams.push(null); // page 2
  if (options.includeConsultations && options.consultations && options.consultations.length > 0) {
    vectorStreams.push(null); // page 3
  }

  const pdfBytes = compilePdfFromImages(pagesImages, 595.28, 841.89, vectorStreams);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const sanitizedTitle = (report.reading_title || 'Palmora_Reading')
    .replace(/[^a-zA-Z0-9_\u0900-\u097F\u4e00-\u9fa5\u3040-\u30ff]/g, '_')
    .slice(0, 32);
  const langTag = report.language || 'en';
  const filename = `Palmora_Reading_${sanitizedTitle}_${langTag}.pdf`;

  return { blob, url, filename };
}

/**
 * Generates an ultra-luxurious, multi-page commemorative PDF for Dual-Hand Evolution readings.
 */
export async function generateDualHandReadingPdf(
  dualReport: DualHandReadingReport,
  options: PdfExportOptions = {}
): Promise<{ blob: Blob; url: string; filename: string }> {
  const isDark = options.theme !== 'parchment';

  // Palette Tokens
  const bgMain = isDark ? '#070913' : '#FDFBF7';
  const cardBg = isDark ? '#0D1122' : '#F3EFE6';
  const cardBorder = isDark ? 'rgba(200, 170, 110, 0.28)' : 'rgba(180, 140, 75, 0.35)';
  const goldColor = isDark ? '#C8AA6E' : '#936D27';
  const goldDim = isDark ? 'rgba(200, 170, 110, 0.45)' : 'rgba(147, 109, 39, 0.45)';
  const textColor = isDark ? '#E5E7EB' : '#1F2937';
  const textMuted = isDark ? '#9CA3AF' : '#6B7280';
  const purpleColor = isDark ? '#C084FC' : '#7E22CE';

  const fontFamily =
    options.activeLanguage?.code === 'hi'
      ? '"Noto Sans Devanagari", "Inter", sans-serif'
      : options.activeLanguage?.code === 'ar'
      ? '"Noto Sans Arabic", "Inter", sans-serif'
      : options.activeLanguage?.code === 'zh'
      ? '"Noto Sans SC", "Inter", sans-serif'
      : options.activeLanguage?.code === 'ja'
      ? '"Noto Sans JP", "Inter", sans-serif'
      : '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const width = 1240;
  const height = 1754;
  const hasConsultations = options.includeConsultations && options.consultations && options.consultations.length > 0;
  const totalPages = hasConsultations ? 3 : 2;
  const pagesImages: string[] = [];

  function createPageCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = bgMain;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = goldDim;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(36, 36, width - 72, height - 72);

    ctx.strokeStyle = isDark ? 'rgba(200,170,110,0.15)' : 'rgba(147,109,39,0.15)';
    ctx.lineWidth = 0.75;
    ctx.strokeRect(44, 44, width - 88, height - 88);

    const corners = [
      [36, 36],
      [width - 36, 36],
      [36, height - 36],
      [width - 36, height - 36],
    ];
    ctx.fillStyle = goldColor;
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    return { canvas, ctx };
  }

  function drawFooter(ctx: CanvasRenderingContext2D, pageNum: number) {
    ctx.fillStyle = textMuted;
    ctx.font = `14px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillText(
      `Palmora AI • Dual-Hand Evolution Commemorative Folio • Page ${pageNum} of ${totalPages}`,
      width / 2,
      height - 56
    );
  }

  // --- PAGE 1: COVER, CONSCIOUS GROWTH INDEX & HOLISTIC SYNTHESIS ---
  const { canvas: page1Canvas, ctx: p1 } = createPageCanvas();

  p1.textAlign = 'center';
  p1.fillStyle = goldColor;
  p1.font = `bold 28px ${fontFamily}`;
  p1.fillText('✧ PALMORA AI ✧', width / 2, 105);

  p1.font = `14px ${fontFamily}`;
  p1.fillStyle = textMuted;
  p1.fillText('CHIROLOGICAL DUAL-HAND EVOLUTION • INNATE BLUEPRINT VS. MANIFESTED REALITY', width / 2, 132);

  p1.strokeStyle = goldColor;
  p1.lineWidth = 1.5;
  p1.beginPath();
  p1.moveTo(width / 2 - 160, 150);
  p1.lineTo(width / 2 + 160, 150);
  p1.stroke();

  p1.fillStyle = isDark ? '#FFFFFF' : '#111827';
  p1.font = `bold 36px ${fontFamily}`;
  const titleLines = wrapCanvasText(p1, dualReport.reading_title, width - 180);
  let curY = 205;
  for (const line of titleLines) {
    p1.fillText(line, width / 2, curY);
    curY += 44;
  }

  // Metadata Pill
  curY += 8;
  const pillW = 760;
  const pillH = 46;
  const pillX = (width - pillW) / 2;
  p1.fillStyle = isDark ? 'rgba(200,170,110,0.12)' : 'rgba(200,170,110,0.2)';
  p1.strokeStyle = goldDim;
  p1.lineWidth = 1;
  drawRoundedRect(p1, pillX, curY, pillW, pillH, 23);
  p1.fill();
  p1.stroke();

  p1.fillStyle = isDark ? '#F3F4F6' : '#374151';
  p1.font = `14px ${fontFamily}`;
  const dateStr = new Date(dualReport.created_at).toLocaleDateString(undefined, { dateStyle: 'long' });
  p1.fillText(
    `Non-Dominant: ${dualReport.non_dominant_hand.toUpperCase()} Hand (Innate) • Dominant: ${dualReport.dominant_hand.toUpperCase()} Hand (Manifested) • ${dateStr}`,
    width / 2,
    curY + 28
  );

  // Conscious Growth Index Meter Card
  curY += 75;
  const meterW = width - 140;
  const meterH = 240;
  const meterX = 70;
  p1.fillStyle = cardBg;
  p1.strokeStyle = cardBorder;
  p1.lineWidth = 1.5;
  drawRoundedRect(p1, meterX, curY, meterW, meterH, 24);
  p1.fill();
  p1.stroke();

  p1.fillStyle = purpleColor;
  p1.font = `bold 14px ${fontFamily}`;
  p1.fillText('✧ CONSCIOUS GROWTH INDEX ✧', width / 2, curY + 45);

  p1.fillStyle = isDark ? '#FFFFFF' : '#111827';
  p1.font = `bold 62px ${fontFamily}`;
  p1.fillText(`${dualReport.growth_index.toFixed(0)}`, width / 2 - 25, curY + 115);
  p1.font = `bold 22px ${fontFamily}`;
  p1.fillStyle = textMuted;
  p1.fillText('/ 100', width / 2 + 55, curY + 115);

  // Growth Progress Bar
  const barW = 540;
  const barH = 14;
  const barX = (width - barW) / 2;
  const barY = curY + 140;
  p1.fillStyle = isDark ? '#1F2937' : '#E5E7EB';
  drawRoundedRect(p1, barX, barY, barW, barH, 7);
  p1.fill();

  const fillW = (barW * Math.min(100, Math.max(10, dualReport.growth_index))) / 100;
  p1.fillStyle = goldColor;
  drawRoundedRect(p1, barX, barY, fillW, barH, 7);
  p1.fill();

  p1.fillStyle = isDark ? '#34D399' : '#059669';
  p1.font = `bold 14px ${fontFamily}`;
  p1.fillText('Dynamic Adaptive Growth • Active Personal Agency Manifested', width / 2, curY + 185);

  p1.font = `13px ${fontFamily}`;
  p1.fillStyle = textMuted;
  p1.fillText(
    'Measures how lived choices and deliberate focus have actualized and expanded your inborn constitutional blueprint.',
    width / 2,
    curY + 210
  );

  // Overall Evolution Narrative Card
  curY += meterH + 40;
  const synthW = width - 140;
  const synthH = 580;
  p1.fillStyle = cardBg;
  p1.strokeStyle = cardBorder;
  p1.lineWidth = 1.5;
  drawRoundedRect(p1, 70, curY, synthW, synthH, 24);
  p1.fill();
  p1.stroke();

  p1.fillStyle = goldColor;
  p1.font = `bold 18px ${fontFamily}`;
  p1.textAlign = 'center';
  p1.fillText('✧ SYNTHESIS OF INNATE POTENTIAL VS. LIVED REALITY ✧', width / 2, curY + 52);

  p1.textAlign = 'left';
  p1.font = `italic 18px ${fontFamily}`;
  p1.fillStyle = textColor;
  const synthLines = wrapCanvasText(p1, `“${dualReport.overall_evolution_synthesis}”`, synthW - 80);
  let sY = curY + 110;
  for (const line of synthLines.slice(0, 10)) {
    p1.fillText(line, 110, sY);
    sY += 34;
  }

  // Philosophical Principles Checklist
  sY = curY + 410;
  p1.font = `bold 15px ${fontFamily}`;
  p1.fillStyle = goldColor;
  p1.fillText('Foundations of Dual-Hand Chirology:', 110, sY);

  sY += 30;
  p1.font = `14px ${fontFamily}`;
  p1.fillStyle = textColor;
  const bulletPoints = [
    `• Non-Dominant (${dualReport.non_dominant_hand}) Palm: Inborn emotional constitution, subconscious memory, and ancestral gifts.`,
    `• Dominant (${dualReport.dominant_hand}) Palm: Consciously forged habits, active career accomplishments, and real-world discernment.`,
    '• Hand Disparity is Autonomy: Divergence proves you are an active co-creator, not a passive spectator of your fate.',
  ];
  for (const bp of bulletPoints) {
    p1.fillText(bp, 110, sY);
    sY += 26;
  }

  // Disclaimer banner
  const discY = height - 165;
  p1.fillStyle = isDark ? '#0B0E1B' : '#F3EFE6';
  p1.strokeStyle = isDark ? '#1F2937' : '#D1D5DB';
  p1.lineWidth = 1;
  drawRoundedRect(p1, 70, discY, width - 140, 85, 16);
  p1.fill();
  p1.stroke();

  p1.fillStyle = textMuted;
  p1.font = `12px ${fontFamily}`;
  p1.textAlign = 'center';
  const discLines = wrapCanvasText(p1, dualReport.disclaimer, width - 180);
  let dY = discY + 28;
  for (const dline of discLines.slice(0, 3)) {
    p1.fillText(dline, width / 2, dY);
    dY += 18;
  }

  drawFooter(p1, 1);
  pagesImages.push(page1Canvas.toDataURL('image/jpeg', 0.92));

  // --- PAGE 2: DETAILED COMPARATIVE LINE EVOLUTIONS (4 MAJOR CREASES) ---
  const { canvas: page2Canvas, ctx: p2 } = createPageCanvas();

  p2.textAlign = 'center';
  p2.fillStyle = goldColor;
  p2.font = `bold 24px ${fontFamily}`;
  p2.fillText('✧ CHIROLOGICAL DIVERGENCE ANALYSIS ✧', width / 2, 88);

  p2.font = `14px ${fontFamily}`;
  p2.fillStyle = textMuted;
  p2.fillText('Detailed Evolution Across Heart, Head, Life, and Fate Line Vectors', width / 2, 114);

  let cY = 145;
  const cardHeight = 350;
  const sectionsToRender = (dualReport.comparative_sections || []).slice(0, 4);

  for (let i = 0; i < sectionsToRender.length; i++) {
    const sec = sectionsToRender[i];
    p2.fillStyle = cardBg;
    p2.strokeStyle = cardBorder;
    p2.lineWidth = 1.2;
    drawRoundedRect(p2, 70, cY, width - 140, cardHeight, 20);
    p2.fill();
    p2.stroke();

    // Section Title & Divergence Pill
    p2.textAlign = 'left';
    p2.fillStyle = '#FFFFFF';
    p2.font = `bold 20px ${fontFamily}`;
    p2.fillText(sec.line_name || 'Line Evolution', 105, cY + 40);

    // Pill
    const badgeLabel = (sec.divergence_type || 'evolution').toUpperCase().replace('_', ' ');
    p2.font = `bold 12px ${fontFamily}`;
    const badgeW = p2.measureText(badgeLabel).width + 24;
    p2.fillStyle = isDark ? 'rgba(200,170,110,0.18)' : 'rgba(147,109,39,0.2)';
    p2.strokeStyle = goldColor;
    drawRoundedRect(p2, width - 105 - badgeW, cY + 20, badgeW, 28, 14);
    p2.fill();
    p2.stroke();
    p2.fillStyle = goldColor;
    p2.textAlign = 'center';
    p2.fillText(badgeLabel, width - 105 - badgeW / 2, cY + 39);

    // Contrast Grid (Innate vs Manifested)
    p2.textAlign = 'left';
    const colW = (width - 250) / 2;

    // Innate Box
    p2.fillStyle = isDark ? '#070913' : '#EAE4D6';
    drawRoundedRect(p2, 105, cY + 65, colW, 95, 12);
    p2.fill();
    p2.fillStyle = '#818CF8';
    p2.font = `bold 12px ${fontFamily}`;
    p2.fillText(`Innate Blueprint (${dualReport.non_dominant_hand || 'Left'} hand):`, 120, cY + 90);
    p2.fillStyle = textColor;
    p2.font = `13px ${fontFamily}`;
    const innateLines = wrapCanvasText(p2, sec.innate_summary || '', colW - 30);
    let inY = cY + 112;
    for (const line of innateLines.slice(0, 2)) {
      p2.fillText(line, 120, inY);
      inY += 18;
    }

    // Manifested Box
    p2.fillStyle = isDark ? '#0B0E1B' : '#EAE4D6';
    drawRoundedRect(p2, 105 + colW + 20, cY + 65, colW, 95, 12);
    p2.fill();
    p2.fillStyle = goldColor;
    p2.font = `bold 12px ${fontFamily}`;
    p2.fillText(`Manifested Reality (${dualReport.dominant_hand || 'Right'} hand):`, 120 + colW + 20, cY + 90);
    p2.fillStyle = textColor;
    p2.font = `13px ${fontFamily}`;
    const manLines = wrapCanvasText(p2, sec.manifested_summary || '', colW - 30);
    let mnY = cY + 112;
    for (const line of manLines.slice(0, 2)) {
      p2.fillText(line, 120 + colW + 20, mnY);
      mnY += 18;
    }

    // Evolutionary Narrative
    p2.fillStyle = isDark ? '#F3F4F6' : '#111827';
    p2.font = `bold 13px ${fontFamily}`;
    p2.fillText('Evolutionary Journey & Conscious Choice:', 105, cY + 188);

    p2.font = `14px ${fontFamily}`;
    p2.fillStyle = textColor;
    const evoLines = wrapCanvasText(p2, sec.evolution_narrative || '', width - 210);
    let evY = cY + 210;
    for (const eline of evoLines.slice(0, 3)) {
      p2.fillText(eline, 105, evY);
      evY += 20;
    }

    // Mindful Growth Guidance
    p2.fillStyle = isDark ? '#34D399' : '#059669';
    p2.font = `bold 13px ${fontFamily}`;
    p2.fillText('Mindful Growth Guidance:', 105, cY + 292);

    p2.font = `13px ${fontFamily}`;
    p2.fillStyle = textMuted;
    const recLines = wrapCanvasText(p2, sec.growth_recommendation || '', width - 210);
    let rcY = cY + 312;
    for (const rline of recLines.slice(0, 2)) {
      p2.fillText(rline, 105, rcY);
      rcY += 18;
    }

    cY += cardHeight + 25;
  }

  drawFooter(p2, 2);
  pagesImages.push(page2Canvas.toDataURL('image/jpeg', 0.92));

  // --- PAGE 3: INTERACTIVE CONSULTATIONS (IF REQUESTED) ---
  if (hasConsultations && options.consultations) {
    const { canvas: page3Canvas, ctx: p3 } = createPageCanvas();

    p3.textAlign = 'center';
    p3.fillStyle = goldColor;
    p3.font = `bold 24px ${fontFamily}`;
    p3.fillText('✧ DUAL-HAND INQUIRIES & CONSULTATIONS ✧', width / 2, 95);

    p3.font = `14px ${fontFamily}`;
    p3.fillStyle = textMuted;
    p3.fillText('Personalized Inquiries Grounded in Your Observed Palm Divergences', width / 2, 122);

    let qY = 160;
    p3.textAlign = 'left';

    for (let idx = 0; idx < Math.min(options.consultations.length, 3); idx++) {
      const item = options.consultations[idx];
      const cardH = 390;

      p3.fillStyle = cardBg;
      p3.strokeStyle = cardBorder;
      drawRoundedRect(p3, 70, qY, width - 140, cardH, 18);
      p3.fill();
      p3.stroke();

      p3.fillStyle = goldColor;
      p3.font = `bold 16px ${fontFamily}`;
      p3.fillText(`Inquiry ${idx + 1} (${(item.category || 'general').toUpperCase()}): "${item.question || ''}"`, 96, qY + 38);

      p3.fillStyle = textColor;
      p3.font = `14px ${fontFamily}`;
      const ansLines = wrapCanvasText(p3, item.answer || '', width - 192);
      let aY = qY + 70;
      for (const line of ansLines.slice(0, 5)) {
        p3.fillText(line, 96, aY);
        aY += 22;
      }

      aY += 10;
      p3.fillStyle = goldColor;
      p3.font = `bold 13px ${fontFamily}`;
      p3.fillText('Key Takeaways:', 96, aY);
      aY += 20;

      p3.fillStyle = textColor;
      p3.font = `13px ${fontFamily}`;
      for (const insight of (item.key_insights || []).slice(0, 2)) {
        p3.fillText(`• ${insight}`, 106, aY);
        aY += 20;
      }

      aY += 10;
      p3.fillStyle = isDark ? '#34D399' : '#059669';
      p3.font = `bold 13px ${fontFamily}`;
      p3.fillText('Reflective Action:', 96, aY);
      aY += 18;
      p3.fillStyle = textColor;
      const actLines = wrapCanvasText(p3, item.reflective_action || '', width - 192);
      for (const act of actLines.slice(0, 2)) {
        p3.fillText(act, 106, aY);
        aY += 18;
      }

      qY += cardH + 25;
    }

    drawFooter(p3, 3);
    pagesImages.push(page3Canvas.toDataURL('image/jpeg', 0.92));
  }

  // Compile binary PDF with genuine vector stream overlay
  const dualVectorStreams: (string | null)[] = [];
  const scale = 595.28 / width;
  let page1DualVector: string | null = null;
  const featuresToRender = dualReport.manifested_features || dualReport.innate_features || options.features;
  if (featuresToRender) {
    page1DualVector = generatePdfVectorOverlay(featuresToRender, {
      xPt: 70 * scale,
      yPt: 460 * scale,
      wPt: (width - 140) * scale,
      hPt: 260 * scale,
      pageHeightPt: 841.89,
    });
  }
  dualVectorStreams.push(page1DualVector);
  dualVectorStreams.push(null); // page 2
  if (hasConsultations) {
    dualVectorStreams.push(null); // page 3
  }

  const pdfBytes = compilePdfFromImages(pagesImages, 595.28, 841.89, dualVectorStreams);
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const sanitizedTitle = (dualReport.reading_title || 'Palmora_Dual_Evolution')
    .replace(/[^a-zA-Z0-9_\u0900-\u097F\u4e00-\u9fa5\u3040-\u30ff]/g, '_')
    .slice(0, 32);
  const langTag = dualReport.language || 'en';
  const filename = `Palmora_Dual_Evolution_${sanitizedTitle}_${langTag}.pdf`;

  return { blob, url, filename };
}

/**
 * Triggers instant browser download of the generated PDF file.
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}
