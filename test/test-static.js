var assert = require('assert')
  , http = require('http')
  , fs = require('fs')
  , connect = require('connect')
  , join = require('path').join
  , gzippo = require('../');


var fixtures = join(__dirname, 'fixtures')
  , port = 32123
  , app;


// basic request mocking function
function request(path, headers, callback) {
  var options = {
    host: '127.0.0.1',
    port: port,
    path: path,
    headers: headers || {},
    method: 'GET'
  };

  var req = http.request(options, function(res) {
    var buffers = []
      , total = 0;

    res.on('data', function(buf) {
      buffers.push(buf);
      total += buf.length;
    });

    res.on('end', function() {
      var data = new Buffer(total)
        , offset = 0;

      for (var i = 0; i < buffers.length; i++) {
        buffers[i].copy(data, offset);
        offset += buffers[i].length;
      }

      callback(null, res, data);
    });

    res.on('error', function() {
      callback(err);
    });
  });

  req.on('error', function(err) {
    callback(err);
  });

  req.end();
}


// builds a `request` callback which asserts that the response's statusCode is
// what we expect
function statusCode(expected, callback) {
  return function(err, res, data) {
    if (err) throw err;
    assert.equal(res.statusCode, expected);

    callback();
  };
}


// read a fixture file synchronously
function file(name) {
  return fs.readFileSync(join(fixtures, name));
}


describe('gzippo.staticGzip', function() {

  // set up a new server for each test
  beforeEach(function(done) {
    app = connect.createServer();
    app.use(gzippo.staticGzip(fixtures));
    app.listen(port, done);
  });

  afterEach(function() {
    app.close();
  });


  it('should gzip static .json file', function(done) {
    request('/user.json', { 'Accept-Encoding': 'gzip' },
      function(err, res, data) {
        if (err) throw err;
        assert.equal(res.statusCode, 200);

        assert.equal(res.headers['content-type'], 'application/json; charset=UTF-8');
        assert.equal(res.headers['content-length'], '69');
        assert.equal(res.headers['content-encoding'], 'gzip');

        assert.deepEqual(data, file('user.gzip'));

        done();
      }
    );
  });


  it('should gzip static .js file', function(done) {
    request('/test.js', { 'Accept-Encoding': 'gzip' },
      function(err, res, data) {
        if (err) throw err;
        assert.equal(res.statusCode, 200);

        assert.equal(res.headers['content-type'], 'application/javascript; charset=UTF-8');
        assert.equal(res.headers['content-length'], '35');
        assert.equal(res.headers['content-encoding'], 'gzip');

        assert.deepEqual(data, file('test.js.gzip'));

        done();
      }
    );
  });


  it('should serve a .js file uncompressed when the accept-encoding header has not been set', function(done) {
    request('/test.js', {}, function(err, res, data) {
      if (err) throw err;
      assert.equal(res.statusCode, 200);

      assert.equal(res.headers['content-length'], '15');
      assert.deepEqual(data, file('test.js'));

      done();
    });
  });


  it('should successfully gzip a utf-8 file', function(done) {
    request('/utf8.txt', { 'Accept-Encoding': 'gzip' },
      function(err, res, data) {
        if (err) throw err;
        assert.equal(res.statusCode, 200);

        assert.equal(res.headers['content-type'], 'text/plain; charset=UTF-8');
        assert.equal(res.headers['content-length'], '2031');
        assert.equal(res.headers['content-encoding'], 'gzip');

        assert.deepEqual(data, file('utf8.txt.gz'));

        done();
      }
    );
  });


  it('should cache a previously gzipped utf-8 file (and respond with a 304 Not Modified)', function(done) {
    request('/utf8.txt', { 'Accept-Encoding': 'gzip' },
      function(err, res, data) {
        if (err) throw err;
        assert.equal(res.statusCode, 200);

        var headers = {
          'Accept-Encoding': 'gzip',
          'If-Modified-Since': res.headers['last-modified']
        };

        request('/utf8.txt', headers, statusCode(304, done));
      }
    );
  });


  it('should set max age resources which are passed to the default static content provider', function(done) {
    request('/tomg.co.png', {},
      function(err, res, data) {
        if (err) throw err;
        assert.equal(res.statusCode, 200);
        assert.notEqual(res.headers['cache-control'].indexOf('max-age=604800'), -1);

        done();
      }
    );
  });


  it('should allow normal traversal', function(done) {
    request('/nom/../tomg.co.png', {},
      function(err, res, data) {
        if (err) throw err;
        assert.equal(res.statusCode, 200);
        assert.deepEqual(data, file('tomg.co.png'));

        done();
      }
    );
  });


  it('should work for paths containing URI-encoded spaces', function(done) {
    request('/space%20the%20final%20frontier/tomg.co.png', {}, statusCode(200, done));
  });


  it('should not let the user access files outside of the static directory (urlencoded)', function(done) {
    request('/../test-static.js', {}, statusCode(403, done));
  });


  it('should not let the user access files outside of the static directory', function(done) {
    request('/%2e%2e/test-static.js', {}, statusCode(403, done));
  });


  it('should serve index.html for directories (if found)', function(done) {
    request('/index_test/', { 'Accept-Encoding': 'gzip' },
      function(err, res, data) {
        if (err) throw err;
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['content-length'], '366');

        done();
      }
    );
  });

});


describe('gzippo.statisGzip (with prefix)', function() {

  it('should successfully serve a .json file with a path prefix', function(done) {
    var app = connect.createServer();
    app.use(gzippo.staticGzip(fixtures, { prefix: '/foo' }));

    app.listen(port, function() {
      request('/foo/user.json', { 'Accept-Encoding': 'gzip' },
        function(err, res, data) {
          if (err) throw err;
          assert.equal(res.statusCode, 200);

          assert.equal(res.headers['content-type'], 'application/json; charset=UTF-8');
          assert.equal(res.headers['content-length'], '69');
          assert.equal(res.headers['content-encoding'], 'gzip');

          assert.deepEqual(data, file('user.gzip'));

          app.close();
          done();
        }
      );
    });
  });


  it('should serve files as expected with a / prefix', function(done) {
    var app = connect.createServer();
    app.use(gzippo.staticGzip(fixtures, { prefix: '/' }));

    app.listen(port, function() {
      request('/user.json', { 'Accept-Encoding': 'gzip' },
        function(err, res, data) {
          if (err) throw err;
          assert.equal(res.statusCode, 200);

          assert.equal(res.headers['content-type'], 'application/json; charset=UTF-8');
          assert.equal(res.headers['content-length'], '69');
          assert.equal(res.headers['content-encoding'], 'gzip');

          assert.deepEqual(data, file('user.gzip'));

          app.close();
          done();
        }
      );
    });
  });

});
