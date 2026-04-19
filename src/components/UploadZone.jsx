import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png']
}

async function detectPageCount(file) {
  if (file.type !== 'application/pdf') return 1

  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    return pdf.numPages
  } catch {
    return null // null = detection failed, owner will confirm
  }
}

export default function UploadZone({ onFileReady }) {
  const { t } = useTranslation()
  const [file, setFile] = useState(null)
  const [pageCount, setPageCount] = useState(null)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState(null)

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    setError(null)
    if (rejectedFiles.length > 0) {
      const rej = rejectedFiles[0]
      if (rej.errors.some(e => e.code === 'file-too-large')) {
        setError(t('errors.file_too_large'))
      } else {
        setError(t('errors.file_invalid_type'))
      }
      return
    }

    const f = acceptedFiles[0]
    if (!f) return

    setFile(f)
    setDetecting(true)
    const count = await detectPageCount(f)
    setPageCount(count)
    setDetecting(false)
    onFileReady({ file: f, pageCount: count })
  }, [onFileReady, t])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    multiple: false
  })

  function removeFile() {
    setFile(null)
    setPageCount(null)
    onFileReady({ file: null, pageCount: null })
  }

  if (file) {
    return (
      <div className="border-2 border-green/50 bg-green/5 rounded-xl p-5 space-y-2 overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-green/15 p-3 rounded-xl shrink-0">
              <FileText size={24} className="text-green" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-ink truncate">{file.name}</p>
              <p className="text-sm text-muted">
                {file.size >= 1024 * 1024
                  ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                  : `${(file.size / 1024).toFixed(0)} KB`}
                {detecting && <span className="ml-2 text-violet">{t('upload.detecting_pages')}</span>}
                {!detecting && pageCount !== null && (
                  <span className="ml-2 text-green font-semibold">{t('upload.pages_detected', { count: pageCount })}</span>
                )}
                {!detecting && pageCount === null && (
                  <span className="ml-2 text-amber">{t('upload.pages_unknown')}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={removeFile}
            className="p-2 text-muted hover:text-red transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={t('upload.remove')}
          >
            <X size={20} />
          </button>
        </div>
        {pageCount === null && !detecting && (
          <div className="flex items-start gap-2 p-3 bg-amber/10 border border-amber/30 rounded-xl text-sm text-amber">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{t('upload.page_count_unknown_hint')}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={[
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-violet bg-violet/5'
            : 'border-border bg-bg hover:border-violet/50 hover:bg-violet/5'
        ].join(' ')}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className="bg-violet/10 p-4 rounded-xl">
            <Upload size={32} className="text-violet" />
          </div>
          <div>
            <p className="font-semibold text-ink text-lg">
              {isDragActive ? t('upload.drop_here') : t('upload.drag_or_tap')}
            </p>
            <p className="text-sm text-muted mt-1">{t('upload.accepted_types')}</p>
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-red">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </div>
  )
}
