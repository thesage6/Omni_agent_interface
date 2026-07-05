// PCM capture/encode helpers for the voice features. Extracted from App.tsx;
// pure data transforms, no Web Audio graph state.

// Encode captured PCM (Float32) as a 16-bit mono WAV — the format the server's
// /api/voice/stt (faster-whisper) accepts. We capture raw PCM via the Web Audio
// API rather than MediaRecorder because MediaRecorder emits webm/opus (Chrome)
// or mp4/aac (iOS Safari), neither of which the upstream takes; PCM→WAV is the
// one path that works the same on every browser, iOS included.
export function floatToWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, v * 32767, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "application/octet-stream" });
}

// Resample a Float32 PCM window (captured at the AudioContext's native rate) to
// the 16 kHz mono signed-16-bit PCM the realtime-STT bridge expects, returning a
// fresh ArrayBuffer ready to ship as a binary WS frame. We request a 16 kHz
// context up front (so this is usually a straight float→int16 cast), but some
// browsers — iOS Safari especially — ignore the requested rate and hand back
// 44.1/48 kHz, so we linear-interpolate down when the rates differ. int16 frames
// are little-endian on every browser we target, which is what the upstream wants.
export function pcm16kFrom(samples: Float32Array, inRate: number): ArrayBuffer {
  const clamp = (s: number) => {
    const v = Math.max(-1, Math.min(1, s));
    return v < 0 ? v * 32768 : v * 32767;
  };
  if (inRate === 16000) {
    const out = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) out[i] = clamp(samples[i]);
    return out.buffer;
  }
  const ratio = inRate / 16000;
  const outLen = Math.max(0, Math.floor(samples.length / ratio));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = idx - i0;
    out[i] = clamp(samples[i0] * (1 - frac) + samples[i1] * frac);
  }
  return out.buffer;
}

// Join the finalized + in-flight halves of a streaming transcript into the one
// string the input should show. Both halves are trimmed and empties dropped so a
// trailing space or a not-yet-started partial never leaks into the field.
export function joinTranscript(committed: string, partial: string): string {
  return [committed, partial]
    .map((t) => t.trim())
    .filter(Boolean)
    .join(" ");
}
