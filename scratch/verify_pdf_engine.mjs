import fs from 'fs';

// Exact implementation from apps/web/lib/pdfGenerator.ts
function generatePdfVectorOverlay(features, frame) {
  if (!features) return '';

  const { xPt, yPt, wPt, hPt, pageHeightPt } = frame;
  if (!Number.isFinite(xPt) || !Number.isFinite(yPt) || !Number.isFinite(wPt) || !Number.isFinite(hPt) || !Number.isFinite(pageHeightPt)) {
    return '';
  }

  const toPdfX = (normX) => {
    const n = Number.isFinite(normX) ? normX : 0.5;
    return (xPt + n * wPt).toFixed(2);
  };
  const toPdfY = (normY) => {
    const n = Number.isFinite(normY) ? normY : 0.5;
    return (pageHeightPt - (yPt + n * hPt)).toFixed(2);
  };

  let stream = 'q\n';
  stream += '1 j 1 J\n';

  const cx = xPt + wPt / 2;
  const cy = pageHeightPt - (yPt + hPt * 0.52);
  const rx = wPt * 0.38;
  const ry = hPt * 0.40;
  const k = 0.5522847498;
  const ox = rx * k;
  const oy = ry * k;

  stream += '0.784 0.667 0.431 RG\n';
  stream += '0.8 w\n';
  stream += '[4 4] 0 d\n';
  stream += `${(cx - rx).toFixed(2)} ${cy.toFixed(2)} m\n`;
  stream += `${(cx - rx).toFixed(2)} ${(cy + oy).toFixed(2)} ${(cx - ox).toFixed(2)} ${(cy + ry).toFixed(2)} ${cx.toFixed(2)} ${(cy + ry).toFixed(2)} c\n`;
  stream += `${(cx + ox).toFixed(2)} ${(cy + ry).toFixed(2)} ${(cx + rx).toFixed(2)} ${(cy + oy).toFixed(2)} ${(cx + rx).toFixed(2)} ${cy.toFixed(2)} c\n`;
  stream += `${(cx + rx).toFixed(2)} ${(cy - oy).toFixed(2)} ${(cx + ox).toFixed(2)} ${(cy - ry).toFixed(2)} ${cx.toFixed(2)} ${(cy - ry).toFixed(2)} c\n`;
  stream += `${(cx - ox).toFixed(2)} ${(cy - ry).toFixed(2)} ${(cx - rx).toFixed(2)} ${(cy - oy).toFixed(2)} ${(cx - rx).toFixed(2)} ${cy.toFixed(2)} c\n`;
  stream += 'S\n';
  stream += '[] 0 d\n';

  const emitPolyline = (path, r, g, b, width) => {
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

  if (features.heart_line?.status === 'detected' && features.heart_line.path) {
    stream += emitPolyline(features.heart_line.path, 0.957, 0.247, 0.369, 1.8);
  }
  if (features.head_line?.status === 'detected' && features.head_line.path) {
    stream += emitPolyline(features.head_line.path, 0.220, 0.741, 0.973, 1.8);
  }
  if (features.life_line?.status === 'detected' && features.life_line.path) {
    stream += emitPolyline(features.life_line.path, 0.204, 0.827, 0.600, 2.0);
  }
  if (features.fate_line?.status === 'detected' && features.fate_line.path) {
    stream += emitPolyline(features.fate_line.path, 0.753, 0.518, 0.988, 1.6);
  }

  stream += 'Q\n';
  return stream;
}

function getJpegDimensions(bytes) {
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

function compilePdfFromImages(jpegDataUrls, widthPt = 595.28, heightPt = 841.89, pageVectorStreams = []) {
  const binaryChunks = [];
  const objectOffsets = [];
  let currentOffset = 0;

  function write(str) {
    binaryChunks.push(str);
    currentOffset += new TextEncoder().encode(str).length;
  }

  function writeBytes(bytes) {
    binaryChunks.push(bytes);
    currentOffset += bytes.length;
  }

  function markObject(objNum) {
    objectOffsets[objNum] = currentOffset;
    write(`${objNum} 0 obj\n`);
  }

  write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const pageCount = jpegDataUrls.length;
  const infoObjNum = 2 + pageCount * 3 + 1;
  const totalObjects = infoObjNum;

  markObject(1);
  write('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const pageKids = Array.from({ length: pageCount }, (_, i) => `${3 + i * 3} 0 R`).join(' ');
  markObject(2);
  write(`<< /Type /Pages /Kids [${pageKids}] /Count ${pageCount} >>\nendobj\n`);

  for (let i = 0; i < pageCount; i++) {
    const pageObjNum = 3 + i * 3;
    const contentObjNum = 4 + i * 3;
    const imgObjNum = 5 + i * 3;

    const rawDataUrl = jpegDataUrls[i] || '';
    const base64Data = rawDataUrl.includes(',') ? rawDataUrl.split(',')[1] : rawDataUrl;
    const binaryBuffer = Buffer.from(base64Data, 'base64');
    const jpegBytes = new Uint8Array(binaryBuffer);
    const { w: imgWidth, h: imgHeight } = getJpegDimensions(jpegBytes);

    markObject(pageObjNum);
    write(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] ` +
      `/Resources << /ProcSet [/PDF /Text /ImageB /ImageC /ImageI] /XObject << /Im${i + 1} ${imgObjNum} 0 R >> >> ` +
      `/Contents ${contentObjNum} 0 R >>\nendobj\n`
    );

    const rasterOp = `q\n${widthPt} 0 0 ${heightPt} 0 0 cm\n/Im${i + 1} Do\nQ\n`;
    const vectorOp = (pageVectorStreams && pageVectorStreams[i]) ? pageVectorStreams[i] : '';
    const streamContent = rasterOp + vectorOp;
    const streamBytes = new TextEncoder().encode(streamContent);

    markObject(contentObjNum);
    write(`<< /Length ${streamBytes.length} >>\nstream\n`);
    writeBytes(streamBytes);
    write('\nendstream\nendobj\n');

    markObject(imgObjNum);
    write(
      `<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    );
    writeBytes(jpegBytes);
    write('\nendstream\nendobj\n');
  }

  markObject(infoObjNum);
  const now = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  write(
    '<< /Title (Palmora AI Cultural Chiromancy Reading Folio) ' +
    '/Creator (Palmora Pure PDF Engine 1.4) ' +
    '/Producer (Palmora AI Pure PDF Engine) ' +
    `/CreationDate (D:${now}Z) >>\nendobj\n`
  );

  const startXref = currentOffset;
  write(`xref\n0 ${totalObjects + 1}\n`);
  write('0000000000 65535 f \r\n');
  for (let o = 1; o <= totalObjects; o++) {
    const offsetStr = String(objectOffsets[o] || 0).padStart(10, '0');
    write(`${offsetStr} 00000 n \r\n`);
  }

  write(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R /Info ${infoObjNum} 0 R ` +
    `/ID [<4e6f746570616c6d6f7261303031> <4e6f746570616c6d6f7261303031>] >>\n` +
    `startxref\n${startXref}\n%%EOF\r\n`
  );

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

const validJpegB64 = fs.readFileSync('scratch/valid_jpeg_b64.txt', 'utf8').trim();

const mockFeatures = {
  heart_line: { status: 'detected', path: [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.35 }] },
  head_line: { status: 'detected', path: [{ x: 0.3, y: 0.5 }, { x: 0.7, y: 0.55 }] },
  life_line: { status: 'detected', path: [{ x: 0.3, y: 0.5 }, { x: 0.5, y: 0.8 }] },
};

const vStream1 = generatePdfVectorOverlay(mockFeatures, {
  xPt: 30, yPt: 200, wPt: 500, hPt: 300, pageHeightPt: 841.89
});

const pages = [
  'data:image/jpeg;base64,' + validJpegB64,
  'data:image/jpeg;base64,' + validJpegB64,
  'data:image/jpeg;base64,' + validJpegB64,
];

const pdfBytes = compilePdfFromImages(pages, 595.28, 841.89, [vStream1, null, null]);
fs.writeFileSync('scratch/engine_test.pdf', pdfBytes);
console.log('Successfully wrote scratch/engine_test.pdf (' + pdfBytes.length + ' bytes)');
