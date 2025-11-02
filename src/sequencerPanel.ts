import type { Session, Lane } from "../automation";
import { renderSession, type ParamMap } from "../sequencer";
import { saveAsWav } from "./wav"; // small helper below
import { defaultParamsFromUI } from "../uiBridge"; // adapt to your existing form→Params bridge

export class SequencerPanel {
  private root: HTMLElement;
  private sess: Session;

  constructor(parent: HTMLElement, initial: Session) {
    this.root = document.createElement("div");
    this.root.className = "panel";
    parent.appendChild(this.root);
    this.sess = initial;
    this.render();
  }

  private render(){
    this.root.innerHTML = `
      <h3>Sequencer</h3>
      <label>BPM <input id="sq-bpm" type="number" value="${this.sess.bpm}" min="20" max="300"></label>
      <label>Length (s) <input id="sq-len" type="number" value="${this.sess.lengthSec}" step="0.1"></label>
      <button id="sq-play">Play</button>
      <button id="sq-render">Render WAV</button>
      <textarea id="sq-json" rows="10" style="width:100%">${JSON.stringify(this.sess, null, 2)}</textarea>
    `;
    this.root.querySelector("#sq-bpm")!.addEventListener("input", e=>{
      this.sess.bpm = Number((e.target as HTMLInputElement).value);
    });
    this.root.querySelector("#sq-len")!.addEventListener("input", e=>{
      this.sess.lengthSec = Number((e.target as HTMLInputElement).value);
    });
    this.root.querySelector("#sq-json")!.addEventListener("input", e=>{
      try { this.sess = JSON.parse((e.target as HTMLTextAreaElement).value); } catch {}
    });

    const map: ParamMap = (t, sess) => {
      const base = defaultParamsFromUI(); // pull current UI as baseline
      const lane = (k:string, def:number, min:number, max:number) => {
        const L = sess.lanes[k] as Lane|undefined;
        if (!L) return def;
        const v = (window as any).Automation.evalLane(L, t, sess.bpm);
        return v===undefined?def:v;
      };
      // minimal demo mapping; extend as needed
      base.f0 = lane("f0", base.f0, 40, 800);
      base.F1 = lane("F1", base.F1, 150, 1200);
      base.F2 = lane("F2", base.F2, 300, 3000);
      base.tiltDb = lane("tiltDb", base.tiltDb, -40, 30);
      return base;
    };

    const play = async () => {
      const { pcm } = await renderSession(this.sess, map, { sampleRate: 48000, frameMs: 10 });
      const ctx = new AudioContext({ sampleRate: 48000 });
      const buf = ctx.createBuffer(1, pcm.length, 48000);
      buf.copyToChannel(pcm, 0, 0);
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start();
    };

    const renderWav = async () => {
      const { pcm } = await renderSession(this.sess, map, { sampleRate: 48000, frameMs: 10 });
      const wav = saveAsWav(pcm, 48000, 16);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([wav], {type:"audio/wav"}));
      a.download = "klatt-seq.wav"; a.click();
    };

    this.root.querySelector("#sq-play")!.addEventListener("click", play);
    this.root.querySelector("#sq-render")!.addEventListener("click", renderWav);
  }
}
