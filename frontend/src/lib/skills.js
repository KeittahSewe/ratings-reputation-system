// Splits "Electrical wiring, lighting installation" into skills for a job's
// required skills, dropping blanks and repeats that differ only in capitals,
// as the API does when it saves them.
export function parseSkills(text) {
  const seen = new Set()
  const skills = []
  for (const part of text.split(',')) {
    const skill = part.trim().replace(/\s+/g, ' ')
    if (!skill || seen.has(skill.toLowerCase())) continue
    seen.add(skill.toLowerCase())
    skills.push(skill)
  }
  return skills
}
