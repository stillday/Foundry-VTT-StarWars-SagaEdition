import {
    inheritableItems,
    ALPHA_FINAL_NAME,
} from "../../../common/util.mjs";
import {getInheritableAttribute} from "../../../attribute-helper.mjs";

const fields = foundry.data.fields;

export class TraitsFields {
    static migrateData(source) {
        if(source.darkSideScore && !source.darkside){
            source.darkside = {
                value: source.darkSideScore
            }
            delete source.darkSideScore;
        }
    }

    //Data common for all actors which needs to be persisted in the database
    static #_common() {
        return {
            xp: new fields.StringField({
                initial: "",
                label: "XP",
            }),
            baseAttack: new fields.NumberField({
                initial: 0,
                integer: true,
                label: "Base Attack",
            }),
            grapple: new fields.NumberField({
                initial: 0,
                integer: true,
                label: "Grapple",
            }),
            // speed / size / reach used to live in `TraitsFields.npc` only.  Since
            // CONFIG.Actor.dataModels.npc is CharacterDataModel (swse.mjs), that block was
            // unreachable for characters *and* npcs, which is why `system.speed` was undefined and
            // the speed/size/reach inputs of the npc sheet had nothing to write to.
            speed: new fields.SchemaField({
                base: new fields.NumberField({
                    initial: 6,
                    min: 0,
                    integer: true,
                    label: "Base Speed",
                }),
                swim: new fields.NumberField({
                    initial: 1.5,
                    min: 0,
                    step: 0.1,
                    label: "Swim Speed",
                }),
                climb: new fields.NumberField({
                    initial: 1.5,
                    min: 0,
                    step: 0.1,
                    label: "Climb Speed",
                }),
                fly: new fields.NumberField({
                    nullable: true,
                    initial: null,
                    min: 0,
                    integer: true,
                    label: "Fly Speed",
                }),
                special: new fields.StringField({
                    initial: "",
                    label: "Movement Special",
                }),
            }),
            size: new fields.StringField({
                initial: "Medium",
                blank: false,
                label: "Size",
            }),
            reach: new fields.NumberField({
                initial: 1,
                min: 1,
                integer: true,
                label: "Reach",
            }),
        };
    }

    //Data common for all character actors which needs to be persisted in the database
    static #_commonCharacter() {
        return {
            forcePoints: new fields.NumberField({
                initial: 0,
                integer: true,
                min: 0,
                label: "ForcePoints",
            }),
            destinyPoints: new fields.NumberField({
                initial: 0,
                integer: true,
                min: 0,
                label: "DestinyPoints",
            }),
            // darkSideScore: new fields.NumberField({
            //     initial: 0,
            //     min: 0,
            //     integer: true,
            //     label: "Darkside Score",
            // }),
            darkSide: new fields.SchemaField({
                value:new fields.NumberField({
                    initial: 0,
                    min: 0,
                    integer: true,
                    label: "Darkside Score",
                }),
            })
        };
    }

    //Data common for all player character actors which needs to be persisted in the database
    static get character() {
        return {
            ...this.#_common(),
            ...this.#_commonCharacter(),
        };
    }

    //Data common for all non-player character actors which need to be persisted in the database
    static get npc() {
        return {
            ...this.#_common(),
            ...this.#_commonCharacter(),
            level: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 0,
                    min: 0,
                    integer: true,
                    label: "Character Level",
                }),
            }),
            cl: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 0,
                    min: 0,
                    integer: true,
                    label: "Challenge Level",
                }),
            }),
        };
    }
}

export class TraitsFunctions {
    _prepareCharacterTraitsDerivedData() {
        let system = this;
        let actor = this.parent;

        system.level = system.level ?? {};
        system.level.value = actor.characterLevel;
        system.classSummary = actor.classSummary;
        system.classLevel = actor.classLevels;


        //TODO move to appropriate part of model prepare
        // if (
        //     game.settings.get("swse", "enableEncumbranceByWeight") &&
        //     actor.weight.carriedWeight >= actor.heavyLoad
        // ) {
        //     system.heavyLoad = true;
        // } else system.heavyLoad = false;

        let activeTraits = inheritableItems(actor).filter(i => i.type === 'trait');
        system.traits = activeTraits.sort(ALPHA_FINAL_NAME);

        this.baseAttack = actor.baseAttackBonus;
    }

    /**
     * `grapple` depends on the ability modifiers, which only exist after
     * `_prepareAbilityDerivedData` has run.  Computing it inside
     * `_prepareCharacterTraitsDerivedData` (which has to run first, for class level data) produced
     * `Math.max(undefined, undefined)` -> NaN, and SWSEActor#grapple cached that NaN for the rest of
     * the preparation cycle.
     */
    _prepareGrappleDerivedData() {
        this.grapple = this.parent.grapple;
    }

    _prepareNpcTraitsDerivedData() {
    	// let system = this;
    	// let actor = this.parent;
    	// No derived trait data for npc characters
    }
}
