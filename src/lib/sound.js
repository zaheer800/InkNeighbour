let audioCtx = null

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

// Unlocks AudioContext on first user gesture — call once from a click handler.
export function unlockAudio() {
  try { getAudioContext() } catch { /* ignore */ }
}

// Plays a repeating alarm burst (3 rapid pulses) for urgent new-order alerts.
export function playNotificationSound() {
  try {
    const ctx = getAudioContext()
    const t = ctx.currentTime

    // Three rapid beep pulses at alarm frequency (960 Hz — piercing but not harsh)
    const PULSE_ON = 0.12
    const PULSE_GAP = 0.08
    const PULSES = 3

    for (let i = 0; i < PULSES; i++) {
      const start = t + i * (PULSE_ON + PULSE_GAP)

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'square'         // square wave = sharp, alarm-like timbre
      osc.frequency.value = 960

      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.25, start + 0.008)
      gain.gain.setValueAtTime(0.25, start + PULSE_ON - 0.015)
      gain.gain.linearRampToValueAtTime(0, start + PULSE_ON)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + PULSE_ON)
    }
  } catch {
    // Audio blocked or not supported — fail silently
  }
}
