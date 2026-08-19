import {getInheritableAttribute} from "../attribute-helper.mjs";
import {generateAction} from "../action/generate-action.mjs";
import {toBoolean} from "../common/util.mjs";

//import * as fields from "../data/fields.mjs";

/**
 * Delete ActiveEffects from a parent document without ever asking the server twice for the same
 * document.
 *
 * Several SWSE cleanup paths can legitimately run for the same effect: a condition change clears the
 * previous condition in `SWSEActor#clearGroupedEffect` while `_onCreateDescendantDocuments` prunes
 * leftover condition effects, and deleting a mode effect on an item cascades to the effects it
 * provided.  Those paths cannot await one another (document hooks are synchronous), so they used to
 * issue overlapping delete requests for one id and the loser rejected with
 * `ActiveEffect "<id>" does not exist!` as an unhandled rejection.  Filtering out ids whose document
 * is already gone - or already on its way out - removes the duplicate request itself.
 *
 * @param {Actor|Item} parent    the document owning the effects
 * @param {string[]} ids         candidate ActiveEffect ids
 * @param {object} [options]     forwarded to deleteEmbeddedDocuments
 * @returns {Promise<Document[]>} the documents that were actually deleted
 */
export async function deleteEffectsSafely(parent, ids, options = {}) {
    if (!parent) return [];
    const pending = parent.__pendingEffectDeletions ??= new Set();
    const toDelete = [];
    for (const id of ids ?? []) {
        if (!id || pending.has(id)) continue;
        if (!parent.effects?.get(id)) continue;
        pending.add(id);
        toDelete.push(id);
    }
    if (!toDelete.length) return [];
    try {
        return (await parent.deleteEmbeddedDocuments("ActiveEffect", toDelete, options)) ?? [];
    } finally {
        for (const id of toDelete) pending.delete(id);
    }
}

/**
 * Extend the base ActiveEffect entity
 * @extends {ActiveEffect}
 */
export class SWSEActiveEffect extends ActiveEffect {

    async safeUpdate(data={}, context={}) {
        if(this.canUserModify(game.user, 'update')){
            await this.update(data, context);
        }
    }

    _onUpdate(data, options, userId) {
        return super._onUpdate(data, options, userId);
    }

    async setPayload(pattern, payload) {
        let regExp = new RegExp(pattern, "g");
        for(const change of this.changes){
            if (change.value) {
                change.key = change.key.replace(regExp, payload);
                if (Array.isArray(change.value)) {
                    change.value = change.value.map(val => `${val}`.replace(regExp, payload));
                } else {
                    change.value = `${change.value}`.replace(regExp, payload);
                }
            }
        }


        if(!this.pack){
            let data = {"changes" : this.changes};
            await this.safeUpdate(data);
        }
    }

    /**
     * Overridden only so that SWSE's own `transfer` getter (below, driven by a "transfer" change)
     * is honoured.  Mirrors ActiveEffect#target in Foundry v14 (client/documents/active-effect.mjs).
     * `CONFIG.ActiveEffect.legacyTransferral` was removed in v14 and always read as undefined here,
     * so its branch was dead code and is dropped.
     * @returns {SWSEActor|SWSEItem|null}
     */
    get target() {
        if ( this.parent instanceof Actor ) return this.parent;
        return this.transfer ? (this.parent.parent ?? null) : this.parent;
    }
    /**
     * SWSE drives ActiveEffect transferral from a "transfer" change rather than the core flag.
     *
     * Read type-tolerantly: Foundry v14 runs `JSON.parse` over every string change value while
     * migrating ActiveEffects (BaseActiveEffect.#migrateChangeValue in
     * common/documents/active-effect.mjs), so a stored "true" now reads back as the boolean `true`.
     * Values still authored as strings in SWSE's own `system.changes` must keep working, hence
     * `toBoolean` instead of a `=== "true"` comparison.
     * @returns {boolean}
     */
    get transfer(){
        const inheritableAttribute = this.changes.find(change => change.key === "transfer")
        return toBoolean(inheritableAttribute?.value ?? false)
    }

    set transfer(value) {
        //console.warn("attempted to modify transfer");
    }

    get actions(){
        let actions = [];
        actions.push(...generateAction(this, this.changes))
        return actions;
    }

    _onDelete(options, userId) {
        super._onDelete(options, userId);
        for(let link of this.links){
            let doc = this.getSiblingEffectByName(link.name);
            if(doc){
                doc.removeLink(this.name);
            }
        }
    }

    getSiblingEffectByName(name) {
        return this.parent.effects.find(e => e.name === name);
    }

    deleteReciprocalLinks(name){
        let doc = this.getSiblingEffectByName(name);
        //let doc2 = getDocumentByUuid(uuid);
        this.removeLink(name)
        doc.removeLink(this.name)
    }
    async addLinks(that, type){
        if(this === that){
            return;
        }

        switch (type) {
            case "parent":
                await this.addLink("child", that)
                await that.addLink("parent", this)
                break;
            case "child":
                await this.addLink("parent", that)
                await that.addLink("child", this)
                break;
            case "mirror":
                await this.addLink("mirror", that)
                await that.addLink("mirror", this)
                break;
            case "exclusive":
                await this.addLink("exclusive", that)
                await that.addLink("exclusive", this)
                break;
        }
    }

    removeLink(name){
        let links = this.flags.swse?.links || [];
        links = links.filter(link => link.name !== name);
        let data = {"flags.swse.links": links};
        this.safeUpdate(data);
    }

    async addLink(type, effect){
        //let uuid = effect.uuid;
        let links = this.flags.swse?.links || [];
        links = links.filter(link => link.name !== effect.name);
        links.push({type, name:effect.name});
        let data = {"flags.swse.links": links};
        await this.safeUpdate(data);
    }

    async disable(disabled = true, affected = []) {
        if (this.disabled === disabled || (affected.includes(this.id))) {
            return;
        }
        for (let link of this.links) {
            if (link.type === "exclusive" && !disabled) {
                let doc = this.getSiblingEffectByName(link.name)
                affected.push(this.id)
                await doc.disable(true, affected)
            } else if (link.type === "mirror") {
                let doc = this.getSiblingEffectByName(link.name)
                affected.push(this.id)
                await doc.disable(disabled, affected)
            }
        }


        // NOTE: must stay recursive.  In Foundry v14 an ActiveEffect's `changes` array lives at
        // `system.changes` (BaseActiveEffect.migrateData moves it there), so a non-recursive update
        // turns the root key `system` into a ForcedReplacement and every change on the effect is
        // destroyed by simply enabling/disabling it.
        await this.safeUpdate({disabled, "system.disabled": disabled});
    }

    get isDisabled(){
        let disabled = this.disabled;
        for(let link of this.links){
            if(link.type === "parent"){
                let doc = fromUuidSync(link.uuid)
                disabled = disabled || doc.disabled
            }
        }
        return disabled
    }

    get isMode(){
        return !this.flags.swse?.itemModifier && !this.flags.swse?.isLevel
    }

    get hasLinks(){
        return this.links.length > 0;
    }

    get links(){
        return this.flags?.swse?.links || []
    }

    get hasDuration(){
        return !this.flags?.swse?.itemModifier && !this.flags.swse?.isLevel
    }

    get hasDisable(){
        return !this.flags?.swse?.itemModifier && !this.flags.swse?.isLevel
    }

    get hideFromActor(){
        return false;
    }

    /**
     *  should this appear as an effect on an actors Mode page?  levels should be used for stats but hidden here.
     * @return {boolean}
     */
    get isActorLevelEffect(){
        return !this.flags.swse?.isLevel;
    }

    static async _onCreateOperation(documents, context) {
        super._onCreateOperation(documents, context).then(
            game.items.directory.render())
    }
    static async _onDeleteDocuments(documents, context) {
        super._onDeleteDocuments(documents, context).then(
            game.items.directory.render())
    }

    get toggles(){
        return this.flags.swse?.toggles || [];
    }

    get upgradePoints(){
        return getInheritableAttribute({entity: this, attributeKey:"upgradePointCost", reduce:"SUM"});
    }
}