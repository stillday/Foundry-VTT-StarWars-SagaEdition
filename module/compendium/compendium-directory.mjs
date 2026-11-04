import {SWSECompendiumBrowser} from "./compendium-browser.mjs";

/**
 * This class is never registered as the sidebar's CompendiumDirectory; it only exists as the home of
 * the static {@link SWSECompendiumDirectory.viewCompendiumItemsByFilter} handler that the actor and
 * item sheets bind to `[data-action="compendium"]`.
 *
 * The V1 instance hooks it used to override (`activateListeners`, `_contextMenu`) are dead in v14:
 * CompendiumDirectory is an ApplicationV2 there, which drives context menus through
 * `_createContextMenus()`/`_createContextMenu()` and never calls `_contextMenu(html)`.  Worse,
 * `ContextMenu.create` throws outright for an ApplicationV2 instance
 * (client/applications/ux/context-menu.mjs), so keeping the override around only invited a crash.
 * They are removed rather than ported.
 */
export class SWSECompendiumDirectory extends foundry.applications.sidebar.tabs.CompendiumDirectory
{
    static viewCompendiumItemsByFilter(event){
        const dataset = event.currentTarget.dataset;
        const filterString = dataset.filter;
        const type = dataset.type;
        const pack = dataset.pack;
        const actionModifier = dataset.actionModifier;

        if(game.settings.get("swse", "enableAdvancedCompendium")) {
            const request = {filterString, type, pack, actionModifier};

            // Opening a browser indexes every compendium of the requested document type (24 Item
            // packs, 4939 items).  Each click used to construct a fresh browser and pay that cost
            // again, which is why a session shows the "Loading Compendium Browser 0% ... 100%" run
            // once per click.  An open browser already holds every item of that type, and its
            // filters are applied client side, so hand the new filter to it instead of building a
            // second one.
            //
            // `app.rendered` is deliberately NOT part of the test.  `ApplicationV2` registers the
            // instance in `foundry.applications.instances` (a Map keyed by app id) as soon as it is
            // constructed, before `_prepareContext()` is called, and removes it in `close()`.
            // Matching on `rendered` would miss the instance that is still loading - exactly the
            // window where a user clicks again because nothing appeared yet - and would spawn another
            // browser with another full load.  Anything in `instances` is alive.
            //
            // The browser's id is `swse-compendium-browser-${entityType.toLowerCase()}` (set in its
            // constructor), so one lookup replaces the linear scan over all open windows.
            const entityType = (type || "Item").toLowerCase();
            const stableId = `swse-compendium-browser-${entityType}`;
            const existing = foundry.applications.instances.get(stableId);
            if (existing instanceof SWSECompendiumBrowser) {
                existing.applyFilterRequest(request);
                return;
            }

            new SWSECompendiumBrowser(request).render({ force: true });
        } else {
            let found = game.packs.get(pack);

            if(found){
                found.render(true);
                return;
            }

            let packName
            if(pack){
                packName = pack.split(".")[1]
            }
            if(!packName && filterString){
                packName = filterString.split(":")[1].split(/(?=[A-Z])/).join("-").toLowerCase()
            }

            found = game.packs.find(p => p.metadata.name.includes(packName));
            if(found){

                found.render(true);
            } else {
                console.warn("could not find appropriate pack " + packName)
            }
        }
    }
}