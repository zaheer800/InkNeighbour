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

// Plays a two-tone rising chime (like Uber/Rapido new-order alerts).
export function playNotificationSound() {
  try {
    const ctx = getAudioContext()
    const t = ctx.currentTime

    function tone(freq, start, duration) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.3, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + duration)
    }

    tone(880, t, 0.25)            // A5 — first ping
    tone(1318.5, t + 0.18, 0.35)  // E6 — rising second ping
  } catch {
    // Audio blocked or not supported — fail silently
  }
}
