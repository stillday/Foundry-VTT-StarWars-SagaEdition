console.log("Starting prerequisite tests ")

import test from 'node:test';
import {expect} from 'chai';
import SWSEActor from '../module/actor/actor.mjs';
import {meetsPrerequisites} from '../module/prerequisite.mjs';

/**
 * Minimal stand-in for a prepared character.  `SWSEActor#attributes` returns `system.abilities`, and
 * `_prepareAbilityDerivedData` fills in `value`/`mod` there - no `total` has ever existed.
 */
function actorWithAbilities(scores = {}, extra = {}) {
    const abilities = {};
    for (const key of ["str", "dex", "con", "int", "wis", "cha"]) {
        const value = scores[key] ?? 10;
        abilities[key] = {value, base: value, mod: Math.floor((value - 10) / 2), customBonus: 0};
    }
    const actor = new SWSEActor({
        name: "Prereq Dummy",
        system: {
            abilities,
            darkside: {value: 0, taint: 0, finalScore: 0},
            settings: {ignorePrerequisites: false, ignorePrerequisitesOnDrop: false},
            ...extra
        }
    });
    // `prepareData()` normally creates these; the harness Actor mock does not run it.
    actor.resolvedVariables = new Map();
    actor.resolvedLabels = new Map();
    actor.resolvedNotes = new Map();
    return actor;
}

const ATTR_PREREQ = [{type: "ATTRIBUTE", requirement: "Strength 13", text: "Strength 13"}];

test('getActorAttribute returns the ability score, not undefined', () => {
    const actor = actorWithAbilities({str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8});

    expect(SWSEActor.getActorAttribute(actor, "STR")).to.equal(15);
    expect(SWSEActor.getActorAttribute(actor, "Strength")).to.equal(15);
    expect(actor.getAttribute("DEX")).to.equal(14);
    expect(actor.getAttribute("CON")).to.equal(13);
    expect(actor.getAttribute("INT")).to.equal(12);
    expect(actor.getAttribute("WIS")).to.equal(10);
    expect(actor.getAttribute("CHA")).to.equal(8);

    // the modifier stays available through its own accessor - the two must not be confused
    expect(actor.getAttributeMod("str")).to.equal(2);
    expect(actor.getAttributeMod("cha")).to.equal(-1);
});

test('getActorAttribute tolerates an unknown attribute name', () => {
    const actor = actorWithAbilities();
    expect(SWSEActor.getActorAttribute(actor, "Midichlorians")).to.equal(undefined);
});

test('an unmet ATTRIBUTE prerequisite fails', () => {
    const actor = actorWithAbilities({str: 12});
    const result = meetsPrerequisites(actor, ATTR_PREREQ, {isLoad: true});

    expect(result.doesFail).to.equal(true);
    expect(result.successList.length).to.equal(0);
});

test('a met ATTRIBUTE prerequisite passes, at the boundary and above', () => {
    for (const str of [13, 14, 20]) {
        const result = meetsPrerequisites(actorWithAbilities({str}), ATTR_PREREQ, {isLoad: true});
        expect(result.doesFail, `STR ${str}`).to.equal(false);
        expect(result.successList.length, `STR ${str}`).to.equal(1);
    }
});

test('system.settings.ignorePrerequisites bypasses an unmet prerequisite', () => {
    const failing = actorWithAbilities({str: 8});
    expect(meetsPrerequisites(failing, ATTR_PREREQ, {isLoad: true}).doesFail).to.equal(true);

    const ignoring = actorWithAbilities({str: 8}, {settings: {ignorePrerequisites: true}});
    expect(meetsPrerequisites(ignoring, ATTR_PREREQ, {isLoad: true}).doesFail).to.equal(false);

    // isLoad-only gate: the drop switch must not answer for the load path
    const ignoringOnDrop = actorWithAbilities({str: 8}, {settings: {ignorePrerequisitesOnDrop: true}});
    expect(meetsPrerequisites(ignoringOnDrop, ATTR_PREREQ, {isLoad: true}).doesFail).to.equal(true);
    expect(meetsPrerequisites(ignoringOnDrop, ATTR_PREREQ, {isAdd: true}).doesFail).to.equal(false);
});

test('DARK SIDE SCORE prerequisites read the real schema path', () => {
    const prereq = [{type: "DARK SIDE SCORE", requirement: "5", text: "Dark Side Score 5"}];

    const clean = actorWithAbilities({}, {darkside: {value: 1, taint: 0, finalScore: 1}});
    expect(meetsPrerequisites(clean, prereq, {isLoad: true}).doesFail).to.equal(true);

    const fallen = actorWithAbilities({}, {darkside: {value: 5, taint: 0, finalScore: 5}});
    expect(meetsPrerequisites(fallen, prereq, {isLoad: true}).doesFail).to.equal(false);

    // taint counts towards the score through the derived finalScore
    const tainted = actorWithAbilities({}, {darkside: {value: 3, taint: 2, finalScore: 5}});
    expect(meetsPrerequisites(tainted, prereq, {isLoad: true}).doesFail).to.equal(false);
});

test('CHARACTER LEVEL prerequisites still behave (control for the ATTRIBUTE change)', () => {
    const actor = actorWithAbilities();
    actor.itemTypes.class = [{
        levelsTaken: [1], id: "c", name: "Jedi",
        canRerollHealth: () => false, classLevelHealth: () => 10
    }];
    const prereq = [{type: "CHARACTER LEVEL", requirement: "3", text: "Character Level 3"}];
    expect(meetsPrerequisites(actor, prereq, {isLoad: true}).doesFail).to.equal(true);
});

// ---------------------------------------------------------------------------------------------
// Regression tests for the prerequisite branches that used to pass unconditionally.
//
// Every branch below was verified in a live client to report doesFail = false for a requirement
// the character could not possibly satisfy.  The mechanism was always the same: the failure path
// either pushed nothing onto the failureList at all (SPECIES, "is a droid"/"not a droid") or
// pushed `{fail: false}` (TRADITION, SPECIAL, "Has Built Lightsaber"), and unknown types only
// produced a console warning.  `meetsPrerequisites` derives `doesFail` solely from entries with
// `fail === true`, so all of those read as "requirement met".
// ---------------------------------------------------------------------------------------------

/** A stub owned item good enough for the resolvedItems filters in prerequisite.mjs. */
function stubItem(type, name, extra = {}) {
    return {
        _id: `${type}-${name}`,
        _source: {name},
        name,
        finalName: name,
        type,
        system: {prerequisite: null, possibleProviders: [], changes: [], ...(extra.system || {})},
        ...extra
    };
}

/** Runs a prerequisite list against a dummy character with a fixed set of "owned" items. */
function check(prereqs, items = [], actorExtra = {}) {
    const actor = actorWithAbilities({}, actorExtra);
    if (actorExtra.species !== undefined) {
        Object.defineProperty(actor, "species", {value: actorExtra.species, configurable: true});
    }
    return meetsPrerequisites(actor, prereqs, {isLoad: true, embeddedItemOverride: items});
}

test('SPECIES: an unmet species requirement fails, a met one passes', () => {
    const prereq = [{type: "SPECIES", requirement: "Wookiee", text: "Species: Wookiee"}];

    // no species at all - this is the case that used to pass
    expect(check(prereq).doesFail).to.equal(true);
    // wrong species
    expect(check(prereq, [], {species: {finalName: "Human"}}).doesFail).to.equal(true);
    // right species
    const met = check(prereq, [], {species: {finalName: "Wookiee"}});
    expect(met.doesFail).to.equal(false);
    expect(met.successList.length).to.equal(1);
});

test('TRADITION: membership is actually required', () => {
    const prereq = [{type: "TRADITION", requirement: "The Jedi", text: "member of The Jedi"}];

    expect(check(prereq).doesFail).to.equal(true);
    expect(check(prereq, [stubItem("affiliation", "The Sith")]).doesFail).to.equal(true);
    expect(check(prereq, [stubItem("affiliation", "The Jedi")]).doesFail).to.equal(false);
});

test('SPECIAL: the droid checks reject, and both directions work', () => {
    const notADroid = [{type: "SPECIAL", requirement: "Not a Droid", text: "Not a Droid"}];
    const isADroid = [{type: "SPECIAL", requirement: "Is a droid", text: "Is a droid"}];

    // a plain character is not a droid
    expect(check(notADroid).doesFail).to.equal(false);
    // ... so a requirement to *be* a droid must fail.  This used to record nothing at all.
    expect(check(isADroid).doesFail).to.equal(true);

    const droidTrait = stubItem("trait", "Droid", {system: {changes: [{key: "isDroid", value: true}]}});
    expect(check(isADroid, [droidTrait]).doesFail).to.equal(false);
    expect(check(notADroid, [droidTrait]).doesFail).to.equal(true);
});

test('SPECIAL: affiliation backed requirements reject when there is no affiliation', () => {
    const military = [{type: "SPECIAL", requirement: "is part of a military", text: "part of a military"}];
    expect(check(military).doesFail).to.equal(true);
    expect(check(military, [stubItem("affiliation", "The Empire")]).doesFail).to.equal(false);

    const corp = [{
        type: "SPECIAL",
        requirement: "is part of a major interstellar corporation",
        text: "part of a corporation"
    }];
    expect(check(corp).doesFail).to.equal(true);
    expect(check(corp, [stubItem("affiliation", "Czerka")]).doesFail).to.equal(false);
});

test('SPECIAL: a requirement no stored data can decide stays a visible, non blocking note', () => {
    // "Has Built Lightsaber", "Receive the Gamemaster's Approval" and friends cannot be checked.
    // They must not block, but they must be reported - not silently dropped.
    const prereq = [{type: "SPECIAL", requirement: "Has Built Lightsaber", text: "must have built a lightsaber"}];
    const result = check(prereq);

    expect(result.doesFail).to.equal(false);
    expect(result.failureList.length).to.equal(1);
    expect(result.failureList[0].fail).to.equal(false);
    expect(result.failureList[0].unverifiable).to.equal(true);
    expect(result.failureList[0].message).to.equal("must have built a lightsaber");
});

test('LANGUAGE: a language requirement is checked against owned language items', () => {
    const prereq = [{type: "LANGUAGE", requirement: "Binary", text: "Binary as a learned language"}];

    expect(check(prereq).doesFail).to.equal(true);
    expect(check(prereq, [stubItem("language", "Bocce")]).doesFail).to.equal(true);
    expect(check(prereq, [stubItem("language", "Binary")]).doesFail).to.equal(false);
});

test('FORCE SECRET: the count and the named form are both checked', () => {
    const count = [{type: "FORCE SECRET", requirement: "1", text: "At least 1 Force Secret"}];
    expect(check(count).doesFail).to.equal(true);
    expect(check(count, [stubItem("forceSecret", "Devastating Power")]).doesFail).to.equal(false);

    const named = [{type: "FORCE SECRET", requirement: "Devastating Power", text: "Devastating Power"}];
    expect(check(named, [stubItem("forceSecret", "Distant Power")]).doesFail).to.equal(true);
    expect(check(named, [stubItem("forceSecret", "Devastating Power")]).doesFail).to.equal(false);
});

test('FORCE TECHNIQUE: a named requirement no longer throws and is enforced', () => {
    // `feat.data.finalName` threw a TypeError here; the throw took out every following
    // prerequisite of the same item and still reported doesFail = false.
    const owned = [stubItem("forceTechnique", "Force Point Recovery")];
    const named = [{type: "FORCE TECHNIQUE", requirement: "Force Throw Mastery", text: "Force Throw Mastery"}];

    expect(check(named, owned).doesFail).to.equal(true);
    expect(check([{type: "FORCE TECHNIQUE", requirement: "Force Point Recovery", text: "x"}], owned).doesFail)
        .to.equal(false);
});

test('an unsupported prerequisite type is treated as not met instead of being warned about', () => {
    const prereq = [{type: "SOURCE", requirement: "Star Wars Saga Edition Core Rulebook", text: "from the core rulebook"}];
    const result = check(prereq);
    expect(result.doesFail).to.equal(true);
    expect(result.failureList[0].fail).to.equal(true);
});

test('one prerequisite that throws must not disable the rest of the list', () => {
    const boom = {get type() { throw new Error("boom"); }, text: "exploding prerequisite"};
    const unmet = {type: "FEAT", requirement: "No Such Feat", text: "control FEAT"};

    const result = check([boom, unmet]);
    // both are reported, and the item is not free to take
    expect(result.doesFail).to.equal(true);
    expect(result.failureList.length).to.equal(2);
    expect(result.failureList[0].error).to.equal(true);
    expect(result.failureList.some(f => f.message === "control FEAT")).to.equal(true);
});

test('OR without an explicit count means "at least one of"', () => {
    const unmet = [{
        type: "OR", text: "one of two feats",
        children: [{type: "FEAT", requirement: "No Such Feat", text: "a"},
                   {type: "FEAT", requirement: "Also Not A Feat", text: "b"}]
    }];
    expect(check(unmet).doesFail).to.equal(true);

    const met = [{
        type: "OR", text: "one of two traits",
        children: [{type: "TRAIT", requirement: "Fearless", text: "a"},
                   {type: "TRAIT", requirement: "Serenity", text: "b"}]
    }];
    expect(check(met, [stubItem("trait", "Serenity")]).doesFail).to.equal(false);
});

test('a composite prerequisite without children is reported, not treated as met', () => {
    for (const type of ["AND", "OR"]) {
        const result = check([{type, text: `${type} with no children`}]);
        expect(result.doesFail, type).to.equal(false);
        expect(result.failureList.length, type).to.equal(1);
        expect(result.failureList[0].unverifiable, type).to.equal(true);
    }
    const notResult = check([{type: "NOT", text: "NOT with no child"}]);
    expect(notResult.failureList[0].unverifiable).to.equal(true);
});

test('NOT inherits the repaired SPECIES branch', () => {
    const prereq = [{
        type: "NOT", text: "not a Wookiee",
        child: {type: "SPECIES", requirement: "Wookiee", text: "Species: Wookiee"}
    }];
    // a Human is not a Wookiee -> the NOT is satisfied.  Before the SPECIES fix the inner check
    // never failed, so the NOT could never be satisfied.
    expect(check(prereq, [], {species: {finalName: "Human"}}).doesFail).to.equal(false);
    expect(check(prereq, [], {species: {finalName: "Wookiee"}}).doesFail).to.equal(true);
});

test('AND inherits the repaired TRADITION branch', () => {
    const prereq = [{
        type: "AND", text: "member of The Jedi",
        children: [{type: "TRADITION", requirement: "The Jedi", text: "member of The Jedi"}]
    }];
    expect(check(prereq).doesFail).to.equal(true);
    expect(check(prereq, [stubItem("affiliation", "The Jedi")]).doesFail).to.equal(false);
});

test('two composite prerequisites in one list do not share a cache entry', () => {
    // SimpleCache keys on type + requirement + String(options); AND/OR/NOT have no requirement and
    // `options` stringifies to "[object Object]", so the second composite of a kind used to be
    // answered with the first one's result.
    const result = check([
        {type: "AND", text: "met", children: [{type: "TRAIT", requirement: "Serenity", text: "a"}]},
        {type: "AND", text: "unmet", children: [{type: "FEAT", requirement: "No Such Feat", text: "b"}]}
    ], [stubItem("trait", "Serenity")]);
    expect(result.doesFail).to.equal(true);
});

test('ignorePrerequisites still bypasses the repaired branches', () => {
    const unmet = [
        {type: "SPECIES", requirement: "Wookiee", text: "Species: Wookiee"},
        {type: "TRADITION", requirement: "The Jedi", text: "member of The Jedi"},
        {type: "SPECIAL", requirement: "Is a droid", text: "Is a droid"},
        {type: "LANGUAGE", requirement: "Binary", text: "Binary"},
        {type: "SOURCE", requirement: "Somewhere", text: "some book"}
    ];
    expect(meetsPrerequisites(actorWithAbilities(), unmet, {isLoad: true}).doesFail).to.equal(true);

    const ignoring = actorWithAbilities({}, {settings: {ignorePrerequisites: true}});
    expect(meetsPrerequisites(ignoring, unmet, {isLoad: true}).doesFail).to.equal(false);

    const onDrop = actorWithAbilities({}, {settings: {ignorePrerequisitesOnDrop: true}});
    expect(meetsPrerequisites(onDrop, unmet, {isAdd: true}).doesFail).to.equal(false);
    expect(meetsPrerequisites(onDrop, unmet, {isLoad: true}).doesFail).to.equal(true);
    expect(meetsPrerequisites(actorWithAbilities(), unmet, {skipPrerequisite: true}).doesFail).to.equal(false);
    expect(meetsPrerequisites(actorWithAbilities(), unmet, {isUpload: true}).doesFail).to.equal(false);
});

test('the checkable controls keep rejecting', () => {
    expect(check([{type: "FEAT", requirement: "No Such Feat", text: "FEAT"}]).doesFail).to.equal(true);
    expect(check([{type: "TRAIT", requirement: "No Such Trait", text: "TRAIT"}]).doesFail).to.equal(true);
    expect(check([{type: "ATTRIBUTE", requirement: "Strength 99", text: "ATTRIBUTE"}]).doesFail).to.equal(true);
    expect(check([{type: "DARK SIDE SCORE", requirement: "99", text: "DSS"}]).doesFail).to.equal(true);
    expect(check([{type: "TRAINED SKILL", requirement: "No Such Skill", text: "SKILL"}]).doesFail).to.equal(true);
    expect(check([{type: "TALENT", requirement: "No Such Talent", text: "TALENT"}]).doesFail).to.equal(true);
    // ... and keep accepting what is met
    expect(check([{type: "FEAT", requirement: "Force Sensitivity", text: "FEAT"}],
        [stubItem("feat", "Force Sensitivity")]).doesFail).to.equal(false);
    expect(check([{type: "TRAIT", requirement: "Serenity", text: "TRAIT"}],
        [stubItem("trait", "Serenity")]).doesFail).to.equal(false);
    expect(check([{type: "ATTRIBUTE", requirement: "Strength 10", text: "ATTRIBUTE"}]).doesFail).to.equal(false);
});

test('a prerequisite evaluated against an item resolves instead of throwing', () => {
    // Change level prerequisites (ARMOR_TYPE / WEAPON_SIZE / DAMAGE_TYPE on the weapon and armor
    // templates) are evaluated with the *item* as target.  `inheritableItems` calls
    // `actor.itemsWithTypes`, which an item does not have, so this threw before the switch ran; the
    // old whole-loop try/catch turned the throw into "met", the new per-prerequisite guard would
    // turn it into "not met" - both wrong.
    const armor = stubItem("armor", "Blast Helmet and Vest",
        {system: {changes: [{key: "armorType", value: "Light Armor"}]}});

    const light = meetsPrerequisites(armor, [{type: "ARMOR_TYPE", requirement: "Light", text: "Light Armor"}],
        {isLoad: true});
    expect(light.doesFail).to.equal(false);
    expect(light.failureList.filter(f => f.error).length).to.equal(0);

    const heavy = meetsPrerequisites(armor, [{type: "ARMOR_TYPE", requirement: "Heavy", text: "Heavy Armor"}],
        {isLoad: true});
    expect(heavy.doesFail).to.equal(true);
    expect(heavy.failureList.filter(f => f.error).length).to.equal(0);
});

test('ARMOR_TYPE and CONDITION are real branches, not default: fallthrough', () => {
    // Both types only occur on change level / provided item prerequisites, which is why they were
    // missing from the type histogram of item prerequisites.  With `default:` now failing, they had
    // to be implemented or the Massassi armor template and the vehicle template ability bonuses
    // would have been switched off.
    const light = [{type: "ARMOR_TYPE", requirement: "Light", text: "Light Armor"}];
    const lightArmor = stubItem("armor", "Blast Helmet and Vest",
        {system: {changes: [{key: "armorType", value: "Light Armor"}]}});
    const heavyArmor = stubItem("armor", "Heavy Battle Armor",
        {system: {changes: [{key: "armorType", value: "Heavy Armor"}]}});
    expect(check(light, [lightArmor]).doesFail).to.equal(false);
    expect(check(light, [heavyArmor]).doesFail).to.equal(true);
    expect(check(light).doesFail).to.equal(true);

    const undamaged = [{type: "CONDITION", requirement: "0", text: "0"}];
    const actor = actorWithAbilities();
    expect(meetsPrerequisites(actor, undamaged, {isLoad: true, embeddedItemOverride: []}).doesFail)
        .to.equal(false);
    Object.defineProperty(actor, "condition", {value: "-2", configurable: true});
    expect(meetsPrerequisites(actor, undamaged, {isLoad: true, embeddedItemOverride: []}).doesFail)
        .to.equal(true);
});
