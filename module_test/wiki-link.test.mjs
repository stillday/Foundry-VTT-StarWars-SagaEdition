import {test} from "node:test";
import assert from "node:assert/strict";
import {wikiUrl, WIKI_BASE, WIKI_HOOKS} from "../module/common/wiki-link.mjs";

test("wikiUrl builds the page URL with underscores", () => {
    assert.equal(wikiUrl("Catch a Second Wind"), WIKI_BASE + "Catch_a_Second_Wind");
});
test("wikiUrl encodes special characters", () => {
    assert.equal(wikiUrl("Force Sensitivity & Co"), WIKI_BASE + "Force_Sensitivity_%26_Co");
});
test("wikiUrl returns null for empty names", () => {
    assert.equal(wikiUrl("  "), null);
    assert.equal(wikiUrl(undefined), null);
});

test("wikiUrl supports the Miraheze wiki", async () => {
    const {WIKI_BASE_MIRAHEZE} = await import("../module/common/wiki-link.mjs");
    assert.equal(wikiUrl("Long Stride", WIKI_BASE_MIRAHEZE), "https://swse.miraheze.org/wiki/Long_Stride");
});

test("Jedipedia is offered for lore item types only", async () => {
    const {WIKIS, LORE_TYPES} = await import("../module/common/wiki-link.mjs");
    const jedi = WIKIS.find(w => w.id === "jedipedia");
    assert.ok(jedi.types.includes("species"));
    assert.ok(!LORE_TYPES.includes("feat"));
    assert.equal(wikiUrl("Zabrak", jedi.base), "https://jedipedia.fandom.com/wiki/Zabrak");
});

test("WIKI_HOOKS includes renderSWSEItemSheet and renderItemSheetV2", () => {
    assert.ok(WIKI_HOOKS.includes("renderSWSEItemSheet"));
    assert.ok(WIKI_HOOKS.includes("renderItemSheetV2"));
});
