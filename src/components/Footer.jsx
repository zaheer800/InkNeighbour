import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-border mt-auto py-5 px-4 w-full">
      <p className="text-center text-xs text-muted">
        <Link to="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link>
        {' · '}
        <Link to="/terms" className="hover:text-ink transition-colors">Terms of Service</Link>
        {' · '}
        © {new Date().getFullYear()} InkNeighbour
      </p>
    </footer>
  )
}
