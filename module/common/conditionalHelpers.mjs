/**
 * Damage types are authored as free text on `damageType` changes, in SWSE's own notation: a base
 * type with an optional parenthesised qualifier list ("Energy", "Energy (Ion)",
 * "Energy (Sonic, Stun)"), and several types per weapon separated by ", ", " or " or ", or ".
 *
 * Two things follow from that notation and both used to be handled by exact string comparison,
 * which silently mis-answered every qualified type:
 *   - a comma inside the parentheses is not a type separator, so splitting has to respect nesting
 *   - "Energy (Ion)" IS Energy damage, so a test for "Energy" has to match it, while a test for
 *     "Energy (Ion)" must NOT match plain "Energy"
 */
import {COMMMA_LIST, toNumber} from "./util.mjs";

/**
 * Splits an authored damage type string into single damage types without splitting inside
 * parentheses ("Energy (Sonic, Stun)" stays one type).
 *
 * @param {string} value
 * @return {string[]}
 */
function splitOutsideParens(value) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i++) {
        const c = value[i];
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
        else if (depth === 0) {
            const rest = value.slice(i);
            const match = rest.match(COMMMA_LIST);
            if (match && match.index === 0) {
                parts.push(value.slice(start, i));
                i += match[0].length - 1;
                start = i + 1;
            }
        }
    }
    parts.push(value.slice(start));
    return parts;
}

/**
 * Normalises whatever `applyDamage` and the attack pipeline hand around - a single string, a
 * comma/or separated list, an array of either - into an array of single damage types.
 *
 * @param {string|string[]|null|undefined} damageType
 * @return {string[]}
 */
export function resolveDamageTypes(damageType) {
    const raw = Array.isArray(damageType) ? damageType : [damageType];
    return raw
        .filter(v => v !== null && v !== undefined)
        .flatMap(v => splitOutsideParens(String(v)))
        .map(v => v.trim())
        .filter(v => !!v);
}

/**
 * @param {string} damageType
 * @return {{base: string, qualifiers: string[]}}
 */
function parseDamageType(damageType) {
    const text = String(damageType ?? "").trim();
    const open = text.indexOf('(');
    if (open < 0) return {base: text.toLowerCase(), qualifiers: []};
    const close = text.lastIndexOf(')');
    const inner = text.slice(open + 1, close < 0 ? text.length : close);
    return {
        base: text.slice(0, open).trim().toLowerCase(),
        qualifiers: inner.split(/,| or | and /).map(q => q.trim().toLowerCase()).filter(q => !!q)
    };
}

/**
 * Case-insensitive damage type test.
 *
 * A candidate without qualifiers matches any qualified variant of the same base type ("Energy"
 * matches "Energy (Ion)") and it also matches a type carrying it as a qualifier, because the pack
 * data names descriptors on their own: the Verpine template's DR reads `modifier: "Ion"` while the
 * damage reads "Energy (Ion)".  A qualified candidate needs its base and all of its qualifiers
 * present, so "Energy (Ion)" does not match plain "Energy".
 *
 * @param {string[]} damageTypes the damage being dealt
 * @param {...string} candidates
 * @return {boolean}
 */
export function hasDamageType(damageTypes, ...candidates) {
    const dealt = (damageTypes ?? []).map(parseDamageType);
    return candidates.some(candidate => {
        const want = parseDamageType(candidate);
        if (!want.base) return false;
        return dealt.some(t => {
            if (want.qualifiers.length === 0 && t.qualifiers.includes(want.base)) return true;
            return t.base === want.base && want.qualifiers.every(q => t.qualifiers.includes(q));
        });
    });
}

/**
 * Determines if the provided damage types can bypass shields.  Shields stop energy damage, in
 * every one of its qualified forms.
 *
 * @param {string[]} damageTypes - An array of damage type strings to evaluate.
 * @return {boolean} Returns true if the shields can be bypassed, otherwise returns false.
 */
export function bypassShields(damageTypes) {
    // if(hasDamageType(damageTypes, "Lightsabers")){
    //     return false;
    // }
    return !hasDamageType(damageTypes, "Energy");
}

/**
 * Applies Damage Reduction to a damage total, resolved per damage type.
 *
 * A reduction that names damage types ("DR 10 against Ion", authored as `modifier` on the change)
 * applies exactly when the incoming damage carries one of them; an unqualified reduction applies to
 * everything.  Reductions are independent of each other, so a type matching one of them cannot
 * switch off the others.
 *
 * @param {number} totalDamage
 * @param {string[]} damageTypes the damage types being dealt
 * @param {Array<{value: *, modifier: ?string}>} damageReductions the `damageReduction` changes
 * @param {boolean} lightsaberResistance whether the target's DR also applies to lightsaber damage
 * @return {number} the damage left after reduction, never below 0
 */
export function applyDamageReduction(totalDamage, damageTypes, damageReductions, lightsaberResistance) {
    if (hasDamageType(damageTypes, "Lightsabers") && !lightsaberResistance) {
        return Math.max(totalDamage, 0);
    }
    for (const damageReduction of damageReductions ?? []) {
        const modifier = damageReduction?.modifier || "";
        if (modifier && !hasDamageType(damageTypes, ...resolveDamageTypes(modifier))) {
            continue;
        }
        totalDamage = Math.max(totalDamage - toNumber(damageReduction.value), 0);
    }
    return Math.max(totalDamage, 0);
}
