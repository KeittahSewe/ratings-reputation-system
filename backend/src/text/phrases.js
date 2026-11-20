// Whole-phrase matching, shared by the recommendation skill rule (#51) and
// the insights theme lexicon (#52), so both read text the same way.

// Lower-case words, splitting on anything that is not a letter or a digit.
// An apostrophe splits too, so "didn't" becomes "didn" and "t"; a phrase
// written with the apostrophe splits the same way and still matches.
export function words(text) {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

// Whether the run of words `need` appears in `have` as whole words, in order.
// Both are arrays from words().
export function hasWords(have, need) {
  if (need.length === 0) return false
  for (let i = 0; i + need.length <= have.length; i++) {
    if (need.every((word, k) => have[i + k] === word)) return true
  }
  return false
}

// Whether text contains phrase as whole words, ignoring capitals:
// "electrical wiring" is in "Basic electrical wiring", but "wiring" is not
// in "Rewiring" and "late" is not in "lately".
export function containsPhrase(text, phrase) {
  return hasWords(words(text), words(phrase))
}
