import re
from collections import Counter


def is_valid_translation_input(text: str) -> tuple[bool, str]:
    """
    Returns (is_valid, error_message).
    Rejects: empty, symbols-only, numbers-only, highly-repeated characters.
    """
    if not text or not text.strip():
        return False, "Input text cannot be empty."

    trimmed = text.strip()

    # Reject purely numeric strings
    if re.fullmatch(r"\d+", trimmed):
        return False, "Numbers alone cannot be translated. Please enter a word or sentence."

    # Reject strings with only symbols
    if re.fullmatch(r"[^a-zA-Z0-9\u0080-\uFFFF]+", trimmed):
        return False, "Symbols cannot be translated. Please enter a word or sentence."

    no_spaces = re.sub(r"\s+", "", trimmed)
    if not no_spaces:
        return False, "Input text cannot be empty."

    # Must have at least 20% alphabetic characters
    alpha_count = sum(1 for c in no_spaces if c.isalpha())
    if alpha_count / len(no_spaces) < 0.2:
        return False, "Invalid input. Please enter a word or sentence with actual text."

    # Reject excessive character repetition (same char >75%, min 4 chars)
    if len(no_spaces) >= 4:
        counts = Counter(no_spaces.lower())
        most_common_count = counts.most_common(1)[0][1]
        if most_common_count / len(no_spaces) > 0.75:
            return False, "Invalid input. Please enter a meaningful word or sentence."

    return True, ""
