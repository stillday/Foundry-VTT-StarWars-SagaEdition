// module_test/abilities-migration.test.mjs
// Regression tests for AbilityFields.migrateData (#575 / #576)
//
// Bug: coerceOldAttributes() overwrites `base` with `manual` even when
// `manual` is the old template default (10, stored as number) and `base`
// was explicitly set to a different value (e.g. for compendium NPCs whose
// stats were written directly into the `base` field).
//
// Expected: when manual === 10 (the old schema default) and base carries a
// real, non-default value, the migration must preserve base.
//
// NOTE: The function under test is inlined here to avoid loading the full
// abilities.mjs module which has a circular dependency on characterdata.mjs.
// The inlined logic must stay in sync with
// module/actor/data/templates/abilities.mjs → AbilityFields.migrateData().

import test from 'node:test';
import { expect } from 'chai';

// ---------------------------------------------------------------------------
// Function under test (inlined from abilities.mjs to avoid circular imports)
// ---------------------------------------------------------------------------

function migrateDataFn(source) {
    function parseManual(val) {
        if(val === null || val === undefined || val === "-") return null;
        const n = Number(val);
        return isNaN(n) ? null : n;
    }

    // Mirror of the fix in abilities.mjs: old schema stored `manual: 10`
    // as a number literal as template default; user form input was always a
    // string.  Preserve `base` when manual is exactly the numeric default and
    // base already holds a different real value (#575/#576).
    const OLD_MANUAL_DEFAULT = 10;

    function shouldPreserveBase(ability, manualNum) {
        if (ability.manual !== OLD_MANUAL_DEFAULT) return false;
        const baseNum = (ability.base !== null && ability.base !== undefined)
            ? Number(ability.base) : null;
        return baseNum !== null && baseNum !== OLD_MANUAL_DEFAULT;
    }

    function coerceOldAttributes(attributes) {
        for (let [key, ability] of Object.entries(attributes)) {
            const manualNum = parseManual(ability.manual);
            if(manualNum !== null) {
                if (!shouldPreserveBase(ability, manualNum)) {
                    ability.base = manualNum;
                }
                ability.manual = null;
            } else {
                ability.manual = null;
            }
        }
        return attributes;
    }

    if(!source.abilities && source.attributes){
        source.abilities = coerceOldAttributes(source.attributes);
        delete source.attributes;
    }

    if(source.abilities) {
        for(const ability of Object.values(source.abilities)) {
            const manualNum = parseManual(ability.manual);
            if(manualNum !== null) {
                if (!shouldPreserveBase(ability, manualNum)) {
                    ability.base = manualNum;
                }
                ability.manual = null;
            } else if(ability.manual !== null && ability.manual !== undefined) {
                ability.manual = null;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function migrate(attrs) {
    const source = { attributes: attrs };
    migrateDataFn(source);
    return source;
}

// ---------------------------------------------------------------------------
// Normal migration cases
// ---------------------------------------------------------------------------

test('migrateData: manual string "8" → base 8 (normal user-entered stat)', () => {
    const source = migrate({
        str: { total: 10, manual: '8', mod: 0, bonus: 0, base: 10 },
    });
    expect(source.abilities.str.base).to.equal(8);
    expect(source.abilities.str.manual).to.equal(null);
    expect(source.attributes).to.be.undefined;
});

test('migrateData: manual "14" string → base 14', () => {
    const source = migrate({
        str: { total: 14, manual: '14', mod: 0, bonus: 0, base: 14 },
    });
    expect(source.abilities.str.base).to.equal(14);
});

test('migrateData: manual 14 number → base 14', () => {
    const source = migrate({
        dex: { total: 14, manual: 14, mod: 0, bonus: 0, base: 14 },
    });
    expect(source.abilities.dex.base).to.equal(14);
});

// ---------------------------------------------------------------------------
// #575 / #576 REGRESSION — compendium NPCs / existing characters lose ability scores
//
// Old template default was `manual: 10` (number literal).
// Compendium actors were often saved with base=<real stat>, manual=10 (default).
// coerceOldAttributes() used to set base = manualNum, wiping the real value.
// ---------------------------------------------------------------------------

test('#575/#576 regression: manual=10 (old default number) and base=14 → preserve base 14', () => {
    const source = migrate({
        str: { total: 14, manual: 10, mod: 2, bonus: 0, base: 14 },
    });
    expect(source.abilities.str.base).to.equal(14,
        'base must not be overwritten when manual is the old template default (10)');
    expect(source.abilities.str.manual).to.equal(null);
});

test('#575/#576 regression: all six abilities preserved when manual=10 and bases vary', () => {
    const source = migrate({
        str: { total: 14, manual: 10, mod: 2,  bonus: 0, base: 14 },
        dex: { total: 12, manual: 10, mod: 1,  bonus: 0, base: 12 },
        con: { total: 16, manual: 10, mod: 3,  bonus: 0, base: 16 },
        int: { total: 8,  manual: 10, mod: -1, bonus: 0, base: 8  },
        wis: { total: 10, manual: 10, mod: 0,  bonus: 0, base: 10 },
        cha: { total: 13, manual: 10, mod: 1,  bonus: 0, base: 13 },
    });
    expect(source.abilities.str.base).to.equal(14);
    expect(source.abilities.dex.base).to.equal(12);
    expect(source.abilities.con.base).to.equal(16);
    expect(source.abilities.int.base).to.equal(8);
    expect(source.abilities.wis.base).to.equal(10);
    expect(source.abilities.cha.base).to.equal(13);
});

test('migrateData: manual=10 and base=10 → base stays 10 (genuine 10 stat)', () => {
    const source = migrate({
        str: { total: 10, manual: 10, mod: 0, bonus: 0, base: 10 },
    });
    expect(source.abilities.str.base).to.equal(10);
});

test('migrateData: manual="-" (sentinel) → base untouched', () => {
    const source = migrate({
        str: { total: 10, manual: '-', mod: 0, bonus: 0, base: 12 },
    });
    // manual="-" parses as null, so base should not be overwritten
    expect(source.abilities.str.base).to.equal(12);
});

test('migrateData: manual=null → base untouched', () => {
    const source = migrate({
        str: { total: 12, manual: null, mod: 1, bonus: 0, base: 12 },
    });
    expect(source.abilities.str.base).to.equal(12);
});

// ---------------------------------------------------------------------------
// New-format actors (abilities already present) must be untouched
// ---------------------------------------------------------------------------

test('migrateData: abilities already present — no double-migration', () => {
    const source = { abilities: { str: { base: 15, manual: null } } };
    migrateDataFn(source);
    expect(source.abilities.str.base).to.equal(15);
    expect(source.abilities.str.manual).to.equal(null);
});

test('migrateData: abilities present with lingering manual value → manual consumed, base updated', () => {
    // Actors saved during the transition period may still have manual set.
    const source = { abilities: { str: { base: 10, manual: 14 } } };
    migrateDataFn(source);
    expect(source.abilities.str.base).to.equal(14);
    expect(source.abilities.str.manual).to.equal(null);
});
