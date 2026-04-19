import { Link } from 'react-router-dom'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import AppNav from '../components/AppNav'

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      <div className="text-muted leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

export default function Terms() {
  return (
    <div className="min-h-screen bg-bg">
      <AppNav />

      {/* Hero */}
      <div className="page-hero px-4 py-8 text-white">
        <div className="max-w-3xl mx-auto relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft size={16} /> Back to home
          </Link>
          <h1 className="font-display text-3xl sm:text-4xl font-black">Terms of Service</h1>
          <p className="text-white/60 text-sm mt-2">Last updated: April 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="bg-surface rounded-2xl shadow-card border border-border/60 p-6 sm:p-8 space-y-8">

          <Section title="About InkNeighbour">
            <p>InkNeighbour is a platform that helps residents of apartment complexes connect with a neighbour who offers home printing services. By using InkNeighbour, you agree to these terms.</p>
          </Section>

          <Section title="For customers">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>You may upload documents for printing through the platform.</li>
              <li>Uploaded files are shared only with the printer owner in your society.</li>
              <li>Files are deleted automatically once your order is delivered or cancelled.</li>
              <li>Payment is made directly to the printer owner (via UPI or cash). InkNeighbour does not process payments on your behalf.</li>
              <li>InkNeighbour is not responsible for print quality disputes — these are between you and the owner.</li>
              <li>Do not upload confidential, illegal, or copyrighted content you do not have the right to print.</li>
            </ul>
          </Section>

          <Section title="For printer owners">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>You may register one shop per society. Only one owner is permitted per residential society.</li>
              <li>You are solely responsible for the print services you provide and any disputes with customers.</li>
              <li>You must respond to new print jobs within 15 minutes of receiving them.</li>
              <li>Missing jobs repeatedly will automatically pause your shop.</li>
              <li>You may set your own rates within the platform limits.</li>
              <li>InkNeighbour does not guarantee any minimum earnings.</li>
              <li>Your shop is subject to admin approval before going live.</li>
            </ul>
          </Section>

          <Section title="Platform rules">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>You must be at least 18 years old to register as an owner.</li>
              <li>You may not use InkNeighbour for commercial bulk printing operations.</li>
              <li>Any misuse of the platform may result in immediate account suspension.</li>
            </ul>
          </Section>

          <Section title="Limitation of liability">
            <p>InkNeighbour provides a connection platform only. We are not a party to any transaction between owners and customers. We are not liable for lost documents, print errors, payment disputes, or any damages arising from use of the service.</p>
          </Section>

          <Section title="Changes to these terms">
            <p>We may update these terms from time to time. Continued use of InkNeighbour after changes are posted means you accept the updated terms.</p>
          </Section>

          <Section title="Contact">
            <p>Questions about these terms? Reach us on WhatsApp:</p>
          </Section>
        </div>

        {/* WhatsApp CTA */}
        <div className="text-center">
          <a
            href="https://wa.me/916381601740"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green/10 border border-green/30 text-green hover:bg-green/20 transition-colors font-semibold px-6 py-3 rounded-xl min-h-[52px]"
          >
            <MessageCircle size={18} />
            Chat with us on WhatsApp
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-ink text-white/50 border-t border-white/5 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-display font-black text-lg text-white/80">
            Ink<span className="text-orange">Neighbour</span>
          </p>
          <div className="flex items-center gap-5 text-sm">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
