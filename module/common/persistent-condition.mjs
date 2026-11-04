/**
 * Persistent conditions (Core Rulebook p.149): while one is active, the Recover
 * action cannot move the condition track up and natural healing gives no hit points.
 */
export const PERSISTENT_FLAG = "persistentCondition";

export function canRecover(persistent) {
    return !persistent;
}

export function naturalHealingAllowed(persistent) {
    return !persistent;
}
