import {getInheritableAttribute} from "../attribute-helper.mjs";
import SWSEActor from "./actor.mjs";
/**
 *
 * @param {SWSEActor|null} actor
 * @returns {{value: number, max: number}}
 */
export function resolveShield(actor) {
    if (!actor) {
        return {max: 0, value: 0, active: false, failureChance: 0};
    }
    let shields = actor.system.shields
    shields.max = shields.override ;
    if(!shields.override){
        let shieldRating = getInheritableAttribute({
            entity: actor,
            attributeKey: 'shieldRating',
            reduce: "SUM"
        })

        let advancedShieldRating = getInheritableAttribute({
            entity: actor,
            attributeKey: 'advancedShieldRating',
            reduce: "MAX"
        })
//TODO make sure the 0 state doesn't activate if a users shields are dropped to 0
        if (advancedShieldRating > 0) {
            if (shieldRating === 0) {
                shieldRating = advancedShieldRating * 2 + 10
            } else {
                shieldRating = shieldRating + advancedShieldRating;
            }
        }
        shields.max = shieldRating;
    }

    let value = Array.isArray(shields?.value) ? shields?.value[0] : shields?.value || 0;
    let failureChance = getInheritableAttribute({
        entity: actor,
        attributeKey: 'shieldFailureChance',
        reduce: "MAX"
    });
    let active = !!actor.effects.find(effect => effect.statuses && effect.statuses.has('shield') && effect.disabled === false);
    shields.value = value;
    // `SWSEActor#shields` calls this legacy resolver and it writes straight back into
    // `actor.system.shields`, so it overwrote the value the DataModel already derived in
    // ShieldFunctions._prepareShieldsDerivedData (data/templates/shields.mjs).  "MAX" reduces from
    // an initial `undefined` (util.mjs maxValue), so an actor without any shieldFailureChance
    // source ended up back at `system.shields.failureChance === undefined` as soon as the sheet
    // rendered - which is why the fix in the DataModel appeared to have no effect.
    shields.failureChance = failureChance ?? 0;
    shields.active = active;
    return shields;
}

/**
 *
 * @param actor {SWSEActor}
 * @param ignoreCon
 * @return {*|number}
 */
function resolveAttributeMod(actor, ignoreCon) {
    if (ignoreCon) {
        return 0;
    }
    return Math.max(actor.attributes.con.mod, 0);
}