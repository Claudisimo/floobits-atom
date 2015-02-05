var util = require("util");

function FlooUrl(owner, workspace, host, port) {
  this.owner = owner;
  this.workspace = workspace;
  this.host = host;
  this.port = port;
}

FlooUrl.prototype.toString = function () {
  return util.format("https://%s:%s/%s/%s", this.host, this.port, this.owner, this.workspace);
};

exports.FlooUrl = FlooUrl;