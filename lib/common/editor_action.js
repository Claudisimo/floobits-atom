"use strict";

const flux = require("flukes");

const Actions = flux.createActions({
  clear_highlights: function () {
    return;
  },
  handle_conflicts: function (newFiles, different, missing, ignored, tooBig, justUpload) {
    return {
      newFiles: newFiles,
      different: different,
      missing: missing,
      ignored: ignored,
      tooBig: tooBig,
      justUpload: justUpload
    };
  },
  jump_to_user: function (username) {
    return username;
  },
  kick: function (connectionIDorUsername) {
    return connectionIDorUsername;
  },
  pref: function (name, value, force) {
    if (this.prefs[name] === value && !force) {
      return new Error("Preference " + name + " already has value " + value);
    }
    this.prefs[name] = value;
    // XXXX: hard-coded fl.editor_settings.prefs_path
    this.prefs.save("editor");
    return [this.prefs, name];
  },
  follow: function (username) {
    if (username) {
      this.prefs.followUsers.toggle(username);
      return this.pref("followUsers", this.prefs.followUsers, true);
    }
    return this.pref("following", !this.prefs.following);
  },
});

Actions.prototype.set = function (buffers, prefs) {
  this.buffers = buffers;
  this.prefs = prefs;
};

module.exports = new Actions();
