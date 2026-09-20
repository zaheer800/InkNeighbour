// Map helper: the standard open-source MapLibre GL engine with Ola Maps' hosted style.
//
// Why not olamaps-web-sdk? That package ships its own bundled copy of the map engine, and in
// production (2026-09) it never finished drawing Ola's current style: the pin and the address
// search worked, but the map stayed a blank pale box. The same style, key and tiles draw in under
// a second with plain maplibre-gl, so the map is built directly and Ola is only the tile/style
// provider. (Ola's REST APIs for search/geocoding are unchanged and live in the components.)
//
// Ola's hosted style also has one layer ("3d_model_data") whose data no longer exists; MapLibre
// logs an error for it and carries on, so that one message is filtered out below.

const OLA_KEY = import.meta.env.VITE_OLA_MAPS_API_KEY
export const OLA_STYLE_URL = 'https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json'
export const OLA_ATTRIBUTION = '© Ola Maps · © OpenStreetMap contributors'

// MapLibre calls this for every request (style, sprites, fonts, tile descriptors, tiles);
// Ola's servers need the key on all of them.
export function withOlaKey(url) {
  if (!url.includes('olamaps.io') || url.includes('api_key=')) return undefined
  return { url: url + (url.includes('?') ? '&' : '?') + 'api_key=' + OLA_KEY }
}

/** Load MapLibre (and its CSS) on demand so it is not part of the main bundle. */
export async function loadMapLibre() {
  const [{ default: maplibregl }] = await Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css'),
  ])
  return maplibregl
}

/**
 * Create a map with Ola's style. Pass MapLibre options (container, center [lng, lat], zoom, ...).
 * Returns { map, maplibregl, styleReady }: use maplibregl.Marker / .Popup for pins, and await
 * styleReady before adding your own sources or layers (it resolves after ~10s at the latest, so a
 * failed style can never hang the caller).
 */
export async function createOlaMap(options) {
  const maplibregl = await loadMapLibre()
  const map = new maplibregl.Map({
    style: OLA_STYLE_URL,
    attributionControl: false,
    transformRequest: withOlaKey,
    ...options,
  })
  map.addControl(
    new maplibregl.AttributionControl({ compact: true, customAttribution: OLA_ATTRIBUTION }),
    'bottom-right',
  )
  map.on('error', (e) => {
    const message = String(e?.error?.message ?? e)
    if (!message.includes('3d_model')) console.warn('[map]', message)
  })
  const styleReady = new Promise((resolve) => {
    map.once('style.load', resolve)
    setTimeout(resolve, 10000)
  })
  return { map, maplibregl, styleReady }
}
