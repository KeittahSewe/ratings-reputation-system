// Checks the two colour rules from the Chapter 4 handover that a linter cannot.
//
// 1. The AI accent (#00A9A5) never colours text. Against white it reaches
//    about 2.5 to 1, under the 4.5 to 1 that body text needs, so it is used as
//    a fill, a tag background or a left rule only.
// 2. Colours come from src/styles/tokens.css. A hex colour anywhere else is a
//    colour the palette does not know about.
//
// Run with `npm run check:design`. Exits 1 and lists every problem it finds.

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const srcDir = join(root, 'src')
const tokensFile = join(srcDir, 'styles', 'tokens.css')

const CHECKED = /\.(css|jsx|js)$/

// A text colour set to the AI accent, as a variable or as the hex value, in
// CSS (`color: var(--color-ai-accent)`) or in an inline style.
const AI_AS_TEXT = /(^|[^-\w])color\s*:\s*['"]?\s*(var\(\s*--color-ai-accent\s*\)|#00a9a5)/i
// SVG text takes its colour from fill.
const AI_AS_SVG_TEXT = /<text[^>]*(fill=["']?(var\(--color-ai-accent\)|#00a9a5))/i
// A hex colour: #abc, #abcd, #aabbcc or #aabbccdd, not part of a word or an
// HTML entity such as &#123;.
const HEX = /(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])/i

const problems = []

for (const name of readdirSync(srcDir, { recursive: true })) {
  const file = join(srcDir, name)
  if (!CHECKED.test(file)) continue
  const shown = relative(root, file).split(sep).join('/')
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    const where = `${shown}:${i + 1}`
    if (AI_AS_TEXT.test(line) || AI_AS_SVG_TEXT.test(line)) {
      problems.push(`${where}  AI accent used as a text colour: ${line.trim()}`)
    }
    if (file !== tokensFile && HEX.test(line)) {
      problems.push(`${where}  hex colour outside tokens.css: ${line.trim()}`)
    }
  })
}

if (problems.length > 0) {
  console.error(`check:design found ${problems.length} problem(s):`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log('check:design passed: no AI accent used as text, no hex colour outside tokens.css.')
