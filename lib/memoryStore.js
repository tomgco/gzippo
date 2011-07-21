/*!
 * David Ellis
 * 
 * MIT Licensed
 */

/**
 * gzipped in-memory cache.
 */

exports = module.exports = (function() {
	var cache = {};
	this.get = function(pathname, callback) {
		if(cache[pathname]) {
			return callback(undefined, cache[pathname]);
		} else {
			return callback(new Error("File not in cache"), undefined);
		}
	};
	this.set = function(pathname, cacheObj, callback) {
		cache[pathname] = cacheObj;
		return callback(undefined);
	};
	return this;
})();
