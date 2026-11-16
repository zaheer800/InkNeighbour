#!/usr/bin/env node
// Stand-in for InkNeighbour Connect, for testing the cloud side without a printer.
// Usage:
//   FUNCTION_URL=https://<project>.supabase.co/functions/v1/printer-agent \
//     node tools/fake-agent/fake-agent.mjs pair ABCDE-12345      (saves credential to .fake-agent.json)
//   node tools/fake-agent/fake-agent.mjs run [scenario]          (scenario: healthy | low-toner | error | unsupported)
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const URL_ = process.env.FUNCTION_URL
if (!URL_) { console.error('Set FUNCTION_URL'); process.exit(1) }
const STATE = '.fake-agent.json'
const [cmd, arg] = process.argv.slice(2)

async function call(body, credential) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${body.action} -> ${res.status} ${JSON.stringify(json)}`)
  return json
}

const SCENARIOS = {
  healthy: { status: 'ready', consumables: [{ type: 'toner', colour: 'black', level: 72, source: 'actual' }] },
  'low-toner': { status: 'ready', consumables: [{ type: 'toner', colour: 'black', level: 7, source: 'estimated' }] },
  error: { status: 'error', status_detail: 'Paper jam in tray 2', consumables: [{ type: 'toner', colour: 'black', level: 55, source: 'actual' }] },
  unsupported: { status: 'ready', consumables: [{ type: 'ink', colour: 'black', source: 'unsupported' }] },
}

if (cmd === 'pair') {
  const r = await call({ action: 'pair', code: arg, device_name: 'Fake test PC', agent_version: 'fake-0.1' })
  writeFileSync(STATE, JSON.stringify({ credential: r.credential, deviceIdentifier: `fake-${randomUUID()}` }), { mode: 0o600 })
  console.log('Paired. Agent id:', r.agent_id)
} else if (cmd === 'run') {
  const s = JSON.parse(readFileSync(STATE, 'utf8'))
  const scenario = SCENARIOS[arg ?? 'healthy']
  if (!scenario) { console.error('Unknown scenario'); process.exit(1) }
  await call({ action: 'heartbeat', agent_version: 'fake-0.1' }, s.credential)
  const reg = await call({
    action: 'register-printer', device_identifier: s.deviceIdentifier, manufacturer: 'Fake', model: 'Simulator 3000',
    connection_type: 'network', ip_address: '192.0.2.10',
  }, s.credential)
  const out = await call({
    action: 'telemetry',
    readings: [{ printer_id: reg.printer_id, observed_at: new Date().toISOString(), page_count: 1234, ...scenario }],
  }, s.credential)
  console.log(JSON.stringify(out))
} else {
  console.error('Usage: pair <code> | run [scenario]')
  process.exit(1)
}
