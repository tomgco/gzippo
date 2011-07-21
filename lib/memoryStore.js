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
	this.get = function(pathname) {
		return cache[pathname];
	};
	this.set = function(pathname, cacheObj) {
		var oldCache = typeof(cache[pathname]) == "object" ? cache[pathname] : undefined;
		cache[pathname] = cacheObj;
		return oldCache;
	};
	return this;
})();
