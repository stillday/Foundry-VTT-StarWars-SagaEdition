// Regression tests for the sheet level operating errors found in a real v14 session.
// Node's test runner gives each file its own process, so replacing globals here is local.

import test from 'node:test';
import {expect} from 'chai';

// A Roll stand-in whose validate() behaves like v14's: it parses the formula and reports failure
// rather than throwing (client/dice/roll.mjs:773).  "1d20 + " is the exact fragment the ability
// score template used to emit.
global.Roll = class {
    constructor(formula, data) {
        this.formula = formula;
        this.data = data;
    }
    evaluate() { return this; }
    static validate(formula) {
        if (typeof formula !== "string") return false;
        const cleaned = formula.replace(/@([a-z.0-9_-]+)/gi, "1").trim();
        if (!cleaned) return false;
        // Reject a trailing or leading operator, and anything that is not dice/number/operator.
        if (/[+\-*/]$/.test(cleaned) || /^[*/]/.test(cleaned)) return false;
        return /^[-+*/() 0-9dkhl]+$/i.test(cleaned);
    }
};

const {isRollableFormula, getRollFromDataSet} = await import('../module/actor/actor-sheet.mjs');
const {toChat} = await import('../module/common/util.mjs');

test('isRollableFormula rejects the interpolation leftovers templates produce (F1)', () => {
    // What the ability score template used to render when attribute.roll was undefined.
    expect(isRollableFormula("1d20 + ")).to.equal(false);
    expect(isRollableFormula("1d20 +")).to.equal(false);
    expect(isRollableFormula("")).to.equal(false);
    expect(isRollableFormula("   ")).to.equal(false);
    expect(isRollableFormula(undefined)).to.equal(false);
    expect(isRollableFormula(7)).to.equal(false);
    // Complete formulas, including the comma separated multi roll _onRoll splits on.
    expect(isRollableFormula("1d20 + 3")).to.equal(true);
    expect(isRollableFormula("1d20 - 0")).to.equal(true);
    expect(isRollableFormula("1d20 + 3,1d20 + 3")).to.equal(true);
    // A dangling comma leaves an empty segment, which used to reach new Roll("").
    expect(isRollableFormula("1d20 + 3,")).to.equal(false);
});

test('getRollFromDataSet falls back to the resolved variable for an incomplete data-roll (F1)', () => {
    const sheet = {object: {resolvedVariables: new Map([["@STRROLL", "1d20 + 2"]])}};

    // Broken data-roll, usable variable: the variable wins instead of the click throwing.
    expect(getRollFromDataSet.call(sheet, {roll: "1d20 + ", variable: "@STRROLL"})).to.equal("1d20 + 2");
    // A good data-roll still takes precedence.
    expect(getRollFromDataSet.call(sheet, {roll: "1d20 + 5", variable: "@STRROLL"})).to.equal("1d20 + 5");
    // Nothing usable anywhere resolves to undefined, which _onRoll treats as "no roll".
    expect(getRollFromDataSet.call(sheet, {roll: "1d20 + "})).to.equal(undefined);
    // Whitespace only data-roll is not a formula either.
    expect(getRollFromDataSet.call(sheet, {roll: "  ", variable: "@STRROLL"})).to.equal("1d20 + 2");
});

test('toChat resolves a speaker without a bound sheet (F2)', async () => {
    const speakers = [];
    const created = [];

    class ChatMessageStub {
        constructor(data) { Object.assign(this, data); }
        static getSpeaker(options = {}) { speakers.push(options); return {alias: options.actor?.name ?? "Test User"}; }
        static applyMode() {}
        static create(msg) { created.push(msg); return Promise.resolve(msg); }
    }
    global.ChatMessage = ChatMessageStub;
    global.getDocumentClass = () => ChatMessageStub;
    global.CONFIG = {...(global.CONFIG ?? {}), sounds: {dice: "sound.ogg"}};
    global.CONST = {...(global.CONST ?? {}), CHAT_MESSAGE_STYLES: {IC: 2, OOC: 1}};

    const actor = new global.Actor({name: "Rey"});

    // 1) No speaker source at all: used to throw "Cannot read properties of undefined
    //    (reading 'object')" because toChat fell back to `this.object.parent`.
    await toChat("<p>plain</p>");
    expect(speakers.at(-1)).to.deep.equal({});

    // 2) A world item has no parent Actor; the message is still posted, spoken by the user.
    const worldItem = new global.Item({name: "Zabrak"});
    worldItem.parent = null;
    await toChat("<p>world item</p>", worldItem, "Zabrak");
    expect(speakers.at(-1)).to.deep.equal({});

    // 3) An owned item speaks as its Actor.
    const ownedItem = new global.Item({name: "Melee Defense"});
    ownedItem.parent = actor;
    await toChat("<p>owned item</p>", ownedItem, "Melee Defense");
    expect(speakers.at(-1).actor).to.equal(actor);

    // 4) An Actor passed directly still works.
    await toChat("<p>actor</p>", actor);
    expect(speakers.at(-1).actor).to.equal(actor);

    expect(created).to.have.lengthOf(4);
    expect(created[1].flavor).to.equal("Zabrak");
});

// --- F7: the attack button never fired --------------------------------------------------------
// `data-attack-key` sits on the wrapping div.attack-button, because that wrapper is also the
// ContextMenu selector (issues #552/#554).  The click listener is bound to the inner button.attack,
// whose own dataset is empty, so _onMakeAttack used to send `attackKeys: [undefined]` and the attack
// silently resolved to nothing.
const {SWSEActorSheet} = await import('../module/actor/actor-sheet.mjs');

/** minimal element stand-in with the one DOM method the resolver uses */
function el(dataset, parent = null) {
    const node = {
        dataset,
        parentElement: parent,
        matches(selector) {
            return selector.split(",").map(s => s.trim()).some(s => {
                const m = /^\[data-([a-z-]+)\]$/.exec(s);
                if (!m) return false;
                const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
                return dataset[key] !== undefined;
            });
        },
        closest(selector) {
            let cur = node;
            while (cur) {
                if (cur.matches(selector)) return cur;
                cur = cur.parentElement;
            }
            return null;
        }
    };
    return node;
}

test('_attackDataset reads the attack key off the wrapping .attack-button (F7)', () => {
    const read = SWSEActorSheet.prototype._attackDataset;

    // The real weapon-block shape: button -> div.attack-button[data-attack-key] -> div.attack[...]
    const wrapper = el({action: "singleAttack", attackKey: "Actor.abc.Item.def"});
    const button = el({}, wrapper);
    expect(read.call(null, button).attackKey).to.equal("Actor.abc.Item.def");

    // The context menu is bound to the wrapper itself, and it must keep seeing the same payload.
    expect(read.call(null, wrapper).attackKey).to.equal("Actor.abc.Item.def");
    expect(read.call(null, wrapper).action).to.equal("singleAttack");

    // A full attack list on an ancestor is found as well.
    const listWrapper = el({action: "fullAttack", attackKeys: "a,b"});
    expect(read.call(null, el({}, listWrapper)).attackKeys).to.equal("a,b");

    // The "Full Attack" button carries no key at all: no key, and no crash.
    const bare = el({action: "fullAttack"});
    expect(read.call(null, el({}, bare)).attackKey).to.equal(undefined);
    expect(read.call(null, null)).to.deep.equal({});
});
