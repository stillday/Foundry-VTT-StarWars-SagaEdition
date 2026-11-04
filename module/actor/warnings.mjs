import {getInheritableAttribute} from "../attribute-helper.mjs";
import {getAvailableTrainedSkillCount} from "./skill-handler.mjs";
import {XP_REQUIREMENT} from "../common/constants.mjs";

function getAvailableTrainedSkills(actor) {
    let trainedSkills = actor.trainedSkills;
    let trainedKnowledgeCount = trainedSkills.filter(s => s.label.includes('Knowledge')).length;
    const otherTrainedSkillCount = trainedSkills.length - trainedKnowledgeCount;

    let {availableTrainedSkillCount, availableTrainedKnowledgeSkillCount} = getAvailableTrainedSkillCount(actor);
    availableTrainedKnowledgeSkillCount = availableTrainedKnowledgeSkillCount - trainedKnowledgeCount;

    availableTrainedSkillCount = availableTrainedSkillCount - otherTrainedSkillCount;
    if (availableTrainedKnowledgeSkillCount < 0) {
        availableTrainedSkillCount = availableTrainedSkillCount + availableTrainedKnowledgeSkillCount;
    }
    return {availableTrainedSkillCount, availableTrainedKnowledgeSkillCount};
}

export function warningsFromActor(actor) {
    let warnings = [];


    if(actor.type === "character"){
        let naturalArmorBonus = getInheritableAttribute({
            entity: actor,
            attributeKey: "naturalArmorReflexDefenseBonus",
            reduce: "SUM",
            attributeFilter: attr => !attr.modifier
        })
        let beastClassLevels = actor.classLevels?.Beast || 0;
        if (beastClassLevels > 0 && naturalArmorBonus > beastClassLevels) {
            warnings.push(game.i18n.format("SWSE.Warn.NaturalArmorExceedsBeastLevel", {bonus: naturalArmorBonus, level: beastClassLevels}))
        }

        if (!actor.system.attributeGenerationType && !actor.system.finalAttributeGenerationType) {
            warnings.push(`<span class="attributeGenerationType">${game.i18n.localize("SWSE.Warn.SelectAttributeGenerationType")}</span>`)
        }

        if (!actor.species && !actor.classes.find(c => c.name === 'Beast')) {
            warnings.push(`<span data-action="compendium" data-type="Item" data-filter="-type:species" title="${game.i18n.localize("SWSE.Warn.TitleOpenSpeciesCompendium")}">${game.i18n.localize("SWSE.Warn.SelectSpecies")}</span>`)
        }


        if (!actor.classes || actor.classes.length === 0) {
            warnings.push(`<span data-action="compendium" data-type="Item" data-filter="-type:class" title="${game.i18n.localize("SWSE.Warn.TitleOpenClassCompendium")}">${game.i18n.localize("SWSE.Warn.SelectClass")}</span>`)
        } else if(actor.characterLevel < 20 && XP_REQUIREMENT[actor.characterLevel + 1] <= actor.system.experience){
            warnings.push(`<span data-action="compendium" data-type="Item" data-filter="-type:class" title="${game.i18n.localize("SWSE.Warn.TitleOpenClassCompendium")}">${game.i18n.localize("SWSE.Warn.EnoughXPForNewLevel")}</span>`)
        }
        let {availableTrainedSkillCount, availableTrainedKnowledgeSkillCount} = getAvailableTrainedSkills(actor);

        if (availableTrainedKnowledgeSkillCount > 0) {
            warnings.push(`<span>${game.i18n.format("SWSE.Warn.RemainingTrainedKnowledgeSkills", {count: availableTrainedKnowledgeSkillCount})}</span>`)
        }
        if (availableTrainedSkillCount > 0) {
            warnings.push(`<span>${game.i18n.format("SWSE.Warn.RemainingTrainedSkills", {count: availableTrainedSkillCount})}</span>`)
        }
        if (availableTrainedSkillCount < 0) {
            warnings.push(`<span>${game.i18n.format("SWSE.Warn.TooManySkillsSelected", {count: Math.abs(availableTrainedSkillCount)})}</span>`)
        }
        for (let item of Object.entries(actor.availableItems || {})) {
            if (item[1] !== 0) {
                warnings.push(`<span data-action="compendium-web" data-type="feat, talent" data-provider-source="${item[0]}">${game.i18n.format("SWSE.Warn.ItemsFromSourceRemaining", {source: item[0], count: item[1]})}</span>`)
            }
        }
        for (let feat of actor.system.inactiveProvidedFeats || []) {
            warnings.push(`<span>${game.i18n.format("SWSE.Warn.FeatProvidedMissingPrereqs", {name: feat.finalName, prereqs: feat.system.prerequisite?.text})}</span>`)
        }

        // for (let feat of actor.system.inactiveProvidedFeats || []) {
        //     warnings.push(`<span>The ${feat.finalName} feat is provided but cannot be added because of missing prerequisites: ${feat.system.prerequisite?.text}</span><a className="item-control item-delete" title="Delete Item"><i
        //     className="fas fa-trash"></i></a>`)
        // }



        for (let skill of Object.values(actor.system.skills)) {
            if (skill.blockedSkill) {
                warnings.push(`<span>${game.i18n.format("SWSE.Warn.SkillNotClassSkill", {skill: skill.label})}</span>`)
            }
        }


        if (game.settings.get("swse", "enableEncumbranceByWeight")) {
            if (actor.weight >= actor.heavyLoad) {
                warnings.push(`<span title="${game.i18n.localize("SWSE.Warn.TitleHeavyLoad")}">${game.i18n.localize("SWSE.Warn.HeavyLoad")}</span>`)
            }

            if (actor.weight >= actor.strainCapacity) {
                warnings.push(`<span title="${game.i18n.localize("SWSE.Warn.TitleCarryCapacity")}">${game.i18n.localize("SWSE.Warn.CarryCapacity")}</span>`)
            }

            if (actor.weight >= actor.maximumCapacity) {
                warnings.push(`<span>${game.i18n.localize("SWSE.Warn.MaximumCapacity")}</span>`)
            }
        }
    }


    return warnings;
}

export function errorsFromActor(actor) {
    let errors = [];

    const levelEffects = actor.effects.filter(effect => effect.flags?.swse?.isLevel);
    if(levelEffects.length > 0){
        errors.push(`<span data-action="remove-leaked-level-effects">${game.i18n.localize("SWSE.Error.RemoveLevelEffects")}</span>`)
    }

    const weaponFireEffects = actor.effects.filter(effect => effect.flags?.swse?.group === "Fire Mode");
    if(weaponFireEffects.length > 0){
        errors.push(`<span data-action="remove-fire-mode-effects">${game.i18n.localize("SWSE.Error.RemoveFireModeEffects")}</span>`)
    }

    const itemTypes = actor.itemTypes
    if(itemTypes["vehicleBaseType"].length > 0){
        errors.push(`<span data-action="remove-vehicleBaseType">${game.i18n.localize("SWSE.Error.RemoveVehicleBaseType")}</span>`)
    }

    for (const item of actor.items) {
        for (const warning of item.errors) {
            errors.push(warning);
        }
    }

    return errors;
}

/**
 *
 * @param level
 * @param entity
 * @returns {*[]}
 */
export function errors(level, entity){
    const checks = ERRORS[entity.type][level];
    const err = [];
    for (const item of checks){
        err.push(...item.check(entity));
    }
    return err;
}

const ERRORS = {
    "actor": {
        "error":[
            {
                //check: (actor) = {},
                //resolution
            }
        ],
        "warning":[]
    },
    "item": {
        "error":[],
        "warning":[]
    }
}