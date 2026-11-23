// Number and date formats shared by the screens. Pure functions, tested in
// format.test.js.

// Rounds half up to one decimal, as the API does (src/reputation/score.js):
// the product is cut to 12 significant digits first so 4.25 does not land at
// 42.4999... and round down.
export function oneDecimal(value) {
  return Math.round(Number((value * 10).toPrecision(12))) / 10
}

// A score or component as shown on every screen: one decimal, always with
// the decimal (4 shows as 4.0).
export function formatScore(value) {
  return oneDecimal(value).toFixed(1)
}

// Two decimals, for the worked formula in the How this is calculated panel.
export function formatStored(value) {
  return Number(value).toFixed(2)
}

const TIME_ZONE = 'Africa/Nairobi'

// 18 August 2026
export function formatDate(iso) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE }).format(new Date(iso))
}

// January 2025
export function formatMonthYear(iso) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: TIME_ZONE }).format(new Date(iso))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// 01 Sep 2026, as in the job table of Figure 4.9. Built from numeric parts
// because some browsers abbreviate September as "Sept".
export function formatShortDate(iso) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'numeric', year: 'numeric', timeZone: TIME_ZONE })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  )
  return `${parts.day} ${MONTHS[Number(parts.month) - 1]} ${parts.year}`
}

// Whole-number percentages that add up to 100, by largest remainder (the
// API's insights use the same rule). counts: { positive, neutral, negative }.
// Returns null when there is nothing to divide.
export function percentages(counts) {
  const keys = Object.keys(counts)
  const total = keys.reduce((sum, key) => sum + counts[key], 0)
  if (total === 0) return null
  const raw = keys.map((key) => ({ key, exact: (counts[key] * 100) / total }))
  const result = Object.fromEntries(raw.map(({ key, exact }) => [key, Math.floor(exact)]))
  let left = 100 - Object.values(result).reduce((sum, v) => sum + v, 0)
  const byRemainder = [...raw].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))
  for (const { key } of byRemainder) {
    if (left === 0) break
    result[key] += 1
    left -= 1
  }
  return result
}

// "1 review", "41 reviews"
export function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}
