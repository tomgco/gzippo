/*!
 * Tom Gallacher
 * 
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var fs = require('fs'),
		parse = require('url').parse,
		path = require('path'),
		mime = require('mime'),
		compress = require('compress'),
		staticSend = require('connect').static.send;

/**
 * gzipped cache.
 */

var gzippoCache = {};

/**
 * gzip file.
 */
 
var gzippo = function(data) {
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
 *     connect.createServer(
 *       connect.staticGzip(__dirname + '/public/');
 *     );
 *
 *     connect.createServer(
 *       connect.staticGzip(__dirname + '/public/', {maxAge: 86400000});
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
	contentTypeMatch = options.contentTypeMatch || /text/;
	
	if (!contentTypeMatch.test) throw new Error('contentTypeMatch: must be a regular expression.');

	return function gzip(req, res, next){
		var end = res.end,
		writeHead = res.writeHead,
		url = req.originalUrl,
		defaults = {};

		// mount safety
		if (req._gzipping) return next();
		
		res.writeHead = function(code, headers){
			res.writeHead = writeHead;
			contentType = res._headers['content-type'] || '';
			if (contentTypeMatch.test(contentType)) {
				res.setHeader('Content-Encoding', 'gzip');
				res.setHeader('Vary', 'Accept-Encoding');
			}
			res.writeHead(code, headers);
		};
		
		res.end = function(chunk, encoding) {
			res.end = end;
			contentType = res._headers['content-type'] || '';
			if (contentTypeMatch.test(contentType) && !req._gzipping) {
				chunk = gzippo(chunk);
				req._gzipping = true;
				res.setHeader('Content-Length', chunk.length);
				res.end(chunk, 'binary');
			} else {
				res.end(chunk, encoding);
			}
		};
			
		next();
	};
};