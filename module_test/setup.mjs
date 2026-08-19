// module_test/setup.mjs

import { expect } from 'chai';

// Mock Foundry globals
global.fromUuidSync = (uuid) => null;

global.foundry = {
  abstract: {
    TypeDataModel: class {},
    DataModel: class {}
  },
  data: {
    fields: {
      StringField: class {},
      NumberField: class {},
      BooleanField: class {},
      ArrayField: class {},
      ObjectField: class {},
      SchemaField: class {},
      EmbeddedDataField: class {},
      FilePathField: class {},
      ColorField: class {},
      HTMLField: class {},
      JSONField: class {}
    }
  },
  documents: {
    ActiveEffect: class {},
    Actor: class {
        get id() { return "test-actor-id"; }
        get uuid() { return "Actor.test-actor-id"; }
    },
    Item: class {
        get id() { return "test-item-id"; }
        get uuid() { return "Item.test-item-id"; }
    },
    TokenDocument: class {}
  },
  utils: {
    getProperty: (obj, path) => path.split('.').reduce((o, i) => o?.[i], obj),
    mergeObject: (target, source) => Object.assign(target, source),
    deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
  },
  appv1: {
    api: {
        Application: class {}
    },
    sheets: {
        ActorSheet: class {},
        ItemSheet: class {}
    }
  },
  canvas: {
    placeables: {
        MeasuredTemplate: class {}
    }
  },
  applications: {
    sidebar: {
      tabs: {
        CompendiumDirectory: class {}
      }
    },
    sheets: {
        ActiveEffectConfig: class {},
        ItemSheet: class {},
        ActorSheet: class {}
    },
    hud: {
        TokenHUD: class {}
    },
    apps: {
        FilePicker: {implementation: class {}},
        DocumentSheetConfig: {registerSheet: () => {}}
    },
    ux: {
        ContextMenu: {implementation: {create: () => {}}},
        TextEditor: {implementation: {getDragEventData: () => ({})}}
    },
    handlebars: {
        getTemplate: async () => (() => ""),
        loadTemplates: async () => [],
        renderTemplate: async () => ""
    },
    ui: {
        SceneNavigation: class {}
    }
  }
};

global.foundry.documents.collections = {
  CompendiumCollection: class {
    static createCompendium() { return Promise.resolve({}); }
  }
};

global.TokenDocument = global.foundry.documents.TokenDocument;

global.Hooks = {
  once: () => {},
  on: () => {},
  callAll: () => {},
  call: () => {}
};

global.Roll = class {
  constructor(formula, data) {
    this.formula = formula;
    this.data = data;
  }
  evaluate() { return this; }
};

global.CONST = {
  // Foundry v14: change types replaced the numeric ACTIVE_EFFECT_MODES.  Values are default
  // priorities, not mode numbers (see common/constants.mjs).
  ACTIVE_EFFECT_CHANGE_TYPES: {
    custom: 0,
    multiply: 10,
    add: 20,
    subtract: 20,
    downgrade: 30,
    upgrade: 40,
    override: 50
  },
  ACTIVE_EFFECT_CHANGE_PHASES: ["initial", "final"]
};

global.Actor = class extends global.foundry.documents.Actor {
  constructor(data = {}) {
    super();
    this.system = data.system || {};
    this.name = data.name || "Unnamed Actor";
    this.flags = data.flags || {};
    this.effects = [];
    this.items = {
        values: () => [],
        filter: () => [],
        map: () => [],
        [Symbol.iterator]: function* () {}
    };
    this.prototypeToken = {};
    this.itemTypes = new Proxy({}, {
        get: (target, prop) => target[prop] || [],
        set: (target, prop, value) => { target[prop] = value; return true; }
    });
  }
  prepareData() {}
  get id() { return "test-actor-id"; }
  get uuid() { return "Actor.test-actor-id"; }
  getCached(key, fn) { return fn(); }
};

global.Item = class extends global.foundry.documents.Item {
  constructor(data = {}) {
    super();
    this.system = data.system || {};
    this.name = data.name || "Unnamed Item";
    this.effects = [];
    this.changes = [];
  }
  prepareData() {}
  get id() { return "test-item-id"; }
  get uuid() { return "Item.test-item-id"; }
};

global.ActiveEffect = global.foundry.documents.ActiveEffect;

global.game = {
  user: { id: "test-user", name: "Test User" },
  settings: {
    get: (scope, key) => {
        if (scope === 'swse' && key === 'defaultAttributeGenerationType') return 'Manual';
        return null;
    }
  },
  packs: {
    get: () => ({ metadata: { packageType: "world" } })
  }
};

global.CONFIG = {
  ActiveEffect: { legacyTransferral: false },
  Actor: { documentClass: global.Actor },
  Item: { documentClass: global.Item }
};

// Add other necessary globals or mocks as needed

// --- v14 port: additional globals required by the module under test ---

// module/common/helpers.mjs registers Handlebars helpers at import time.
global.Handlebars = {
  helpers: {},
  registerHelper: (name, fn) => {
    if ( typeof name === "object" ) Object.assign(global.Handlebars.helpers, name);
    else global.Handlebars.helpers[name] = fn;
  },
  registerPartial: () => {},
  SafeString: class { constructor(s) { this.string = s; } toString() { return this.string; } },
  escapeExpression: s => String(s)
};

global.Dialog = class {
  static prompt() { return Promise.resolve(null); }
  static confirm() { return Promise.resolve(false); }
  constructor(data) { this.data = data; }
  render() { return this; }
};

// Foundry extends String.prototype (common/primitives/string.mjs).  Mirrors v14's titleCase.
if (!String.prototype.titleCase) {
  Object.defineProperty(String.prototype, "titleCase", {
    value: function () {
      if (!this.length) return this;
      return this.toLowerCase().split(' ').reduce((parts, word) => {
        if (!word) return parts;
        parts.push(word.replace(word[0], word[0].toUpperCase()));
        return parts;
      }, []).join(' ');
    }
  });
}
