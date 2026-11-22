// After a submit with errors, moves focus to the first field marked invalid,
// so a keyboard or screen-reader user lands on what needs fixing.
export function focusFirstError(form) {
  setTimeout(() => form?.querySelector('[aria-invalid="true"]')?.focus(), 0)
}
