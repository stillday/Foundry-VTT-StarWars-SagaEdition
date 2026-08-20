console.log("Starting damage type tests ")

import test from 'node:test';
import {expect} from 'chai';
import {
    applyDamageReduction,
    bypassShields,
    hasDamageType,
    resolveDamageTypes
} from '../module/common/conditionalHelpers.mjs';

test('a weapon dealing two damage types resolves to two types', () => {
    // The pack authors one `damageType` change per type, so the attack hands over two values.
    expect(resolveDamageTypes(["Energy", "Slashing"])).to.deep.equal(["Energy", "Slashing"]);
    // An authored list is split on every separator COMMMA_LIST knows, " and " is NOT one of them
    // (that is why the second type has to be its own change).
    expect(resolveDamageTypes("Energy, Slashing")).to.deep.equal(["Energy", "Slashing"]);
    expect(resolveDamageTypes("Slashing or Piercing")).to.deep.equal(["Slashing", "Piercing"]);
    expect(resolveDamageTypes("Bludgeoning, or Slashing")).to.deep.equal(["Bludgeoning", "Slashing"]);
    // a comma inside the qualifier list is not a type separator
    expect(resolveDamageTypes("Energy (Sonic, Stun)")).to.deep.equal(["Energy (Sonic, Stun)"]);
    expect(resolveDamageTypes("Energy (Blaster), Piercing (Bayonet)"))
        .to.deep.equal(["Energy (Blaster)", "Piercing (Bayonet)"]);
    // a missing damage type is untyped damage, not an error
    expect(resolveDamageTypes(undefined)).to.deep.equal([]);
    expect(resolveDamageTypes(null)).to.deep.equal([]);
});

test('damage type matching is case insensitive and qualifier aware', () => {
    expect(hasDamageType(["energy"], "Energy")).to.equal(true);
    expect(hasDamageType(["Energy"], "energy")).to.equal(true);
    // a qualified type IS its base type ...
    expect(hasDamageType(["Energy (Ion)"], "Energy")).to.equal(true);
    // ... but plain Energy is not Ion damage
    expect(hasDamageType(["Energy"], "Energy (Ion)")).to.equal(false);
    expect(hasDamageType(["Energy (Sonic, Stun)"], "Energy (Stun)")).to.equal(true);
    expect(hasDamageType(["Slashing"], "Energy", "Piercing")).to.equal(false);
    expect(hasDamageType([], "Energy")).to.equal(false);
});

test('shields stop energy damage in every qualified form', () => {
    expect(bypassShields(["Energy"])).to.equal(false);
    expect(bypassShields(["Energy (Ion)"])).to.equal(false);
    expect(bypassShields(["energy (stun)"])).to.equal(false);
    expect(bypassShields(["Slashing"])).to.equal(true);
    // a weapon dealing Energy AND Slashing is still stopped by shields
    expect(bypassShields(["Energy", "Slashing"])).to.equal(false);
    expect(bypassShields([])).to.equal(true);
});

test('damage reduction applies when the damage type matches, not when it misses', () => {
    // Verpine General Template (armor): {key: damageReduction, value: "10", modifier: "Ion"}
    const verpine = [{value: "10", modifier: "Ion"}];
    expect(applyDamageReduction(20, ["Energy (Ion)"], verpine, false)).to.equal(10);
    expect(applyDamageReduction(20, ["Slashing"], verpine, false)).to.equal(20);
    // an unqualified reduction applies to everything
    const plain = [{value: "5"}];
    expect(applyDamageReduction(20, ["Energy"], plain, false)).to.equal(15);
    expect(applyDamageReduction(20, ["Slashing"], plain, false)).to.equal(15);
    expect(applyDamageReduction(20, [], plain, false)).to.equal(15);
    // never below zero
    expect(applyDamageReduction(3, ["Energy"], plain, false)).to.equal(0);
});

test('damage reduction resolves per type instead of all-or-nothing', () => {
    // DR 5 vs Energy plus DR 2 vs Slashing, and an unqualified DR 1 on top.
    const reductions = [
        {value: "5", modifier: "Energy"},
        {value: "2", modifier: "Slashing"},
        {value: "1"}
    ];
    // one matching type must not switch off the reductions for the other types
    expect(applyDamageReduction(20, ["Energy"], reductions, false)).to.equal(14);
    expect(applyDamageReduction(20, ["Slashing"], reductions, false)).to.equal(17);
    // a weapon dealing both types gets both reductions
    expect(applyDamageReduction(20, ["Energy", "Slashing"], reductions, false)).to.equal(12);
    // a type matching none of the qualified reductions keeps only the unqualified one
    expect(applyDamageReduction(20, ["Piercing"], reductions, false)).to.equal(19);
    // a comma separated modifier list matches any of its entries
    const multi = [{value: "5", modifier: "Ion, Slashing"}];
    expect(applyDamageReduction(20, ["Slashing"], multi, false)).to.equal(15);
    expect(applyDamageReduction(20, ["Energy (Ion)"], multi, false)).to.equal(15);
    expect(applyDamageReduction(20, ["Piercing"], multi, false)).to.equal(20);
});

test('lightsaber damage ignores damage reduction unless the target resists lightsabers', () => {
    const plain = [{value: "5"}];
    expect(applyDamageReduction(20, ["Lightsabers"], plain, false)).to.equal(20);
    expect(applyDamageReduction(20, ["Lightsabers"], plain, true)).to.equal(15);
});

test('Ion and Stun are independent descriptors on the same weapon', () => {
    // A weapon carrying both Energy (Ion) and Energy (Stun) has to trigger both branches; the
    // detection used to be an if/else chain keyed on exact strings.
    const both = ["Energy (Ion)", "Energy (Stun)"];
    expect(hasDamageType(both, "Energy (Ion)")).to.equal(true);
    expect(hasDamageType(both, "Energy (Stun)")).to.equal(true);
    // and a single type with both descriptors does the same
    const combined = resolveDamageTypes("Energy (Ion, Stun)");
    expect(combined).to.deep.equal(["Energy (Ion, Stun)"]);
    expect(hasDamageType(combined, "Energy (Ion)")).to.equal(true);
    expect(hasDamageType(combined, "Energy (Stun)")).to.equal(true);
});
