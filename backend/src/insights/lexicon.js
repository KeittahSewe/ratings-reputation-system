// The theme lexicon for the insights dashboard (plan C1, confirmed 12 November;
// matching rules confirmed 20 November).
//
// A theme is found in a sentence when the sentence contains one of its
// triggers as a whole phrase, ignoring capitals (src/text/phrases.js). A
// trigger only decides the topic. Whether the mention is good or bad comes
// from the sentence's DistilBERT label, so "did not reply" and "replied
// quickly" both mark communication, and there is no negation list.
//
// There is no stemming: every form a trigger should match is listed. One
// sentence can mark two themes ("he rescheduled and arrived late" is advance
// notice and punctuality). Known false hit: "late" in "late afternoon".
//
// Each theme carries a fixed piece of advice for each polarity. The guidance
// adds the counts (src/insights/guidance.js); nothing is generated.
//
// Worker themes come from plan C1. Client themes come from the labelling
// guideline's rule on reviews of clients (paying on time, clear instructions,
// being reachable, changing the job halfway), which the frozen marketplace
// test set was labelled against.

import { words } from '../text/phrases.js'

const COMMUNICATION_TRIGGERS = [
  'explain', 'explained', 'explaining',
  'update', 'updated', 'updates',
  'responsive', 'unresponsive',
  'reply', 'replied', 'replies', 'did not reply', "didn't reply",
  'reachable', 'unreachable',
  'answered', 'called back', 'kept me informed',
]

const WORKER_THEMES = [
  {
    key: 'punctuality',
    name: 'Punctuality and arriving on time',
    triggers: [
      'on time', 'punctual', 'late', 'early',
      'arrive', 'arrived', 'arriving',
      'showed up', 'turned up', 'kept me waiting', 'no show',
    ],
    advice: {
      negative: 'Confirm the arrival time the day before and leave room for traffic.',
      positive: 'Mention punctuality in your profile bio, because a client reading your profile sees only your score.',
    },
  },
  {
    key: 'tidiness',
    name: 'Tidiness and clearing up afterwards',
    triggers: [
      'clean', 'cleaned', 'cleaned up', 'tidy', 'tidied',
      'mess', 'messy', 'left the site', 'dust', 'debris', 'swept',
    ],
    advice: {
      negative: 'Set aside the last part of every job for clearing up and taking away offcuts and debris.',
      positive: 'Mention in your profile bio that you leave the site clean, since clients comparing workers look for it.',
    },
  },
  {
    key: 'communication',
    name: 'Communication and explaining the work',
    triggers: COMMUNICATION_TRIGGERS,
    advice: {
      negative: 'Explain the problem and your plan before you start, and reply to messages the same day.',
      positive: 'Keep explaining the problem before you start work, because clients notice it and say so.',
    },
  },
  {
    key: 'quality',
    name: 'Quality of work',
    triggers: [
      'neat', 'sloppy', 'redo', 'redone', 'professional',
      'quality', 'workmanship', 'poor job', 'shoddy',
    ],
    advice: {
      negative: 'Check the finished work with the client before you leave, so anything that needs redoing is caught on the day.',
      positive: 'Describe a recent finished job in your profile bio so new clients can see the standard you work to.',
    },
  },
  {
    key: 'pricing',
    name: 'Pricing',
    triggers: [
      'price', 'prices', 'fair price', 'overcharged', 'overcharge',
      'quote', 'quoted', 'charged', 'expensive', 'cheap', 'affordable',
    ],
    advice: {
      negative: 'Give a written quote before you start, and agree any extra charge before you do the extra work.',
      positive: 'Keep quoting before you start, because clients mention that your prices were fair.',
    },
  },
  {
    key: 'advance_notice',
    name: 'Advance notice of delays',
    triggers: [
      'warned', 'no warning', 'rescheduled', 'told me late',
      'let me know', 'without telling', 'did not tell', "didn't tell",
      'heads up', 'called ahead',
    ],
    advice: {
      negative: 'Tell clients about a delay as soon as you know about it.',
      positive: 'Keep telling clients early when plans change, because they notice it.',
    },
  },
]

const CLIENT_THEMES = [
  {
    key: 'payment',
    name: 'Paying as agreed',
    triggers: [
      'paid', 'pay', 'pays', 'payment', 'late payment',
      'm-pesa', 'mpesa', 'balance',
    ],
    advice: {
      negative: 'Agree when you will pay before the job starts, and pay on the day the work is done.',
      positive: 'Keep paying on the day the work is done, because workers mention it.',
    },
  },
  {
    key: 'instructions',
    name: 'Clear instructions',
    triggers: ['instructions', 'clear', 'unclear', 'brief', 'described'],
    advice: {
      negative: 'Put the whole job in the description, including measurements and what is already on site.',
      positive: 'Keep writing detailed job descriptions, because workers say your instructions are clear.',
    },
  },
  {
    key: 'communication',
    name: 'Communication and being reachable',
    triggers: [...COMMUNICATION_TRIGGERS, 'picked up'],
    advice: {
      negative: 'Keep your phone on while a job is running, and reply to the worker the same day.',
      positive: 'Keep being reachable while a job is running, because workers say it helps.',
    },
  },
  {
    key: 'scope',
    name: 'Changing the job halfway',
    triggers: [
      'changed the job', 'changed his mind', 'changed her mind',
      'extra work', 'more work', 'halfway',
    ],
    advice: {
      negative: 'Agree any extra work and its price with the worker before you ask for it.',
      positive: 'Keep the job to what was agreed, because workers notice when it stays the same.',
    },
  },
]

// Triggers are split into words once, here, rather than on every review.
function compile(themes) {
  return Object.freeze(
    themes.map((theme) => Object.freeze({ ...theme, triggerWords: theme.triggers.map(words) })),
  )
}

export const LEXICON = Object.freeze({
  worker: compile(WORKER_THEMES),
  client: compile(CLIENT_THEMES),
})

export function lexiconFor(role) {
  const themes = LEXICON[role]
  if (!themes) throw new TypeError(`role must be 'client' or 'worker', not ${role}.`)
  return themes
}
