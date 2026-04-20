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

export default function Privacy() {
  return (
    <div className="min-h-screen bg-bg">
      <AppNav />

      {/* Hero */}
      <div className="page-hero px-4 py-8 text-white">
        <div className="max-w-3xl mx-auto relative z-10">
          <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft size={16} /> Back to home
          </Link>
          <h1 className="font-display text-3xl sm:text-4xl font-black">Privacy Policy</h1>
          <p className="text-white/60 text-sm mt-2">Last updated: April 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="bg-surface rounded-2xl shadow-card border border-border/60 p-6 sm:p-8 space-y-8">

          <Section title="Who we are">
            <p>InkNeighbour ("we", "us", "our") is a platform that connects home printer owners with neighbours in the same residential society for on-demand printing services. Our website is at <strong>inkneighbour.zakapedia.in</strong>.</p>
          </Section>

          <Section title="What information we collect">
            <p><strong>For printer owners (shop registration):</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Full name, email address, and phone number</li>
              <li>Society / apartment name and postal code</li>
              <li>UPI ID (optional, for receiving payments)</li>
              <li>Print rates you set for your shop</li>
            </ul>
            <p className="mt-3"><strong>For customers placing orders:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Your name, flat number, and phone number (optional)</li>
              <li>The document you upload for printing</li>
              <li>Print preferences (colour, copies, paper size)</li>
            </ul>
            <p className="mt-3"><strong>Automatically collected:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Browser push notification subscription (if you grant permission)</li>
              <li>Basic usage data via Supabase (our database provider)</li>
            </ul>
          </Section>

          <Section title="How we use your information">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>To match customers with the printer owner in their society</li>
              <li>To display your shop to customers searching your pincode</li>
              <li>To send push notifications to owners when a new print job arrives</li>
              <li>To generate a print job record and facilitate payment between neighbours</li>
              <li>To calculate and display earnings summaries for owners</li>
            </ul>
            <p>We do <strong>not</strong> sell your information to third parties.</p>
          </Section>

          <Section title="Document storage">
            <p>Files you upload for printing are stored temporarily in Supabase Storage. They are automatically deleted when your order is marked as delivered or cancelled. We do not retain your documents after the print job is complete.</p>
          </Section>

          <Section title="Data security">
            <p>All data is stored on Supabase (PostgreSQL) with row-level security policies. Authentication is handled by Supabase Auth. We use HTTPS for all data in transit. We do not store passwords in plain text.</p>
          </Section>

          <Section title="Your rights">
            <p>You may request deletion of your account and all associated data at any time by contacting us via WhatsApp. We will process deletion requests within 7 business days.</p>
          </Section>

          <Section title="Cookies">
            <p>We use only essential session cookies provided by Supabase Auth for keeping you logged in. We do not use advertising or tracking cookies.</p>
          </Section>

          <Section title="Contact">
            <p>For any privacy concerns or data requests, reach us on WhatsApp:</p>
          </Section>
        </div>

        {/* WhatsApp CTA */}
        <div className="text-center">
          <a
            href={`https://wa.me/${import.meta.env.VITE_CONTACT_WHATSAPP}`}
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
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
