export function saveAsWav(pcm: Float32Array, sampleRate: number, bits=16): ArrayBuffer {
  const numSamples = pcm.length, numCh=1, blockAlign = numCh * (bits/8);
  const dataSize = numSamples * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  let p=0; const w=(s:string)=>{ for (let i=0;i<s.length;i++) v.setUint8(p++, s.charCodeAt(i)); };
  w("RIFF"); v.setUint32(p, 36+dataSize, true); p+=4; w("WAVEfmt "); v.setUint32(p,16,true); p+=4;
  v.setUint16(p,1,true); p+=2; v.setUint16(p,numCh,true); p+=2; v.setUint32(p,sampleRate,true); p+=4;
  v.setUint32(p,sampleRate*blockAlign,true); p+=4; v.setUint16(p,blockAlign,true); p+=2; v.setUint16(p,bits,true); p+=2;
  w("data"); v.setUint32(p,dataSize,true); p+=4;
  if (bits===16){
    for (let i=0;i<numSamples;i++){ const s=Math.max(-1,Math.min(1,pcm[i])); v.setInt16(p, s<0?s*0x8000:s*0x7FFF, true); p+=2; }
  } else { throw new Error("Only 16-bit implemented"); }
  return buf;
}
