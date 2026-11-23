// Checks for the review form (Figure 4.10). The API allows 5000 characters;
// the form keeps to the figure's 1000. A review needs at least one letter or
// number, as the API does, because text with none is empty once the
// inference service cleans it.
export const REVIEW_MAX = 1000
const HAS_WORDS = /[\p{L}\p{N}]/u

export function validateReview({ rating, text }) {
  const errors = {}
  if (!rating) errors.rating = 'Choose a rating from 1 to 5 stars.'
  const trimmed = text.trim()
  if (!trimmed || !HAS_WORDS.test(trimmed)) errors.text = 'Write a few words about the job.'
  else if (trimmed.length > REVIEW_MAX) errors.text = `Keep the review to ${REVIEW_MAX} characters.`
  return errors
}
