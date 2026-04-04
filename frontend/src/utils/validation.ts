/**
 * Input Validation Utilities
 * Validates text input before sending to the translation API.
 */

/**
 * Returns true if the text is a meaningful input suitable for translation.
 * Rejects: empty, symbols-only, numbers-only, highly-repeated characters.
 */
export function isValidTranslationInput(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  // Reject strings that contain only symbols (no letters or digits at all)
  if (/^[^a-zA-Z0-9\u0080-\uFFFF]+$/.test(trimmed)) return false;

  // Reject purely numeric strings ("1144555", "007", etc.)
  if (/^\d+$/.test(trimmed)) return false;

  // Analyse non-space characters only
  const noSpaces = trimmed.replace(/\s+/g, '');
  if (noSpaces.length === 0) return false;

  // Must have at least 20% alphabetic characters
  // Catches things like "111a", "##!a", mixed-junk with a stray letter
  const alphaCount = [...noSpaces].filter(c => /[a-zA-Z\u0080-\uFFFF]/.test(c)).length;
  if (alphaCount / noSpaces.length < 0.2) return false;

  // Reject excessive character repetition — same char makes up >75% of non-space
  // content and total non-space length is at least 4 (catches "aaaaaaa", "bbbbb", etc.)
  if (noSpaces.length >= 4) {
    const counts: Record<string, number> = {};
    for (const c of noSpaces.toLowerCase()) {
      counts[c] = (counts[c] || 0) + 1;
    }
    const maxCount = Math.max(...Object.values(counts));
    if (maxCount / noSpaces.length > 0.75) return false;
  }

  return true;
}

/**
 * Returns a user-friendly error message that explains WHY the input was rejected.
 */
export function getValidationErrorMessage(text: string): string {
  const trimmed = (text || '').trim();

  if (!trimmed) {
    return 'Please enter a word or sentence to translate.';
  }

  if (/^\d+$/.test(trimmed)) {
    return 'Numbers alone cannot be translated. Please enter a word or sentence.';
  }

  if (/^[^a-zA-Z0-9\u0080-\uFFFF]+$/.test(trimmed)) {
    return 'Symbols cannot be translated. Please enter a word or sentence.';
  }

  const noSpaces = trimmed.replace(/\s+/g, '');

  if (noSpaces.length >= 4) {
    const counts: Record<string, number> = {};
    for (const c of noSpaces.toLowerCase()) {
      counts[c] = (counts[c] || 0) + 1;
    }
    const maxCount = Math.max(...Object.values(counts));
    if (maxCount / noSpaces.length > 0.75) {
      return 'Invalid input. Please enter a meaningful word or sentence.';
    }
  }

  const alphaCount = [...noSpaces].filter(c => /[a-zA-Z\u0080-\uFFFF]/.test(c)).length;
  if (noSpaces.length > 0 && alphaCount / noSpaces.length < 0.2) {
    return 'Invalid input. Please enter a word or sentence with actual text.';
  }

  return 'Please enter a valid word or phrase to translate.';
}
