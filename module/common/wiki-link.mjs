/**
 * Link from item sheets to the SWSE fan wiki (https://swse.fandom.com).
 * The wiki is a secondary reference: the Core Rulebook wins on any conflict.
 * There is only an English wiki (no German rules wiki exists), and item names stay English on purpose,
 * so both language versions link to the same page; only the label and tooltip are localized.
 */
export const WIKI_BASE = "https://swse.fandom.com/wiki/";
export const WIKI_BASE_MIRAHEZE = "https://swse.miraheze.org/wiki/";
export const WIKI_BASE_JEDIPEDIA = "https://jedipedia.fandom.com/wiki/";

/** Item types that make sense as lore lookups in the German Jedipedia. */
export const LORE_TYPES = ["species", "class", "affiliation", "language"];

/**
 * The wikis we link to: two English SWSE rules wikis for every item, plus the German Jedipedia
 * (lore encyclopedia, no SWSE rules) for item types where lore is useful.
 */
export const WIKIS = [
    {id: "fandom", label: "Fandom", base: WIKI_BASE},
    {id: "miraheze", label: "Miraheze", base: WIKI_BASE_MIRAHEZE},
    {id: "jedipedia", label: "Jedipedia (DE)", base: WIKI_BASE_JEDIPEDIA, types: LORE_TYPES, lore: true}
];

/** Wiki page URL for an item name, or null for an empty name. */
export function wikiUrl(name, base = WIKI_BASE) {
    const title = String(name ?? "").trim().replace(/\s+/g, "_");
    if (!title) return null;
    return base + encodeURIComponent(title).replace(/%2F/g, "/");
}

/** Add a "Wiki" link to the header of an item sheet (works for jQuery and plain element html). */
function addWikiLink(app, html) {
    const item = app?.item ?? app?.document;
    const url = wikiUrl(item?.name);
    if (!url) return;
    const root = html instanceof Element ? html : html?.[0];
    const header = root?.querySelector?.(".window-header")
        ?? root?.closest?.(".window-app, .application")?.querySelector(".window-header");
    if (!header || header.querySelector(".swse-wiki-link")) return;
    const close = header.querySelector(".close");
    for (const wiki of WIKIS) {
        if (wiki.types && !wiki.types.includes(item.type)) continue;
        const link = document.createElement("a");
        link.className = "swse-wiki-link header-button";
        link.href = wikiUrl(item.name, wiki.base);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.title = game.i18n.localize(wiki.lore ? "SWSE.Wiki.TooltipLore" : "SWSE.Wiki.Tooltip");
        link.innerHTML = `<i class="fas fa-book-open"></i> ${wiki.lore ? "" : game.i18n.localize("SWSE.Wiki.Link") + " "}${wiki.label}`;
        header.insertBefore(link, close ?? null);
    }
}

export const WIKI_HOOKS = ["renderSWSEItemSheet", "renderItemSheetV2"];

export function registerWikiLink() {
    for (const hook of WIKI_HOOKS) {
        Hooks.on(hook, addWikiLink);
    }
}
