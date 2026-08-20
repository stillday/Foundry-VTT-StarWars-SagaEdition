import SystemDataModel from "./abstract.mjs";
import CommonActorData from "./commondata.mjs";

import {AbilityFields, AbilityFunctions} from "./templates/abilities.mjs";
import {DefenseFields, DefenseFunctions} from "./templates/defenses.mjs";
import {DetailFunctions, DetailFields} from "./templates/details.mjs";
import {HealthFunctions} from "./templates/health.mjs";
import {ShieldFunctions} from "./templates/shields.mjs";
import {SkillFunctions, SkillFields} from "./templates/skills.mjs";
import {TraitsFields, TraitsFunctions} from "./templates/traits.mjs";
import {CREW_QUALITIES} from "../../common/constants.mjs";

const fields = foundry.data.fields;
const vehicleFunctionClasses = [
    AbilityFunctions,
    DefenseFunctions,
    DetailFunctions,
    HealthFunctions,
    ShieldFunctions,
    SkillFunctions,
    TraitsFunctions,
];

export class VehicleDataModel extends SystemDataModel.mixin(...vehicleFunctionClasses) {
    static _systemType = "vehicle";

    static migrateData(source) {
        if (source.crewQuality && typeof source.crewQuality === "object") {
            source.crewQuality = source.crewQuality.quantity === "-" ? "Normal" : (source.crewQuality.quantity ?? "Normal");
        }



        return super.migrateData(source);
    }

    static defineSchema() {
        return {
            ...CommonActorData.commonData,
            // The vehicle summary edits `system.subType` and `system.captain`, and
            // SWSEActor#applyVehicleAttributes writes `system.subType` from a base type's
            // `vehicleSubType` change.  Neither path existed in the schema, so SchemaField#clean
            // discarded both and the Vehicle Type / Captain inputs stayed blank forever.
            subType: new fields.StringField({
                initial: "",
                label: "Vehicle Type",
            }),
            captain: new fields.StringField({
                initial: "",
                label: "Captain",
            }),
            // Crew quality lived under `vehicle.crewQuality`, but nothing read it there:
            // `migrateData` above normalises the legacy value into top level `crewQuality`, and
            // CrewDelegate (module/actor/crewDelegate.mjs:168/202) reads `system.crewQuality`.  The
            // sheet wrote to a third path, `system.crewQuality.quality`, which existed nowhere.
            // Moved here so the migration, the consumer and the sheet agree; the old nested field
            // was never written to, so there is no data to lose.
            crewQuality: new fields.StringField({
                required: true,
                choices: CREW_QUALITIES,
                initial: "Normal",
                blank: false,
                label: "Crew Quality",
                hint: "The quality of the crew of this vehicle",
            }),
            defense: new fields.SchemaField({
                ...DefenseFields.npc,
                // damageThreshold.misc is the only character defense field, and
                // _resolveDt (which _prepareDefenseDerivedData calls below) reads it
                // unconditionally.  The vehicle sheet has an input for it too.
                ...DefenseFields.character,
            }),
            skills: new fields.SchemaField({
                ...SkillFields.npc,
            }),
            details: new fields.SchemaField({
                ...DetailFields.npc,
            }),
            ...TraitsFields.npc,
            vehicle: new fields.SchemaField({
                cover: new fields.StringField({
                }),
                passengers: new fields.StringField({
                    required: false,
                }),
                consumables: new fields.StringField({
                    required: false,
                }),
                // `cargo.capacity` is the older path and nothing reads or writes it any more; it is
                // kept so existing documents do not lose data.  The sheet and
                // SWSEActor#applyVehicleAttributes both use `cargoCapacity`, which had no schema
                // entry at all, so the Cargo / Capacity inputs and the base type's cargoCapacity
                // change were both silently dropped.  Strings, because published values read
                // "80 tons" rather than a bare number.
                cargo: new fields.SchemaField({
                    capacity: new fields.NumberField({
                    })
                }),
                cargoCapacity: new fields.SchemaField({
                    value: new fields.StringField({
                        initial: "",
                        label: "Cargo Carried",
                    }),
                    capacity: new fields.StringField({
                        initial: "",
                        label: "Cargo Capacity",
                    }),
                }),
                cost: new fields.StringField({
                    initial: "",
                    label: "Cost",
                }),
                emplacementPoints: new fields.NumberField({
                    required: false,
                    nullable: true,
                    initial: null,
                    label: "Emplacement Points",
                }),
                // Fighting space as entered on the sheet.  SWSEActor#fightingSpace derives a
                // separate {vehicle, character} pair from the installed items; this is the
                // user-entered value the two inputs on the summary were writing into nothing.
                fightingSpace: new fields.SchemaField({
                    characterScale: new fields.NumberField({
                        required: false,
                        nullable: true,
                        initial: null,
                    }),
                    starshipScale: new fields.NumberField({
                        required: false,
                        nullable: true,
                        initial: null,
                    }),
                }),
                speed: new fields.SchemaField({
                    starshipScale: new fields.NumberField({
                    }),
                    characterScale: new fields.NumberField({
                    }),
                    maximumVelocity: new fields.NumberField({
                    })
                }),
                crew: new fields.NumberField({
                    initial: 0
                })
            })
            ///attacks: new fields.ArrayField({}),
        };
    }

    /**
     * @override
     * This is the final place to manipulate a document's data in a way that is generally
     * accessible within the foundry API. Derived data is the place to calculate modifiers,
     * encumbrance, and all of the other pieces of information you want available.
     *
     * If you have a system data model, you can run type-specific logic here. Keep in mind
     * that you're operating within the system object, so you'll need to call this.parent to
     * access the actual document properties, e.g. this.parent.items to access the items
     * collection.
     */
    prepareDerivedData() {
        this.parent.cache?.invalidateAll();

        //Traits - currently needs to be first for grabbing class level resolved data.
        this._prepareCharacterTraitsDerivedData();

        //Abilities
        this._prepareAbilityDerivedData();

        //Grapple - needs the ability modifiers prepared above
        this._prepareGrappleDerivedData();

        // Defenses.  DefenseFunctions is already mixed in here and its armour logic has an explicit
        // vehicle branch, but nothing ever called the preparation, so `system.defense` never grew
        // the `fortitude`/`will`/`reflex` entries that actor-defenses.hbs renders (it only shows
        // entries carrying `defenseBlock`).  The vehicle defence panel was therefore column
        // headers over nothing.  Runs after the abilities, whose modifiers it needs.
        this._prepareDefenseDerivedData();

        // Shields.  ShieldFunctions is mixed in and every starship shield generator in
        // swse.vehicle-systems carries a `shieldRating` change, but the preparation was never
        // called for vehicles, so `system.shields.max` stayed null on every one of them and the
        // shield rating those systems provide did nothing at all.
        this._prepareShieldsDerivedData();
    }
}
