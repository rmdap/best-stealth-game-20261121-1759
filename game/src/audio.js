// All sound is synthesized with WebAudio: no audio files, no network.
// Footsteps patter softly, a gem chimes, an alert stings, escape arpeggiates.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (!context) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();
      } catch {
        context = null;
      }
    }
    if (context && context.state === 'suspended') context.resume();
    return context;
  }

  function tone(frequency, duration, type, volume, when = 0, slideTo = null) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const start = ctx.currentTime + when;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo !== null) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noise(duration, volume, lowpass) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const start = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** A soft paw-step; pitch wanders so it never sounds looped. */
    footstep(sneaking) {
      noise(0.07, sneaking ? 0.02 : 0.05, sneaking ? 500 : 900);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.16);
      tone(1318, 0.2, 'sine', 0.14, 0.07);
    },
    pebble() {
      tone(300, 0.08, 'triangle', 0.1, 0, 520);
      noise(0.05, 0.06, 2400);
    },
    alert() {
      tone(196, 0.28, 'sawtooth', 0.12, 0, 147);
      tone(147, 0.32, 'sawtooth', 0.12, 0.14, 110);
    },
    caught() {
      tone(220, 0.5, 'sawtooth', 0.14, 0, 55);
    },
    win() {
      [523, 659, 784, 1047].forEach((frequency, i) => tone(frequency, 0.3, 'sine', 0.14, i * 0.11));
    },
  };
}
