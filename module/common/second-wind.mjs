/**
 * Second Wind (Core Rulebook p.146, PDF 154): "If you are reduced to one-half your maximum hit points
 * or less, you can catch a second wind as a swift action. This action heals one-quarter of your full
 * hit point total (rounded down) or a number of hit points equal to your Constitution score, whichever
 * is greater. You can catch a second wind only once per day. [...] Certain feats or talents may allow
 * you to catch a second wind more often, but never more than once in a single encounter."
 */

/** Hit points restored by a second wind. A target without a Constitution score (droid) only gets the quarter. */
export function secondWindHealing(maxHealth, constitution) {
    const quarter = Math.floor((Number(maxHealth) || 0) / 4);
    const con = Number.isFinite(Number(constitution)) ? Number(constitution) : 0;
    return Math.max(quarter, con);
}

/** A second wind needs current hit points at or below half the maximum (and a positive maximum). */
export function meetsSecondWindThreshold(value, maxHealth) {
    return maxHealth > 0 && value <= maxHealth / 2;
}

/** Index of the first unspent second wind slot, or -1 when none is left. */
export function firstFreeSecondWind(perDay, spentFlags = {}) {
    for (let i = 0; i < perDay; i++) {
        if (!spentFlags?.[i]) return i;
    }
    return -1;
}
