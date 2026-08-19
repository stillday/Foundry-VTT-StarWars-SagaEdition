console.log("Starting effect cleanup tests ")

import test from 'node:test';
import {expect} from 'chai';
import {deleteEffectsSafely} from '../module/active-effect/active-effect.mjs';

/** Minimal stand-in for a document owning an ActiveEffect collection. */
function parentWithEffects(ids) {
    const store = new Map(ids.map(id => [id, {id}]));
    return {
        name: "Cleanup Dummy",
        effects: {get: id => store.get(id)},
        requests: [],
        async deleteEmbeddedDocuments(name, deleteIds) {
            this.requests.push([...deleteIds]);
            for (const id of deleteIds) {
                if (!store.has(id)) throw new Error(`ActiveEffect "${id}" does not exist!`);
                store.delete(id);
            }
            return deleteIds.map(id => ({id}));
        }
    };
}

test('deleteEffectsSafely deletes the effects that exist', async () => {
    const parent = parentWithEffects(["a", "b", "c"]);
    const deleted = await deleteEffectsSafely(parent, ["a", "c"]);

    expect(parent.requests).to.deep.equal([["a", "c"]]);
    expect(deleted.map(d => d.id)).to.deep.equal(["a", "c"]);
});

test('deleteEffectsSafely skips ids whose document is already gone', async () => {
    const parent = parentWithEffects(["a"]);
    await deleteEffectsSafely(parent, ["a"]);
    // second cleanup path for the same effect - must not reach the server again
    const again = await deleteEffectsSafely(parent, ["a"]);

    expect(parent.requests).to.deep.equal([["a"]]);
    expect(again).to.deep.equal([]);
});

test('deleteEffectsSafely never requests one id twice concurrently', async () => {
    const parent = parentWithEffects(["a", "b"]);
    // two cleanup paths racing for the same effect, neither able to await the other
    const results = await Promise.all([
        deleteEffectsSafely(parent, ["a", "b"]),
        deleteEffectsSafely(parent, ["a"])
    ]);

    expect(parent.requests).to.deep.equal([["a", "b"]]);
    expect(results[1]).to.deep.equal([]);
});

test('deleteEffectsSafely makes no request when there is nothing to delete', async () => {
    const parent = parentWithEffects([]);
    expect(await deleteEffectsSafely(parent, [])).to.deep.equal([]);
    expect(await deleteEffectsSafely(parent, [undefined, null, "missing"])).to.deep.equal([]);
    expect(parent.requests).to.deep.equal([]);
});

test('deleteEffectsSafely releases its pending ids when the deletion fails', async () => {
    const parent = parentWithEffects(["a"]);
    parent.deleteEmbeddedDocuments = async () => { throw new Error("boom"); };
    let caught = null;
    try { await deleteEffectsSafely(parent, ["a"]); } catch (e) { caught = e.message; }

    expect(caught).to.equal("boom");
    expect(parent.__pendingEffectDeletions.size).to.equal(0);
});
