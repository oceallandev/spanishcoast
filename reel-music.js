/**
 * reel-music.js — Premium music engine for Spanish Coast Properties reels.
 *
 * Uses OfflineAudioContext to pre-render high-quality audio buffers with:
 *   • FM synthesis for rich, warm timbres
 *   • Algorithmic reverb via filtered noise convolution
 *   • Multi-layered composition (sub, pad, lead, arp, percussion)
 *   • Professional chord voicings (7ths, 9ths, sus chords)
 *   • Stereo widening and mastered output
 *
 * Exposes:  window.__reelMusicEngine = { render(mode, durationSec) => Promise<AudioBuffer> }
 */
(function () {
    'use strict';

    /* ─── constants ─── */
    const SR = 44100;
    const semi = (n) => Math.pow(2, n / 12);

    /* ─── note helpers ─── */
    const NOTE = {
        C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61,
        G3: 196.00, Ab3: 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
        C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23,
        G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
        C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00
    };

    /* chord templates (semitones from root) */
    const CHORD = {
        maj: [0, 4, 7],
        min: [0, 3, 7],
        maj7: [0, 4, 7, 11],
        min7: [0, 3, 7, 10],
        dom7: [0, 4, 7, 10],
        min9: [0, 3, 7, 10, 14],
        maj9: [0, 4, 7, 11, 14],
        sus4: [0, 5, 7],
        sus2: [0, 2, 7],
        add9: [0, 4, 7, 14],
        dim: [0, 3, 6],
        aug: [0, 4, 8],
        six9: [0, 4, 7, 9, 14]
    };

    const chordFreqs = (root, type) => {
        const tpl = CHORD[type] || CHORD.maj;
        return tpl.map((s) => root * semi(s));
    };

    /* ─── DSP utilities (work on Float32Array buffers directly) ─── */

    /** Generate sine wave into buffer */
    const writeSine = (buf, freq, start, dur, amp, sr) => {
        const s0 = Math.floor(start * sr);
        const s1 = Math.min(buf.length, Math.floor((start + dur) * sr));
        const atk = Math.min(dur * 0.08, 0.04);
        const rel = Math.min(dur * 0.25, 0.15);
        for (let i = s0; i < s1; i++) {
            const t = (i - s0) / sr;
            const env = envADSR(t, dur, atk, 0, 1, rel);
            buf[i] += Math.sin(2 * Math.PI * freq * t) * amp * env;
        }
    };

    /** FM oscillator — carrier + modulator for lush timbres */
    const writeFM = (buf, freq, start, dur, amp, modRatio, modDepth, sr) => {
        const s0 = Math.floor(start * sr);
        const s1 = Math.min(buf.length, Math.floor((start + dur) * sr));
        const atk = Math.min(dur * 0.12, 0.06);
        const rel = Math.min(dur * 0.35, 0.3);
        const modFreq = freq * modRatio;
        for (let i = s0; i < s1; i++) {
            const t = (i - s0) / sr;
            const env = envADSR(t, dur, atk, dur * 0.2, 0.7, rel);
            const mod = Math.sin(2 * Math.PI * modFreq * t) * modDepth * freq;
            buf[i] += Math.sin(2 * Math.PI * (freq + mod) * t) * amp * env;
        }
    };

    /** Warm pad — detuned saws via additive synthesis */
    const writePad = (buf, freq, start, dur, amp, sr) => {
        const s0 = Math.floor(start * sr);
        const s1 = Math.min(buf.length, Math.floor((start + dur) * sr));
        const atk = Math.min(dur * 0.3, 0.5);
        const rel = Math.min(dur * 0.4, 0.8);
        const detune = [0.997, 1.0, 1.003]; // slight detuning for warmth
        const harmonics = 6;
        for (let i = s0; i < s1; i++) {
            const t = (i - s0) / sr;
            const env = envADSR(t, dur, atk, dur * 0.1, 0.8, rel);
            let val = 0;
            for (const d of detune) {
                const f = freq * d;
                for (let h = 1; h <= harmonics; h++) {
                    val += Math.sin(2 * Math.PI * f * h * t) * (1 / (h * h)) * (h % 2 === 1 ? 1 : 0.5);
                }
            }
            buf[i] += val * amp * env / (detune.length * 2);
        }
    };

    /** Pluck — short bright attack with quick decay */
    const writePluck = (buf, freq, start, dur, amp, sr) => {
        const s0 = Math.floor(start * sr);
        const s1 = Math.min(buf.length, Math.floor((start + dur) * sr));
        for (let i = s0; i < s1; i++) {
            const t = (i - s0) / sr;
            const env = Math.exp(-t * 8) * (1 - Math.exp(-t * 200));
            const brightness = Math.exp(-t * 3);
            let val = Math.sin(2 * Math.PI * freq * t);
            val += Math.sin(2 * Math.PI * freq * 2 * t) * 0.5 * brightness;
            val += Math.sin(2 * Math.PI * freq * 3 * t) * 0.25 * brightness;
            val += Math.sin(2 * Math.PI * freq * 4 * t) * 0.12 * brightness;
            buf[i] += val * amp * env;
        }
    };

    /** Sub bass — deep sine with slight saturation */
    const writeSub = (buf, freq, start, dur, amp, sr) => {
        const s0 = Math.floor(start * sr);
        const s1 = Math.min(buf.length, Math.floor((start + dur) * sr));
        const atk = 0.02;
        const rel = Math.min(dur * 0.3, 0.15);
        for (let i = s0; i < s1; i++) {
            const t = (i - s0) / sr;
            const env = envADSR(t, dur, atk, 0, 1, rel);
            let val = Math.sin(2 * Math.PI * freq * t);
            val = Math.tanh(val * 1.4); // gentle saturation
            buf[i] += val * amp * env;
        }
    };

    /** Kick drum */
    const writeKick = (buf, start, amp, sr) => {
        const s0 = Math.floor(start * sr);
        const dur = 0.3;
        const s1 = Math.min(buf.length, Math.floor((start + dur) * sr));
        for (let i = s0; i < s1; i++) {
            const t = (i - s0) / sr;
            const pitchEnv = 160 * Math.exp(-t * 40) + 45;
            const ampEnv = Math.exp(-t * 12);
            const click = Math.exp(-t * 200) * 0.4;
            buf[i] += (Math.sin(2 * Math.PI * pitchEnv * t) * ampEnv + click) * amp;
        }
    };

    /** Snare / clap */
    const writeSnare = (buf, start, amp, sr, rng) => {
        const s0 = Math.floor(start * sr);
        const dur = 0.18;
        const s1 = Math.min(buf.length, Math.floor((start + dur) * sr));
        for (let i = s0; i < s1; i++) {
            const t = (i - s0) / sr;
            const body = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 30) * 0.5;
            const noise = (rng() * 2 - 1) * Math.exp(-t * 18);
            buf[i] += (body + noise) * amp;
        }
    };

    /** Hi-hat */
    const writeHat = (buf, start, amp, open, sr, rng) => {
        const s0 = Math.floor(start * sr);
        const dur = open ? 0.2 : 0.06;
        const s1 = Math.min(buf.length, Math.floor((start + dur) * sr));
        const decay = open ? 8 : 35;
        for (let i = s0; i < s1; i++) {
            const t = (i - s0) / sr;
            // metallic noise — combine several high-frequency tones
            let val = 0;
            const freqs = [3013, 4027, 5519, 6913, 8121];
            for (const f of freqs) val += Math.sin(2 * Math.PI * f * t) * 0.2;
            val += (rng() * 2 - 1) * 0.6;
            buf[i] += val * Math.exp(-t * decay) * amp;
        }
    };

    /** Shaker */
    const writeShaker = (buf, start, amp, sr, rng) => {
        const s0 = Math.floor(start * sr);
        const dur = 0.07;
        const s1 = Math.min(buf.length, Math.floor((start + dur) * sr));
        for (let i = s0; i < s1; i++) {
            const t = (i - s0) / sr;
            buf[i] += (rng() * 2 - 1) * Math.exp(-t * 45) * amp * 0.4;
        }
    };

    /** ADSR envelope */
    const envADSR = (t, dur, atk, decay, sustain, rel) => {
        if (t < 0) return 0;
        if (t < atk) return t / atk;
        const decEnd = atk + decay;
        if (t < decEnd) return 1 - (1 - sustain) * ((t - atk) / decay);
        const relStart = dur - rel;
        if (t >= relStart) {
            const r = (t - relStart) / rel;
            return sustain * Math.max(0, 1 - r);
        }
        return sustain;
    };

    /** Seeded PRNG for deterministic percussion */
    const seedRng = (seed) => {
        let s = seed | 0 || 42;
        return () => {
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            return s / 0x7fffffff;
        };
    };

    /** Simple low-pass filter (one-pole) applied in-place */
    const lpFilter = (buf, cutoffHz, sr) => {
        const rc = 1.0 / (2 * Math.PI * cutoffHz);
        const dt = 1.0 / sr;
        const alpha = dt / (rc + dt);
        let prev = 0;
        for (let i = 0; i < buf.length; i++) {
            prev += alpha * (buf[i] - prev);
            buf[i] = prev;
        }
    };

    /** Simple high-pass filter (one-pole) applied in-place */
    const hpFilter = (buf, cutoffHz, sr) => {
        const rc = 1.0 / (2 * Math.PI * cutoffHz);
        const dt = 1.0 / sr;
        const alpha = rc / (rc + dt);
        let prev = buf[0] || 0;
        let prevOut = prev;
        for (let i = 1; i < buf.length; i++) {
            prevOut = alpha * (prevOut + buf[i] - prev);
            prev = buf[i];
            buf[i] = prevOut;
        }
    };

    /** Simple algorithmic reverb (Schroeder-style) */
    const applyReverb = (buf, sr, wetGain, decayTime) => {
        const out = new Float32Array(buf.length);
        const delays = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => Math.round(d * sr / 44100));
        const allpassDelays = [225, 556, 441, 341].map((d) => Math.round(d * sr / 44100));
        // Comb filters
        const combs = delays.map((len) => ({
            buf: new Float32Array(len),
            idx: 0,
            len,
            fb: Math.pow(0.001, len / (decayTime * sr))
        }));
        const combOut = new Float32Array(buf.length);
        for (const comb of combs) {
            for (let i = 0; i < buf.length; i++) {
                const delayed = comb.buf[comb.idx];
                comb.buf[comb.idx] = buf[i] + delayed * comb.fb;
                comb.idx = (comb.idx + 1) % comb.len;
                combOut[i] += delayed;
            }
        }
        // Allpass filters
        let ap = combOut;
        for (const len of allpassDelays) {
            const next = new Float32Array(ap.length);
            const apBuf = new Float32Array(len);
            let idx = 0;
            const g = 0.5;
            for (let i = 0; i < ap.length; i++) {
                const delayed = apBuf[idx];
                const input = ap[i];
                apBuf[idx] = input + delayed * g;
                next[i] = delayed - input * g;
                idx = (idx + 1) % len;
            }
            ap = next;
        }
        // Mix dry + wet
        for (let i = 0; i < buf.length; i++) {
            out[i] = buf[i] * (1 - wetGain) + ap[i] * wetGain * 0.35;
        }
        return out;
    };

    /** Soft-clip limiter */
    const softLimit = (buf, threshold) => {
        for (let i = 0; i < buf.length; i++) {
            const x = buf[i] / threshold;
            buf[i] = Math.tanh(x) * threshold;
        }
    };

    /** Fade in/out */
    const applyFades = (buf, sr, fadeIn, fadeOut) => {
        const inSamples = Math.floor(fadeIn * sr);
        const outSamples = Math.floor(fadeOut * sr);
        for (let i = 0; i < inSamples && i < buf.length; i++) buf[i] *= i / inSamples;
        for (let i = 0; i < outSamples && i < buf.length; i++) {
            const idx = buf.length - 1 - i;
            buf[idx] *= i / outSamples;
        }
    };

    /* ─── MUSIC MODE COMPOSERS ─── */
    /* Each returns a stereo { L, R } pair of Float32Arrays */

    const composeAmbient = (dur, sr) => {
        const L = new Float32Array(Math.ceil(dur * sr));
        const R = new Float32Array(Math.ceil(dur * sr));
        const rng = seedRng(1);
        // Dreamy evolving pads — Cmaj7 → Am9 → Fmaj7 → G → Em7 → Dm9
        const prog = [
            { root: NOTE.C3, type: 'maj7' },
            { root: NOTE.A3 / 2, type: 'min9' },
            { root: NOTE.F3 / 2, type: 'maj7' },
            { root: NOTE.G3 / 2, type: 'add9' },
            { root: NOTE.E3 / 2, type: 'min7' },
            { root: NOTE.D3, type: 'min9' }
        ];
        const chordDur = 3.2;
        let t = 0.1;
        let ci = 0;
        while (t < dur - 0.5) {
            const ch = prog[ci % prog.length];
            const freqs = chordFreqs(ch.root * 2, ch.type);
            // Lush FM pad
            for (const f of freqs) {
                writeFM(L, f, t, chordDur + 0.4, 0.035, 1.5, 0.3, sr);
                writeFM(R, f * 1.002, t + 0.02, chordDur + 0.4, 0.035, 1.5, 0.3, sr);
            }
            // Deep sub
            writeSub(L, ch.root / 2, t, chordDur, 0.08, sr);
            writeSub(R, ch.root / 2, t, chordDur, 0.08, sr);
            // Sparkle arps
            const arpNotes = freqs.concat(freqs.map(f => f * 2)).sort(() => rng() - 0.5).slice(0, 4);
            for (let a = 0; a < arpNotes.length; a++) {
                const at = t + 0.8 + a * 0.55;
                if (at < dur - 0.3) {
                    writePluck(a % 2 === 0 ? L : R, arpNotes[a], at, 0.6, 0.02, sr);
                }
            }
            ci++;
            t += chordDur;
        }
        return { L, R };
    };

    const composeUpbeat = (dur, sr) => {
        const L = new Float32Array(Math.ceil(dur * sr));
        const R = new Float32Array(Math.ceil(dur * sr));
        const rng = seedRng(7);
        const bpm = 118;
        const beat = 60 / bpm;
        const prog = [
            { root: NOTE.C3, type: 'maj' },
            { root: NOTE.G3 / 2, type: 'maj' },
            { root: NOTE.A3 / 2, type: 'min' },
            { root: NOTE.F3 / 2, type: 'maj' }
        ];
        const lead = [NOTE.E5, NOTE.G5, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.D5];
        let t = 0;
        let ci = 0;
        let li = 0;
        while (t < dur - 0.1) {
            const bar = ci % prog.length;
            const ch = prog[bar];
            // Pad
            const freqs = chordFreqs(ch.root * 2, ch.type);
            for (const f of freqs) {
                writeFM(L, f, t, beat * 4.2, 0.02, 2, 0.2, sr);
                writeFM(R, f * 1.003, t, beat * 4.2, 0.02, 2, 0.2, sr);
            }
            // Sub
            writeSub(L, ch.root / 2, t, beat * 2, 0.1, sr);
            writeSub(R, ch.root / 2, t, beat * 2, 0.1, sr);
            writeSub(L, ch.root / 2, t + beat * 2, beat * 2, 0.1, sr);
            writeSub(R, ch.root / 2, t + beat * 2, beat * 2, 0.1, sr);
            // Drums
            for (let s = 0; s < 8; s++) {
                const st = t + s * (beat / 2);
                if (st >= dur) break;
                if (s % 4 === 0) { writeKick(L, st, 0.22, sr); writeKick(R, st, 0.22, sr); }
                if (s % 4 === 2) { writeSnare(L, st, 0.12, sr, rng); writeSnare(R, st, 0.12, sr, rng); }
                writeHat(s % 2 === 0 ? L : R, st, 0.04, s % 4 === 3, sr, rng);
                // Lead melody
                if (s % 2 === 1) {
                    const n = lead[li % lead.length];
                    writePluck(s % 4 === 1 ? L : R, n, st, beat * 0.8, 0.04, sr);
                    li++;
                }
            }
            ci++;
            t += beat * 4;
        }
        return { L, R };
    };

    const composeChill = (dur, sr) => {
        const L = new Float32Array(Math.ceil(dur * sr));
        const R = new Float32Array(Math.ceil(dur * sr));
        const rng = seedRng(3);
        const bpm = 85;
        const beat = 60 / bpm;
        const prog = [
            { root: NOTE.D3, type: 'min7' },
            { root: NOTE.G3 / 2, type: 'dom7' },
            { root: NOTE.C3, type: 'maj7' },
            { root: NOTE.A3 / 2, type: 'min7' }
        ];
        let t = 0;
        let ci = 0;
        while (t < dur - 0.2) {
            const ch = prog[ci % prog.length];
            const freqs = chordFreqs(ch.root * 2, ch.type);
            // Warm pad
            for (const f of freqs) {
                writePad(L, f, t, beat * 4.5, 0.028, sr);
                writePad(R, f * 1.004, t + 0.03, beat * 4.5, 0.028, sr);
            }
            writeSub(L, ch.root / 2, t, beat * 4, 0.07, sr);
            writeSub(R, ch.root / 2, t, beat * 4, 0.07, sr);
            // Lazy drums
            for (let s = 0; s < 8; s++) {
                const st = t + s * (beat / 2);
                if (st >= dur) break;
                if (s === 0 || s === 5) { writeKick(L, st, 0.16, sr); writeKick(R, st, 0.16, sr); }
                if (s === 2 || s === 6) { writeSnare(L, st, 0.06, sr, rng); writeSnare(R, st, 0.06, sr, rng); }
                if (s % 2 === 0) writeShaker(s % 4 === 0 ? L : R, st, 0.05, sr, rng);
            }
            // Rhodes-style keys
            const arp = freqs.slice(0, 3);
            for (let a = 0; a < 3; a++) {
                const at = t + beat * (0.5 + a * 1.1);
                if (at < dur - 0.2) writeFM(a % 2 === 0 ? L : R, arp[a], at, beat * 1.5, 0.03, 3, 0.15, sr);
            }
            ci++;
            t += beat * 4;
        }
        return { L, R };
    };

    const composeCinematic = (dur, sr) => {
        const L = new Float32Array(Math.ceil(dur * sr));
        const R = new Float32Array(Math.ceil(dur * sr));
        const rng = seedRng(5);
        // Epic minor progressions with long evolving textures
        const prog = [
            { root: NOTE.A3 / 2, type: 'min' },
            { root: NOTE.F3 / 2, type: 'maj' },
            { root: NOTE.C3, type: 'maj' },
            { root: NOTE.E3 / 2, type: 'min' }
        ];
        const chordDur = 3.8;
        let t = 0;
        let ci = 0;
        while (t < dur - 0.5) {
            const ch = prog[ci % prog.length];
            const freqs = chordFreqs(ch.root * 2, ch.type);
            // Massive layered pad
            for (const f of freqs) {
                writePad(L, f, t, chordDur + 1, 0.04, sr);
                writePad(R, f * 1.005, t + 0.05, chordDur + 1, 0.04, sr);
                writeFM(L, f * 0.5, t, chordDur, 0.02, 1, 0.5, sr);
                writeFM(R, f * 0.5 * 1.002, t, chordDur, 0.02, 1, 0.5, sr);
            }
            // Deep sub pulse
            writeSub(L, ch.root / 2, t, chordDur * 0.8, 0.09, sr);
            writeSub(R, ch.root / 2, t, chordDur * 0.8, 0.09, sr);
            // Timpani-like hits on transitions
            if (ci > 0 && ci % 2 === 0) {
                writeKick(L, t, 0.2, sr);
                writeKick(R, t, 0.2, sr);
            }
            // High string shimmer
            const shimmer = freqs[freqs.length - 1] * 2;
            writeSine(L, shimmer, t + 1.5, 1.0, 0.008, sr);
            writeSine(R, shimmer * 1.005, t + 1.5, 1.0, 0.008, sr);
            ci++;
            t += chordDur;
        }
        return { L, R };
    };

    const composeTropical = (dur, sr) => {
        const L = new Float32Array(Math.ceil(dur * sr));
        const R = new Float32Array(Math.ceil(dur * sr));
        const rng = seedRng(11);
        const bpm = 105;
        const beat = 60 / bpm;
        const prog = [
            { root: NOTE.C3, type: 'maj' },
            { root: NOTE.A3 / 2, type: 'min' },
            { root: NOTE.F3 / 2, type: 'maj7' },
            { root: NOTE.G3 / 2, type: 'maj' }
        ];
        const marimba = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5];
        let t = 0;
        let ci = 0;
        let mi = 0;
        while (t < dur - 0.1) {
            const ch = prog[ci % prog.length];
            const freqs = chordFreqs(ch.root * 2, ch.type);
            for (const f of freqs) {
                writeFM(L, f, t, beat * 4, 0.018, 2, 0.15, sr);
                writeFM(R, f * 1.002, t, beat * 4, 0.018, 2, 0.15, sr);
            }
            writeSub(L, ch.root / 2, t, beat * 4, 0.08, sr);
            writeSub(R, ch.root / 2, t, beat * 4, 0.08, sr);
            for (let s = 0; s < 8; s++) {
                const st = t + s * (beat / 2);
                if (st >= dur) break;
                if (s % 4 === 0) { writeKick(L, st, 0.18, sr); writeKick(R, st, 0.18, sr); }
                if (s === 2 || s === 6) writeSnare(s % 4 === 2 ? L : R, st, 0.07, sr, rng);
                writeShaker(s % 2 === 0 ? L : R, st, 0.06, sr, rng);
                // Marimba plucks
                if (s % 2 === 1) {
                    const n = marimba[mi % marimba.length];
                    writePluck(mi % 2 === 0 ? L : R, n, st, 0.35, 0.045, sr);
                    mi++;
                }
            }
            ci++;
            t += beat * 4;
        }
        return { L, R };
    };

    const composeHouse = (dur, sr) => {
        const L = new Float32Array(Math.ceil(dur * sr));
        const R = new Float32Array(Math.ceil(dur * sr));
        const rng = seedRng(13);
        const bpm = 124;
        const beat = 60 / bpm;
        const bassline = [NOTE.A3 / 2, NOTE.A3 / 2, NOTE.C3, NOTE.G3 / 2,
        NOTE.A3 / 2, NOTE.C3, NOTE.D3, NOTE.C3];
        const prog = [
            { root: NOTE.A3 / 2, type: 'min7' },
            { root: NOTE.D3, type: 'min7' },
            { root: NOTE.G3 / 2, type: 'dom7' },
            { root: NOTE.C3, type: 'maj7' }
        ];
        let t = 0;
        let bi = 0;
        let ci = 0;
        while (t < dur - 0.1) {
            // Chords every 2 bars
            if (bi % 8 === 0) {
                const ch = prog[ci % prog.length];
                const freqs = chordFreqs(ch.root * 2, ch.type);
                for (const f of freqs) {
                    writeFM(L, f, t, beat * 8.5, 0.015, 2, 0.2, sr);
                    writeFM(R, f * 1.003, t + 0.01, beat * 8.5, 0.015, 2, 0.2, sr);
                }
                ci++;
            }
            // Four-on-the-floor kick
            writeKick(L, t, 0.25, sr);
            writeKick(R, t, 0.25, sr);
            // Off-beat hat
            writeHat(bi % 2 === 0 ? L : R, t + beat * 0.5, 0.05, false, sr, rng);
            // Bass
            const bn = bassline[bi % bassline.length];
            writeSub(L, bn / 2, t, beat * 0.85, 0.12, sr);
            writeSub(R, bn / 2, t, beat * 0.85, 0.12, sr);
            // Clap on 2 and 4
            if (bi % 4 === 2) {
                writeSnare(L, t, 0.1, sr, rng);
                writeSnare(R, t, 0.1, sr, rng);
            }
            bi++;
            t += beat;
        }
        return { L, R };
    };

    const composeLofi = (dur, sr) => {
        const L = new Float32Array(Math.ceil(dur * sr));
        const R = new Float32Array(Math.ceil(dur * sr));
        const rng = seedRng(17);
        const bpm = 78;
        const beat = 60 / bpm;
        const prog = [
            { root: NOTE.D3, type: 'min9' },
            { root: NOTE.G3 / 2, type: 'dom7' },
            { root: NOTE.C3, type: 'maj9' },
            { root: NOTE.F3 / 2, type: 'maj7' }
        ];
        // Vinyl crackle
        for (let i = 0; i < L.length; i++) {
            const crackle = (rng() < 0.005) ? (rng() * 2 - 1) * 0.015 : 0;
            L[i] += crackle;
            R[i] += crackle * 0.8;
        }
        let t = 0;
        let ci = 0;
        while (t < dur - 0.2) {
            const ch = prog[ci % prog.length];
            const freqs = chordFreqs(ch.root * 2, ch.type);
            // Rhodes-style FM keys
            for (let k = 0; k < freqs.length; k++) {
                const delay = k * 0.04;
                writeFM(k % 2 === 0 ? L : R, freqs[k], t + delay, beat * 4, 0.03, 3.5, 0.12, sr);
            }
            writeSub(L, ch.root / 2, t, beat * 4, 0.06, sr);
            writeSub(R, ch.root / 2, t, beat * 4, 0.06, sr);
            // Lazy boom-bap drums
            writeKick(L, t, 0.14, sr); writeKick(R, t, 0.14, sr);
            writeKick(L, t + beat * 2.5, 0.1, sr); writeKick(R, t + beat * 2.5, 0.1, sr);
            writeSnare(L, t + beat, 0.06, sr, rng); writeSnare(R, t + beat, 0.06, sr, rng);
            writeSnare(L, t + beat * 3, 0.06, sr, rng); writeSnare(R, t + beat * 3, 0.06, sr, rng);
            for (let s = 0; s < 8; s++) {
                if (s % 2 === 0) writeShaker(s % 4 === 0 ? L : R, t + s * (beat / 2), 0.03, sr, rng);
            }
            ci++;
            t += beat * 4;
        }
        return { L, R };
    };

    const composePiano = (dur, sr) => {
        const L = new Float32Array(Math.ceil(dur * sr));
        const R = new Float32Array(Math.ceil(dur * sr));
        const rng = seedRng(23);
        const bpm = 100;
        const beat = 60 / bpm;
        const prog = [
            { root: NOTE.C3, type: 'maj7' },
            { root: NOTE.A3 / 2, type: 'min7' },
            { root: NOTE.F3 / 2, type: 'maj7' },
            { root: NOTE.G3 / 2, type: 'sus4' },
            { root: NOTE.G3 / 2, type: 'maj' }
        ];
        let t = 0.05;
        let ci = 0;
        while (t < dur - 0.3) {
            const ch = prog[ci % prog.length];
            const freqs = chordFreqs(ch.root * 2, ch.type);
            // Arpeggiated piano pattern — each note separately
            const pattern = [...freqs, freqs[freqs.length - 1] * 2, ...freqs.reverse()];
            for (let n = 0; n < pattern.length && n < 8; n++) {
                const nt = t + n * (beat * 0.5);
                if (nt >= dur - 0.2) break;
                const pan = n % 2 === 0 ? L : R;
                writeFM(pan, pattern[n], nt, beat * 1.5, 0.04, 4, 0.08, sr);
                writeFM(pan === L ? R : L, pattern[n] * 1.001, nt + 0.005, beat * 1.2, 0.015, 4, 0.08, sr);
            }
            // Light sub
            writeSub(L, ch.root / 2, t, beat * 3, 0.04, sr);
            writeSub(R, ch.root / 2, t, beat * 3, 0.04, sr);
            ci++;
            t += beat * 4;
        }
        return { L, R };
    };

    const composeSunset = (dur, sr) => {
        const L = new Float32Array(Math.ceil(dur * sr));
        const R = new Float32Array(Math.ceil(dur * sr));
        const rng = seedRng(29);
        const bpm = 95;
        const beat = 60 / bpm;
        const prog = [
            { root: NOTE.D3, type: 'maj7' },
            { root: NOTE.B3 / 2, type: 'min7' },
            { root: NOTE.G3 / 2, type: 'maj' },
            { root: NOTE.A3 / 2, type: 'sus2' },
            { root: NOTE.A3 / 2, type: 'maj' }
        ];
        let t = 0;
        let ci = 0;
        while (t < dur - 0.2) {
            const ch = prog[ci % prog.length];
            const freqs = chordFreqs(ch.root * 2, ch.type);
            // Warm sunset pads
            for (const f of freqs) {
                writePad(L, f, t, beat * 5, 0.032, sr);
                writePad(R, f * 1.003, t + 0.04, beat * 5, 0.032, sr);
            }
            writeSub(L, ch.root / 2, t, beat * 4, 0.07, sr);
            writeSub(R, ch.root / 2, t, beat * 4, 0.07, sr);
            // Gentle groove
            for (let s = 0; s < 8; s++) {
                const st = t + s * (beat / 2);
                if (st >= dur) break;
                if (s === 0 || s === 5) { writeKick(L, st, 0.14, sr); writeKick(R, st, 0.14, sr); }
                if (s === 2 || s === 6) writeSnare(s === 2 ? L : R, st, 0.05, sr, rng);
                writeShaker(s % 2 === 0 ? L : R, st, 0.035, sr, rng);
                // Bell-like tones
                if (s === 1 || s === 5) {
                    const f = freqs[s % freqs.length] * 2;
                    writePluck(s % 2 === 0 ? L : R, f, st, 0.8, 0.02, sr);
                }
            }
            ci++;
            t += beat * 4;
        }
        return { L, R };
    };

    const composeCorporate = (dur, sr) => {
        const L = new Float32Array(Math.ceil(dur * sr));
        const R = new Float32Array(Math.ceil(dur * sr));
        const rng = seedRng(31);
        const bpm = 112;
        const beat = 60 / bpm;
        const prog = [
            { root: NOTE.C3, type: 'maj' },
            { root: NOTE.F3 / 2, type: 'maj' },
            { root: NOTE.A3 / 2, type: 'min' },
            { root: NOTE.G3 / 2, type: 'sus4' },
            { root: NOTE.G3 / 2, type: 'maj' }
        ];
        const motif = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.B4, NOTE.C5];
        let t = 0;
        let ci = 0;
        let mi = 0;
        while (t < dur - 0.1) {
            const ch = prog[ci % prog.length];
            const freqs = chordFreqs(ch.root * 2, ch.type);
            // Clean guitar-like FM chords
            for (const f of freqs) {
                writeFM(L, f, t, beat * 4, 0.022, 2.5, 0.12, sr);
                writeFM(R, f * 1.002, t, beat * 4, 0.022, 2.5, 0.12, sr);
            }
            writeSub(L, ch.root / 2, t, beat * 4, 0.08, sr);
            writeSub(R, ch.root / 2, t, beat * 4, 0.08, sr);
            // Driving groove
            for (let s = 0; s < 8; s++) {
                const st = t + s * (beat / 2);
                if (st >= dur) break;
                if (s % 4 === 0) { writeKick(L, st, 0.2, sr); writeKick(R, st, 0.2, sr); }
                if (s % 4 === 2) { writeSnare(L, st, 0.08, sr, rng); writeSnare(R, st, 0.08, sr, rng); }
                writeHat(s % 2 === 0 ? L : R, st, 0.035, s % 4 === 3, sr, rng);
                // Catchy motif
                if (s % 2 === 1 && mi < motif.length * 4) {
                    writePluck(mi % 2 === 0 ? L : R, motif[mi % motif.length], st, beat * 0.8, 0.035, sr);
                    mi++;
                }
            }
            ci++;
            t += beat * 4;
        }
        return { L, R };
    };

    /* ─── MODE DISPATCHER ─── */
    const COMPOSERS = {
        ambient: composeAmbient,
        upbeat: composeUpbeat,
        chill: composeChill,
        cinematic: composeCinematic,
        tropical: composeTropical,
        house: composeHouse,
        lofi: composeLofi,
        piano: composePiano,
        sunset: composeSunset,
        corporate: composeCorporate
    };

    /* ─── MAIN RENDER ─── */
    const render = async (mode, durationSec) => {
        const compose = COMPOSERS[mode] || COMPOSERS.ambient;
        const dur = Math.max(3, Number(durationSec) || 9) + 0.5; // extra for reverb tail
        const sr = SR;
        const { L, R } = compose(dur, sr);

        // Post-processing
        // 1. High-pass to remove DC offset & rumble below 30 Hz
        hpFilter(L, 30, sr);
        hpFilter(R, 30, sr);

        // 2. Gentle low-pass to eliminate harsh aliasing artifacts
        const lpCutoff = (mode === 'lofi') ? 8000 : 14000;
        lpFilter(L, lpCutoff, sr);
        lpFilter(R, lpCutoff, sr);

        // 3. Apply reverb
        const reverbWet = {
            ambient: 0.35, cinematic: 0.4, piano: 0.3, lofi: 0.15,
            chill: 0.25, sunset: 0.3, house: 0.12, upbeat: 0.15,
            tropical: 0.2, corporate: 0.15
        }[mode] || 0.2;
        const reverbDecay = {
            ambient: 2.5, cinematic: 3.0, piano: 2.0, lofi: 1.2,
            chill: 1.8, sunset: 2.2, house: 0.8, upbeat: 1.0,
            tropical: 1.4, corporate: 1.0
        }[mode] || 1.5;
        const Lr = applyReverb(L, sr, reverbWet, reverbDecay);
        const Rr = applyReverb(R, sr, reverbWet, reverbDecay);

        // 4. Soft-limit / master
        softLimit(Lr, 0.85);
        softLimit(Rr, 0.85);

        // 5. Fade in/out
        const actualDur = durationSec + 0.5;
        applyFades(Lr, sr, 0.15, 0.6);
        applyFades(Rr, sr, 0.15, 0.6);

        // Build AudioBuffer via OfflineAudioContext
        const finalLen = Math.ceil(actualDur * sr);
        const trimL = Lr.slice(0, finalLen);
        const trimR = Rr.slice(0, finalLen);
        try {
            const offCtx = new OfflineAudioContext(2, finalLen, sr);
            const audioBuf = offCtx.createBuffer(2, finalLen, sr);
            audioBuf.getChannelData(0).set(trimL);
            audioBuf.getChannelData(1).set(trimR);
            return audioBuf;
        } catch {
            return null;
        }
    };

    window.__reelMusicEngine = { render };
})();
