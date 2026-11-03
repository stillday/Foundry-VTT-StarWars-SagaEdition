import test from 'node:test';
import {expect} from 'chai';
import {firstFreeSecondWind, meetsSecondWindThreshold, secondWindHealing} from '../module/common/second-wind.mjs';

// Core Rulebook p.146 (PDF 154), "Second Wind"
test('second wind heals a quarter of the maximum (rounded down) when that beats Constitution', () => {
    expect(secondWindHealing(60, 12)).to.equal(15);
    expect(secondWindHealing(63, 12)).to.equal(15);
});

test('second wind heals the Constitution score when it is higher than a quarter', () => {
    expect(secondWindHealing(20, 14)).to.equal(14);
});

test('a droid without Constitution only gets the quarter', () => {
    expect(secondWindHealing(40, undefined)).to.equal(10);
    expect(secondWindHealing(40, null)).to.equal(10);
});

test('second wind needs half the maximum hit points or less', () => {
    expect(meetsSecondWindThreshold(10, 20)).to.equal(true);
    expect(meetsSecondWindThreshold(11, 20)).to.equal(false);
    expect(meetsSecondWindThreshold(1, 0)).to.equal(false);
});

test('first free second wind slot ignores spent ones', () => {
    expect(firstFreeSecondWind(2, {0: true})).to.equal(1);
    expect(firstFreeSecondWind(1, {0: true})).to.equal(-1);
    expect(firstFreeSecondWind(0, {})).to.equal(-1);
    expect(firstFreeSecondWind(1, undefined)).to.equal(0);
});
