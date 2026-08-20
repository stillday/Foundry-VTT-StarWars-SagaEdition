console.log("Starting armor defense reduction tests ")

import test from 'node:test';
import {expect} from 'chai';
import {SWSEItem} from '../module/item/item.mjs';
import {reduceArray, toNumber} from '../module/common/util.mjs';

/*
 * SWSEItem#armorReflexDefenseBonus and #fortitudeDefenseBonus used to reduce their change key with
 * `MAX`, which meant
 *   - a modification installed on an armour was invisible whenever the armour's own bonus was
 *     larger  (Mandalorian Armor Template `equipmentFortitudeDefenseBonus: "+1"`)
 *   - a malus was swallowed entirely  (Durasteel Cast / Bonadan-Alloy Armor Template `-1`)
 *   - `MAX` compared the values through toNumber() and returned the raw string when it could not
 *     read one, so `Arkanian General Template (armor)` (which ships the never-implemented notation
 *     `equipmentFortitudeDefenseBonus: "x2"` and `"x0"`) turned the getter into `NaN` and dropped
 *     the wearer's Fortitude Defense from 15 to 13.
 * They now reduce with `SUM` through #_reduceNumericArmorBonus, which also guarantees a number.
 */

/** the change arrays that actually occur, as `system.changes` rows */
const changes = (key, ...values) => values.map(value => ({key, value, mode: 2}));

/** a bare-bones armour item: enough for getInheritableAttribute to read `system.changes` */
function armour(...changeRows) {
    const item = Object.create(SWSEItem.prototype);
    item._id = "armour-id";
    item.name = "Test Armor";
    item.type = "armor";
    item.effects = [];
    item.system = {subtype: "Light Armor", changes: changeRows, stripping: {}};
    item.getCached = (key, fn) => fn();
    return item;
}

// ---------------------------------------------------------------- the reduction itself

test('SUM stacks armour and modification changes where MAX kept only the larger one', () => {
    // Stormtrooper Armor (+2) + Mandalorian Armor Template (+1)
    const mando = changes("k", "+2", "+1");
    expect(reduceArray("MAX", mando.map(c => ({...c})), null)).to.equal(2);
    expect(reduceArray("SUM", mando.map(c => ({...c})), null)).to.equal(3);

    // Stormtrooper Armor (+6 Reflex) + Stygian-Triprismatic Polymer Armor Template (+1)
    const stygian = changes("k", "+6", "+1");
    expect(reduceArray("MAX", stygian.map(c => ({...c})), null)).to.equal(6);
    expect(reduceArray("SUM", stygian.map(c => ({...c})), null)).to.equal(7);
});

test('SUM applies a malus that MAX swallowed', () => {
    // Stormtrooper Armor (+2) + Durasteel Cast / Bonadan-Alloy Armor Template (-1)
    const durasteel = changes("k", "+2", -1);
    expect(reduceArray("MAX", durasteel.map(c => ({...c})), null)).to.equal(2);
    expect(reduceArray("SUM", durasteel.map(c => ({...c})), null)).to.equal(1);
});

test('MAX returns a string for the Arkanian value array, SUM does not', () => {
    // Arkanian General Template (armor) on an armour with an own +2
    const arkanian = changes("k", "+2", "x2", "x0");
    const max = reduceArray("MAX", arkanian.map(c => ({...c})), null);
    expect(max).to.equal("x2");
    expect(Number.isNaN(Number(toNumber(max)))).to.equal(true);   // this is where the NaN came from

    const sum = reduceArray("SUM", arkanian.map(c => ({...c})), null);
    expect(sum).to.equal(2);
});

test('SUM alone is not enough: with no numeric term it hands the string back', () => {
    // the same template on an armour that has no Fortitude bonus of its own.  This is why
    // #_reduceNumericArmorBonus needs its own numeric guard on top of SUM.
    const bare = changes("k", "x2", "x0");
    expect(reduceArray("SUM", bare.map(c => ({...c})), null)).to.equal("x2x0");
});

// ---------------------------------------------------------------- the guarded helper

test('SWSEItem#_reduceNumericArmorBonus always returns a number', () => {
    const cases = [
        [[], 0],
        [["+2"], 2],
        [["+2", "+1"], 3],
        [["+2", -1], 1],
        [["+6", "+1"], 7],
        [["+2", "x2", "x0"], 2],
        [["x2", "x0"], 0],          // nothing numeric to stack onto -> contributes nothing
        [["x2"], 0],
        [["-"], 0],
        [["+0", "x2", "x0"], 0]
    ];
    for (const [values, expected] of cases) {
        const item = armour(...changes("equipmentFortitudeDefenseBonus", ...values));
        const result = item._reduceNumericArmorBonus("equipmentFortitudeDefenseBonus");
        expect(result, `values ${JSON.stringify(values)}`).to.equal(expected);
        expect(typeof result, `values ${JSON.stringify(values)}`).to.equal("number");
    }
});

// ---------------------------------------------------------------- the two getters

test('SWSEItem#fortitudeDefenseBonus stacks the modification and never goes NaN', () => {
    const fort = (...values) => {
        const item = armour(...changes("equipmentFortitudeDefenseBonus", ...values));
        item._parentIsProficientWithArmor = () => true;
        return item.fortitudeDefenseBonus;
    };

    expect(fort("+2")).to.equal(2);                    // shipped armour, unchanged by SUM
    expect(fort("+2", "+1")).to.equal(3);              // Mandalorian Armor Template
    expect(fort("+2", -1)).to.equal(1);                // Durasteel Cast / Bonadan-Alloy
    expect(fort("+2", "x2", "x0")).to.equal(2);        // Arkanian, was NaN
    expect(fort("x2", "x0")).to.equal(0);              // Arkanian on an armour without an own bonus
    expect(Number.isNaN(fort("+2", "x2", "x0"))).to.equal(false);
    expect(Number.isNaN(fort("x2", "x0"))).to.equal(false);
});

test('SWSEItem#fortitudeDefenseBonus still requires proficiency', () => {
    const item = armour(...changes("equipmentFortitudeDefenseBonus", "+2", "+1"));
    item._parentIsProficientWithArmor = () => false;
    expect(item.fortitudeDefenseBonus).to.equal(0);
});

test('SWSEItem#armorReflexDefenseBonus stacks the modification and never goes NaN', () => {
    const ref = (...values) => armour(...changes("armorReflexDefenseBonus", ...values)).armorReflexDefenseBonus;

    expect(ref("+6")).to.equal(6);                     // shipped armour, unchanged by SUM
    expect(ref("+6", "+1")).to.equal(7);               // Stygian-Triprismatic Polymer
    expect(ref("+4", "+2")).to.equal(6);               // Superior Protective Armor
    expect(ref("x2", "x0")).to.equal(0);
    expect(Number.isNaN(ref("x2", "x0"))).to.equal(false);
    // the one shipped armour whose value carries a parenthesised note is read the same way as
    // before this change ("+5 (+3 vs Slugthrowers)" resolves to 53 under MAX and under SUM alike -
    // a pre-existing data problem, deliberately left as it was)
    expect(ref("+5 (+3 vs Slugthrowers)")).to.equal(53);
});

// ---------------------------------------------------------------- the strip cap

test('the reduceDefensiveMaterial cap uses the same reduction as the getters', () => {
    const cap = (ref, fort) => armour(
        ...changes("armorReflexDefenseBonus", ...ref),
        ...changes("equipmentFortitudeDefenseBonus", ...fort)
    ).stripping.reduceDefensiveMaterial;

    // shipped Stormtrooper Armor: min(6, 2)
    expect(cap(["+6"], ["+2"])).to.include({enabled: true, high: 2});
    // with Mandalorian Armor Template the Fortitude side is 3 now, so the cap follows
    expect(cap(["+6"], ["+2", "+1"])).to.include({enabled: true, high: 3});
    // Arkanian: Math.min() of the old MAX string was NaN and reached the sheet as an input max
    const arkanian = cap(["+6"], ["+2", "x2", "x0"]);
    expect(Number.isNaN(arkanian.high)).to.equal(false);
    expect(arkanian.high).to.equal(2);
});

// ---------------------------------------------------------------- deliberately unchanged

test('SWSEItem#maximumDexterityBonus keeps its NaN for the "-" value', () => {
    // Blinding Helmet ships `maximumDexterityBonus: "-"`.  The getter neither reduces with MAX nor
    // with SUM - it sums the raw attribute array through toNumber(), and toNumber("-") returns the
    // string, so the result is NaN.  That NaN is load bearing: DefenseFunctions
    // #_getEquipmentMaxDexBonus (actor/data/templates/defenses.mjs:426-434) skips an item whose
    // maximumDexterityBonus isNaN, which is how "-" is read as "no Dexterity cap".  Turning this
    // key into SUM would make it 0 and cap the wearer's Dexterity bonus at zero, so it stays.
    const dash = armour(...changes("maximumDexterityBonus", "-"));
    expect(Number.isNaN(Number(dash.maximumDexterityBonus))).to.equal(true);

    // a normal armour is unaffected
    const three = armour(...changes("maximumDexterityBonus", "+3"));
    expect(three.maximumDexterityBonus).to.equal(3);
});
