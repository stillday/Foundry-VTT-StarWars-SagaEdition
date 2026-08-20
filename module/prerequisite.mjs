import {
    equippedItems,
    filterItemsByTypes,
    inheritableItems,
    resolveExpression,
    resolveValueArray,
    toNumber
} from "./common/util.mjs";
import {sizeArray, weaponGroup} from "./common/constants.mjs";
import {getInheritableAttribute, getResolvedSize} from "./attribute-helper.mjs";
import SWSEActor from "./actor/actor.mjs";
import {SWSEItem} from "./item/item.mjs";
import {SimpleCache} from "./common/simple-cache.mjs";

function ensureArray(array) {
    if (Array.isArray(array)) {
        return array;
    } else if (!!array[0]) {
        return Object.values(array)
    }
    return [array];
}

function filterEquippedItemsByCriteria(target, resolvedItems, req) {
    let items = equippedItems(target);
    let filteredEquippedItems = items.filter(item => {
        let actsAs = getInheritableAttribute({
            entity: item,
            recursive: true,
            embeddedItemOverride: resolvedItems,
            attributeKey: ["actsAsForProficiency", "actsAs", "armorType"],
            reduce: "VALUES"
        })

        return item.name === req || item.finalName === req || target.system?.subtype === req || actsAs.includes(req)
    });
    return filteredEquippedItems;
}

/**
 * The current Dark Side Score of a target.  The schema exposes `system.darkside.value` (the stored
 * score) and the derived `system.darkside.finalScore` (score + darksideTaint); prefer the derived
 * value when it has been prepared.  Note there is a second, unused `system.darkSide.value` schema
 * declaration in module/actor/data/templates/traits.mjs which nothing writes to.
 * @param {SWSEActor|Object} target
 * @returns {number}
 */
function darkSideScore(target) {
    const darkside = target?.system?.darkside;
    return darkside?.finalScore ?? darkside?.value ?? 0;
}

/**
 * Normalises the child list of a composite prerequisite (AND / OR).  The pack data stores these
 * either as an array or as an object keyed by index; a node with no children at all is malformed
 * and must not be silently treated as satisfied.
 * @param {Object[]|Object|undefined|null} value
 * @returns {Object[]}
 */
function childPrerequisites(value) {
    if (value === undefined || value === null) {
        return [];
    }
    const children = ensureArray(value);
    return children.filter(child => !!child);
}

/**
 * Message for a prerequisite that carries no machine readable content (narrative "GM approval"
 * style requirements, composite nodes without children).
 * @param {Object} prereq
 * @returns {string}
 */
function prerequisiteMessage(prereq) {
    return `${prereq.text ?? `${prereq.type}: ${prereq.requirement ?? ""}`}`;
}

/**
 * SPECIAL requirements that no data on the actor can decide - membership in an organisation, having
 * built a lightsaber, GM approval, appendage counts (droid appendages are equipment items with a
 * subtype, not a countable attribute) and the "Cyborg Hybrid" droid template, which does not exist
 * as an item in any compendium.  These are reported as a visible, non blocking note so the player
 * still sees them, instead of being treated as met (which is what the old fallthrough did for
 * *every* SPECIAL requirement, including the ones that are perfectly checkable).
 * @type {string[]}
 */
const UNVERIFIABLE_SPECIAL_REQUIREMENTS = [
    "has built lightsaber",
    "cyborg hybrid",
    "sworn defender of emperor roan fel",
    "must belong to a law enforcement",
    "2+ appendages",
    "2+ tool appendages",
    "have a destiny",
    "receive the gamemaster's approval",
    "must possess an implant"
];

/**
 * The item list a prerequisite is resolved against.
 *
 * `inheritableItems` calls `actor.itemsWithTypes`, which only exists on SWSEActor.  A good number of
 * prerequisites are evaluated against an *item*: the change level prerequisites on the weapon and
 * armor templates (ARMOR_TYPE / WEAPON_SIZE / DAMAGE_TYPE, resolved by getValues in
 * attribute-helper.mjs against the item the template is applied to) and the provided item
 * prerequisites on droid and vehicle templates.  For those, this line threw a TypeError before the
 * switch even ran.  The old whole-loop try/catch turned that into "prerequisite met"; with the
 * failure now reported it would turn into "prerequisite not met" and silently switch those changes
 * off, so the item case has to be handled instead of thrown.  An item has no inheritable item list
 * of its own - its own changes are read straight off the document by getInheritableAttribute.
 * @param {SWSEActor|SWSEItem|Object} target
 * @param {Object} options
 * @returns {Object[]}
 */
function resolveItemsFor(target, options) {
    if (options.embeddedItemOverride) {
        return options.embeddedItemOverride;
    }
    if (typeof target?.itemsWithTypes !== "function") {
        return [];
    }
    return inheritableItems(target);
}

function meetsPrerequisite(prereq, target, options) {
    const fn = () => {
        let failureList = [];
        let successList = [];
        const resolvedItems = resolveItemsFor(target, options);
        switch (prereq.type.toUpperCase()) {
            case undefined:
                break;
            case 'AGE':
                let age = toNumber(target.age) || toNumber(target.system.age);
                if (!age || toNumber(prereq.low) > age || (prereq.high && toNumber(prereq.high) < age)) {
                    failureList.push({fail: true, message: `${prereq.type}: ${prereq.text}`});
                    break;
                }
                successList.push({prereq, count: 1});
                break;
            case 'SIZE':
                let resolvedSize = getResolvedSize(target, options)
                if (sizeArray[resolvedSize] !== prereq.requirement) {
                    failureList.push({fail: true, message: `${prereq.type}: ${prereq.text}`});
                    break;
                }
                successList.push({prereq, count: 1});
                break;
            case 'CHARACTER LEVEL':
                if (!(target.characterLevel < toNumber(prereq.requirement))) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'BASE ATTACK BONUS':
                if (!(target._baseAttackBonus(resolvedItems) < parseInt(prereq.requirement))) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'DARK SIDE SCORE': {
                // `system.darkside` (abilities.mjs / commondata.mjs) holds `value` plus the derived
                // `finalScore` (= value + darksideTaint).  There is no `score`, so this read `undefined`
                // and `!(undefined < n)` made every DARK SIDE SCORE prerequisite pass.
                // An unresolvable requirement has the same effect: resolveExpression returns the
                // literal "@WISTOTAL" for an unknown variable and `!(0 < "@WISTOTAL")` is true, so
                // the three "@WISTOTAL" prerequisites in the compendium passed for every character.
                const requiredScore = Number(resolveValueArray([prereq.requirement], target));
                if (!Number.isFinite(requiredScore)) {
                    console.error("SWSE | DARK SIDE SCORE prerequisite does not resolve to a number",
                        prereq.requirement, target?.name);
                    failureList.push({fail: true, message: `${prerequisiteMessage(prereq)} (requirement "${prereq.requirement}" does not resolve to a number)`});
                    break;
                }
                if (!(darkSideScore(target) < requiredScore)) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: prerequisiteMessage(prereq)});
                break;
            }
            case 'ITEM':
                let filteredItem = resolvedItems.filter(feat => feat.finalName === prereq.requirement);
                if (filteredItem.length > 0) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'SPECIES':
                let filteredSpecies = [target.species].filter(feat => feat?.finalName === prereq.requirement);
                if (filteredSpecies.length > 0) {
                    successList.push({prereq, count: 1});
                    break;
                }
                // The failure path used to `break` without pushing anything onto the failureList, so
                // `doesFail` stayed false: every SPECIES prerequisite was met by every character.
                failureList.push({fail: true, message: prerequisiteMessage(prereq)});
                break;
            case 'TRAINED SKILL':
                if (target.trainedSkills.filter(skill => skill.label.toLowerCase() === prereq.requirement.toLowerCase() && skill.trained).length === 1) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'FEAT':
                let filteredFeats;
                if (prereq.requirement.toLowerCase().includes("(any)")) {
                    let req = prereq.requirement.replace(/ \(a|Any\)/, "");
                    filteredFeats = resolvedItems
                        .filter(item => item.type === "feat"
                            && SWSEItem.buildItemName(item).startsWith(req));
                } else if (prereq.requirement.includes("(Exotic Melee Weapons)")) {
                    let exoticMeleeWeapons = game.generated?.exoticMeleeWeapons || [];
                    let possibleFeats = exoticMeleeWeapons?.map(w => prereq.requirement.replace("(Exotic Melee Weapons)", `(${w})`))

                    filteredFeats = resolvedItems
                        .filter(item => item.type === "feat"
                            && possibleFeats.includes(SWSEItem.buildItemName(item)));
                } else {
                    filteredFeats = resolvedItems
                        .filter(item => item.type === "feat"
                            && SWSEItem.buildItemName(item) === prereq.requirement);
                }

                if (filteredFeats.length > 0) {
                    let prereqs1 = filteredFeats[0].system?.prerequisite;
                    if (!meetsPrerequisites(target, prereqs1, options).doesFail) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'CLASS':
                let filteredClasses = resolvedItems
                    .filter(item => item.type === "class"
                        && item.finalName === prereq.requirement);
                if (filteredClasses.length > 0) {
                    if (!meetsPrerequisites(target, filteredClasses[0].system.prerequisite, options).doesFail) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'TRAIT':
                let filteredTraits = resolvedItems
                    .filter(item => item.type === "trait"
                        && item.finalName === prereq.requirement);
                if (filteredTraits.length > 0) {
                    let parentsMeetPrequisites = false;
                    for (let filteredTrait of filteredTraits) {
                        if (!meetsPrerequisites(target, filteredTrait.system.prerequisite, options).doesFail) {
                            successList.push({prereq, count: 1});
                            parentsMeetPrequisites = true;
                        }
                    }
                    if (parentsMeetPrequisites) {
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'SPECIAL_QUALITY':
                let filteredSpecialQualities = resolvedItems
                    .filter(item => item.type === "beastQuality"
                        && item.finalName === prereq.requirement);
                if (filteredSpecialQualities.length > 0) {
                    let parentsMeetPrequisites = false;
                    for (let filteredTrait of filteredSpecialQualities) {
                        if (!meetsPrerequisites(target, filteredTrait.system.prerequisite, options).doesFail) {
                            successList.push({prereq, count: 1});
                            parentsMeetPrequisites = true;
                        }
                    }
                    if (parentsMeetPrequisites) {
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'SPECIES_TYPE':
                let filteredSpeciesTypes = resolvedItems
                    .filter(item => item.type === "beastType"
                        && item.finalName === prereq.requirement);
                if (filteredSpeciesTypes.length > 0) {
                    let parentsMeetPrequisites = false;
                    for (let filteredTrait of filteredSpeciesTypes) {
                        if (!meetsPrerequisites(target, filteredTrait?.system?.prerequisite, options).doesFail) {
                            successList.push({prereq, count: 1});
                            parentsMeetPrequisites = true;
                        }
                    }
                    if (parentsMeetPrequisites) {
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'BEAST_ATTACK':
                let filteredBeastAttacks = resolvedItems
                    .filter(item => item.type === "beastAttack"
                        && item.finalName === prereq.requirement);
                if (filteredBeastAttacks.length > 0) {
                    let parentsMeetPrequisites = false;
                    for (let filteredTrait of filteredBeastAttacks) {
                        if (!meetsPrerequisites(target, filteredTrait?.system?.prerequisite, options).doesFail) {
                            successList.push({prereq, count: 1});
                            parentsMeetPrequisites = true;
                        }
                    }
                    if (parentsMeetPrequisites) {
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'PROFICIENCY':
                let proficiencies = getInheritableAttribute({
                    entity: target,
                    recursive: true,
                    embeddedItemOverride: resolvedItems,
                    attributeKey: ["weaponProficiency", "armorProficiency"],
                    reduce: "VALUES_TO_LOWERCASE"
                })
                if(prereq.requirement === 'Armor equipped'){
                    let proficientArmor = [];
                    if(proficiencies.includes("light") || proficiencies.includes("light armor")){
                        proficientArmor.push(...filterEquippedItemsByCriteria(target, resolvedItems, "Light Armor"))
                    }
                    if(proficiencies.includes("heavy") || proficiencies.includes("heavy armor")){
                        proficientArmor.push(...filterEquippedItemsByCriteria(target, resolvedItems, "Heavy Armor"))
                    }
                    if(proficiencies.includes("medium") || proficiencies.includes("medium armor")){
                        proficientArmor.push(...filterEquippedItemsByCriteria(target, resolvedItems, "Medium Armor"))
                    }
                    if(proficientArmor.length > 0){
                        successList.push({prereq, count: 1});
                        break;
                    }
                }


                if (proficiencies.includes(prereq.requirement.toLowerCase())) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'TALENT':
                let filteredTalents = resolvedItems
                    .filter(item => {
                        if (item.type !== "talent") {
                            return false;
                        }
                        let actsAs = getInheritableAttribute({
                            entity: item,
                            recursive: true,
                            attributeKey: "actsAs",
                            reduce: "VALUES"
                        }) || []

                        return item.finalName === prereq.requirement ||
                            item.system.possibleProviders.includes(prereq.requirement) ||
                            item.system.talentTree === prereq.requirement || actsAs.includes(prereq.requirement)
                    });

                if (filteredTalents.length > 0) {
                    if (!meetsPrerequisites(target, filteredTalents[0].system.prerequisite, options).doesFail) {
                        successList.push({prereq, count: filteredTalents.length});
                        break;
                    }
                }

                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'TRADITION':
                let filteredTraditions = resolvedItems
                    .filter(item => item.type === "affiliation"
                        && item.finalName === prereq.requirement);

                if (filteredTraditions.length > 0) {
                    if (!meetsPrerequisites(target, filteredTraditions[0].system.prerequisite, options).doesFail) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                // was `fail: false`, which records the failure for display but never blocks -
                // meaning membership in a Force tradition was never actually required.
                failureList.push({fail: true, message: prerequisiteMessage(prereq)});
                break;
            case 'FORCE TECHNIQUE':
                let ownedForceTechniques = filterItemsByTypes(resolvedItems, ["forceTechnique"]);
                if (!isNaN(prereq.requirement)) {
                    if (!(ownedForceTechniques.length < parseInt(prereq.requirement))) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }

                // `feat.data` does not exist on a v14 Item (it was the 0.8 era alias for `system`),
                // so a *named* FORCE TECHNIQUE prerequisite threw a TypeError here.  The throw was
                // swallowed by the try/catch in meetsPrerequisites, which skipped every remaining
                // prerequisite of the same item and still reported doesFail = false.
                let filteredForceTechniques = ownedForceTechniques.filter(feat => feat.finalName === prereq.requirement);
                if (filteredForceTechniques.length > 0) {
                    if (!meetsPrerequisites(target, filteredForceTechniques[0].system.prerequisite, options).doesFail) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'FORCE POWER':
                let ownedForcePowers = filterItemsByTypes(resolvedItems, ["forcePower"]);
                if (!isNaN(prereq.requirement)) {
                    if (!(ownedForcePowers.length < parseInt(prereq.requirement))) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }

                let filteredForcePowers = ownedForcePowers.filter(feat => feat.finalName === prereq.requirement);
                if (filteredForcePowers.length > 0) {
                    if (!meetsPrerequisites(target, filteredForcePowers[0].system.prerequisite, options).doesFail) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'FORCE SECRET': {
                // Mirrors FORCE POWER / FORCE TECHNIQUE: either a count ("At least 1 Force Secret")
                // or the name of a specific secret.  Without this branch the prerequisite fell
                // through to `default:`, which only warned and never failed.
                let ownedForceSecrets = filterItemsByTypes(resolvedItems, ["forceSecret"]);
                if (!isNaN(prereq.requirement)) {
                    if (!(ownedForceSecrets.length < parseInt(prereq.requirement))) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                    failureList.push({fail: true, message: prerequisiteMessage(prereq)});
                    break;
                }
                let filteredForceSecrets = ownedForceSecrets.filter(secret => secret.finalName === prereq.requirement);
                if (filteredForceSecrets.length > 0) {
                    if (!meetsPrerequisites(target, filteredForceSecrets[0].system.prerequisite, options).doesFail) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                failureList.push({fail: true, message: prerequisiteMessage(prereq)});
                break;
            }
            case 'LANGUAGE': {
                // Languages are owned items of type `language`; this used to fall through to
                // `default:` and pass unconditionally.
                let ownedLanguages = filterItemsByTypes(resolvedItems, ["language"]);
                if (ownedLanguages.some(language => language.finalName === prereq.requirement
                    || language.name === prereq.requirement)) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: prerequisiteMessage(prereq)});
                break;
            }
            case 'ATTRIBUTE':
                if (prereq.requirement.includes(":")) {
                    let toks = prereq.requirement.split(":");
                    let val = getInheritableAttribute({
                        entity: target,
                        recursive: true,
                        embeddedItemOverride: resolvedItems,
                        attributeKey: toks[0],
                        reduce: "SUM"
                    });
                    let check = parseInt(toks[1].substring(1));
                    if (toks[1].startsWith(">")) {
                        if (val > check) {
                            successList.push({prereq, count: 1});
                            break;
                        }
                    } else if (toks[1].startsWith("<")) {
                        if (val < check) {
                            successList.push({prereq, count: 1});
                            break;
                        }
                    } else if (toks[1].startsWith("=")) {
                        if (val === check) {
                            successList.push({prereq, count: 1});
                            break;
                        }
                    } else {
                        if (val === toks[1]) {
                            successList.push({prereq, count: 1});
                            break;
                        }
                    }
                } else {
                    let toks = prereq.requirement.split(" ");
                    let actorAttribute = SWSEActor.getActorAttribute(target, toks[0], options);
                    let number = parseInt(toks[1]);
                    // An unresolvable attribute or requirement must not silently satisfy the
                    // prerequisite: `!(undefined < 13)` is true, which is exactly how this used to
                    // pass for every character.
                    if (Number.isFinite(actorAttribute) && Number.isFinite(number) && !(actorAttribute < number)) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                }
                // Reaching here means no comparison above succeeded.  This case used to `break`
                // without recording a failure, so `doesFail` stayed false and ATTRIBUTE
                // prerequisites were unenforceable even once the attribute lookup worked.
                failureList.push({fail: true, message: `${prereq.text ?? `${prereq.type}: ${prereq.requirement}`}`});
                break;
            case 'NOT': {
                if (!prereq.child) {
                    console.warn("SWSE | NOT prerequisite without a child, cannot be evaluated", prereq);
                    failureList.push({fail: false, unverifiable: true, message: prerequisiteMessage(prereq)});
                    break;
                }
                let meetsChildPrereqs = meetsPrerequisites(target, prereq.child, options);
                if (meetsChildPrereqs.doesFail) {
                    successList.push({prereq, count: 1});
                    break;
                }
                meetsChildPrereqs.successList.forEach(item => item.fail = true)
                failureList.push(...meetsChildPrereqs.successList)
                break;
            }
            case 'AND': {
                // `meetsPrerequisites(target, undefined)` returns doesFail = false, so a malformed
                // composite node without children used to count as satisfied.  It cannot be decided,
                // so report it as a visible note instead of a silent pass.
                const andChildren = childPrerequisites(prereq.children);
                if (andChildren.length === 0) {
                    console.warn("SWSE | AND prerequisite without children, cannot be evaluated", prereq);
                    failureList.push({fail: false, unverifiable: true, message: prerequisiteMessage(prereq)});
                    break;
                }
                let meetsChildPrereqs = meetsPrerequisites(target, andChildren, options);
                if (!(meetsChildPrereqs.doesFail)) {
                    successList.push({prereq, count: 1});
                    break;
                }
                if (meetsChildPrereqs.failureList.length > 1) {
                    failureList.push({fail: true, message: `all of:`, children: meetsChildPrereqs.failureList})
                } else {
                    failureList.push(...meetsChildPrereqs.failureList)
                }
                break;
            }
            case 'OR': {
                const orChildren = childPrerequisites(prereq.children);
                if (orChildren.length === 0) {
                    console.warn("SWSE | OR prerequisite without children, cannot be evaluated", prereq);
                    failureList.push({fail: false, unverifiable: true, message: prerequisiteMessage(prereq)});
                    break;
                }
                let meetsChildPrereqs = meetsPrerequisites(target, orChildren, options)
                let count = 0;
                for (let success of meetsChildPrereqs.successList) {
                    count += success.count;
                }

                // A missing `count` made the comparison `count < undefined` - always false - so the
                // OR passed no matter how many children failed.  "at least one of" is the meaning of
                // an OR without an explicit count.
                const requiredCount = Number.isFinite(Number(prereq.count)) && Number(prereq.count) > 0
                    ? Number(prereq.count) : 1;

                if (!(count < requiredCount)) {
                    successList.push({prereq, count: 1});
                    break;
                }
                if (prereq.text) {
                    failureList.push({
                        fail: true,
                        message: prereq.text
                    })
                } else {
                    failureList.push({
                        fail: true,
                        message: `at least ${requiredCount} of:`,
                        children: meetsChildPrereqs.failureList
                    })
                }

                break;
            }
            case 'SPECIAL': {
                // Every branch here used to either record nothing at all ("is a droid" / "not a
                // droid") or a `fail: false` entry, so no SPECIAL requirement could ever block.
                // The checkable ones now fail properly; the ones that no stored data can decide are
                // pushed as an explicit, non blocking note (see UNVERIFIABLE_SPECIAL_REQUIREMENTS).
                const specialRequirement = `${prereq.requirement ?? ""}`.trim().toLowerCase();

                if (specialRequirement === 'not a droid' || specialRequirement === 'is a droid') {
                    const isDroid = !!getInheritableAttribute({
                        entity: target,
                        recursive: true,
                        embeddedItemOverride: resolvedItems,
                        attributeKey: "isDroid",
                        reduce: "OR"
                    });
                    if (isDroid === (specialRequirement === 'is a droid')) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                    failureList.push({fail: true, message: prerequisiteMessage(prereq)});
                    break;
                }

                if (specialRequirement === 'is part of a military'
                    || specialRequirement === 'is part of a major interstellar corporation') {
                    if (filterItemsByTypes(resolvedItems, ["affiliation"]).length > 0) {
                        successList.push({prereq, count: 1});
                        break;
                    }
                    failureList.push({fail: true, message: prerequisiteMessage(prereq)});
                    break;
                }

                if (!UNVERIFIABLE_SPECIAL_REQUIREMENTS.includes(specialRequirement)) {
                    console.warn("SWSE | unrecognised SPECIAL prerequisite, treated as a note", prereq);
                }
                failureList.push({fail: false, unverifiable: true, message: prerequisiteMessage(prereq)});
                break;
            }
            case 'GENDER':
                if (target.system.sex && target.system.sex.toLowerCase() === prereq.requirement.toLowerCase()) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case 'EQUIPPED':
                let req = prereq.requirement;
                let comparison;
                if (req.includes(":")) {
                    let toks = req.split(":");
                    req = toks[0];
                    comparison = toks[1];
                }
                let filteredEquippedItems = filterEquippedItemsByCriteria(target, resolvedItems, req);
                let count = filteredEquippedItems.length;
                if ((count > 0 && !comparison) || (comparison && resolveExpression(`${count}${comparison}`))) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "TYPE":
                if (target.type && target.type.toLowerCase() === prereq.requirement.toLowerCase()) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "SUBTYPE":
                if (target.system.subtype && target.system.subtype.toLowerCase() === prereq.requirement.toLowerCase()) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "WEAPON_GROUP":
                if (weaponGroup[prereq.requirement].includes(target.system.subtype)) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "TEMPLATE":
                let templates = target.system.items.filter(item => item.type === "template").map(item => item.name)
                if (templates.includes(prereq.requirement)) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "MODE":
                let modes = Object.values(target.system.modes).map(item => item.name.toLowerCase());
                if (modes.includes(prereq.requirement.toLowerCase())) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "DAMAGE_TYPE":
                let damageTypes = getInheritableAttribute({
                    entity: target,
                    recursive: true,
                    embeddedItemOverride: resolvedItems,
                    attributeKey: "damageType",
                    reduce: "VALUES_TO_LOWERCASE"
                });
                if (damageTypes.includes(prereq.requirement.toLowerCase())) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "WEAPON_SIZE":
                let weaponSize = SWSEItem.getItemSize(target);

                if (prereq.requirement.toLowerCase() === weaponSize.toLowerCase()) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: `${prereq.text}`});
                break;
            case "ARMOR_TYPE": {
                // Used by the Massassi armor template on its `armorCheckPenaltyOverride` changes
                // ("Light"/"Medium"/"Heavy").  Armor items express the same thing as an `armorType`
                // change whose value is "Light Armor"/"Medium Armor"/"Heavy Armor".  This type was
                // missing from the switch, so it used to fall through to `default:` and pass.
                const armorTypes = getInheritableAttribute({
                    entity: target,
                    recursive: true,
                    embeddedItemOverride: resolvedItems,
                    attributeKey: "armorType",
                    reduce: "VALUES_TO_LOWERCASE"
                });
                const requiredArmorType = `${prereq.requirement ?? ""}`.trim().toLowerCase();
                if (armorTypes.some(type => type === requiredArmorType
                    || type === `${requiredArmorType} armor`
                    || type.startsWith(`${requiredArmorType} `))) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: prerequisiteMessage(prereq)});
                break;
            }
            case "CONDITION": {
                // Vehicle / droid templates hand out traits ("Strength (+2)", "Starship Armor (+2)")
                // whose prerequisite is a position on the condition track - the bonus is lost once the
                // vehicle takes a step down.  `SWSEActor#condition` returns 0 or the condition value
                // of the active condition effect.  Also missing from the switch before.
                const currentCondition = `${target?.condition ?? target?.parent?.condition ?? 0}`;
                if (currentCondition === `${prereq.requirement ?? ""}`.trim()) {
                    successList.push({prereq, count: 1});
                    break;
                }
                failureList.push({fail: true, message: prerequisiteMessage(prereq)});
                break;
            }
            default:
                // An unsupported prerequisite type used to only warn, which left `doesFail` false and
                // let the requirement through.  A gap in this switch is a coding error and must be
                // loud, not permissive.
                console.error("SWSE | unsupported prerequisite type, treated as not met", prereq);
                failureList.push({fail: true, message: `${prerequisiteMessage(prereq)} (unsupported prerequisite type "${prereq.type}")`});
        }
        return {failureList, successList}
    }
    // SimpleCache builds its key by string-concatenating the property values, and `options`
    // stringifies to "[object Object]".  AND / OR / NOT nodes have no `requirement`, so *every*
    // composite node of the same type produced the identical key and the second one in a tree got
    // the first one's answer.  Composite nodes are cheap (their children are cached individually),
    // so they are not cached at all.
    const isComposite = ["AND", "OR", "NOT"].includes(`${prereq.type}`.toUpperCase());
    return (!!options.prerequisiteCache && !isComposite) ? options.prerequisiteCache.getCached({
        type: prereq.type,
        requirement: prereq.requirement,
        options: options
    }, fn) : fn()
}

/**
 *
 * @param {SWSEActor|SWSEItem|ActorData|ItemData|Object} target
 * @param {Object[]} prereqs
 * @param {string} prereqs[].text always available
 * @param {string} prereqs[].type always available
 * @param {string} prereqs[].requirement available on all types except AND, OR, and NULL
 * @param {number} prereqs[].count available on OR
 * @param options
 * @param {Object[]} prereqs[].children available on AND and OR
 * @returns {{failureList: [], doesFail: boolean, successList: []}}
 */
export function meetsPrerequisites(target, prereqs, options = {}) {
    //TODO add links to failures to open up the fancy compendium to show the missing thing.  when you make a fancy compendium

    if (!target) {
        return {doesFail: true, failureList: [], successList: []};
    }
    // These two flags live under `system.settings` (module/actor/data/commondata.mjs, written by the
    // Settings tab via `system.settings.ignorePrerequisites`).  Reading them straight off `system`
    // always yielded undefined, so both switches were inert.  The legacy top-level location is still
    // honoured for worlds that stored it there before the DataModel migration.
    const ignoreAll = target.system?.settings?.ignorePrerequisites ?? target.system?.ignorePrerequisites;
    const ignoreOnDrop = target.system?.settings?.ignorePrerequisitesOnDrop ?? target.system?.ignorePrerequisitesOnDrop;
    if (!prereqs || (ignoreAll && options.isLoad) || (ignoreOnDrop && options.isAdd) || options.skipPrerequisite || options.isUpload) {
        return {doesFail: false, failureList: [], successList: []};
    }

    if (!options.prerequisiteCache) {
        options.prerequisiteCache = new SimpleCache();
    }

    prereqs = ensureArray(prereqs)

    let failureList = [];
    let successList = [];
    for (let prereq of prereqs) {
        // The try/catch used to wrap the whole loop: one prerequisite throwing (a named FORCE
        // TECHNIQUE requirement did, via `feat.data.finalName`) aborted the loop, skipped every
        // remaining prerequisite of the item and still reported doesFail = false - the item became
        // free to take.  Guard each prerequisite on its own and make the failure visible instead.
        try {
            let response = meetsPrerequisite(prereq, target, options);
            failureList.push(...response.failureList)
            successList.push(...response.successList)
        } catch (e) {
            console.error("SWSE | could not evaluate prerequisite", {prereq, target, options, error: e});
            failureList.push({
                fail: true,
                error: true,
                message: `${prerequisiteMessage(prereq ?? {})} (could not be evaluated: ${e?.message ?? e})`
            });
        }
    }
    let doesFail = false;
    for (let fail of failureList) {
        if (fail.fail === true) {
            doesFail = true;
            break;
        }
    }

    return {doesFail, failureList, successList};
}


export function formatPrerequisites(failureList, type = "html") {
    if (type === "plain") {
        let format = "[";
        for (let fail of failureList) {
            format = format + `"${fail.message}"`;
            if (fail.children && fail.children.length > 0) {
                format = format + formatPrerequisites(fail.children, type);
            }
            format = format + `,`;
        }
        return format + "]";
    }


    let format = "<ul>";
    for (let fail of failureList) {
        format = format + `<li>${fail.message}`;
        if (fail.children && fail.children.length > 0) {
            format = format + "</br>" + formatPrerequisites(fail.children, type);
        }
        format = format + `</li>`;
    }
    return format + "</ul>";
}