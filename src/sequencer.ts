import type { Session, evalLane } from "./automation";
import { Synth, type Params } from "klatt-syn"; // engine API
// NOTE: The engine’s “new dB” conventions apply: positive = amplify, 0 = unity, -99 = mute. 2

export interface BuildOpts { sampleRate: number; frameMs: number; }
export interface BuildOut { pcm: Float32Array; }

export type ParamMap = (t: number, sess: Session) => Params;

export async function renderSession(sess: Session, map: ParamMap, opts: BuildOpts): Promise<BuildOut> {
  const sr = opts.sampleRate, dt = opts.frameMs/1000;
  const frames: Params[] = [];
  for (let t=0; t<sess.lengthSec; t+=dt) {
    frames.push(map(t, sess));
  }
  const synth = new Synth(sr);
  // Concatenate frames
  const chunks: Float32Array[] = [];
  for (const p of frames) {
    const n = Math.max(1, Math.round(dt*sr));
    chunks.push(synth.synthesizeFrame(p, n));
  }
  const total = chunks.reduce((a,c)=>a+c.length,0);
  const pcm = new Float32Array(total);
  let o=0; for (const c of chunks){ pcm.set(c,o); o+=c.length; }
  return { pcm };
}
