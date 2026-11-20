// Calendar months in Africa/Nairobi for the insights period (confirmed
// 20 November). Nairobi is UTC+03:00 all year with no daylight saving, so a
// fixed offset gives the same month boundaries as a time zone database.
//
// 3m is the current month and the two before it; 6m is the current month and
// the five before it. The current month is still running and is marked partial.

export const TIME_ZONE = 'Africa/Nairobi'
const OFFSET_MS = 3 * 60 * 60 * 1000

export const PERIODS = Object.freeze({ '3m': 3, '6m': 6 })
export const DEFAULT_PERIOD = '6m'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function pad(n) {
  return String(n).padStart(2, '0')
}

// The Nairobi calendar month a moment falls in, as 'YYYY-MM'.
export function monthKey(date) {
  const local = new Date(new Date(date).getTime() + OFFSET_MS)
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}`
}

// Midnight in Nairobi on the first of the month, as a Date.
function monthStart(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex, 1) - OFFSET_MS)
}

// "March 2026" for '2026-03'.
export function monthName(key) {
  const [year, month] = key.split('-').map(Number)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

// The months of a period, oldest first: [{ month: 'YYYY-MM', start, end, partial }],
// where start is included and end is not. The last one is the current month.
export function periodMonths(period, now = new Date()) {
  const count = Object.hasOwn(PERIODS, period) ? PERIODS[period] : 0
  if (!count) throw new TypeError(`period must be one of ${Object.keys(PERIODS).join(', ')}, not ${period}.`)
  const local = new Date(new Date(now).getTime() + OFFSET_MS)
  const year = local.getUTCFullYear()
  const month = local.getUTCMonth()

  const months = []
  for (let back = count - 1; back >= 0; back--) {
    // Date.UTC accepts month indexes below 0 and rolls back into the year before.
    const start = monthStart(year, month - back)
    const end = monthStart(year, month - back + 1)
    months.push({ month: monthKey(start), start, end, partial: back === 0 })
  }
  return months
}
