const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * RFC-4648 base64 encoder for arbitrary bytes. React Native runtime APIs are
 * inconsistent about btoa availability, so report screenshot streaming uses
 * this deterministic encoder (unit-tested against known vectors).
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let output = ''
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const remaining = bytes.length - offset
    const first = bytes[offset]
    const second = remaining > 1 ? bytes[offset + 1] : 0
    const third = remaining > 2 ? bytes[offset + 2] : 0
    if (remaining >= 3) {
      output += BASE64_ALPHABET[first >> 2]
      output += BASE64_ALPHABET[((first & 0x03) << 4) | (second >> 4)]
      output += BASE64_ALPHABET[((second & 0x0f) << 2) | (third >> 6)]
      output += BASE64_ALPHABET[third & 0x3f]
    } else if (remaining === 2) {
      output += BASE64_ALPHABET[first >> 2]
      output += BASE64_ALPHABET[((first & 0x03) << 4) | (second >> 4)]
      output += BASE64_ALPHABET[(second & 0x0f) << 2]
      output += '='
    } else {
      output += BASE64_ALPHABET[first >> 2]
      output += BASE64_ALPHABET[(first & 0x03) << 4]
      output += '=='
    }
  }
  return output
}
