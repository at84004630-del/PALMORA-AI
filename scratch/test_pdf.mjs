import fs from 'fs';

const widthPt = 595.28;
const heightPt = 841.89;

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

  markObject(1);
  write('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const pageKids = Array.from({ length: pageCount }, (_, i) => `${3 + i * 3} 0 R`).join(' ');
  markObject(2);
  write(`<< /Type /Pages /Kids [${pageKids}] /Count ${pageCount} >>\nendobj\n`);

  for (let i = 0; i < pageCount; i++) {
    const pageObjNum = 3 + i * 3;
    const contentObjNum = 4 + i * 3;
    const imgObjNum = 5 + i * 3;

    const base64Data = jpegDataUrls[i].split(',')[1];
    const binaryStr = Buffer.from(base64Data, 'base64');
    const jpegBytes = new Uint8Array(binaryStr);

    markObject(pageObjNum);
    write(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt} ${heightPt}] ` +
      `/Resources << /XObject << /Im${i + 1} ${imgObjNum} 0 R >> >> ` +
      `/Contents ${contentObjNum} 0 R >>\nendobj\n`
    );

    const rasterOp = `q\n${widthPt} 0 0 ${heightPt} 0 0 cm\n/Im${i + 1} Do\nQ\n`;
    const vectorOp = (pageVectorStreams && pageVectorStreams[i]) ? pageVectorStreams[i] : '';
    const streamContent = rasterOp + vectorOp;
    const streamLen = new TextEncoder().encode(streamContent).length;

    markObject(contentObjNum);
    write(`<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`);

    markObject(imgObjNum);
    write(
      `<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    );
    writeBytes(jpegBytes);
    write('\nendstream\nendobj\n');
  }

  const startXref = currentOffset;
  const totalObjects = 2 + pageCount * 3;
  write(`xref\n0 ${totalObjects + 1}\n`);
  write('0000000000 65535 f \n');
  for (let o = 1; o <= totalObjects; o++) {
    const offsetStr = String(objectOffsets[o] || 0).padStart(10, '0');
    write(`${offsetStr} 00000 n \n`);
  }

  write(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);

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

  return { result, objectOffsets, startXref };
}

// Minimal valid 1x1 JPEG
const minimalJpeg = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const { result, objectOffsets, startXref } = compilePdfFromImages(['data:image/jpeg;base64,' + minimalJpeg]);

fs.writeFileSync('scratch/test_output.pdf', result);
console.log('PDF written successfully. Size:', result.length);
console.log('startXref reported:', startXref);
const actualXrefText = new TextDecoder().decode(result.slice(startXref, startXref + 4));
console.log('Bytes at startXref:', actualXrefText);
for (let o = 1; o < objectOffsets.length; o++) {
  const off = objectOffsets[o];
  const objHeader = new TextDecoder().decode(result.slice(off, off + 10));
  console.log(`Object ${o} at offset ${off}: '${objHeader.trim()}'`);
}
