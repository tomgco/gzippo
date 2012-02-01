/*!
 * Tom Gallacher
 *
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

// Commented out as I think that connect is avalible from within express...
// try {
    var staticMiddleware = require('connect').static;
// } catch (e) {
//  staticMiddleware = require('express').static;
// }

var fs = require('fs'),
    parse = require('url').parse,
    path = require('path'),
    zlib = require('zlib'),
    MemoryStore = require('./memory'),
    FileAsset = require('./fileAsset');

var mime = staticMiddleware.mime,
    staticSend = staticMiddleware.send;

/**
 * Strip `Content-*` headers from `res`.
 *
 * @param {ServerResponse} res
 * @api public
 */

var removeContentHeaders = function(res){
    Object.keys(res._headers).forEach(function(field){
        if (0 === field.indexOf('content')) {
            res.removeHeader(field);
        }
    });
};

/**
 * Supported content-encoding methods.
 */

var methods = {
    gzip: zlib.createGzip,
    deflate: zlib.createDeflate
};

/**
 * Default filter function.
 */

exports.filter = function(req, res){
  var type = res.getHeader('Content-Type') || '';
  return type.match(/json|text|javascript/);
};

/**
 * By default gzip's static's that match the given regular expression /text|javascript|json/
 * and then serves them with Connects static provider, denoted by the given `dirPath`.
 *
 * Options:
 *
 *  -   `maxAge` how long gzippo should cache gziped assets, defaulting to 1 day
 *  -   `clientMaxAge`  client cache-control max-age directive, defaulting to 0; 604800000 is one week.
 *  -   `contentTypeMatch` - A regular expression tested against the Content-Type header to determine whether the response
 *      should be gzipped or not. The default value is `/text|javascript|json/`.
 *  -   `prefix` - A url prefix. If you want all your static content in a root path such as /resource/. Any url paths not matching will be ignored
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

exports = module.exports = function staticGzip(dirPath, options){
    options = options || {};

    var maxAge = options.maxAge || 86400000,
        contentTypeMatch = options.contentTypeMatch || /text|javascript|json/,
        clientMaxAge = options.clientMaxAge || 0,
        prefix = options.prefix || '',
        names = Object.keys(methods),
        compressionOptions = options.compression || {},
        store = options.store || new MemoryStore();

    if (!dirPath) throw new Error('You need to provide the directory to your static content.');
    if (!contentTypeMatch.test) throw new Error('contentTypeMatch: must be a regular expression.');

    return function(req, res, next) {
        var acceptEncoding = req.headers['accept-encoding'],
            url,
            filename,
            contentType,
            charset,
            method;


        function pass(name) {
            var o = Object.create(options);
            o.path = name;
            o.maxAge = clientMaxAge;
            staticSend(req, res, next, o);
        }

        function setHeaders(stat, asset) {
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Encoding', method);
            res.setHeader('Vary', 'Accept-Encoding');
            // if cache version is avalible then add this.
            if (asset) {
                res.setHeader('Content-Length', asset.content.length);
                res.setHeader('ETag', '"' + asset.content.length + '-' + Number(asset.mtime) + '"');
            }
            res.setHeader('Last-Modified', asset.mtime.toUTCString());
            res.setHeader('Date', new Date().toUTCString());
            res.setHeader('Expires', new Date(Date.now() + clientMaxAge).toUTCString());
            res.setHeader('Cache-Control', 'public, max-age=' + (clientMaxAge / 1000));
        }

        // function gzipAndSend(filename, gzipName, mtime) {
        //     gzippo(filename, charset, function(gzippedData) {
        //         gzippoCache[gzipName] = {
        //             'ctime': Date.now(),
        //             'mtime': mtime,
        //             'content': gzippedData
        //         };
        //         sendGzipped(gzippoCache[gzipName]);
        //     });
        // }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return next();
        }

        url = parse(req.url);

        // Allow a url path prefix
        if (url.pathname.substring(0, prefix.length) !== prefix) {
            return next();
        }

        filename = path.join(dirPath, url.pathname.substring(prefix.length));

        contentType = mime.lookup(filename);
        charset = mime.charsets.lookup(contentType, 'UTF-8');
        contentType = contentType + (charset ? '; charset=' + charset : '');

        // default to gzip
        if ('*' == acceptEncoding.trim()) method = 'gzip';

        // compression method
        if (!method) {
            for (var i = 0, len = names.length; i < len; ++i) {
              if (~acceptEncoding.indexOf(names[i])) {
                method = names[i];
                break;
              }
            }
        }

        if (!method) return pass(filename);

        fs.stat(decodeURI(filename), function(err, stat) {

            if (err || stat.isDirectory()) {
                return pass(req.url);
            }

            if (!contentTypeMatch.test(contentType)) {
                return pass(filename);
            }

            // superceeded by if (!method) return;
            // if (!~acceptEncoding.indexOf('gzip')) {
            //     return pass(filename);
            // }

            var base = path.basename(filename),
                dir = path.dirname(filename),
                gzipName = path.join(dir, base + '.gz');

            var sendGzipped = function(filename) {
                var stream = fs.createReadStream(filename);

                asset = new FileAsset(filename, stat.mtime);

                asset.maxAge = options.maxAge;

                req.on('close', stream.destroy.bind(stream));

                var compressionStream = methods[method](options.compression);

                stream.pipe(compressionStream).pipe(res);

                compressionStream.on('data', function(data) {
                    asset.content = data;
                });

                compressionStream.on('end', function() {
                    store.set(asset);
                });

                stream.on('error', function(err){
                    if (res.headerSent) {
                        console.error(err.stack);
                        req.destroy();
                    } else {
                        next(err);
                    }
                });
            };

            store.get(decodeURI(filename), function(err, asset) {
                setHeaders(stat, asset);
                if (err) {
                    // handle error

                } else if (!asset) {
                    sendGzipped(decodeURI(filename));
                } else if ((asset.mtime < stat.mtime) || asset.isExpired) {
                    sendGzipped(decodeURI(filename));
                }
                else if (req.headers['if-modified-since'] &&
                // Optimisation: new Date().getTime is 90% faster that Date.parse()
                +stat.mtime <= new Date(req.headers['if-modified-since']).getTime()) {
                    removeContentHeaders(res);
                    res.statusCode = 304;
                    return res.end();
                } else {
                    res.end(asset.content);
                }
            });
        });
    };
};
