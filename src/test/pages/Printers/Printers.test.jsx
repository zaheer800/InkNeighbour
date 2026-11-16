import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Printers from '../../../pages/Printers'
import { usePrinters } from '../../../hooks/usePrinters'

vi.mock('../../../hooks/usePrinters')
vi.mock('../../../components/AppNav', () => ({ default: () => null }))
vi.mock('../../../components/DashboardNav', () => ({ default: () => null }))

const fresh = () => new Date().toISOString()
const base = () => ({
  loading: false, error: null, accountId: 'acc',
  agents: [{ id: 'a1', device_name: 'Shop PC', status: 'online', last_heartbeat_at: fresh() }],
  printers: [{ id: 'p1', agent_id: 'a1', name: 'Front desk', manufacturer: 'HP', model: 'M404', status: 'ready', last_seen_at: fresh(), low_supply_threshold: 15 }],
  consumables: [
    { printer_id: 'p1', consumable_type: 'toner', colour: 'black', source: 'actual', level_percentage: 8, observed_at: fresh() },
    { printer_id: 'p1', consumable_type: 'other', colour: 'other', source: 'unsupported', level_percentage: null, observed_at: fresh() },
  ],
  alerts: [],
  createPairingCode: vi.fn().mockResolvedValue({ code: 'ABCDE12345', error: null }),
  revokeAgent: vi.fn().mockResolvedValue({ error: null }),
  updatePrinter: vi.fn().mockResolvedValue({ error: null }),
  removePrinter: vi.fn().mockResolvedValue({ error: null }),
  acknowledgeAlert: vi.fn().mockResolvedValue({ error: null }),
})

const renderPage = () => render(<MemoryRouter><Printers /></MemoryRouter>)

describe('Printers page', () => {
  beforeEach(() => vi.mocked(usePrinters).mockReturnValue(base()))

  it('shows printer state and supplies, never 0% for unsupported', () => {
    renderPage()
    expect(screen.getByText('Front desk')).toBeInTheDocument()
    expect(screen.getByText('printers.state_ready')).toBeInTheDocument()
    expect(screen.getByText('8%')).toBeInTheDocument()
    expect(screen.getByText('printers.supply_unavailable')).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    expect(screen.getByText('printers.supply_low')).toBeInTheDocument()
  })

  it('shows agent-offline instead of ready when the computer went quiet', () => {
    const s = base()
    s.agents[0].last_heartbeat_at = new Date(Date.now() - 30 * 60_000).toISOString()
    vi.mocked(usePrinters).mockReturnValue(s)
    renderPage()
    expect(screen.getByText('printers.state_agent_offline')).toBeInTheDocument()
    expect(screen.queryByText('printers.state_ready')).not.toBeInTheDocument()
  })

  it('shows a formatted pairing code', async () => {
    renderPage()
    fireEvent.click(screen.getByText('printers.add_computer'))
    expect(await screen.findByText('ABCDE-12345')).toBeInTheDocument()
  })

  it('acknowledges an alert', async () => {
    const s = base()
    s.alerts = [{ id: 'al1', status: 'open', message: 'Toner low' }]
    vi.mocked(usePrinters).mockReturnValue(s)
    renderPage()
    fireEvent.click(screen.getByText('printers.alert_ok'))
    await waitFor(() => expect(s.acknowledgeAlert).toHaveBeenCalledWith('al1'))
  })

  it('removes a printer only after confirmation', async () => {
    const s = base()
    vi.mocked(usePrinters).mockReturnValue(s)
    renderPage()
    fireEvent.click(screen.getByText('printers.remove'))
    expect(s.removePrinter).not.toHaveBeenCalled()
    const buttons = await screen.findAllByText('printers.remove')
    fireEvent.click(buttons[buttons.length - 1])
    await waitFor(() => expect(s.removePrinter).toHaveBeenCalledWith('p1'))
  })
})
