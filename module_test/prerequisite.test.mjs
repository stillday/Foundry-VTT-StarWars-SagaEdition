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
