import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import StarRating from '../components/StarRating'
import Button from '../components/ui/Button'
import AppNav from '../components/AppNav'

const THUMB_BASE = 'flex-1 flex flex-col items-center justify-center gap-2 py-4 rounded-xl border-2 font-bold min-h-[80px] transition-colors cursor-pointer'

export default function FeedbackForm() {
  const { jobId } = useParams()
  const { t } = useTranslation()
  const [job, setJob] = useState(null)
  const [owner, setOwner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expired, setExpired] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [onTime, setOnTime] = useState(null)       // true | false | null
  const [qualityGood, setQualityGood] = useState(null)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [starError, setStarError] = useState(false)

  useEffect(() => {
    supabase
      .from('jobs')
      .select(`*, owners(id, name, societies(name))`)
      .eq('id', jobId)
      .single()
      .then(async ({ data: jobData }) => {
        if (!jobData) { setLoading(false); return }
        setJob(jobData)
        setOwner(jobData.owners)

        // Check expiry — feedback valid for 7 days after delivery
        const { data: fb } = await supabase
          .from('feedback')
          .select('id')
          .eq('job_id', jobId)
          .maybeSingle()

        if (fb) { setAlreadySubmitted(true); setLoading(false); return }

        if (jobData.status === 'delivered' || jobData.status === 'feedback_pending' || jobData.status === 'feedback_done') {
          const deliveredAt = new Date(jobData.updated_at)
          const expiresAt = new Date(deliveredAt.getTime() + 7 * 24 * 60 * 60 * 1000)
          if (new Date() > expiresAt) {
            setExpired(true)
          }
        } else {
          setExpired(true) // not yet delivered
        }

        setLoading(false)
      })
  }, [jobId])

  async function handleSubmit() {
    if (stars === 0) { setStarError(true); return }
    setStarError(false)
    setSubmitting(true)

    const { error } = await supabase.from('feedback').insert({
      job_id: jobId,
      owner_id: owner.id,
      society_id: null,
      on_time: onTime,
      quality_good: qualityGood,
      star_rating: stars,
      comment: comment.trim() || null
    })

    if (!error) {
      // Update job status to feedback_done
      await supabase.from('jobs').update({ status: 'feedback_done' }).eq('id', jobId)
      setSubmitted(true)
    }
    setSubmitting(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-muted">{t('common.loading')}</p></div>

  if (!job) return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center space-y-2">
        <p className="text-4xl">🤔</p>
        <p className="text-muted">{t('errors.shop_not_found')}</p>
      </div>
    </div>
  )

  if (expired) return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center space-y-3 max-w-sm">
        <p className="text-5xl">⏰</p>
        <h1 className="font-display text-2xl font-bold text-ink">{t('feedback_form.expired_title')}</h1>
        <p className="text-muted">{t('feedback_form.expired_desc')}</p>
      </div>
    </div>
  )

  if (alreadySubmitted) return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center space-y-3 max-w-sm">
        <p className="text-5xl">✅</p>
        <p className="text-muted">{t('feedback_form.already_submitted')}</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-6xl">🙏</p>
        <h1 className="font-display text-3xl font-bold text-ink">{t('feedback_form.success_title')}</h1>
        <p className="text-muted text-lg">{t('feedback_form.success_desc')}</p>
      </div>
    </div>
  )

  const societyName = owner?.societies?.name || ''

  return (
    <div className="min-h-screen bg-bg">
      <AppNav />
      <div className="page-hero px-4 py-12 text-white text-center relative">
        <div className="relative z-10 max-w-sm mx-auto space-y-2">
          <p className="text-4xl">🖨️</p>
          <h1 className="font-display text-3xl font-bold">{t('feedback_form.title')}</h1>
          {job?.job_number && <p className="text-white/60 text-sm font-mono">#{job.job_number} · {societyName}</p>}
          {owner && <p className="text-white/70 text-sm">{t('feedback_form.printed_by', { name: owner.name.split(' ')[0] })}</p>}
        </div>
      </div>

      <div className="max-w-sm mx-auto px-4 py-8 space-y-6">
        {/* Q1: On time */}
        <div className="bg-surface rounded-xl shadow-card p-5 space-y-3">
          <p className="font-semibold text-ink text-lg">{t('feedback_form.q1')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setOnTime(true)}
              className={`${THUMB_BASE} ${onTime === true ? 'border-green bg-green/5 text-green' : 'border-border bg-bg text-muted'}`}
            >
              <ThumbsUp size={28} />
              <span className="text-base">Yes</span>
            </button>
            <button
              onClick={() => setOnTime(false)}
              className={`${THUMB_BASE} ${onTime === false ? 'border-red bg-red/5 text-red' : 'border-border bg-bg text-muted'}`}
            >
              <ThumbsDown size={28} />
              <span className="text-base">No</span>
            </button>
          </div>
        </div>

        {/* Q2: Quality */}
        <div className="bg-surface rounded-xl shadow-card p-5 space-y-3">
          <p className="font-semibold text-ink text-lg">{t('feedback_form.q2')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setQualityGood(true)}
              className={`${THUMB_BASE} ${qualityGood === true ? 'border-green bg-green/5 text-green' : 'border-border bg-bg text-muted'}`}
            >
              <ThumbsUp size={28} />
              <span className="text-base">Yes</span>
            </button>
            <button
              onClick={() => setQualityGood(false)}
              className={`${THUMB_BASE} ${qualityGood === false ? 'border-red bg-red/5 text-red' : 'border-border bg-bg text-muted'}`}
            >
              <ThumbsDown size={28} />
              <span className="text-base">No</span>
            </button>
          </div>
        </div>

        {/* Q3: Star rating */}
        <div className="bg-surface rounded-xl shadow-card p-5 space-y-3">
          <p className="font-semibold text-ink text-lg">{t('feedback_form.q3')}</p>
          <div className="flex justify-center">
            <StarRating value={stars} onChange={v => { setStars(v); setStarError(false) }} size="lg" />
          </div>
          {starError && <p className="text-sm text-red text-center">{t('feedback_form.star_required')}</p>}
        </div>

        {/* Q4: Comment */}
        <div className="bg-surface rounded-xl shadow-card p-5 space-y-3">
          <p className="font-semibold text-ink text-lg">{t('feedback_form.q4')}</p>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value.slice(0, 200))}
            placeholder={t('feedback_form.q4_placeholder')}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-border text-base text-ink bg-bg resize-none focus:outline-none focus:ring-2 focus:ring-violet/40 focus:border-violet"
          />
          <p className="text-xs text-muted text-right">{comment.length}/200</p>
        </div>

        <Button onClick={handleSubmit} loading={submitting} className="w-full" size="lg">
          {submitting ? t('feedback_form.submitting') : t('feedback_form.submit')}
        </Button>
      </div>
    </div>
  )
}
