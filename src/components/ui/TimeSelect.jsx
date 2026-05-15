const TIME_OPTIONS = []
for (let h = 6; h <= 23; h++) {
  for (const m of [0, 30]) {
    if (h === 23 && m === 30) continue
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    const period = h < 12 ? 'AM' : 'PM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    TIME_OPTIONS.push({ value: `${hh}:${mm}`, label: `${h12}:${mm} ${period}` })
  }
}

export default function TimeSelect({ value, onChange, className = '' }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`min-h-[44px] px-2 rounded-lg border border-border text-sm text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-violet/40 ${className}`}
    >
      {TIME_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
