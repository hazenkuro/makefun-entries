// Lumen Drift — all sound is synthesised with WebAudio: short oscillator
// bleeps shaped by a gain envelope. No audio files, no network, and nothing
// plays until the player first interacts (browsers require a gesture).
const NOTE = {
  pickup: [880, 1320],
  dash: [220, 440],
  hit: [160, 90],
  shield: [520, 780, 1040],
  win: [523, 659, 784, 1047],
  over: [392, 311, 233],
  click: [660],
};

export function createAudio() {
  let context = null;
  let muted = false;

  // Lazily create the context on first use, inside a user gesture.
  function ensure() {
    if (context === null) {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  }

  // Play one note: a sine/triangle blip that rises or falls in pitch.
  function tone(freq, when, duration, type, volume) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + duration + 0.05);
  }

  function play(name, type = 'sine', volume = 0.12) {
    const notes = NOTE[name];
    if (!notes) return;
    notes.forEach((freq, index) => {
      tone(freq, index * 0.07, 0.16, type, volume);
    });
  }

  return {
    // Unlock audio from a gesture (start click / key press).
    unlock() {
      ensure();
    },
    // A higher combo sings higher, and a little louder: the pitch climbs
    // with the streak, so a good run sounds like a good run.
    pickup(combo) {
      const base = 660 + combo * 90;
      tone(base, 0, 0.12, 'sine', 0.1);
      tone(base * 1.5, 0.05, 0.14, 'sine', 0.09);
    },
    dash() {
      play('dash', 'triangle', 0.1);
    },
    hit() {
      play('hit', 'sawtooth', 0.14);
    },
    shield() {
      play('shield', 'sine', 0.11);
    },
    win() {
      play('win', 'sine', 0.13);
    },
    over() {
      play('over', 'triangle', 0.13);
    },
    click() {
      play('click', 'sine', 0.07);
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
  };
}
