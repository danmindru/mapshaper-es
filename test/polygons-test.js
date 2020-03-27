var api = require('../'),
    assert = require('assert'),
    helpers = require('./helpers.js');

describe('mapshaper-polygons.js', function () {

  describe('Tests based on real data', function () {
    it('polygons/ex1.shp -- 6 polygons are generated', function (done) {
      // From issue #354 -- before, one polygon was not detected
      var cmd = '-i test/data/features/polygons/ex1.shp -polygons -o ex1.json';
      api.applyCommands(cmd, {}, function(err, out) {
        var json = JSON.parse(out['ex1.json']);
        assert.equal(json.geometries.length, 6);
        done();
      });
    })
  })

  it ('test 1: tic-tac-toe board', function(done) {
    var input = {
      type: 'MultiLineString',
      coordinates: [
        [[1, 0], [1, 3]],
        [[2, 0], [2, 3]],
        [[3, 1], [0, 1]],
        [[0, 2], [3, 2]]
      ]
    };
    var target = {
      type: 'Polygon',
      coordinates: [ [ [ 1, 1 ], [ 1, 2 ], [ 2, 2 ], [ 2, 1 ], [ 1, 1 ] ] ]
    }
    api.applyCommands('in.json -polygons -o out.json', {'in.json': input}, function(err, out) {
      var poly = JSON.parse(out['out.json']).geometries[0];
      assert.deepEqual(poly, target);
      done();
    })

  });

  it ('test 2: tic-tac-toe board with gaps', function(done) {
    var input = {
      type: 'MultiLineString',
      coordinates: [
        [[1, 0], [1, 1.9]],
        [[2, 1.1], [2, 3]],
        [[3, 1], [1.1, 1]],
        [[0, 2], [3, 2]]
      ]
    };
    var target = {
      type: 'Polygon',
      coordinates: [ [ [ 1, 1 ], [ 1, 2 ], [ 2, 2 ], [ 2, 1 ], [ 1, 1 ] ] ]
    }
    api.applyCommands('in.json -polygons gap-tolerance 0.11 -o out.json', {'in.json': input}, function(err, out) {
      var poly = JSON.parse(out['out.json']).geometries[0];
      helpers.coordinatesAlmostEqual(poly.coordinates, target.coordinates, 1e-12);
      done();
    })

  });

  it ('test 3: partially overlapping lines, gap', function(done) {
    var input = {
      type: 'MultiLineString',
      coordinates: [
        [[1, 1], [1, 3], [3, 3]],
        [[1, 2], [1, 1], [2, 1], [2, 3 - 1e-6]]
      ]
    };
    var target = {
      type: 'Polygon',
      coordinates: [[[1, 1], [1, 2], [1, 3], [2, 3], [2, 1], [1, 1]]]
    }
    api.applyCommands('in.json -polygons gap-tolerance=1e-5 -o out.json', {'in.json': input}, function(err, out) {
      var poly = JSON.parse(out['out.json']).geometries[0];
      helpers.coordinatesAlmostEqual(poly.coordinates, target.coordinates, 1e-12);
      done();
    })
  })

});