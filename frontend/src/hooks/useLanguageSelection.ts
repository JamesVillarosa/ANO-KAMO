import { useState, useCallback } from 'react';

type Langs = [string, string, string];

/**
 * Pure utility: apply smart-swap logic to a langs array.
 * If `code` already occupies another active slot (0..count-1),
 * that slot gets the old value at `slot`.
 */
export function computeSmartSwap(
    langs: string[],
    slot: number,
    code: string,
    count: 2 | 3,
): string[] {
    const next = [...langs];
    const old = next[slot];
    for (let i = 0; i < count; i++) {
        if (i !== slot && next[i] === code) {
            next[i] = old;
            break;
        }
    }
    next[slot] = code;
    return next;
}

/**
 * Shared hook for managing language selections across screens.
 * Provides smart swap: selecting a language already held by another
 * active slot swaps the two rather than allowing duplicates.
 */
export function useLanguageSelection(
    count: 2 | 3,
    initialLangs: Langs = ['tl', 'ceb', 'hil'],
) {
    const [langs, setLangsState] = useState<Langs>(initialLangs);

    const setLang = useCallback((slot: number, code: string) => {
        setLangsState(prev => {
            return computeSmartSwap(prev, slot, code, count) as Langs;
        });
    }, [count]);

    const swap = useCallback((i: number, j: number) => {
        setLangsState(prev => {
            const next: Langs = [...prev] as Langs;
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });
    }, []);

    return { langs, setLang, swap };
}
