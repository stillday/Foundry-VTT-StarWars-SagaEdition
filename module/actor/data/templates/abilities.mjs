import {getInheritableAttribute} from "../../../attribute-helper.mjs";
import {getLongKey, resolveValueArray} from "../../../common/util.mjs";

const fields = foundry.data.fields;

export class AbilityFields {
    static migrateData(source) {
        function parseManual(val) {
            if(val === null || val === undefined || val === "-") return null;
            const n = Number(val);
            return isNaN(n) ? null : n;
        }

        // The old schema stored `manual: 10` as a *number* literal as the
        // template default.  User form input always produced *strings* ("10").
        // When a compendium actor had its real stat in `base` (e.g. 14) and the
        // untouched template default of 10 in `manual`, the old migration code
        // blindly set base = manualNum = 10, wiping the real value (#575/#576).
        //
        // Fix: if manual is the old numeric default AND base already carries a
        // different real value, keep base and just clear manual.
        // User-entered "10" (string) still converts to 10 normally via parseManual.
        const OLD_MANUAL_DEFAULT = 10; // number, not string — the schema initial

        function shouldPreserveBase(ability, manualNum) {
            if (ability.manual !== OLD_MANUAL_DEFAULT) return false; // not the old default
            const baseNum = (ability.base !== null && ability.base !== undefined)
                ? Number(ability.base) : null;
            return baseNum !== null && baseNum !== OLD_MANUAL_DEFAULT;
        }

        function coerceOldAttributes(attributes) {
            for (let [key, ability] of Object.entries(attributes)) {
                const manualNum = parseManual(ability.manual);
                if(manualNum !== null) {
                    if (!shouldPreserveBase(ability, manualNum)) {
                        ability.base = manualNum;
                    }
                    ability.manual = null;
                } else {
                    ability.manual = null;
                }
            }
            return attributes;
        }

        if(!source.abilities && source.attributes){
            source.abilities = coerceOldAttributes(source.attributes);
            delete source.attributes;
        }

        if(source.abilities) {
            for(const ability of Object.values(source.abilities)) {
                const manualNum = parseManual(ability.manual);
                if(manualNum !== null) {
                    if (!shouldPreserveBase(ability, manualNum)) {
                        ability.base = manualNum;
                    }
                    ability.manual = null;
                } else if(ability.manual !== null && ability.manual !== undefined) {
                    ability.manual = null;
                }
            }
        }
    }


    static #abilityProperties(ability) {
        return new fields.SchemaField({
            value: new fields.NumberField({
                initial: 10,
                integer: true,
                min: 0,
                label: `${ability} Score`,
            }),
            manual: new fields.NumberField({
                nullable: true,
                initial: null,
                integer: true,
                min: 0,
                label: `${ability} Manual`,
            }),
            base: new fields.NumberField({
                nullable: true,
                initial: 10,
                integer: true,
                min: 0,
                label: `${ability} Base`,
            }),
            customBonus: new fields.NumberField({
                initial: 0,
                integer: true,
                label: `${ability} Custom`,
            }),
        });
    }

    static get physical() {
        return {
            str: this.#abilityProperties("Strength"),
            dex: this.#abilityProperties("Dexterity"),
            con: this.#abilityProperties("Constitution"),
        };
    }

    static get mental() {
        return {
            int: this.#abilityProperties("Intelligence"),
            wis: this.#abilityProperties("Wisdom"),
            cha: this.#abilityProperties("Charisma"),
        };
    }

    static get darkside() {
        return {
            darkside: new fields.SchemaField({
                value: new fields.NumberField({
                    initial: 0,
                    min: 0,
                    integer: true,
                    label: "Darkside Score",
                }),
            }),
        };
    }
}
export class AbilityFunctions {
    _prepareAbilityDerivedData() {
        let actor = this.parent;
        let abilityGenType = this.settings.attributeGeneration;
        if(abilityGenType === "Default"){
            abilityGenType = game.settings.get("swse", "defaultAttributeGenerationType") || "Manual";
        }

        let hide = [];
        if(actor.type === "vehicle"){
            hide = ["cha", "wis"];
        }
        if(actor.isDroid){
            hide = ["con"]
        }

        // Loop through ability scores, and add their modifiers to our sheet output.
        for (let [key, ability] of Object.entries(this.abilities)) {
            if (abilityGenType !== "Manual") {
                let longKey = getLongKey(key);
                if (!longKey) continue;

                let bonuses = getInheritableAttribute({
                    entity: actor,
                    attributeKey: `${longKey}Bonus`,
                    reduce: "VALUES",
                });

                ability.bonus = resolveValueArray(bonuses, actor);
            }

            if(hide.includes(key)){
                ability.skip = true;
            }

            // if there's no base, set value to 10.  is that right?
            ability.value = ability.base === null ? 10 : ability.base + (ability.bonus ?? 0) + ability.customBonus;

            // Calculate the modifier using d20 rules.
            ability.mod = Math.floor(
                (ability.value - 10) / 2
            );

            // Prepare the roll data
            let totalModifiers = ability.mod + (this.health.condition ?? 0);
            // CONFIG.SWSE.Abilities.abilitiesShort holds localization keys ("SWSE.AbilityShortStr"),
            // and none of them exist in lang/en.json, so this was putting the raw key into the roll
            // label the chat card prints ("SWSE.AbilityShortStr Modifer").  Localize it and fall
            // back to the plain abbreviation whenever the key is missing.
            const shortKey = CONFIG.SWSE.Abilities.abilitiesShort[key];
            const localizedShort = shortKey ? game.i18n?.localize(shortKey) : undefined;
            let label = (!localizedShort || localizedShort === shortKey) ? key.toUpperCase() : localizedShort;

            ability.label = key.toUpperCase();

            // The ability check formula.  `actor-ability-scores.hbs` renders this into the
            // rollable label's data-roll/title, and it feeds the @<KEY>ROLL resolved variable.
            // It used to exist only as a resolved variable, so the template interpolated an
            // undefined `attribute.roll` and produced the formula "1d20 + ", which made every
            // click on an ability label throw a Roll parse error instead of rolling.
            ability.roll = "1d20" + (totalModifiers < 0 ? " - " : " + ") + Math.abs(totalModifiers);

            let rollLabel = label + " Modifier";
            actor.setResolvedVariable(
                "@" + key.toUpperCase() + "ROLL",
                ability.roll,
                rollLabel,
                rollLabel
            );
            actor.setResolvedVariable(
                "@" + key.toUpperCase() + "MOD",
                totalModifiers,
                rollLabel,
                rollLabel
            );
            rollLabel = label + " Score";
            actor.setResolvedVariable(
                "@" + key.toUpperCase() + "SCORE",
                ability.value,
                rollLabel,
                rollLabel
            );
            // The compendium uses "@WISTOTAL" for the Wisdom score (the Sith Apprentice / Sith Lord
            // / Transfer Essence prerequisite "Dark Side Score equal to or greater than your Wisdom
            // score", which is also what `darkside.max` is derived from below).  Nothing registered
            // that name, so resolveExpression handed the literal string "@WISTOTAL" to a numeric
            // comparison and the prerequisite passed for everyone.
            actor.setResolvedVariable(
                "@" + key.toUpperCase() + "TOTAL",
                ability.value,
                rollLabel,
                rollLabel
            );
        }


        //move this somewhere else.  this is prepped too early
        this.darkside.max = this.abilities.wis.value;
        this.darkside.taint = getInheritableAttribute({
            entity: actor,
            attributeKey: "darksideTaint",
            reduce: "SUM"}
        )
        this.darkside.finalScore = this.darkside.value + this.darkside.taint;
    }
}
