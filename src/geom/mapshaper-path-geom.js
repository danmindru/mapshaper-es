/* @requires mapshaper-geom */

geom.getPointToPathDistance = function(px, py, ids, arcs) {
  return geom.getPointToPathInfo(px, py, ids, arcs).distance;
};

geom.getPointToPathInfo = function(px, py, ids, arcs) {
  var iter = arcs.getShapeIter(ids);
  var pPathSq = Infinity;
  var ax, ay, bx, by, axmin, aymin, bxmin, bymin, pabSq;
  if (iter.hasNext()) {
    ax = axmin = bxmin = iter.x;
    ay = aymin = bymin = iter.y;
  }
  while (iter.hasNext()) {
    bx = iter.x;
    by = iter.y;
    pabSq = pointSegDistSq2(px, py, ax, ay, bx, by);
    if (pabSq < pPathSq) {
      pPathSq = pabSq;
      axmin = ax;
      aymin = ay;
      bxmin = bx;
      bymin = by;
    }
    ax = bx;
    ay = by;
  }
  if (pPathSq == Infinity) return {distance: Infinity};
  return {
    segment: [[axmin, aymin], [bxmin, bymin]],
    distance: Math.sqrt(pPathSq)
  };
};


// Return unsigned distance of a point to the nearest point on a polygon or polyline path
//
geom.getPointToShapeDistance = function(x, y, shp, arcs) {
  var minDist = (shp || []).reduce(function(minDist, ids) {
    var pathDist = geom.getPointToPathDistance(x, y, ids, arcs);
    return Math.min(minDist, pathDist);
  }, Infinity);
  return minDist;
};

// @ids array of arc ids
// @arcs ArcCollection
geom.getAvgPathXY = function(ids, arcs) {
  var iter = arcs.getShapeIter(ids);
  if (!iter.hasNext()) return null;
  var x0 = iter.x,
      y0 = iter.y,
      count = 0,
      sumX = 0,
      sumY = 0;
  while (iter.hasNext()) {
    count++;
    sumX += iter.x;
    sumY += iter.y;
  }
  if (count === 0 || iter.x !== x0 || iter.y !== y0) {
    sumX += x0;
    sumY += y0;
    count++;
  }
  return {
    x: sumX / count,
    y: sumY / count
  };
};

// Return path with the largest (area) bounding box
// @shp array of array of arc ids
// @arcs ArcCollection
geom.getMaxPath = function(shp, arcs) {
  var maxArea = 0;
  return (shp || []).reduce(function(maxPath, path) {
    var bbArea = arcs.getSimpleShapeBounds(path).area();
    if (bbArea > maxArea) {
      maxArea = bbArea;
      maxPath = path;
    }
    return maxPath;
  }, null);
};

geom.countVerticesInPath = function(ids, arcs) {
  var iter = arcs.getShapeIter(ids),
      count = 0;
  while (iter.hasNext()) count++;
  return count;
};

geom.getPathBounds = function(points) {
  var bounds = new Bounds();
  for (var i=0, n=points.length; i<n; i++) {
    bounds.mergePoint(points[i][0], points[i][1]);
  }
  return bounds;
};

geom.calcPathLen = (function() {
  var len, calcLen;
  function addSegLen(i, j, xx, yy) {
    len += calcLen(xx[i], yy[i], xx[j], yy[j]);
  }
  // @spherical (optional bool) calculate great circle length in meters
  return function(path, arcs, spherical) {
    if (spherical && arcs.isPlanar()) {
      error("Expected lat-long coordinates");
    }
    calcLen = spherical ? greatCircleDistance : distance2D;
    len = 0;
    for (var i=0, n=path.length; i<n; i++) {
      arcs.forEachArcSegment(path[i], addSegLen);
    }
    return len;
  };
}());
