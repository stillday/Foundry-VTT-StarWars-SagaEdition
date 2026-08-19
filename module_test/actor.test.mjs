console.log("Starting actor tests ")

import test from 'node:test';
import {expect} from 'chai';
import SWSEActor from '../module/actor/actor.mjs';
import {SWSEActiveEffect} from '../module/active-effect/active-effect.mjs';
import {reduceArray, toBoolean, toStringValue} from '../module/common/util.mjs';

test('SWSEActor instantiation', () => {
    const actor = new SWSEActor({
        name: "Test Character",
        system: {
            abilities: {
                str: { value: 10 },
                dex: { value: 12 },
                con: { value: 14 },
                int: { value: 8 },
                wis: { value: 13 },
                cha: { value: 15 }
            }
        }
    });
    expect(actor.name).to.equal("Test Character");
    expect(actor.system.abilities.str.value).to.equal(10);
});

test('SWSEActor levelSummary and firstAid', async () => {
    const actor = new SWSEActor({
        name: "Test Character",
        system: {}
    });
    actor.itemTypes.class = [{
        levelsTaken: [1, 2, 3],
        id: "class-id",
        name: "Jedi",
        canRerollHealth: () => false,
        classLevelHealth: () => 10
    }];
    
    expect(actor.levelSummary).to.equal(3);
    expect(actor.firstAid.perDay).to.equal(1);
});

test('SWSEActor forcePoints calculation at higher level', async () => {
    const actor = new SWSEActor({
        name: "Test Character",
        system: {
            forcePoints: 5
        }
    });
    // Level 15
    actor.itemTypes.class = [{
        levelsTaken: Array.from({length: 15}, (_, i) => i + 1),
        id: "class-id",
        name: "Jedi",
        canRerollHealth: () => false,
        classLevelHealth: () => 10
    }];
    
    const fp = actor.forcePoints;
    expect(fp.quantity).to.equal(5);
    expect(fp.roll).to.equal("3d6kh"); // Level 15 -> 3d6
});

/*
 * Regression tests for Foundry v14's silent retyping of ActiveEffect change values.
 * BaseActiveEffect.#migrateChangeValue (common/documents/active-effect.mjs) runs JSON.parse over
 * every string change value, so "true" becomes boolean true and "20" becomes number 20 once a value
 * has passed through an ActiveEffect.  SWSE's own system.changes still hold strings, so every
 * consumer has to accept both types.
 */

test('SWSEActiveEffect#transfer accepts both boolean and string change values', async () => {
    const effect = new SWSEActiveEffect();

    // Post-v14 ActiveEffect data: JSON.parse turned "true" into a boolean.
    effect.changes = [{key: "transfer", value: true}];
    expect(effect.transfer).to.equal(true);

    // Legacy / SWSE system.changes data: still a string.
    effect.changes = [{key: "transfer", value: "true"}];
    expect(effect.transfer).to.equal(true);

    effect.changes = [{key: "transfer", value: false}];
    expect(effect.transfer).to.equal(false);

    effect.changes = [{key: "transfer", value: "false"}];
    expect(effect.transfer).to.equal(false);

    // No transfer change at all.
    effect.changes = [{key: "somethingElse", value: "true"}];
    expect(effect.transfer).to.equal(false);
});

test('toStringValue makes retyped change values safe for string operations', async () => {
    expect(toStringValue("2d6/2d6")).to.equal("2d6/2d6");
    expect(toStringValue(20)).to.equal("20");
    expect(toStringValue(-1)).to.equal("-1");
    expect(toStringValue(true)).to.equal("true");
    expect(toStringValue(undefined)).to.equal("");
    expect(toStringValue(null)).to.equal("");
});

test('VALUES_WITH_MODIFIERS and VALUES_TO_LOWERCASE tolerate numeric change values', async () => {
    // toHitModifier is one of the keys Foundry retyped from string to number.
    expect(reduceArray("VALUES_WITH_MODIFIERS", [{value: 2, sourceString: "Effect"}]))
        .to.deep.equal([{value: "2", modifiers: [], source: "Effect"}]);
    expect(reduceArray("VALUES_WITH_MODIFIERS", [{value: "2|hits", sourceString: "Effect"}])[0].value)
        .to.equal("2");
    expect(reduceArray("VALUES_TO_LOWERCASE", [{value: 5}, {value: "ANY"}]))
        .to.deep.equal(["5", "any"]);
});

test('toBoolean tolerates the value types Foundry v14 produces', async () => {
    expect(toBoolean(true)).to.equal(true);
    expect(toBoolean("true")).to.equal(true);
    expect(toBoolean(false)).to.equal(false);
    expect(toBoolean("false")).to.equal(false);
    expect(toBoolean(1)).to.equal(true);
    expect(toBoolean(0)).to.equal(false);
    expect(toBoolean(null)).to.equal(false);
    expect(toBoolean(undefined)).to.equal(false);
});

/* ------------------------------------------------------------------------------------------------
 * Regression tests for the v14 port fixes.
 * ---------------------------------------------------------------------------------------------- */

import {SWSEItem} from '../module/item/item.mjs';
import {Attack} from '../module/actor/attack/attack.mjs';
import {SWSE} from '../module/common/config.mjs';
import {resolveAttackRange} from '../module/common/util.mjs';
import {DEFAULT_LEVEL_EFFECT} from '../module/common/classDefaults.mjs';

global.CONFIG.SWSE = SWSE;

/** minimal stand-in for a class item on an actor, mirroring SWSEItem#levelsTaken's `|| []` */
function classItemStub(system = {}) {
    return {
        type: "class", name: "Jedi", id: "class-id", img: "",
        system,
        get levelsTaken() { return this.system.levelsTaken || []; },
        levelUpHitPoints: 0,
        canRerollHealth: () => false,
        classLevelHealth: () => 1,
        isFollowerTemplate: false
    };
}

function actorWithClasses(...classItems) {
    const actor = new SWSEActor({name: "Levelled", system: {}});
    actor.items = {
        values: () => classItems,
        filter: fn => classItems.filter(fn),
        map: fn => classItems.map(fn),
        [Symbol.iterator]: function* () { yield* classItems; }
    };
    actor.itemTypes.class = classItems;
    actor.resolvedVariables = new Map();
    return actor;
}

test('heroicLevel survives a class item without system.levelsTaken (F4)', () => {
    // A class item created by createEmbeddedDocuments / a compendium copy / an import has no
    // system.levelsTaken - template.json does not declare it.  Reading `.length` off it threw and
    // took down the whole prepareData chain (defenses -> undefined, actor sheet never rendered).
    const actor = actorWithClasses(classItemStub({}));
    expect(() => actor.heroicLevel).to.not.throw();
    expect(actor.heroicLevel).to.equal(0);
    expect(() => actor.halfHeroicLevel).to.not.throw();
    expect(actor.halfHeroicLevel).to.equal(0);
    expect(actor.characterLevel).to.equal(0);
});

test('heroicLevel still counts levels that are present', () => {
    const actor = actorWithClasses(classItemStub({levelsTaken: [1, 2, 3]}));
    expect(actor.characterLevel).to.equal(3);
});

test('rangePenalty falls back to no penalty for an unmapped range (F3)', () => {
    const known = Object.create(Attack.prototype);
    Object.defineProperty(known, "range", {value: "Pistols"});
    expect(known.rangePenalty(5)).to.deep.equal({penalty: 0, range: "Point-blank"});
    expect(known.rangePenalty(50).penalty).to.equal(-5);

    // subtype that is not a range grid key: blank (data loss / new item) and homebrew
    for (const range of ["", "Homebrew Blasters", "Exotic Ranged Weapons", undefined]) {
        const attack = Object.create(Attack.prototype);
        Object.defineProperty(attack, "range", {value: range});
        expect(() => attack.rangePenalty(5), `range=${range}`).to.not.throw();
        expect(attack.rangePenalty(5)).to.deep.equal({penalty: 0, range: ""});
    }
});

test('canEffectWeapon tolerates an unmapped range (F3)', () => {
    const attack = Object.create(Attack.prototype);
    Object.defineProperty(attack, "range", {value: "Exotic Ranged Weapons"});
    const value = {value: "2", modifiers: [{type: "RANGE", requirement: "Short"}]};
    expect(() => attack.canEffectWeapon(value)).to.not.throw();
    expect(attack.canEffectWeapon(value)).to.equal(false);
    expect(attack.canEffectWeapon({value: "2", modifiers: []})).to.equal(true);
});

test('resolveAttackRange reports out of range instead of throwing (F3)', () => {
    expect(resolveAttackRange("Pistols", 5)).to.equal("point-blank");
    expect(resolveAttackRange("Pistols", 100000)).to.equal("out of range");
    expect(resolveAttackRange("Not A Weapon Group", 5)).to.equal(0);
});

test('addClassLevel registers the level under flags.swse.level and is idempotent (F5)', async () => {
    // `new SWSEItem` cannot be used here: the mock Item constructor assigns `changes`, which
    // SWSEItem exposes as a getter only.
    const item = Object.create(SWSEItem.prototype);
    item.system = {};
    item.name = "Jedi";
    item.type = "class";
    item.canUserModify = () => true;
    item.effects = [];
    let creates = 0;
    item.createEmbeddedDocuments = async (type, data) => {
        creates++;
        const docs = data.map((d, i) => ({...d, id: `effect-${item.effects.length + i}`}));
        item.effects.push(...docs);
        return docs;
    };

    const effect = await item.addClassLevel(1);
    expect(creates).to.equal(1);
    expect(effect.name).to.equal("Level 1");
    // the old code wrote a top level `level`, which ActiveEffect has no field for
    expect(effect.flags.swse.level).to.equal(1);
    expect(effect.flags.swse.isLevel).to.equal(true);
    expect(item.level(1)).to.equal(effect);

    // adding the same class level again must not duplicate it
    await item.addClassLevel(1);
    expect(creates).to.equal(1);
    expect(item.effects.length).to.equal(1);

    await item.addClassLevel(2);
    expect(creates).to.equal(2);
    expect(item.levels.map(l => l.flags.swse.level)).to.deep.equal([1, 2]);

    // the shared default must not be polluted by the deep clone target
    expect(DEFAULT_LEVEL_EFFECT.flags.swse.level).to.equal(undefined);
});

test('addClassLevel records the taken character level on an owned class item (F5)', async () => {
    const parent = new Actor({name: "Padawan", system: {}});
    const item = Object.create(SWSEItem.prototype);
    item.system = {};
    item.name = "Jedi";
    item.type = "class";
    item.canUserModify = () => true;
    item.effects = [];
    item.createEmbeddedDocuments = async (type, data) => data.map(d => ({...d, id: "effect-0"}));
    Object.defineProperty(item, "parent", {value: parent});
    Object.defineProperty(item, "isFollowerTemplate", {value: false});
    parent.itemTypes.class = [item];
    item.safeUpdate = async data => { item.system.levelsTaken = data["system.levelsTaken"]; };

    await item.addClassLevel(1);
    expect(item.system.levelsTaken).to.deep.equal([1]);
    await item.addClassLevel(1);                 // idempotent
    expect(item.system.levelsTaken).to.deep.equal([1]);
    await item.addClassLevel(2);
    expect(item.system.levelsTaken).to.deep.equal([1, 2]);
});

test('SWSEItem#levels ignores effects without flags.swse (F5)', () => {
    const item = Object.create(SWSEItem.prototype);
    item.system = {};
    item.name = "Jedi";
    item.type = "class";
    item.effects = [
        {name: "Some Core Status", flags: {}},
        {name: "No Flags At All"},
        {name: "Level 2", flags: {swse: {isLevel: true, level: 2}}},
        {name: "Level 1", flags: {swse: {isLevel: true, level: 1}}}
    ];
    expect(() => item.levels).to.not.throw();
    expect(item.levels.map(l => l.name)).to.deep.equal(["Level 1", "Level 2"]);
});
