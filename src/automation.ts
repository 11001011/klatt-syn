// Lightweight automation graph: keyframes + LFOs + steps + smoothing.
export type Curve = "linear" | "exp" | "step" | "spline";
export type LFOShape = "sine" | "tri" | "square" | "snh";
export interface Keyframe { t: number; v: number; curve?: Curve; }
export interface LFO { shape: LFOShape; rateHz: number; depth: number; phase?: number; bipolar?: boolean; }
export interface Steps { n: number; vals: number[]; glide?: number; prob?: number; humanizeMs?: number; }
export interface Lane {
  min: number; max: number;
  keyframes?: Keyframe[];
  lfos?: LFO[];
  steps?: Steps;
  scale?: number; offset?: number;
  smoothMs?: number;
  quant?: number; // e.g., 1 Hz or 0.5 dB
  enabled?: boolean;
}
export interface Session { bpm: number; swing: number; lengthSec: number; lanes: Record<string,Lane>; }

const TAU = Math.PI * 2;
const clamp = (x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const lerp = (a:number,b:number,t:number)=>a+(b-a)*t;

function interp(keys: Keyframe[]|undefined, t: number): number|undefined {
  if (!keys || !keys.length) return undefined;
  if (t <= keys[0].t) return keys[0].v;
  for (let i=0;i<keys.length-1;i++){
    const a = keys[i], b = keys[i+1];
    if (t <= b.t){
      const u = (t - a.t) / Math.max(1e-9, b.t - a.t);
      switch (a.curve ?? "linear"){
        case "linear": return lerp(a.v,b.v,u);
        case "exp":    return a.v===0?0: a.v*Math.pow(b.v/a.v, u);
        case "step":   return a.v;
        case "spline": // Catmull-Rom minimal: fall back to linear for brevity
        default:       return lerp(a.v,b.v,u);
      }
    }
  }
  return keys[keys.length-1].v;
}

function evalLFO(l: LFO, t: number): number {
  const ph = (l.phase ?? 0) + t * l.rateHz;
  let y = 0;
  switch (l.shape){
    case "sine": y = Math.sin(TAU*ph); break;
    case "tri":  y = 2*Math.abs(2*(ph-Math.floor(ph+0.5))) - 1; break;
    case "square": y = (ph%1)<0.5 ? 1 : -1; break;
    case "snh":  y = (Math.floor(ph)%2)?-1:1; break;
  }
  if (!l.bipolar) y = (y+1)/2; // [0,1]
  return y * l.depth;
}

function evalSteps(s: Steps, t: number, bpm: number, swing: number): number {
  const beat = t * (bpm/60);
  const stepF = beat * s.n;
  let i = Math.floor(stepF) % s.n;
  // simple swing: delay odd steps
  const frac = stepF - Math.floor(stepF);
  const isOdd = (i % 2) === 1;
  const swingFrac = isOdd ? Math.min(1, frac + swing*0.5) : frac;
  const v0 = s.vals[i % s.n];
  const v1 = s.vals[(i+1) % s.n];
  const g = clamp(s.glide ?? 0, 0, 1);
  return lerp(v0, v1, g * swingFrac);
}

export function evalLane(l: Lane, t: number, bpm: number): number|undefined {
  if (l.enabled === false) return undefined;
  let x = 0;
  const k = interp(l.keyframes, t);
  if (k !== undefined) x += k;
  if (l.lfos) for (const f of l.lfos) x += evalLFO(f, t);
  if (l.steps) x += evalSteps(l.steps, t, bpm, 0);
  x = x * (l.scale ?? 1) + (l.offset ?? 0);
  x = clamp(x, l.min, l.max);
  if (l.quant) x = Math.round(x / l.quant) * l.quant;
  // one-pole smoothing
  if (l.smoothMs && l.smoothMs > 0) {
    const a = Math.exp(-1 / (l.smoothMs * 0.001 * 48000)); // assumes render @48k
    // caller should track previous value per-lane; we expose helper:
  }
  return x;
}
