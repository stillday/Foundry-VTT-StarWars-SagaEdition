import {onCollapseToggle} from "../common/util.mjs";
import {_adjustPropertyBySpan, _onLinkControl, onSpanTextInput, onToggle} from "../common/listeners.mjs";

/**
 * Bridge a Foundry v14 ApplicationV2 action invocation onto SWSE's jQuery-era listeners.
 *
 * ApplicationV2 delegates every `[data-action]` click from a single listener bound to the application
 * root (`ApplicationV2##onClick`, client/applications/api/application.mjs), so `event.currentTarget`
 * is the *root element*, not the clicked control. The action handler receives the real control as its
 * second argument instead. SWSE's shared listeners in module/common/listeners.mjs and
 * module/common/util.mjs all read `event.currentTarget`, so they get a thin facade carrying the
 * resolved target plus the few event methods they call.
 *
 * @param {PointerEvent} event  The originating ApplicationV2 action event
 * @param {HTMLElement} target  The element which carried the `data-action` attribute
 * @returns {object}            A V1-shaped pseudo-event
 */
function asV1Event(event, target) {
    return {
        currentTarget: target,
        target: event.target,
        originalEvent: event,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation()
    };
}

/**
 * The SWSE ActiveEffect sheet.
 *
 * Foundry's own {@link foundry.applications.sheets.ActiveEffectConfig} is
 * `HandlebarsApplicationMixin(DocumentSheetV2)` since v13, so this class is an ApplicationV2. Only the
 * parts that SWSE actually presents differently are overridden — `header`, `details`, `changes` and the
 * SWSE-only `links` tab. `tabs`, `duration` and `footer` are inherited from core, which keeps SWSE off
 * the hook for the v14 duration model (`duration.value`/`duration.units`/`duration.expiry` plus the new
 * `start` block) and for the tab navigation and submit button markup.
 *
 * @extends {foundry.applications.sheets.ActiveEffectConfig}
 */
export class SWSEActiveEffectConfig extends foundry.applications.sheets.ActiveEffectConfig {

    /** @inheritDoc */
    static DEFAULT_OPTIONS = {
        // Arrays concatenate through ApplicationV2#_initializeApplicationOptions, so the root element
        // keeps core's "sheet active-effect-config" and gains SWSE's own hooks.
        classes: ["swse", "sheet", "effect"],
        position: {width: 680, height: 640},
        // The ApplicationV2 equivalent of V1's `submitOnChange` / `closeOnSubmit` sheet options.
        form: {submitOnChange: true, closeOnSubmit: false},
        actions: {
            "change-control": SWSEActiveEffectConfig.#onChangeControl,
            "collapse-toggle": SWSEActiveEffectConfig.#onCollapseToggle,
            "direct-field": SWSEActiveEffectConfig.#onDirectField,
            "link-control": SWSEActiveEffectConfig.#onLinkControl,
            "toggle": SWSEActiveEffectConfig.#onToggle
        }
    };

    /** @override */
    static PARTS = {
        header: {template: "systems/swse/templates/active-effect/header.hbs"},
        tabs: {template: "templates/generic/tab-navigation.hbs"},
        details: {template: "systems/swse/templates/active-effect/details.hbs", scrollable: [""]},
        duration: {template: "templates/sheets/active-effect/duration.hbs"},
        changes: {
            template: "systems/swse/templates/active-effect/changes.hbs",
            scrollable: ["ol.change-list"]
        },
        links: {template: "systems/swse/templates/active-effect/links.hbs", scrollable: [""]},
        footer: {template: "templates/generic/form-footer.hbs"}
    };

    /** @override */
    static TABS = {
        sheet: {
            tabs: [
                {id: "details", icon: "fa-solid fa-book"},
                {id: "duration", icon: "fa-solid fa-clock"},
                {id: "changes", icon: "fa-solid fa-gears"},
                {id: "links", icon: "fa-solid fa-link", label: "EFFECT.TabLinks"}
            ],
            initial: "details",
            labelPrefix: "EFFECT.TABS"
        }
    };

    /* -------------------------------------------- */
    /*  ApplicationV1 compatibility shims           */
    /* -------------------------------------------- */

    /**
     * `DocumentSheetV2` dropped V1's `object` alias, but the shared SWSE listeners in
     * module/common/listeners.mjs (`onToggle`, `_adjustPropertyBySpan`, `_onLinkControl`) still address
     * the edited document that way. Those helpers are shared with the still-V1 actor and item sheets and
     * must not change, so the alias is restored here instead.
     * @returns {ActiveEffect}
     */
    get object() {
        return this.document;
    }

    /**
     * V1's `_onSubmit`. `_adjustPropertyBySpan` calls it after it has already persisted the edited value,
     * purely to flush the rest of the form.
     * @returns {Promise<void>}
     */
    async _onSubmit() {
        if (!this.isEditable) return;
        return this.submit();
    }

    /**
     * V1's `_render`. `onSpanTextInput` calls it to restore the span when an edit was a no-op.
     * @returns {Promise<ApplicationV2>}
     */
    async _render(...args) {
        return this.render(...args);
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        // `editable`, `document`, `source`, `fields` and `rootId` already come from
        // DocumentSheetV2#_prepareContext; only the SWSE-specific additions are needed here.

        // A standalone ActiveEffect (one that lives in a compendium or was created unparented) has no
        // parent at all, so ownership falls back to the effect itself. The pre-V2 code dereferenced
        // `this.document.parent.isOwner` unguarded and would have thrown for those.
        context.owner = this.document.parent?.isOwner ?? this.document.isOwner;
        context.swseDescription = this.document.flags?.swse?.description ?? "";
        context.links = this.document.links ?? [];
        return context;
    }

    /** @inheritDoc */
    async _preparePartContext(partId, context, options) {
        // Core's ActiveEffectConfig pre-renders the `changes` part into an array of HTML strings built
        // from its own templates/sheets/active-effect/change.hbs. SWSE renders its own rows, so that
        // part is prepared here instead of delegating.
        if (partId === "changes") return this.#prepareChangesContext(context);

        const partContext = await super._preparePartContext(partId, context, options);
        if (partId === "links") partContext.tab = context.tabs.links;
        return partContext;
    }

    /**
     * Build the render context for SWSE's `changes` tab.
     *
     * In Foundry v14 an effect's changes live on the ActiveEffect's TypeDataModel at
     * `effect.system.changes` (common/data/active-effect.mjs), each entry being
     * `{key, type, value, phase, priority}`. The numeric `mode` of v13 and earlier is only a
     * deprecation shim now, so the sheet edits `type` and submits `system.changes.<i>.<field>` paths.
     *
     * @param {ApplicationRenderContext} sharedContext  The context produced by {@link _prepareContext}
     * @returns {ApplicationRenderContext}
     */
    #prepareChangesContext(sharedContext) {
        const effect = this.document;
        const ActiveEffectClass = effect.constructor;

        // A shallow copy, because `fields` is narrowed to the change element's schema here and the
        // shared context object is handed to every other part after this one.
        const context = {...sharedContext};
        context.partId = `${this.id}-changes`;
        context.tab = sharedContext.tabs.changes;
        context.fields = effect.system.schema.fields.changes.element.fields;

        context.changeTypes = Object.entries(ActiveEffectClass.CHANGE_TYPES)
            .map(([type, {label}]) => ({type, label: game.i18n.localize(label)}))
            .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
            .reduce((types, {type, label}) => {
                types[type] = label;
                return types;
            }, {});

        const toggles = effect.toggles ?? {};
        context.changes = foundry.utils.deepClone(effect._source.system?.changes ?? []).map((change, index) => {
            // AnyField values round-trip through JSON, mirroring ActiveEffectConfig#_renderChange.
            if (("value" in change) && (typeof change.value !== "string")) change.value = JSON.stringify(change.value);
            const toggleId = `toggle-change-active${index}`;
            return Object.assign(change, {
                index,
                toggleId,
                toggled: !!toggles[toggleId],
                registered: !!ActiveEffectClass.CHANGE_TYPES[change.type],
                defaultPriority: ActiveEffectClass.CHANGE_TYPES[change.type]?.defaultPriority ?? 0,
                keyPath: `system.changes.${index}.key`,
                typePath: `system.changes.${index}.type`,
                valuePath: `system.changes.${index}.value`,
                phasePath: `system.changes.${index}.phase`,
                priorityPath: `system.changes.${index}.priority`
            });
        });
        return context;
    }

    /* -------------------------------------------- */
    /*  Actions                                     */
    /* -------------------------------------------- */

    /**
     * Add or remove a change on the edited effect.
     *
     * SWSE's shared {@link onChangeControl} cannot serve this any more: it writes to the root-level
     * `changes` path with a numeric `mode`, which v14 moved to `system.changes` with a string `type`.
     * Rewriting it is out of scope here because the still-V1 item sheet shares it, so the v14-correct
     * variant lives on the sheet. It mirrors ActiveEffectConfig's private `#onAddChange`/`#onDeleteChange`
     * so that unsaved edits in the other rows survive the operation.
     *
     * @this {SWSEActiveEffectConfig}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     * @returns {Promise<void>}
     */
    static async #onChangeControl(event, target) {
        event.preventDefault();
        if (!this.isEditable) return;
        const type = target.dataset.actionType;
        const element = this.document.system.schema.fields.changes.element;

        const formData = new foundry.applications.ux.FormDataExtended(this.form);
        const submitData = this._processFormData(null, this.form, formData);
        const changes = Object.values(submitData.system?.changes ?? {});

        switch (type) {
            case "add":
                changes.push(element.getInitialValue());
                break;
            case "delete": {
                const index = Number(target.closest("[data-index]")?.dataset.index);
                if (!Number.isInteger(index)) return;
                changes.splice(index, 1);
                break;
            }
            default:
                return;
        }
        await this.submit({updateData: {system: {changes}}});
    }

    /**
     * Show or hide a change row's detail area. Delegates to SWSE's shared collapse helper.
     * @this {SWSEActiveEffectConfig}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onCollapseToggle(event, target) {
        onCollapseToggle(asV1Event(event, target));
    }

    /**
     * Turn a `<span>` into an inline editor and persist the result on blur or Enter.
     * @this {SWSEActiveEffectConfig}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onDirectField(event, target) {
        if (!this.isEditable) return;

        // onSpanTextInput copies the span's whole dataset onto the replacement input, `data-action`
        // included, so the input itself keeps triggering this action. Clicking into the input to move
        // the caret must not swap it for yet another (empty) input.
        if (target.tagName === "INPUT") return;

        const parent = target.parentElement;
        onSpanTextInput.call(this, asV1Event(event, target), _adjustPropertyBySpan.bind(this), "text");

        // onSpanTextInput swaps the span for a focused <input type="text"> synchronously. Inside a
        // <form> — and DocumentSheetV2 renders the application root as one — Enter in a lone text input
        // triggers implicit form submission, which re-renders the sheet and tears the input out of the
        // DOM before onSpanTextInput's own keyup handler can commit the value.
        const input = parent.querySelector("input[type=text]");
        input?.addEventListener("keydown", e => {
            if (["Enter", "NumpadEnter"].includes(e.code)) e.preventDefault();
        });
    }

    /**
     * Delete a reciprocal link between two effects.
     * @this {SWSEActiveEffectConfig}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onLinkControl(event, target) {
        if (!this.isEditable) return;
        _onLinkControl.call(this, asV1Event(event, target));
    }

    /**
     * Flip one of the effect's persisted `flags.swse.toggles` entries.
     * @this {SWSEActiveEffectConfig}
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onToggle(event, target) {
        if (!this.isEditable) return;
        onToggle.call(this, asV1Event(event, target));
    }
}
