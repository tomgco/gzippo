var assert = require('assert')
  , fs = require('fs')
  , connect = require('connect')
  , join = require('path').join
  , gzippo = require('../')
  ;
  var fixtures = join(__dirname, 'fixtures')
  , port = 32123
  , app
  , request = require('./request')({ port: port })
  ;

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

  app = connect.createServer();
  app.use(gzippo.staticGzip(fixtures));
  app.listen(port);

  // set up a new server for each test
  // beforeEach(function(done) {
  // });

  // afterEach(function() {
  //   app.exit();
  // });


  it('should gzip static .json file', function(done) {
    request('/user.json', { 'Accept-Encoding': 'gzip' },
      function(err, res, data) {
        if (err) throw err;
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['content-type'], 'application/json; charset=UTF-8');
        assert.equal(data.length, '69');
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
        assert.equal(data.length, '35');
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
      assert.equal(data.length, '15');
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
        assert.equal(data.length, '2031');
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
        assert.equal(res.headers['content-length'], '616');

        done();
      }
    );
  });

});