import {changeModeChoices, getParentByHTMLClass, onCollapseToggle, toChat, toNumber} from "../common/util.mjs";
import {
    _adjustPropertyBySpan,
    onChangeControl,
    onEffectControl,
    onSpanTextInput,
    onToggle
} from "../common/listeners.mjs";
import {onAmmunition} from "./ammunition/ammunitionDelegate.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class SWSEItemSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {

    static DEFAULT_OPTIONS = {
        classes: ["swse", "sheet", "item"],
        position: { width: 520, height: 480 },
        window: { resizable: true },
        form: { submitOnChange: true },
        actions: {
            "to-chat": SWSEItemSheet.prototype._onToChat
        }
    };

    static PARTS = {
        form: {
            template: "systems/swse/templates/item/item-sheet.hbs",
            scrollable: [".sheet-body"]
        }
    };

    // Compatibility shims for shared listener functions that use AppV1 API
    get object() { return this.document; }
    _onSubmit(_event, _opts = {}) { return this.submit().catch(() => {}); }
    _render() { return this.render({ force: true }); }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.item = this.item;
        context.actor = this.actor;
        context.owner = this.item.isOwner;
        context.cssClass = this.isEditable ? "editable" : "locked";
        context.options = { debug: false };
        context.modes = changeModeChoices();
        return context;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        if (options.isFirstRender) {
            this.changeTab("summary", "primary");
        }

        this._bindEventListeners();
    }

    _bindEventListeners() {
        const el = this.element;

        el.querySelectorAll(".collapse-toggle").forEach(btn => {
            btn.addEventListener("click", onCollapseToggle);
        });

        if (!this.isEditable) return;

        el.querySelectorAll(".toggle").forEach(btn => {
            btn.addEventListener("click", ev => onToggle.call(this, ev));
        });

        if (this.actor) {
            el.querySelectorAll('[data-action="view"]').forEach(btn => {
                btn.addEventListener("click", this.actor.sheet._onItemEdit.bind(this.actor.sheet));
            });
            el.querySelectorAll(".item-delete").forEach(btn => {
                btn.addEventListener("click", ev => {
                    const li = ev.currentTarget.closest(".item");
                    const ownedItem = this.item.actor.items.get(li.dataset.itemId);
                    this.item.revokeOwnership(ownedItem);
                });
            });
        }

        el.querySelectorAll('[data-action="item-warning"]').forEach(btn => {
            btn.addEventListener("click", ev => this.item.resolveWarning(ev));
        });

        el.querySelectorAll('[data-action="class-control"]').forEach(btn => {
            btn.addEventListener("click", ev => this._onClassControl(ev));
        });

        el.querySelectorAll('[data-action="provided-item-control"]').forEach(btn => {
            btn.addEventListener("click", ev => this._onProvidedItemControl(ev));
        });

        el.querySelectorAll('[data-action="prerequisite-control"]').forEach(btn => {
            btn.addEventListener("click", ev => this._onPrerequisiteControl(ev));
        });

        el.querySelectorAll('[data-action="modifier-control"]').forEach(btn => {
            btn.addEventListener("click", ev => this._onModifierControl(ev));
        });

        el.querySelectorAll('[data-action="effect-control"]').forEach(btn => {
            btn.addEventListener("click", ev => onEffectControl.call(this, ev));
        });

        el.querySelectorAll('[data-action|="ammunition"]').forEach(btn => {
            btn.addEventListener("click", ev => onAmmunition.call(this, ev));
        });

        el.querySelectorAll(".value-plus").forEach(btn => {
            btn.addEventListener("click", ev => {
                const target = ev.currentTarget;
                const name = target.name;
                const high = target.dataset.high !== undefined ? Number(target.dataset.high) : undefined;
                const current = foundry.utils.getProperty(this.document, name);
                const value = typeof high === "number" ? Math.min(current + 1, high) : current + 1;
                this.document.safeUpdate({ [name]: value });
            });
        });

        el.querySelectorAll(".value-minus").forEach(btn => {
            btn.addEventListener("click", ev => {
                const target = ev.currentTarget;
                const name = target.name;
                const low = target.dataset.low !== undefined ? Number(target.dataset.low) : undefined;
                const current = foundry.utils.getProperty(this.document, name);
                const value = typeof low === "number" ? Math.max(current - 1, low) : current - 1;
                this.document.safeUpdate({ [name]: value });
            });
        });

        el.querySelectorAll("[data-action='direct-field']").forEach(btn => {
            btn.addEventListener("click", ev => onSpanTextInput.call(this, ev, _adjustPropertyBySpan.bind(this), "text"));
        });

        el.querySelectorAll('[data-action="change-control"]').forEach(btn => {
            btn.addEventListener("click", ev => onChangeControl.call(this, ev));
        });
    }

    async _onToChat(event, target) {
        event.preventDefault();
        const a = target ?? event.currentTarget;
        const itemId = a.dataset.actionItem;
        const actorId = a.dataset.actorId;
        const actionCompendium = a.dataset.actionCompendium;

        let item;

        if (actorId) {
            item = game.actors.get(actorId)?.items.get(itemId);
        } else if (actionCompendium) {
            const compendium = game.packs.get(actionCompendium);
            item = compendium ? await compendium.getDocument(itemId) : undefined;
        } else {
            item = game.items.get(itemId);
        }

        item ??= this.document;
        if (!item) {
            console.warn(`SWSEItemSheet._onToChat: no item resolved`, {itemId, actorId, actionCompendium});
            return;
        }

        const content = item.description || item.system?.description;
        return toChat(content, item, item.name);
    }

    _canDragStart(_selector) {
        return true;
    }

    _canDragDrop(_selector) {
        return true;
    }

    _onDragStart(event) {
        const dragData = {};
        const li = event.currentTarget;

        dragData.itemId = this.item.id;

        const owner = this.item.actor;
        if (owner) {
            dragData.owner = owner;
            dragData.actorId = owner.id;
            dragData.sceneId = owner.isToken ? canvas.scene?.id : null;
            dragData.tokenId = owner.isToken ? this.actor.token.id : null;
        }

        if (li.dataset.itemId) {
            dragData.modId = li.dataset.itemId;
            dragData.type = "Item";
        }

        if (li.dataset.effectId) {
            dragData.effectId = li.dataset.effectId;
            dragData.effectUuid = li.dataset.uuid;
            dragData.type = "ActiveEffect";
        }

        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    async _onDrop(event) {
        if (!this.item.canUserModify(game.user, 'update')) return false;
        let droppedItem;
        try {
            droppedItem = JSON.parse(event.dataTransfer.getData("text/plain"));
        } catch (err) {
            console.error(`Parsing error: ${event.dataTransfer.getData("text/plain")}`);
            return false;
        }
        const effect = getParentByHTMLClass(event, "effect");
        if (effect) {
            droppedItem.targetEffectUuid = effect.dataset.uuid;
        }
        await this.document.handleDroppedItem(droppedItem);
    }

    _canAttach(application) {
        if (!application) {
            return true;
        }
        application = (application + "").trim();

        const hasParens = this.hasParens(application);
        if (hasParens) {
            return this._canAttach(hasParens[1]);
        }

        const ors = this._findZeroDepth(application, " OR ");
        if (ors.length > 0) {
            for (const or of ors) {
                for (let i = or.start; i < or.end; i++) {
                    application = application.substring(0, i) + 'X' + application.substring(i + 1);
                }
            }
            const toks = application.split("XXXX");
            let isTruthy = false;
            for (const tok of toks) {
                isTruthy = isTruthy || this._canAttach(tok);
            }
            return isTruthy;
        }

        const ands = this._findZeroDepth(application, " AND ");
        if (ands.length > 0) {
            for (const or of ors) {
                for (let i = ands.start; i < ands.end; i++) {
                    application = application.substring(0, i) + 'X' + application.substring(i + 1);
                }
            }
            const toks = application.split("XXXXX");
            let isTruthy = true;
            for (const tok of toks) {
                isTruthy = isTruthy && this._canAttach(tok);
            }
            return isTruthy;
        }

        if (application === 'WEAPON') {
            return this.document.type === 'weapon';
        }
        if (application === 'ARMOR') {
            return this.document.type === 'armor';
        }
        if (application === 'ION') {
            return this.document.system.weapon.type === 'Energy (Ion)';
        }
        if (application === 'STUN') {
            return this.document.system.weapon.stun?.isAvailable;
        }
        return false;
    }

    hasParens(application) {
        if (!application.startsWith("(")) {
            return false;
        }
        let depth = 0;
        for (let i = 0; i < application.length; i++) {
            const char = application.charAt(i);
            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
            }
            if (depth === 0) {
                return application.length - 1 === i;
            }
        }
        return false;
    }

    _findZeroDepth(term, search) {
        const found = [];
        let depth = 0;
        for (let i = 0; i < term.length; i++) {
            const char = term.charAt(i);
            if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
            } else if (term.substring(i).startsWith(search) && depth === 0) {
                found.push({start: i, end: i + search.length});
            }
        }
        return found;
    }

    createItemAttribute(attributeId, level, modeId) {
        const content = `<label>Key:
            <input id="key">
            </label>
            <br/>
        <label>Value:
            <input id="value">
            </label>
        `;

        const options = {
            title: "New Attribute",
            content,
            callback: async (html) => {
                const key = html.find("#key")[0].value;
                const value = html.find("#value")[0].value;

                const updateData = {};
                let data = updateData;
                if (level) {
                    updateData.levels = {};
                    updateData.levels[level] = {};
                    updateData.levels[level].data = {};
                    data = updateData.levels[level].data;
                }

                if (modeId !== undefined) {
                    for (const tok of `${modeId}`.split(".")) {
                        data.modes = {};
                        data.modes[tok] = {};
                        data = data.modes[tok];
                    }
                }

                data.attributes = {};
                data.attributes[attributeId] = {key, value};
                this.item.updateData(updateData);
            }
        };

        Dialog.prompt(options);
    }

    createItemMode(modeId, level, parentModeId) {
        const content = `
        <label>Name:</label>
            <input id="name">
        <label>Group:</label>
            <input id="group">
        `;

        const options = {
            title: "New Mode",
            content,
            callback: async (html) => {
                const name = html.find("#name")[0].value;
                const group = html.find("#group")[0].value;

                const updateData = {};
                let data = updateData;
                if (level) {
                    updateData.levels = {};
                    updateData.levels[level] = {};
                    data = updateData.levels[level];
                }

                if (parentModeId !== undefined) {
                    const toks = `${parentModeId}`.split(".");
                    for (const tok of toks) {
                        data.modes = {};
                        data.modes[tok] = {};
                        data = data.modes[tok];
                    }
                }

                data.modes = {};
                data.modes[modeId] = {name, group, attributes: {}};
                this.item.updateData(updateData);
            }
        };

        Dialog.prompt(options);
    }

    _onPrerequisiteControl(event) {
        const target = event.currentTarget;
        const path = target.dataset.path;
        const type = target.dataset.type;

        let system = this.item.system || this.item._source.system;
        for (const tok of path.substring(5).split(".")) {
            if (system[tok]) {
                system = system[tok];
            }
        }

        const updateData = {};
        switch (type) {
            case 'remove-this-prerequisite':
                updateData[path] = null;
                break;
            case 'add-child-prerequisite': {
                const maxKey = (Math.max(...Object.keys(system).map(k => toNumber(k))) || 0) + 1;
                let selectedKey = maxKey;
                for (let i = 0; i <= maxKey; i++) {
                    if (system[i] === undefined || system[i] === null) {
                        selectedKey = i;
                    }
                }
                updateData[path.endsWith("child") ? `${path}` : `${path}.${selectedKey}`] = {};
                break;
            }
        }
        this.item.safeUpdate(updateData);
    }

    _onModifierControl(event) {
        const target = event.currentTarget;
        const path = target.dataset.path;
        const type = target.dataset.type;

        let system = this.item.system || this.item._source.system;
        for (const tok of path.substring(5).split(".")) {
            if (system[tok]) {
                system = system[tok];
            }
        }

        const updateData = {};
        switch (type) {
            case 'remove-this-modifier':
                updateData[path] = null;
                break;
            case 'add-modifier': {
                const maxKey = (Math.max(...Object.keys(system).map(k => toNumber(k))) || 0) + 1;
                let selectedKey = maxKey;
                for (let i = 0; i <= maxKey; i++) {
                    if (system[i] === undefined || system[i] === null) {
                        selectedKey = i;
                    }
                }
                updateData[path.endsWith("child") ? `${path}` : `${path}.${selectedKey}`] = {};
                break;
            }
        }
        this.item.safeUpdate(updateData);
    }

    async _onClassControl(event) {
        const target = event.currentTarget;
        const type = target.dataset.type;

        const highestLevel = this.document.levels
            .map(c => c.flags.swse.level ?? 0)
            .reduce((a, b) => Math.max(a, b), 0);
        switch (type) {
            case "add-level":
                await this.document.addClassLevel(highestLevel + 1);
                break;
            case "remove-level":
                await this.document.removeClassLevel(highestLevel);
                break;
        }
    }

    _onProvidedItemControl(event) {
        const target = event.currentTarget;
        const type = target.dataset.type;
        const entityId = target.dataset.entityId;

        const system = this.document.system || this.document._source.system;
        const updateData = {};
        switch (type) {
            case "delete-item":
                if (Array.isArray(system.providedItems)) {
                    system.providedItems.forEach((item, i) => { updateData[`system.providedItems.${i}`] = item; });
                }
                updateData[`system.providedItems.${entityId}`] = null;
                break;
            case "add-item":
                updateData["system.providedItems"] = (Array.isArray(system.providedItems)
                    ? system.providedItems
                    : Object.values(system.providedItems || {})) || [];
                updateData["system.providedItems"].push({name: "", type: "trait"});
                break;
        }
        this.document.safeUpdate(updateData);
    }
}
