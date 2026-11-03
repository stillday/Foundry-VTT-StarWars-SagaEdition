import test from 'node:test';
import {expect} from 'chai';

const {SWSEActorSheet} = await import('../module/actor/actor-sheet.mjs');

function makeRow(amountValue) {
    const input = {value: String(amountValue)};
    return {
        querySelector(sel) {
            if (sel === '.hp-adjust-amount') return input;
            return null;
        },
        _input: input,
    };
}

function makeEvent(row) {
    return {
        preventDefault() {},
        stopPropagation() {},
        currentTarget: {
            closest(sel) {
                if (sel === '.hp-adjust-row') return row;
                return null;
            }
        }
    };
}

function makeSheet(value, max) {
    const updates = [];
    return {
        actor: {
            system: {health: {value, max}},
            update(data) {
                updates.push(data);
                return Promise.resolve();
            }
        },
        _updates: updates,
    };
}

test('_onApplyDamage subtracts amount from current HP', async () => {
    const sheet = makeSheet(15, 20);
    const row = makeRow(5);
    await SWSEActorSheet.prototype._onApplyDamage.call(sheet, makeEvent(row));
    expect(sheet._updates.at(-1)["system.health.value"]).to.equal(10);
    expect(row._input.value).to.equal('');
});

test('_onApplyDamage clamps at 0 (overkill damage)', async () => {
    const sheet = makeSheet(10, 20);
    const row = makeRow(15);
    await SWSEActorSheet.prototype._onApplyDamage.call(sheet, makeEvent(row));
    expect(sheet._updates.at(-1)["system.health.value"]).to.equal(0);
});

test('_onApplyDamage does nothing for zero or negative amounts', async () => {
    const sheet = makeSheet(10, 20);
    const row0 = makeRow(0);
    await SWSEActorSheet.prototype._onApplyDamage.call(sheet, makeEvent(row0));
    expect(sheet._updates).to.have.lengthOf(0);

    const rowNeg = makeRow(-5);
    await SWSEActorSheet.prototype._onApplyDamage.call(sheet, makeEvent(rowNeg));
    expect(sheet._updates).to.have.lengthOf(0);
});

test('_onApplyHeal adds amount to current HP', async () => {
    const sheet = makeSheet(10, 20);
    const row = makeRow(5);
    await SWSEActorSheet.prototype._onApplyHeal.call(sheet, makeEvent(row));
    expect(sheet._updates.at(-1)["system.health.value"]).to.equal(15);
    expect(row._input.value).to.equal('');
});

test('_onApplyHeal clamps at max (overhealing)', async () => {
    const sheet = makeSheet(18, 20);
    const row = makeRow(10);
    await SWSEActorSheet.prototype._onApplyHeal.call(sheet, makeEvent(row));
    expect(sheet._updates.at(-1)["system.health.value"]).to.equal(20);
});

test('_onApplyHeal does nothing for zero amount', async () => {
    const sheet = makeSheet(10, 20);
    const row = makeRow(0);
    await SWSEActorSheet.prototype._onApplyHeal.call(sheet, makeEvent(row));
    expect(sheet._updates).to.have.lengthOf(0);
});

test('health pct calculation: 50% of 20 is 50', () => {
    const pct = (value, max) =>
        max > 0 ? Math.min(100, Math.max(0, Math.round(value / max * 100))) : 0;
    expect(pct(10, 20)).to.equal(50);
    expect(pct(0, 20)).to.equal(0);
    expect(pct(20, 20)).to.equal(100);
    expect(pct(0, 0)).to.equal(0);
    expect(pct(25, 20)).to.equal(100);
    expect(pct(1, 20)).to.equal(5);
});
