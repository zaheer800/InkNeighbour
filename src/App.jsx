import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Landing from './pages/Landing'
import Find from './pages/Find'
import Step1Details from './pages/Register/Step1Details'
import Step2Society from './pages/Register/Step2Society'
import Step3Rates from './pages/Register/Step3Rates'
import Success from './pages/Register/Success'
import Login from './pages/Login'
import DashboardJobs from './pages/Dashboard/index'
import DashboardEarnings from './pages/Dashboard/Earnings'
import DashboardFeedback from './pages/Dashboard/Feedback'
import DashboardSettings from './pages/Dashboard/Settings'
import ShopPage from './pages/ShopPage'
import OrderConfirm from './pages/OrderConfirm'
import FeedbackForm from './pages/FeedbackForm'
import Admin from './pages/Admin'
import IOSInstallBanner from './components/IOSInstallBanner'

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-muted">Loading...</div></div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { session, loading, isAdmin } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-muted">Loading...</div></div>
  if (!session) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/find" element={<Find />} />
        <Route path="/register" element={<Step1Details />} />
        <Route path="/register/society" element={<Step2Society />} />
        <Route path="/register/rates" element={<Step3Rates />} />
        <Route path="/register/success" element={<Success />} />
        <Route path="/login" element={<Login />} />

        {/* Owner dashboard — protected */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardJobs /></ProtectedRoute>} />
        <Route path="/dashboard/earnings" element={<ProtectedRoute><DashboardEarnings /></ProtectedRoute>} />
        <Route path="/dashboard/feedback" element={<ProtectedRoute><DashboardFeedback /></ProtectedRoute>} />
        <Route path="/dashboard/settings" element={<ProtectedRoute><DashboardSettings /></ProtectedRoute>} />

        {/* Platform admin — protected + admin email only */}
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />

        {/* Customer-facing (dynamic) — must come last */}
        <Route path="/feedback/:jobId" element={<FeedbackForm />} />
        <Route path="/:slug/confirm/:jobId" element={<OrderConfirm />} />
        <Route path="/:slug" element={<ShopPage />} />
      </Routes>
      <IOSInstallBanner />
    </>
  )
}
