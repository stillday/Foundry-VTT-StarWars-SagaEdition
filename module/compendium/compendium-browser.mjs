import {getInheritableAttribute} from "../attribute-helper.mjs";

export const naturalSort = function (arr, propertyKey = "") {
    const collator = new Intl.Collator(game.settings.get("core", "language"), {numeric: true});
    return arr.sort((a, b) => {
        const propA = propertyKey ? foundry.utils.getProperty(a, propertyKey) : a;
        const propB = propertyKey ? foundry.utils.getProperty(b, propertyKey) : b;
        return collator.compare(propA, propB);
    });
};


export class SWSECompendiumBrowser extends foundry.appv1.api.Application {
    constructor(...args) {
        super(...args);

        this.items = [];

        this.filters = [];
        this.postFilters = [];

        this.activeFilters = {};

        this._data = {
            loaded: false,
            data: {},
            promise: null,
            progress: null,
        };

        /**
         * The bottom scroll treshold (in pixels) at which the browser should start lazy loading some more items.
         *
         * @type {number}
         * @property
         */
        this.lazyLoadTreshold = 80;
        /**
         * The maximum number of items initially visible in regards to lazy loading.
         *
         * @type {number}
         * @property
         */
        this.lazyStart = 80;
        /**
         * The current amount of items visible in regards to lazy loading.
         *
         * @type {number}
         * @property
         */
        this.lazyIndex = 0;
        /**
         * The amount of new items to lazy load when triggered.
         *
         * @type {number}
         * @property
         */
        this.lazyAdd = 20;

        /**
         * A list of packs used, for filtering purposes.
         *
         * @type {Compendium{}}
         * @property
         */
        this.packs = {};

        /**
         * The RegExp to filter item names by.
         *
         * @type {RegExp}
         * @property
         */
        this.filterQuery = /.*/;
        this.defaultString = SWSECompendiumBrowser.buildFilterString(args[0]);
        this.selectedEntityType = args[0].type || "Item"

        this.do_filter(this.defaultString);

        /**
         * Load cached items
         */
        {
            this._savedItems = [];
        }
    }

    /**
     * Turn the `{filterString, pack}` a sheet control carries into the search box's filter string.
     * @param {{filterString?: string, pack?: string}} [request]
     * @returns {string}
     */
    static buildFilterString(request = {}) {
        const split = request.filterString?.split(" ").filter(t => t.length) ?? [];
        if (request.pack) {
            split.push(("-pack:" + request.pack).replace(/ /g, "_"));
        }
        // The trailing separator is load bearing.  The box is pre-filled with these filter terms and
        // the caret sits at their end, so the first character a user types would otherwise be glued
        // onto the last token: "-type:class" + "S" -> "-type:classS".  `do_filter` still sees a
        // single "-" term, `generateFilter` turns it into a `-type` filter for "classS" and tests it
        // against `item.type`, which nothing matches - so typing a name empties the list instead of
        // narrowing it.  With the space the typed text becomes its own search term.
        return split.length ? split.join(" ") + " " : "";
    }

    /**
     * Put the filter terms into the search box and leave the caret behind them.
     *
     * `do_filter` tokenises on spaces, so a search term only works as a search term when it is a
     * token of its own; parking the caret at the end is what makes that the natural outcome of
     * "open the picker, start typing".
     */
    _primeSearchBox() {
        const input = this.element?.find?.('input[name="search"]')?.[0];
        if (!input) return;
        input.value = this.defaultString;
        try {
            input.focus({preventScroll: true});
            input.setSelectionRange(input.value.length, input.value.length);
        } catch { /* not a text input; nothing to place */ }
    }

    /**
     * Point an already open browser at a different filter.
     *
     * Loading the browser's data means indexing every compendium of the selected document type - 24
     * Item packs with 4939 items in this system.  That work is filter independent: `this.items` holds
     * everything and `postFilters` narrows it down, which is exactly what typing in the search box
     * already does.  So a request for a different filter can be served by re-filtering instead of by
     * building a second browser from scratch.
     *
     * @param {{filterString?: string, pack?: string, actionModifier?: string}} request
     */
    applyFilterRequest(request = {}) {
        this.defaultString = SWSECompendiumBrowser.buildFilterString(request);
        if (request.actionModifier !== undefined) {
            this.options.actionModifier = request.actionModifier;
        }
        this._primeSearchBox();
        this.do_filter(this.defaultString);
        // An instance that is still inside `getData()` has no element yet, and `bringToTop()` reads
        // `this.element[0]` unguarded.  Only raise a window that is actually on screen.
        if (this.element?.[0]) this.bringToTop?.();
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "systems/swse/templates/compendium/compendium-browser.hbs",
            classes: ["swse", "app"],
            width: 720,
            height: window.innerHeight - 60,
            top: 30,
            left: 40,
        });
    }

    shouldForceRefresh() {
        let result = false;

        if (!this._currentCompendiums) {
            this.updateForceRefreshData();
        }

        return result;
    }

    updateForceRefreshData(options = {save: false, refresh: true}) {
        // Generate list of usable compendiums
        if (options.refresh) {
            this._currentCompendiums = game.packs
                .filter((o) => {
                    if (o.documentName !== this.entityType) return false;

                    if (this.shouldSkip(o)) return false;

                    return true;
                })
                .map((o) => {
                    return `${o.metadata.package}.${o.metadata.name}`;
                });
        }

        // Save results
        if (options.save) {
            const forceRefreshData = {} //duplicate(game.settings.get("pf1", "compendiumForceRefresh"));
            foundry.utils.setProperty(forceRefreshData, `diff.${this.type}`, this._currentCompendiums);
            return true //game.settings.set("pf1", "compendiumForceRefresh", forceRefreshData);
        }
    }

    async _createInitialElements() {
        let items = [];
        for (let a = 0; items.length < this.lazyLoadTreshold && a < this.items.length; a++) {
            const item = this.items[a];
            if (this._passesFilters(item.item)) {
                item.item.compendiumModifier = this.options.actionModifier
                items.push(item);
            }
            this.lazyIndex = a + 1;
        }

        for (let item of items) {
            await this._addEntryElement(item);
        }
    }

    async _addEntryElement(item) {
        const elem = $(await foundry.applications.handlebars.renderTemplate("systems/swse/templates/compendium/compendium-browser_entry.hbs", item));
        const rootElem = this.element.find(".directory-list");
        rootElem.append(elem);
        this.activateEntryListeners(elem);

        return elem;
    }

    _clearEntryElements() {
        this.element.find(".directory-list").empty();
    }

    activateEntryListeners(elem) {
        // Open sheet
        elem.click((ev) => {
            let li = ev.currentTarget;
            this._onEntry(li.getAttribute("data-collection"), li.getAttribute("data-entry-id"));
        });

        // Make compendium item draggable
        elem[0].setAttribute("draggable", true);
        elem[0].addEventListener("dragstart", this._onDragStart, false);
    }

    async _initLazyLoad() {
        await this._createInitialElements();
        const rootElem = this.element.find(".directory-list");

        // Create function for lazy loading
        const lazyLoad = async () => {
            let createdItems = 0;
            for (let a = this.lazyIndex; a < this.items.length && createdItems < this.lazyAdd; a++) {
                const item = this.items[a];
                if (this._passesFilters(item.item)) {
                    createdItems++;
                    const elem = await this._addEntryElement(item);
                    $(elem).fadeIn(500);
                }
                this.lazyIndex++;
            }
        };

        // Create callback for lazy loading
        $(rootElem).on("scroll", () => {
            const top = rootElem.scrollTop() + rootElem.height();
            const bottom = rootElem[0].scrollHeight - this.lazyLoadTreshold;
            if (top >= bottom) {
                lazyLoad();
            }
        });
    }

    async _onDrop(event) {
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        if (!data.type) throw new Error("You must define the type of document data being dropped");

        let collection = this.getCollection();

        if (!collection) return false;


        if (data.pack === collection.collection) return false; // Prevent drop on self

        // Import the dropped Document
        const cls = collection.documentClass;
        const document = await cls.fromDropData(data);
        let importDocument = collection.importDocument(document);
        this.refresh()
        return importDocument;
    }

    _contextMenu(html) {
        // v14 ContextMenu: the container must be an HTMLElement (jQuery is deprecated since v13 and
        // removed in v15) and `jQuery: false` opts the entry callbacks into HTMLElement targets.
        // See client/applications/ux/context-menu.mjs.  Both are logged as separate compatibility
        // warnings when omitted, so both have to be supplied.
        const container = html instanceof HTMLElement ? html : html?.[0];
        if (!container) return;
        foundry.applications.ux.ContextMenu.implementation.create(this, container, ".directory-item",
            this._getEntryContextOptions(), {jQuery: false});
    }

    /* -------------------------------------------- */

    /**
     * Get Compendium entry context options
     * @returns {object[]}  The Compendium entry context options
     * @private
     */
    _getEntryContextOptions() {
        // v14 renamed the ContextMenuEntry fields: name -> label, condition -> visible,
        // callback(target, event) -> onClick(event, target).  With `jQuery: false` set in
        // _contextMenu the target is an HTMLElement, so read the entry id from its dataset.
        return [
            {
                label: "COMPENDIUM.ImportEntry",
                icon: '<i class="fas fa-download"></i>',
                visible: () => {
                    let collection = this.getCollection();
                    return false && !!collection && collection.documentClass.canUserCreate(game.user)
                },
                onClick: (event, target) => {
                    let collection = this.getCollection();
                    const id = target.dataset.entryId;
                    return collection.importFromCompendium(collection, id, {}, {renderSheet: true});
                }
            },
            {
                label: "COMPENDIUM.DeleteEntry",
                icon: '<i class="fas fa-trash"></i>',
                visible: () => game.user.isGM && !!this.getCollection(),
                onClick: async (event, target) => {
                    const id = target.dataset.entryId;
                    const document = await this.getCollection().getDocument(id);
                    return Dialog.confirm({
                        title: `${game.i18n.localize("COMPENDIUM.DeleteEntry")} ${document.name}`,
                        content: `<h4>${game.i18n.localize("AreYouSure")}</h4><p>${game.i18n.localize("COMPENDIUM.DeleteEntryWarning")}</p>`,
                        yes: () => {
                            document.delete()
                            this.refresh()
                        }
                    });
                }
            }
        ];
    }

    async loadData() {
        return new Promise((resolve) => {
            let promise = this._data.promise;
            if (promise == null) {
                promise = this._gatherData();
                this._data.promise = promise;
            }

            promise.then(async () => {
                this._data.loaded = true;
                this._data.promise = null;
                try {
                    //await this.saveEntries();
                } catch (err) {
                    console.error(err);
                    await this.clearEntries();
                }
                resolve(this._data.data);
            });
        });
    }

    async _gatherData() {
        try {
            await this._fetchMetadata();
        } catch (err) {
            console.warn(err);
            this._savedItems = [];
            await this._fetchMetadata();
        }

        // No `collection` map here any more.  It was an id -> entry index of every loaded item that
        // no template and no code path ever read, and `getData` runs `duplicate()` over this object
        // on every render, so it deep cloned all 4939 entries for nothing.
        this._data.data = {
            filters: this.filters,
            labels: {
                itemCount: this.items.length///game.i18n.localize("PF1.TotalItems").format(this.items.length),
            },
        };
    }

    get type() {
        return this.options.type;
    }

    get title() {
        return [this.type, "Browser"].join(" ");
    }

    get entityType() {
        return this.selectedEntityType
    }

    getBasicFilters() {
        return [null];
    }

    /**
     * @param {Compendium} p - The compendium in question.
     * @returns {boolean} Whether the compendium should be skipped.
     */
    shouldSkip(p) {
        // Check disabled status
        const config = game.settings.get("core", "compendiumConfiguration")[p.collection];
        const disabled = foundry.utils.getProperty(config, "swse.disabled") === true;
        if (disabled) return true;

        // Skip if set to private and the user is not a GM
        if (!p.visible && !game.user.isGM) return true;

        // Don't skip the compendium
        return false;
    }

    _onProgress(progress) {
        progress.loaded++;
        progress.pct = Math.round((progress.loaded * 100) / progress.total);
        // SceneNavigation.displayProgressBar is deprecated since v13 (removed in v15) in favour of
        // Notifications#notify with {progress: true}; see client/applications/ui/scene-navigation.mjs.
        // The notification's own pct is a 0-1 fraction, unlike the old 0-100 percentage.
        if (!this.#progressBar || !ui.notifications.has(this.#progressBar)) {
            this.#progressBar = ui.notifications.info(progress.message, {progress: true});
        }
        this.#progressBar.update({message: progress.message, pct: Math.clamp(progress.pct, 0, 100) / 100});
    }

    /**
     * The active progress notification used while compendium contents are loaded.
     * @type {Notification|undefined}
     */
    #progressBar;

    /**
     * Dismiss the loading notification.
     *
     * `Notifications##fetch` only schedules the automatic removal for notifications that are neither
     * `permanent` nor `progress` (client/applications/ui/notifications.mjs), so a progress
     * notification stays on screen until somebody removes it.  Nothing did, which left a
     * "Loading Compendium Browser 100%" bar parked over the top centre of the interface for the rest
     * of the session - on top of the sheet controls that live there, swallowing their clicks.
     */
    #finishProgress() {
        try { this.#progressBar?.remove?.(); } catch { /* already gone */ }
        this.#progressBar = undefined;
    }

    /** @inheritDoc */
    async close(...args) {
        this.#finishProgress();
        return super.close(...args);
    }

    /**
     * The `system.*` paths the browser needs on top of what core already indexes.
     *
     * `Item.metadata.compendiumIndexFields` (common/documents/item.mjs) is
     * `["_id", "name", "img", "type", "sort", "folder"]`, and
     * `CompendiumCollection#getIndex` additionally stamps `uuid` onto every entry
     * (client/documents/collections/compendium-collection.mjs).  Together with the four fields below
     * that is everything `_mapEntry`, the entry template and every filter this browser offers can
     * read - see the field-by-field note on `_mapEntry`.
     *
     * `CompendiumCollection#indexFields` in v14 is *only* built from
     * `documentClass.metadata.compendiumIndexFields` plus `CONFIG[documentName].compendiumIndexFields`.
     * There is no manifest-level `indexFields` and no `flags.<systemId>.indexFields` in v14 - a grep
     * over `common/packages/` finds no such field.  Declaring them here and passing them to
     * `getIndex({fields})` per call keeps the extra payload to the browser instead of inflating the
     * index of every Item pack for the whole client, and `getIndex` caches the widened index on the
     * pack anyway, so the second browser gets it for free.
     *
     * The server honours dotted paths: `ServerBackend##o` turns each entry into a projection with
     * `setProperty(projection, field, 1)` and hands it to `SublevelDatabase#find({project})`, which
     * runs `filterObject(record, projection)` - a recursive filter that copies a matched non-object
     * value (an array of changes included) verbatim.
     *
     * @type {string[]}
     */
    static INDEX_FIELDS = ["system.subtype", "system.talentTree", "system.possibleProviders", "system.changes"];

    async loadCompendium(p, filters = [null]) {
        const progress = this._data.progress;

        // The index instead of the documents.  `getDocuments()` pulls every field of all 4939 items
        // of the 24 Item packs over the socket and instantiates a Document (and its DataModel) for
        // each one; the browser only ever displays name/img/type/subType/talentTree and filters on
        // those plus `system.changes`.  `getIndex` asks the server to project exactly those fields.
        //
        // `p.clear()` is gone with it: it used to drop the pack's document cache on every open, so
        // every open paid the full price again.  The index is cached on the pack by `getIndex`, and
        // a widened index is reused as long as the requested fields are a subset of what was already
        // indexed, which makes reopening the browser nearly free.
        //
        // `filters` is unused now - the index is unfiltered by construction and `getBasicFilters()`
        // returns `[null]` for every browser in this system, so nothing narrowed the query anyway.
        const index = await p.getIndex({fields: SWSECompendiumBrowser.INDEX_FIELDS});

        const items = [];
        for (const entry of index) {
            this.packs[p.collection] = p;
            items.push(this._mapEntry(p, entry));
        }

        this._onProgress(progress);
        return items;
    }

    async _fetchMetadata() {
        this.items = [];
        // Initialize progress bar
        let packs = [];
        const progress = {pct: 0, message: game.i18n.localize("SWSE.LoadingCompendiumBrowser"), loaded: -1, total: 0};
        for (let p of game.packs.values()) {
            if (p.documentClass.documentName === this.entityType && !this.shouldSkip(p)) {
                progress.total++;
                packs.push(p);
            } else {
                if (Object.hasOwnProperty.call(this.packs, p.collection)) {
                    delete this.packs[p.collection];
                }
            }
        }

        // Clear filters without applicable packs
        if (packs.length === 0) {
            this.filters = [];
            return;
        }

        this._data.progress = progress;
        this._onProgress(progress);

        // Load compendiums
        let promises = [];
        for (let p of packs) {
            promises.push(this.loadCompendium(p, this.getBasicFilters()));
        }

        // Deliberately not awaited: _gatherData/getData must resolve so the window appears while the
        // packs are still loading, otherwise the user stares at nothing for the whole load.
        Promise.all(promises).then(async response => {
            response.forEach(items => this.items.push(...items))
            // Sort items
            this.items = naturalSort(this.items, "item.name");

            // Gather filter data
            this._fetchGeneralFilters();
            // Lazy load
            await this._initLazyLoad();
            // Everything is in: take the loading bar down again.
            this.#finishProgress();
            // The header counters are rendered from _gatherData, which resolves before this promise
            // does, so at render time both were still 0.  Fill them in once the items are actually
            // there instead of leaving the window claiming "0 of 0".
            this._updateItemCounts();
        })
    }

    /* ------------------------------------- */
    /*  Mapping Functions                    */

    /* ------------------------------------- */
    /**
     * Reduce one compendium index entry to what the browser actually uses.
     *
     * Every field below is consumed somewhere concrete:
     *  - `_id`, `uuid`, `collection._id`, `img`, `name`, `type`, `subType`, `talentTree` and
     *    `compendiumModifier` are read by templates/compendium/compendium-browser_entry.hbs,
     *  - `name`, `type`, `subType`, `talentTree` and `groupTypes` are what the search box matches in
     *    `_passesFilters`,
     *  - `type`, `subType`, `pack` and `isExotic` back the `-type:` / `-subtype:` / `-pack:` /
     *    `-exotic` filter terms produced by `generateFilter`,
     *  - `changes` is the only thing the homebrew post filter needs.  It hands this very object to
     *    `getInheritableAttribute({entity})`, whose only reader for a plain object is
     *    `getLocalChangesOnDocument`, which resolves `document.changes || document.system?.changes`.
     *    The other collectors bail out immediately: `getChangesFromEmbeddedItems` requires an
     *    `SWSEActor`, `getChangesFromActiveEffects` requires `document.effects` (which the old
     *    mapping did not carry either, so nothing regresses) and `getChangesFromLoadedAmmunition`
     *    requires `document.ammunition`.
     *
     * The whole `system` object used to be kept here.  Nothing read it, and it was the reason
     * `getData`'s `duplicate(this._data.data)` had to deep clone 4939 full item bodies on every
     * render.
     */
    _mapEntry(pack, item) {
        const result = {
            collection: {
                _id: pack.collection,
                label: pack.metadata.label,
            },
            item: {
                _id: item._id,
                name: item.name,
                type: item.type,
                img: item.img,
                changes: item.system?.changes,
                uuid: item.uuid ?? `Compendium.${pack.metadata.id}.${item._id}`,
                pack: pack.collection,
                talentTree: item.system?.talentTree,
                groupTypes: item.system?.possibleProviders || [],
                subType: item.system?.subtype,
                isExotic: item.system?.subtype?.toLowerCase().includes("exotic")
            },
        };

        return result;
    }

    async getData() {
        this.updateForceRefreshData();
        if (this.shouldForceRefresh() || !this._data.loaded) await this.loadData();
        await this.updateForceRefreshData({save: true, refresh: false});

        const data = foundry.utils.duplicate(this._data.data);
        data.searchString = this.searchString;

        return data;
    }

    async refresh() {
        await this.loadData();
        this.render(false);
    }

    _fetchGeneralFilters() {
        this.filters = [];
    }

    async _render(force, ...args) {
        await super._render(force, ...args);

        this._determineFilteredItemCount();
    }

    activateListeners(html) {
        super.activateListeners(html);

        let search = html.find('input[name="search"]');
        search.keyup(this._onFilterResults.bind(this));
        this._primeSearchBox();

        html.each((i, li) => {
            li.addEventListener("drop", (ev) => this._onDrop(ev));
        });

        html.find('.filter input[type="checkbox"]').change(this._onActivateBooleanFilter.bind(this));

        html.find(".filter h3").click(this._toggleFilterVisibility.bind(this));

        html.find("button.refresh").click(this.refresh.bind(this));

        this._contextMenu(html)
    }

    /**
     * Handle opening a single compendium entry by invoking the configured entity class and its sheet
     *
     * @param collectionKey
     * @param entryId
     * @private
     */
    async _onEntry(collectionKey, entryId) {
        const pack = game.packs.find((o) => o.collection === collectionKey);
        const entity = await pack.getDocument(entryId);
        entity.sheet.render(true);
    }

    /**
     * Handle a new drag event from the compendium, create a placeholder token for dropping the item
     *
     * @param event
     * @private
     */
    _onDragStart(event) {
        const li = this,
            packName = li.getAttribute("data-collection"),
            pack = game.packs.find((p) => p.collection === packName);

        // Get the pack
        if (!pack) {
            event.preventDefault();
            return false;
        }

        // Set the transfer data
        event.dataTransfer.setData(
            "text/plain",
            JSON.stringify({
                type: pack.documentClass.documentName,
                pack: pack.collection,
                id: li.getAttribute("data-document-id"),
                uuid: li.getAttribute("data-uuid"),
                modifier: li.getAttribute("data-action-modifier")
            })
        );
    }

    _toggleFilterVisibility(event) {
        event.preventDefault();
        const title = event.currentTarget;
        const content = $(title).siblings(".filter-content")[0];

        if (content.style.display === "none") content.style.display = "block";
        else content.style.display = "none";
    }

    _onFilterResults(event) {
        event.preventDefault();
        let input = event.currentTarget;


        // Filter if we are done entering keys
        let raw_string = input.value;
        this.do_filter(raw_string);
    }

    do_filter(raw_string) {
        // Define filtering function
        let filter = async (query) => {
            this.filterQuery = query;
            await this._filterResults();
        };

        let terms = raw_string.split(" ");
        let filterStrings = [];
        let searchTerms = [];
        for (let term of terms) {
            if (term.startsWith("-")) {
                filterStrings.push(term);
            } else {
                searchTerms.push(term);
            }
        }

        this.postFilters = this.generateFilters(filterStrings);
        const enableHomebrewContent = game.settings.get("swse", "enableHomebrewContent");
        if(!enableHomebrewContent){
            this.postFilters.push({
                type: 'homebrew',
                test: (item) => {
                    const inheritableAttribute = !getInheritableAttribute({
                        entity:item,
                        attributeKey: "isHomebrew",
                        reduce:"OR"
                    });
                    return inheritableAttribute
                }
            })
        }

        let groomedString = searchTerms.join(" ").trim();
        let query = new RegExp(RegExp.escape(groomedString), "i");
        this.searchString = groomedString;
        if (this._filterTimeout) {
            clearTimeout(this._filterTimeout);
            this._filterTimeout = null;
        }
        this._filterTimeout = setTimeout(() => filter(query), 100);
    }


    generateFilters(filterStrings) {
        return filterStrings.map(filterString => this.generateFilter(filterString))
    }

    generateFilter(filterString) {
        if (filterString.startsWith("-type")) {
            let s = filterString.split(":")[1]

            if (s) {
                return {
                    type: 'type',
                    test: (item) => {
                        return new RegExp(RegExp.escape(s), "i").test(item.type)
                    }
                }
            }
        } else if (filterString.startsWith("-subtype")) {
            let s = filterString.split(":")[1]

            if (s) {
                return {
                    type: 'subtype',
                    test: (item) => {
                        return new RegExp(RegExp.escape(s), "i").test(item.subType)
                    }
                }
            }
        } else if (filterString.startsWith("-pack")) {
            let s = filterString.split(":")[1]

            if (s) {
                s = s.replace(/_/g, " ")
                return {
                    type: 'pack',
                    test: (item) => {
                        let regExp = new RegExp(RegExp.escape(s), "i");
                        return regExp.test(item.pack)
                    }
                }
            }
        } else if (filterString.startsWith("-exotic")) {
            return {
                type: 'exotic',
                test: (item) => {
                    return !!item.isExotic
                }
            }
        }
    }

    _onActivateBooleanFilter(event) {
        event.preventDefault();
        let input = event.currentTarget;
        const path = input.closest(".filter").dataset.path;
        const key = input.name;
        const value = input.checked;

        const filter = this._data.data.filters.find((o) => o.path === path);
        if (filter) {
            if (!filter.active) filter.active = {};
        }

        if (value) {
            let index = this.activeFilters[path].indexOf(key);
            if (index < 0) {
                this.activeFilters[path].push(key);
                filter.active[key] = true;
            }
        } else {
            let index = this.activeFilters[path].indexOf(key);
            if (index >= 0) {
                this.activeFilters[path].splice(index, 1);
                if (filter.active[key] != null) delete filter.active[key];
            }
        }

        // Save filter settings
        {
            const settings = game.settings.get("pf1", "compendiumFilters");
            foundry.utils.setProperty(settings, `${this.type}.activeFilters`, this.activeFilters);
            game.settings.set("pf1", "compendiumFilters", settings);
        }

        return this._filterResults();
    }

    async _filterResults() {
        this.lazyIndex = 0;
        // Clear entry elements
        this._clearEntryElements();

        // Scroll up
        const rootElem = this.element.find(".directory-list")[0];
        if (rootElem) {
            rootElem.scrollTop = 0;
        }

        // Create new elements
        await this._createInitialElements();

        // Determine filtered item count
        this._determineFilteredItemCount();
    }

    _determineFilteredItemCount() {
        let itemCount = 0;
        for (let item of this.items) {
            if (this._passesFilters(item.item)) {
                itemCount++;
            }
        }
        this.element
            .find('span[data-type="filterItemCount"]')
            .text(itemCount)//game.i18n.localize("PF1.FilteredItems").format(itemCount));
    }

    /**
     * Refresh both header counters ("<filtered> of <total>").
     * The total is rendered from `_gatherData`, which runs before the packs have finished loading,
     * so the window opens claiming "0 of 0" until this is called again afterwards.
     */
    _updateItemCounts() {
        this._determineFilteredItemCount();
        this.element
            .find('span[data-type="itemCount"]')
            .text(this.items.length);
    }

    _passesFilters(item) {
        let matchesProviderGroup = item.groupTypes.map(type => {
            let b = this.filterQuery.test(type);
            return b;
        })
            .reduce((previousValue, currentValue) => previousValue || currentValue, false);


        if (!this.filterQuery.test(item.name)
            && !this.filterQuery.test(item.talentTree)
            && !this.filterQuery.test(item.type)
            && !this.filterQuery.test(item.subType)
            && !matchesProviderGroup) return false;

        let groupedFilters = {};
        this.postFilters.forEach(f => {
            if (!f) return;
            groupedFilters[f.type] = groupedFilters[f.type] || []
            groupedFilters[f.type].push(f)
        });

        for (let key of Object.keys(groupedFilters)) {
            if (!groupedFilters[key].map(f => f.test(item)).reduce((previous, next) => previous || next, false)) return false;
        }


        return true;
    }

    getSaveEntries() {
        let result = [];

        let propKeys = ["_id", "name", "img"];


        for (let i of this.items) {
            let resultObj = {
                collection: i.collection,
                item: {},
            };

            // Copy parsed properties
            for (let k of Object.keys(i.item)) {
                if (k !== "data") {
                    resultObj.item[k] = i.item[k];
                }
            }

            // Copy specific data properties
            for (let k of propKeys) {
                if (foundry.utils.hasProperty(i.item, k)) {
                    foundry.utils.setProperty(resultObj, `item.${k}`, foundry.utils.getProperty(i.item, k));
                }
            }

            result.push(resultObj);
        }

        return result;
    }

    saveEntries() {
        const entries = this.getSaveEntries();

        const settings = {}//game.settings.get("pf1", "compendiumItems") || {};
        settings[this.type] = entries;

        return false//game.settings.set("pf1", "compendiumItems", settings);
    }

    clearEntries() {
        const settings = {}///game.settings.get("pf1", "compendiumItems") || {};
        settings[this.type] = [];

        return false//game.settings.set("pf1", "compendiumItems", settings);
    }

    getCollection() {
        let search = this.element.find(`input[name="search"]`)[0];
        let values = search.value.split(" ");

        let compendium;

        for (let value of values) {
            if (!value) continue;
            if (value.startsWith("-pack")) {
                if (!compendium) {
                    let compendiumName = value.split(":")[1];
                    compendium = game.packs.get(compendiumName);
                    if (!compendium) {

                        compendium = game.packs.get(compendiumName.replace("_", " "));
                    }
                } else {
                    //throw ui exception
                }
            }
        }

        return compendium;
    }
}
