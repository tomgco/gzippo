/*!
 * Tom Gallacher
 * 
 * MIT Licensed
 */

/**
 * Module dependencies.
 */
var	compress = require('compress');	

/**
 * gzipped cache.
 */

var gzippoCache = {};

/**
 * gzip file.
 */
 
var gzippo = function(data, url) {
	var gzip = new compress.Gzip();
	gzip.init();
	var gzippedData = gzip.deflate(data, 'binary') + gzip.end();
	return gzippedData;
};

/**
 * By default gzip's static's that match the given regular expression /text|javascript|json/
 * and then serves them with Connects static provider, denoted by the given `dirPath`.
 *
 * Options:
 *
 *	-	`maxAge`  cache-control max-age directive, defaulting to 1 day
 *	-	`matchType` - A regular expression tested against the Content-Type header to determine whether the response 
 *		should be gzipped or not. The default value is `/text|javascript|json/`.
 *
 * Examples:
 *
 *     app.use(
 *       gzippo.gzip(__dirname + '/public/');
 *     );
 *
 *     app.createServer(
 *       gzippo.gzip(__dirname + '/public/', {maxAge: 86400000});
 *     );
 *
 * @param {String} path
 * @param {Object} options
 * @return {Function}
 * @api public
 */

exports = module.exports = function gzip(options){
	options = options || {};
	var maxAge = options.maxAge || 86400000,
	contentTypeMatch = options.contentTypeMatch || /text|javascript|json/;
	
	if (!contentTypeMatch.test) throw new Error('contentTypeMatch: must be a regular expression.');

	return function gzip(req, res, next){
		var end = res.end,
		writeHead = res.writeHead,
		setHeader = res.setHeader,
		url = req.originalUrl,
		write = res.write,
		send = res.send,
		defaults = {},
		chunky = '';

		// mount safety
		if (req._gzipping) return next();
		
		res.setHeader = function(key, value){
			res.setHeader = setHeader;
			if (key == "Content-Type" && contentTypeMatch.test(value)) {
				res.setHeader('Content-Encoding', 'gzip');
				res.setHeader('Vary', 'Accept-Encoding');
			}
			res.setHeader(key, value);
		};

		res.writeHead = function(code, headers){
			res.writeHead = writeHead;
			contentType = res._headers['content-type'] || '';
			if (contentTypeMatch.test(contentType)) {
				res.setHeader('Content-Encoding', 'gzip');
				res.setHeader('Vary', 'Accept-Encoding');
				res.removeHeader('Content-Length');
			}
			res.writeHead(code, headers);
		};
		
		res.write = function(chunk, encoding) {
			res.write = write;
			contentType = res._headers['content-type'] || '';
			if (contentTypeMatch.test(contentType)) {
				chunky += chunk;
			} else {
				res.write(chunk, encoding);
			}
		};
		
		res.end = function(chunk, encoding) {
			res.end = end;
			contentType = res._headers['content-type'] || '';
			if (contentTypeMatch.test(contentType) && !req._gzipping) {
				req._gzipping = true;
				if (chunk !== undefined) {
					chunky += chunk;
				}
				chunk = gzippo(chunky);
				chunky = '';
				res.end(chunk, 'binary');
			} else {
				res.end(chunk, encoding);
			}
		};
			
		next();
	};
};