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

/* -------------------------------------------------------------------------- */
/*  F6: item copies must carry a schema valid ActiveEffect duration           */
/* -------------------------------------------------------------------------- */

/**
 * Builds the situation SWSEActor#checkPrerequisitesAndResolveOptions is in: an item whose
 * ActiveEffects have been prepared, so `duration.value` is the derived `Infinity` that Foundry v14's
 * ActiveEffect#prepareBaseData writes, while `_source.duration` still holds the stored, schema
 * valid values.
 */
function itemWithPreparedEffects(effectSpecs) {
    const item = Object.create(SWSEItem.prototype);
    item.system = {changes: []};
    item.name = "Beast";
    item.type = "class";
    const contents = effectSpecs.map((spec, i) => ({
        _id: spec._id ?? `effect${i}`,
        name: spec.name,
        _source: {duration: spec.sourceDuration}
    }));
    item.effects = {
        contents,
        get: id => contents.find(e => e._id === id),
        [Symbol.iterator]: function* () { yield* contents; }
    };
    // stands in for Document#toObject, which returns the *derived* duration for source === false
    item.__super = {
        effects: effectSpecs.map((spec, i) => ({
            _id: spec._id ?? `effect${i}`,
            name: spec.name,
            duration: spec.derivedDuration
        }))
    };
    return item;
}

test('SWSEItem#toObject(false) takes effect durations from _source, not from derived data (F6)', () => {
    const item = itemWithPreparedEffects([
        {
            name: "Level 1",
            // measured in the live client: prepareBaseData does `duration.value ??= Infinity` and
            // _prepareDuration assigns seconds/remaining/label on top
            derivedDuration: {value: Infinity, units: "seconds", expiry: null, expired: false,
                _worldTime: 0, seconds: Infinity, remaining: Infinity, label: "None"},
            sourceDuration: {value: null, units: "seconds", expiry: null, expired: false}
        },
        {
            name: "Level 2",
            derivedDuration: {value: Infinity, units: "seconds", expiry: null, expired: false},
            sourceDuration: {value: null, units: "seconds", expiry: null, expired: false}
        },
        {
            // a real, finite duration must survive untouched
            name: "Timed Mode",
            derivedDuration: {value: 6, units: "rounds", expiry: "turnStart", expired: false,
                seconds: 36, remaining: 6, label: "6 Rounds"},
            sourceDuration: {value: 6, units: "rounds", expiry: "turnStart", expired: false}
        }
    ]);

    // Document#toObject is not available on the mock, so drive the override against a stub super
    const superToObject = Object.getPrototypeOf(SWSEItem.prototype).toObject;
    Object.getPrototypeOf(SWSEItem.prototype).toObject = function () {
        return {system: {changes: []}, effects: foundry.utils.deepClone(this.__super.effects)};
    };
    try {
        const copy = item.toObject(false);
        expect(copy.effects.length).to.equal(3);
        // Infinity is a number but not an integer, and duration.value is
        // NumberField({integer: true}) in v14 -> the create was rejected for every level effect
        for (const effect of copy.effects) {
            expect(effect.duration.value === null || Number.isInteger(effect.duration.value),
                `${effect.name}: ${effect.duration.value}`).to.equal(true);
            // the derived-only keys must not travel along either
            expect(Object.keys(effect.duration).sort()).to.deep.equal(["expired", "expiry", "units", "value"]);
        }
        expect(copy.effects[0].duration.value).to.equal(null);
        expect(copy.effects[2].duration).to.deep.equal({value: 6, units: "rounds", expiry: "turnStart", expired: false});
    } finally {
        Object.getPrototypeOf(SWSEItem.prototype).toObject = superToObject;
    }
});

test('SWSEItem#toObject(true) is left alone (F6)', () => {
    const item = itemWithPreparedEffects([{
        name: "Level 1",
        derivedDuration: {value: Infinity, units: "seconds"},
        sourceDuration: {value: null, units: "seconds"}
    }]);
    const superToObject = Object.getPrototypeOf(SWSEItem.prototype).toObject;
    let sawSource;
    Object.getPrototypeOf(SWSEItem.prototype).toObject = function (source) {
        sawSource = source;
        return {system: {changes: []}, effects: [{_id: "effect0", duration: {value: null, units: "seconds"}}]};
    };
    try {
        item.toObject();
        expect(sawSource).to.equal(true);   // default must stay `true`, as in Foundry
        item.toObject(true);
        expect(sawSource).to.equal(true);
    } finally {
        Object.getPrototypeOf(SWSEItem.prototype).toObject = superToObject;
    }
});

test('addClassLevel reports a rejected effect creation instead of half applying the level (F6)', async () => {
    const parent = new Actor({name: "Padawan", system: {}});
    const item = Object.create(SWSEItem.prototype);
    item.system = {levelsTaken: []};
    item.name = "Jedi";
    item.type = "class";
    item.canUserModify = () => true;
    item.effects = [];
    // exactly what createEmbeddedDocuments returns when the data fails validation: an empty array
    item.createEmbeddedDocuments = async () => [];
    Object.defineProperty(item, "parent", {value: parent});
    Object.defineProperty(item, "isFollowerTemplate", {value: false});
    parent.itemTypes.class = [item];
    let updated = false;
    item.safeUpdate = async () => { updated = true; };

    ui.notifications.messages.length = 0;
    const effect = await item.addClassLevel(1);
    expect(effect).to.equal(undefined);
    expect(updated, "levelsTaken must not grow without a level effect").to.equal(false);
    expect(ui.notifications.messages.filter(m => m.type === "error").length).to.equal(1);
});

// ---------------------------------------------------------------------------------------------
// getResolvedSize: precedence between a size *change* (species/trait/base type), the size stored
// on the actor (`system.size`) and the type default.  The Medium default for character/npc actors
// was introduced so a speciesless character stops reporting "Fine" (index 0), but it also
// overrode a stored size: 28 of 644 sampled compendium characters declare Large/Small/Huge/Tiny/
// Diminutive/Gargantuan/Colossal in their statblock and computed as Medium, which silently
// falsified Reflex Defense, grapple, damage threshold and fighting space.
// ---------------------------------------------------------------------------------------------
import {getResolvedSize} from '../module/attribute-helper.mjs';
import {sizeArray} from '../module/common/constants.mjs';

function sizeActor(type, storedSize, changes = []) {
    const actor = new SWSEActor({name: `${type} ${storedSize}`, system: {size: storedSize, changes}});
    actor.type = type;
    actor._source = {system: {size: storedSize}};
    actor.system.changes = changes;
    actor.resolvedVariables = new Map();
    return actor;
}

test('getResolvedSize keeps a size stored on the actor', () => {
    for (const stored of ["Large", "Small", "Huge", "Tiny", "Diminutive", "Gargantuan", "Colossal"]) {
        const actor = sizeActor("character", stored);
        expect(sizeArray[getResolvedSize(actor)], stored).to.equal(stored);
    }
});

test('getResolvedSize still defaults a character with nothing at all to Medium, not Fine', () => {
    const actor = new SWSEActor({name: "blank", system: {}});
    actor.type = "character";
    actor.resolvedVariables = new Map();
    expect(sizeArray[getResolvedSize(actor)]).to.equal("Medium");

    // an invalid stored value must not win either
    const bogus = sizeActor("character", "Variable (See Above)");
    expect(sizeArray[getResolvedSize(bogus)]).to.equal("Medium");
});

test('getResolvedSize lets a size change win over the stored size', () => {
    // this is the 37 vehicles / 5 characters case: system.size is the never-updated template
    // default while the real size comes from a vehicle base type or a species trait
    const vehicle = sizeActor("vehicle", "Medium", [{key: "size", value: "Colossal"}]);
    expect(sizeArray[getResolvedSize(vehicle)]).to.equal("Colossal");

    const smallSpecies = sizeActor("character", "Medium", [{key: "size", value: "Small"}]);
    expect(sizeArray[getResolvedSize(smallSpecies)]).to.equal("Small");

    // and a stored size does not block a sizeBonus on top of it
    const grown = sizeActor("character", "Small", [{key: "sizeBonus", value: "1"}]);
    expect(sizeArray[getResolvedSize(grown)]).to.equal("Medium");
});

test('providedTraits turns providedTrait changes into trait items, once each', () => {
    const actor = new SWSEActor({name: "Ace", system: {}});
    const classItem = {
        id: "ace-pilot",
        name: "Ace Pilot",
        type: "class",
        system: {levelsTaken: [1, 2], changes: [
            {key: "providedTrait", value: "Vehicle Dodge"},
            {key: "providedTrait", value: "Vehicle Dodge"},
            {key: "provides", value: "Ace Pilot Talent Trees"}
        ]},
        effects: []
    };

    const first = actor.providedTraits(classItem);
    expect(first.length).to.equal(2);
    expect(first.every(t => t.type === "TRAIT" && t.name === "Vehicle Dodge" && t.parent === classItem))
        .to.equal(true);

    // one of them has already been granted by this class -> only the missing one is requested
    actor.itemTypes.trait = [
        {name: "Vehicle Dodge", finalName: "Vehicle Dodge", system: {supplier: {id: "ace-pilot"}}}
    ];
    expect(actor.providedTraits(classItem).length).to.equal(1);

    // both granted -> nothing left to do (idempotent)
    actor.itemTypes.trait = [
        {name: "Vehicle Dodge", finalName: "Vehicle Dodge", system: {supplier: {id: "ace-pilot"}}},
        {name: "Vehicle Dodge", finalName: "Vehicle Dodge", system: {supplier: {id: "ace-pilot"}}}
    ];
    expect(actor.providedTraits(classItem).length).to.equal(0);

    // a trait of the same name from a *different* source does not count as granted by this class
    actor.itemTypes.trait = [
        {name: "Vehicle Dodge", finalName: "Vehicle Dodge", system: {supplier: {id: "some-species"}}}
    ];
    expect(actor.providedTraits(classItem).length).to.equal(2);

    // uploads must not trigger item creation
    expect(actor.providedTraits(classItem, {isUpload: true}).length).to.equal(0);
});

test('formulaFunctions is usable through the Map API it is read with', () => {
    const actor = new SWSEActor({name: "formula", system: {}});
    actor.prepareData();
    expect(actor.formulaFunctions instanceof Map).to.equal(true);
    expect(actor.formulaFunctions.size).to.be.greaterThan(0);
    expect(typeof actor.formulaFunctions.get('@charLevel')).to.equal('function');
});
