/**
 * Input Validation Utilities
 * Validates text input before sending to translation API
 */

/**
 * Validates if input text is valid for translation
 * Returns true if valid, false if empty or contains only non-alphanumeric characters
 */
export function isValidTranslationInput(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Trim whitespace
  const trimmed = text.trim();

  // Check if empty
  if (trimmed.length === 0) {
    return false;
  }

  // Check if contains only non-alphanumeric characters (but allow unicode Filipino characters)
  // This regex matches strings that contain ONLY punctuation, spaces, and symbols
  const onlyNonAlphanumeric = /^[^a-zA-Z0-9\u0080-\uFFFF]+$/;

  if (onlyNonAlphanumeric.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Get user-friendly validation error message
 */
export function getValidationErrorMessage(text: string): string {
  if (!text || text.trim().length === 0) {
    return "Please enter a valid word or phrase to translate.";
  }

  const trimmed = text.trim();
  const onlyNonAlphanumeric = /^[^a-zA-Z0-9\u0080-\uFFFF]+$/;

  if (onlyNonAlphanumeric.test(trimmed)) {
    return "Please enter a valid word or phrase to translate.";
  }

  return "Please enter a valid word or phrase to translate.";
}
