/**
 * Copy text to the clipboard, falling back to a hidden textarea +
 * execCommand for browsers/contexts where navigator.clipboard is
 * unavailable (e.g. non-HTTPS, older WebViews).
 * @param {string} text
 * @returns {Promise<void>}
 */
export function copyToClipboard(text) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text)

  return Promise.resolve().then(() => {
    const el = document.createElement('textarea')
    el.value = text
    Object.assign(el.style, { position: 'fixed', opacity: '0' })
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  })
}
