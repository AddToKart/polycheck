/**
 * Thin HTTP wrapper shared by every Polycheck k6 script.
 *
 * Every request carries an `operation` tag so `http_req_duration{operation:...}`
 * submetrics exist for each flow (k6 exports tagged submetrics only when a
 * threshold references them; see lib/thresholds.js).
 */
import http from 'k6/http'

export function endpoint(fixture, path) {
  return `${fixture.baseUrl}/api${path}`
}

/**
 * @param {object} fixture
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} method
 * @param {string} path path after /api, e.g. '/attendance/scan'
 * @param {{ token?: string, body?: any, operation: string, timeout?: string }} options
 */
export function request(fixture, method, path, options) {
  const { token, body, operation, timeout = '30s' } = options || {}
  if (!operation) throw new Error('request() requires an operation tag')
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const params = { headers, tags: { operation }, timeout }
  const url = endpoint(fixture, path)
  const payload = body === undefined ? null : JSON.stringify(body)
  switch (method) {
    case 'GET':
      return http.get(url, params)
    case 'POST':
      return http.post(url, payload, params)
    case 'PATCH':
      return http.patch(url, payload, params)
    case 'DELETE':
      return http.del(url, payload, params)
    default:
      throw new Error(`unsupported method ${method}`)
  }
}

/** Parses JSON without throwing (k6's Response.json() throws on HTML/empty). */
export function jsonOf(response) {
  if (!response || typeof response.body !== 'string' || response.body.length === 0) return null
  try {
    return response.json()
  } catch (error) {
    return null
  }
}

export function isOk(response) {
  return Boolean(response) && response.status >= 200 && response.status < 300
}
