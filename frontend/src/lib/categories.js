// The six job and skill categories the API accepts (backend/src/categories.js),
// with the label each shows as.
export const CATEGORIES = [
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'painting', label: 'Painting' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'carpentry', label: 'Carpentry' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'tutoring', label: 'Tutoring' },
]

export const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label ?? value
