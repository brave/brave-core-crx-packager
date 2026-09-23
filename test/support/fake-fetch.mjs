// Hermetic globalThis.fetch: records every call, serves scripted routes,
// and fails loudly on anything unrouted (deny by default).
import { mockState } from './state.mjs'

function routeMatches (route, url) {
  if (typeof route.match === 'function') return route.match(url)
  if (route.match instanceof RegExp) return route.match.test(url)
  return url.includes(route.match)
}

export async function hermeticFetch (url, opts) {
  const state = mockState()
  state.fetchCalls.push({ url: String(url), opts })
  for (const route of state.fetchRoutes) {
    if (routeMatches(route, String(url))) {
      if (route.error) throw route.error
      const status = route.status ?? 200
      const headers = route.headers ?? {}
      const body = route.body ?? ''
      return new Response(body, { status, headers })
    }
  }
  throw new Error(`hermetic fetch: unexpected request ${url}`)
}
