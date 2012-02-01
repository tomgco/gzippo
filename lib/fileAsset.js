var FileAsset = module.exports = function FileAsset(name, mtime) {
  this._fileName = name;
  this._mtime = mtime;
  this._ctime = +Date.now();
  this.fileContents = [];
  this.fileContentsLength = 0;
  this._maxAge = 86400000;
};

/**
 * Prototype.
 */

FileAsset.prototype = {
  set maxAge(maxAge) {
    this._maxAge = maxAge;
  },

  get maxAge() {
    return this_.maxAge;
  },

  get isExpired() {
    return (this._ctime + this._maxAge) < +Date.now();
  },

  get name() {
    return this._fileName;
  },

  set content(data) {
    this.fileContents.push(data);
    this.fileContentsLength += data.length;
  },

  get content() {
    var file = Buffer(this.fileContentsLength);
    var pos = 0;
    for (var i = 0; i < this.fileContents.length; i++) {
      var buffer = this.fileContents[i];
      buffer.copy(file, pos);
      pos += buffer.length;
    }

    return file;
  },

  get data() {
    return {
      expires: this._expires,
      mtime: this._mtime,
      content: this.content
    };
  }
};
