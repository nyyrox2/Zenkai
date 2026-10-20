export interface Cue {
  start: number
  end: number
  text: string
}

function parseTimestamp(str?: string): number {
  if (!str) return -1
  const parts = str.replace(',', '.').trim().split(':')
  if (parts.length === 3) return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
  if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
  return -1
}

/** SRT + WebVTT + ASS parser. */
export function parseSubtitleText(content: string): Cue[] {
  if (!content) return []
  const cues: Cue[] = []

  // Check if content is ASS / SSA format
  if (content.includes('Dialogue:')) {
    const lines = content.replace(/\r\n?/g, '\n').split('\n')
    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('Dialogue:')) continue
      const rest = line.slice(9).trim()
      const parts = rest.split(',')
      if (parts.length < 10) continue
      const start = parseTimestamp(parts[1])
      const end = parseTimestamp(parts[2])
      if (start < 0 || end <= start) continue
      const text = parts
        .slice(9)
        .join(',')
        .replace(/\{[^\}]*\}/g, '')
        .replace(/\\N/gi, '\n')
        .replace(/\\n/gi, '\n')
        .replace(/\\h/gi, ' ')
        .trim()
      if (text) cues.push({ start, end, text })
    }
    if (cues.length) return cues
  }

  const blocks = content.replace(/\r\n?/g, '\n').split(/\n\s*\n/)
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const at = lines.findIndex((l) => l.includes('-->'))
    if (at < 0) continue
    const [a, b] = lines[at].split('-->').map((s) => s.trim().split(' ')[0])
    const start = parseTimestamp(a)
    const end = parseTimestamp(b)
    if (start < 0 || end <= start) continue
    const text = lines
      .slice(at + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
    if (text) cues.push({ start, end, text })
  }
  return cues
}

export function findActiveCue(cues: Cue[], time: number, offset = 0): string | null {
  const t = time + offset
  for (const c of cues) if (t >= c.start && t <= c.end) return c.text
  return null
}
