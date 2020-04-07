'use strict';
const BroccoliPlugin = require("broccoli-plugin");
const fs = require("fs");
const Funnel = require("broccoli-funnel").Funnel;

function trace(message) {
  if (process.env.EMBER_TRACER_FILE) {
    fs.appendFileSync(process.env.EMBER_TRACER_FILE, message, "utf-8");
    if (!message.endsWith("\n")) {
      fs.appendFileSync(process.env.EMBER_TRACER_FILE, "\n", "utf-8");
    }
  } else {
    console.log(message);
  }
}

class Tracer extends Funnel {
  constructor(realTree, name, suffix) {
    super(realTree, {
      annotation: `tracer: ${name}`,
    });
    this.name = name;
    this.suffix = suffix;
    this.discoveredFiles = [];
    this.getDestinationPath = this._getDestinationPath.bind(this);
  }
  _getDestinationPath(relativePath) {
    this.discoveredFiles.push(relativePath);
    if (relativePath.endsWith(".block.css")) {
      relativePath = relativePath.substring(0,relativePath.length - 10);
      relativePath = relativePath + "--" + this.suffix + ".block.css";
    } else if (relativePath.endsWith(".hbs")) {
      relativePath = relativePath.substring(0,relativePath.length - 4);
      relativePath = relativePath + "--" + this.suffix + ".hbs";
    }
    return relativePath;
  }
  build() {
    super.build();
    if (this.discoveredFiles.length === 0) {
      trace(`Tree: ${this.name}\n\tEMPTY\n`);
    } else {
      trace(`Tree: ${this.name}\n\t` + this.discoveredFiles.join("\n\t") + "\n");
    }
  }
}

module.exports = {
  name: require('./package').name,
  _modulePrefix() {
    const parent = this.parent;
    const config = typeof parent.config === "function" ? parent.config() || {} : {};
    const name = typeof parent.name === "function" ? parent.name() : parent.name;
    const moduleName = typeof parent.moduleName === "function" ? parent.moduleName() : parent.moduleName;
    return moduleName || parent.modulePrefix || config.modulePrefix || name || "";
  },
  getEnv(parent) {
    // Fetch a reference to the parent app
    let current = this, app;
    do { app = current.app || app; }
    while (current.parent.parent && (current = current.parent));

    let isApp = parent === app;

    // The absolute path to the root of our app (aka: the directory that contains "src").
    // Needed because app root !== project root in addons – its located at `tests/dummy`.
    // TODO: Is there a better way to get this for Ember?
    let rootDir = parent.root || parent.project.root;

    let modulePrefix = this._modulePrefix();

    return {
      parent,
      app,
      rootDir,
      isApp,
      modulePrefix,
    };
  },
  preprocessTree(type, tree) {
    let name = `${this.env.isApp ? "app" : this.env.modulePrefix}.preprocessTree('${type}')`;
    if (tree) {
      tree = new Tracer(tree, name, `${this.env.isApp ? "app" : "addon"}_preprocesstree_${type}`)
    } else {
      trace(`No tree given for ${name}.`)
    }
    return tree;
  },
  postprocessTree(type, tree) {
    let name = `${this.env.isApp ? "app" : this.env.modulePrefix}.postprocessTree('${type}')`;
    if (tree) {
      tree = new Tracer(tree, name, `${this.env.isApp ? "app" : "addon"}_postprocesstree_${type}`)
    } else {
      trace(`No tree given for ${name}.`);
    }
    return tree;
  },
  included(parent) {
    let env = this.getEnv(parent);
    this.env = env;
    if (env.isApp) {
      let treeNames = Object.keys(parent.trees);
      for (let treeName of treeNames) {
        let tree = parent.trees[treeName]
        let name = `app.trees['${treeName}']`;
        if (tree) {
          parent.trees[treeName] = new Tracer(tree, name, `app_trees_${treeName}`)
        } else {
          trace(`No tree for ${name}`)
        }
      }
    } else {
      let realTreeFor = parent.treeFor;
      parent.treeFor = function(type) {
        let realTree = realTreeFor.call(this, type)
        let name = `${env.modulePrefix}.treeFor('${type}')`;
        if (realTree) {
          let t = new Tracer(realTree, name, `${env.modulePrefix}_treefor_${type}`);
          return t;
        } else {
          trace(`No tree for ${name}`)
          return realTree;
        }
      };
    }
  }
};
