#!/usr/bin/env node
/**
 * Validate archived PostgreSQL WAL continuity for the default 16 MiB segment
 * size, following timeline history from a physical backup's start timeline.
 *
 * Segment math is deliberately performed with BigInt. PostgreSQL has 256
 * 16 MiB segments per 4 GiB XLogId, so ...000000FF is followed by
 * ...000100000000. Timeline changes are read from NNNNNNNN.history; timeline
 * IDs are never incremented as part of segment arithmetic.
 */
import { readFileSync, readdirSync } from 'node:fs'

const SEGMENT_BYTES = 16n * 1024n * 1024n
const SEGMENTS_PER_XLOG_ID = 0x100n
const UINT32_MAX = 0xffffffffn
const DEFAULT_MAX_CHAIN_SEGMENTS = 1_000_000n
const SEGMENT_RE = /^([0-9A-F]{8})([0-9A-F]{8})(000000[0-9A-F]{2})$/
const SEGMENT_RE_I = /^([0-9A-F]{8})([0-9A-F]{8})([0-9A-F]{8})$/i
const BACKUP_RE = /^([0-9A-F]{24})\.([0-9A-F]{8})\.backup$/
const BACKUP_RE_I = /^([0-9A-F]{24})\.([0-9A-F]{8})\.backup$/i
const HISTORY_RE = /^([0-9A-F]{8})\.history$/
const HISTORY_RE_I = /^([0-9A-F]{8})\.history$/i

const die = (message, status = 1) => {
  console.error(`verify-wal-chain: ${message}`)
  process.exit(status)
}

const [, , labelPath, archiveDir] = process.argv
if (!labelPath || !archiveDir) {
  die('usage: verify-wal-chain.mjs <backup_label_path> <wal_archive_dir>', 2)
}

const parseUint32Hex = (value, context) => {
  const parsed = BigInt(`0x${value}`)
  if (parsed < 0n || parsed > UINT32_MAX) die(`${context} is outside uint32 range`)
  return parsed
}

const parseSegment = (name) => {
  const match = SEGMENT_RE.exec(name)
  if (!match) return null
  const timeline = parseUint32Hex(match[1], `${name} timeline`)
  if (timeline === 0n) die(`invalid zero timeline in ${name}`)
  return {
    name,
    timeline,
    position: parseUint32Hex(match[2], `${name} XLogId`) * SEGMENTS_PER_XLOG_ID +
      parseUint32Hex(match[3], `${name} segment`),
  }
}

const segmentName = (timeline, position) => {
  if (position < 0n) die('negative WAL segment position')
  const log = position / SEGMENTS_PER_XLOG_ID
  const segment = position % SEGMENTS_PER_XLOG_ID
  if (timeline > UINT32_MAX || log > UINT32_MAX) die('WAL position exceeds PostgreSQL filename range')
  const hex8 = (value) => value.toString(16).toUpperCase().padStart(8, '0')
  return `${hex8(timeline)}${hex8(log)}${hex8(segment)}`
}

const parseLsn = (value, context) => {
  const match = /^([0-9A-F]+)\/([0-9A-F]+)$/i.exec(value)
  if (!match) die(`invalid LSN '${value}' in ${context}`)
  const high = BigInt(`0x${match[1]}`)
  const low = BigInt(`0x${match[2]}`)
  if (high > UINT32_MAX || low > UINT32_MAX) die(`LSN '${value}' is outside PostgreSQL range`)
  return (high << 32n) + low
}

const maxChainSegmentsText = process.env.PITR_MAX_CHAIN_SEGMENTS || DEFAULT_MAX_CHAIN_SEGMENTS.toString()
if (!/^[1-9][0-9]*$/.test(maxChainSegmentsText)) die('PITR_MAX_CHAIN_SEGMENTS must be a positive integer', 2)
const maxChainSegments = BigInt(maxChainSegmentsText)
if (maxChainSegments > 10_000_000n) die('PITR_MAX_CHAIN_SEGMENTS must not exceed 10000000', 2)

const label = readFileSync(labelPath, 'utf8')
const startMatch = label.match(/START WAL LOCATION:.*\(file ([0-9A-F]{24})\)/)
if (!startMatch) die(`no uppercase START WAL LOCATION file entry in ${labelPath}`, 2)
const start = parseSegment(startMatch[1])
if (!start) die(`base start filename is invalid for 16 MiB WAL: ${startMatch[1]}`, 2)

const entries = readdirSync(archiveDir, { withFileTypes: true })
const segments = new Map()
const historyEntries = []
let backupHistoryCount = 0

for (const entry of entries) {
  if (!entry.isFile()) continue
  const { name } = entry
  if ((SEGMENT_RE_I.test(name) || BACKUP_RE_I.test(name) || HISTORY_RE_I.test(name)) &&
      !(SEGMENT_RE.test(name) || BACKUP_RE.test(name) || HISTORY_RE.test(name))) {
    die(`PostgreSQL archive filename must be uppercase: ${name}`)
  }

  const segment = parseSegment(name)
  if (segment) {
    segments.set(`${segment.timeline}:${segment.position}`, segment)
    continue
  }
  if (SEGMENT_RE_I.test(name)) die(`invalid 16 MiB WAL segment number: ${name}`)

  const backupMatch = BACKUP_RE.exec(name)
  if (backupMatch) {
    const baseSegment = parseSegment(backupMatch[1])
    if (!baseSegment) die(`invalid backup-history segment: ${name}`)
    if (BigInt(`0x${backupMatch[2]}`) >= SEGMENT_BYTES) {
      die(`backup-history offset is outside a 16 MiB segment: ${name}`)
    }
    backupHistoryCount += 1
    continue
  }
  if (BACKUP_RE_I.test(name)) die(`invalid backup-history filename: ${name}`)

  const historyMatch = HISTORY_RE.exec(name)
  if (historyMatch) {
    historyEntries.push({ name, timeline: parseUint32Hex(historyMatch[1], name) })
    continue
  }
  if (HISTORY_RE_I.test(name)) die(`invalid timeline-history filename: ${name}`)
}

if (segments.size === 0) die(`no completed uppercase WAL segments found in ${archiveDir}`)

const parents = new Map()
for (const history of historyEntries) {
  if (history.timeline === 0n) die(`invalid zero timeline history: ${history.name}`)
  const historyPath = `${archiveDir}/${history.name}`
  const text = readFileSync(historyPath, 'utf8')
  if (Buffer.byteLength(text) > 1024 * 1024) die(`timeline history is unreasonably large: ${history.name}`)
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
  if (lines.length === 0) die(`timeline history has no ancestry entries: ${history.name}`)
  let previousTimeline = 0n
  let previousSwitchLsn = 0n
  const parsedLines = []
  for (const [index, line] of lines.entries()) {
    const lineMatch = /^(\d+)\s+([0-9A-F]+\/[0-9A-F]+)(?:\s+.*)?$/i.exec(line)
    if (!lineMatch) {
      die(`invalid ancestry line in ${history.name}: ${JSON.stringify(line)}`)
    }
    const ancestor = BigInt(lineMatch[1])
    const ancestorSwitchLsn = parseLsn(lineMatch[2], history.name)
    if (ancestor <= previousTimeline || ancestor >= history.timeline) die(`non-increasing ancestry in ${history.name}`)
    if (index > 0 && ancestorSwitchLsn <= previousSwitchLsn) die(`non-increasing switch LSN in ${history.name}`)
    previousTimeline = ancestor
    previousSwitchLsn = ancestorSwitchLsn
    parsedLines.push({ ancestor, ancestorSwitchLsn })
  }
  const lastLine = parsedLines.at(-1)
  const parent = lastLine.ancestor
  if (parent <= 0n || parent >= history.timeline) die(`invalid parent timeline in ${history.name}`)
  const switchLsn = lastLine.ancestorSwitchLsn
  if (switchLsn === 0n) die(`zero switch LSN in ${history.name}`)
  parents.set(history.timeline.toString(), { parent, switchLsn, name: history.name })
}

const reachable = new Set([start.timeline.toString()])
let changed = true
while (changed) {
  changed = false
  for (const [child, transition] of parents) {
    if (reachable.has(transition.parent.toString()) && !reachable.has(child)) {
      reachable.add(child)
      changed = true
    }
  }
}

const leafTimeline = [...reachable].map(BigInt).reduce((highest, value) => value > highest ? value : highest)
const transitions = []
let cursorTimeline = leafTimeline
while (cursorTimeline !== start.timeline) {
  const transition = parents.get(cursorTimeline.toString())
  if (!transition || !reachable.has(transition.parent.toString())) {
    die(`timeline ${cursorTimeline} has no complete history path to base timeline ${start.timeline}`)
  }
  transitions.unshift({ child: cursorTimeline, ...transition })
  cursorTimeline = transition.parent
}

let currentTimeline = start.timeline
let currentPosition = start.position
let checked = 0n
const checkRange = (timeline, first, last) => {
  if (last < first) die(`timeline ${timeline} moves backwards from segment ${first} to ${last}`)
  const count = last - first + 1n
  checked += count
  if (checked > maxChainSegments) {
    die(`chain exceeds PITR_MAX_CHAIN_SEGMENTS=${maxChainSegments}; refusing unbounded verification`)
  }
  for (let position = first; position <= last; position += 1n) {
    const expected = segmentName(timeline, position)
    if (!segments.has(`${timeline}:${position}`)) die(`missing interior WAL segment ${expected}`)
  }
}

for (const transition of transitions) {
  if (transition.parent !== currentTimeline) die(`non-contiguous timeline path at ${transition.name}`)
  const childStart = transition.switchLsn / SEGMENT_BYTES
  const parentEnd = (transition.switchLsn - 1n) / SEGMENT_BYTES
  checkRange(currentTimeline, currentPosition, parentEnd)
  currentTimeline = transition.child
  currentPosition = childStart
}

const leafPositions = [...segments.values()]
  .filter((segment) => segment.timeline === currentTimeline)
  .map((segment) => segment.position)
if (leafPositions.length === 0) die(`no WAL segments exist on selected timeline ${currentTimeline}`)
const newestPosition = leafPositions.reduce((highest, value) => value > highest ? value : highest)
checkRange(currentTimeline, currentPosition, newestPosition)

console.log(
  `verify-wal-chain: continuous ${checked}-segment path from ${start.name} to ${segmentName(currentTimeline, newestPosition)} ` +
  `across ${transitions.length} timeline transition(s); ${backupHistoryCount} backup-history file(s) recognized`,
)
