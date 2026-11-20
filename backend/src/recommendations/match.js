// The recommendation engine from plan 3.5, with the matching rules confirmed
// on 19 November. Every function here is pure, so the Figure 4.11 example can
// be checked by unit tests without a database.
//
//   match = 100 x (0.5 x skill + 0.4 x reputation / 5 + 0.1 x hired_before)
//
//   skill         0 if the worker lists no skill in the job's category;
//                 otherwise 0.5 + 0.5 x (required skills held / required skills),
//                 or 1 when the job lists no required skills
//   reputation    the stored two-decimal score, or 0 with no reputation row
//   hired_before  1 if this client has a completed job with this worker
//
// A worker holds a required skill when one of their skills in the job's
// category contains it as a whole phrase, ignoring capitals: "Basic electrical
// wiring" holds "electrical wiring", but "Basic electrical" does not.

import { oneDecimal, twoDecimals } from '../reputation/score.js'
import { containsPhrase } from '../text/phrases.js'

export const MATCH_WEIGHTS = { skill: 0.5, reputation: 0.4, hiredBefore: 0.1 }

export const DISCLOSURE =
  'Ranked by the recommendation engine from skill match, reputation score and whether you have hired the worker before. ' +
  'It is not a paid placement and no worker can pay to appear higher.'

// Whether the worker's skill contains the required skill as a run of whole
// words, so "electrical wiring" is in "Basic electrical wiring" but "wiring"
// is not in "Rewiring". The matching lives in src/text/phrases.js, shared
// with the insights theme lexicon.
export function holdsSkill(workerSkill, requiredSkill) {
  return containsPhrase(workerSkill, requiredSkill)
}

// job: { category, required_skills }. skills: the worker's [{ skill_name, category }].
// held: [{ required, listed_as }], the required skills the worker holds and
// the skill of theirs that counted for each.
export function skillMatch(job, skills) {
  const inCategory = skills.filter((s) => s.category === job.category)
  const required = job.required_skills ?? []
  const held = []
  for (const name of required) {
    const by = inCategory.find((s) => holdsSkill(s.skill_name, name))
    if (by) held.push({ required: name, listed_as: by.skill_name })
  }
  const missing = required.filter((name) => !held.some((h) => h.required === name))

  let value = 0
  if (inCategory.length > 0) value = required.length === 0 ? 1 : 0.5 + (0.5 * held.length) / required.length
  return { value, in_category: inCategory.map((s) => s.skill_name), held, missing }
}

// Rounds half up to a whole number, cutting to 12 significant digits first
// as score.js does, so 88.5 cannot become 88.49999999999999.
function wholeNumber(value) {
  return Math.round(Number(value.toPrecision(12)))
}

// The three parts of the match in points out of 100, and their total.
export function matchScore({ skill, reputationScore, hiredBefore }) {
  const points = {
    skill: 100 * MATCH_WEIGHTS.skill * skill,
    reputation: (100 * MATCH_WEIGHTS.reputation * (reputationScore ?? 0)) / 5,
    hired_before: hiredBefore ? 100 * MATCH_WEIGHTS.hiredBefore : 0,
  }
  return { raw: points.skill + points.reputation + points.hired_before, points }
}

function firstName(name) {
  return name.trim().split(/\s+/)[0]
}

function listWords(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

function heldPhrase(h) {
  return h.listed_as.toLowerCase() === h.required.toLowerCase() ? h.required : `${h.required} (listed as ${h.listed_as})`
}

function skillSentence(name, job, skill) {
  const required = job.required_skills ?? []
  const n = required.length
  if (skill.in_category.length === 0) return `${name} lists no ${job.category} skills, so skill match adds nothing.`
  if (n === 0) {
    return `This job names no specific skills, and ${name} lists ${job.category} skills (${listWords(skill.in_category)}).`
  }
  if (skill.held.length === n) {
    const how = n === 1 ? 'the skill' : n === 2 ? 'both skills' : `all ${n} skills`
    return `${name} holds ${how} this job needs: ${listWords(skill.held.map(heldPhrase))}.`
  }
  if (skill.held.length === 0) {
    const none = n === 1 ? 'not the skill' : n === 2 ? 'neither of the 2 skills' : `none of the ${n} skills`
    return `${name} lists ${job.category} skills (${listWords(skill.in_category)}), but ${none} this job needs.`
  }
  return (
    `${name} holds ${skill.held.length} of the ${n} skills this job needs: ${listWords(skill.held.map(heldPhrase))}, ` +
    `not ${listWords(skill.missing)}.`
  )
}

function reputationSentence(name, reputation) {
  if (!reputation) return `No reviews yet, so reputation adds nothing and ${name} is listed after every worker with a score.`
  const shown = oneDecimal(reputation.score).toFixed(1)
  const reviews = reputation.review_count === 1 ? '1 review' : `${reputation.review_count} reviews`
  if (reputation.provisional) return `Reputation score ${shown}, Provisional because it rests on ${reviews}.`
  return `Reputation score ${shown} from ${reviews}.`
}

function hiredSentence(name, hiredBefore) {
  return hiredBefore ? 'You have hired this worker before.' : `You have not hired ${name} before.`
}

// Workers with a reputation row come first, then those without (plan 3.4's
// cold-start rule). Within each group: match, then stored score, then
// completed jobs, then name and id, so the order never depends on the
// order the database returned rows in.
function compare(a, b) {
  const scored = Number(Boolean(b.reputation)) - Number(Boolean(a.reputation))
  if (scored !== 0) return scored
  return (
    b.raw - a.raw ||
    (b.reputation?.score ?? 0) - (a.reputation?.score ?? 0) ||
    b.completed_jobs - a.completed_jobs ||
    a.worker.name.localeCompare(b.worker.name) ||
    a.worker.id.localeCompare(b.worker.id)
  )
}

// job: { category, required_skills }.
// candidates: [{ worker: { id, name }, skills, reputation (or null), completed_jobs }].
// hiredBefore: a Set of worker ids this client has completed a job with.
// Returns the ranked cards. Every card carries three explanation sentences,
// one per term, so phase 8 can check that each reason is present.
export function rankWorkers(job, candidates, hiredBefore = new Set()) {
  const cards = candidates.map((c) => {
    const skill = skillMatch(job, c.skills)
    const hired = hiredBefore.has(c.worker.id)
    const { raw, points } = matchScore({ skill: skill.value, reputationScore: c.reputation?.score, hiredBefore: hired })
    const name = firstName(c.worker.name)
    return {
      ...c,
      raw,
      skill,
      hired,
      points,
      explanation: [skillSentence(name, job, skill), reputationSentence(name, c.reputation), hiredSentence(name, hired)],
    }
  })
  cards.sort(compare)

  return cards.map((card, i) => ({
    rank: i + 1,
    worker: card.worker,
    // Skills in the job's category first, as the card shows them.
    skills: [...card.skills].sort(
      (a, b) =>
        Number(b.category === job.category) - Number(a.category === job.category) ||
        a.skill_name.localeCompare(b.skill_name),
    ),
    completed_jobs: card.completed_jobs,
    reputation: card.reputation,
    match: wholeNumber(card.raw),
    match_points: {
      skill: twoDecimals(card.points.skill),
      reputation: twoDecimals(card.points.reputation),
      hired_before: twoDecimals(card.points.hired_before),
    },
    skill_match: twoDecimals(card.skill.value),
    skills_held: card.skill.held,
    skills_missing: card.skill.missing,
    hired_before: card.hired,
    explanation: card.explanation,
  }))
}
