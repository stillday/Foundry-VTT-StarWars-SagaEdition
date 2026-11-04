import {describe, it} from "node:test";
import {expect} from "chai";
import {canRecover, naturalHealingAllowed} from "../module/common/persistent-condition.mjs";

describe("persistent condition (CRB p.149)", () => {
    it("blocks Recover and natural healing while persistent", () => {
        expect(canRecover(true)).to.equal(false);
        expect(naturalHealingAllowed(true)).to.equal(false);
    });
    it("allows both otherwise", () => {
        expect(canRecover(false)).to.equal(true);
        expect(canRecover(undefined)).to.equal(true);
        expect(naturalHealingAllowed(false)).to.equal(true);
    });
});
