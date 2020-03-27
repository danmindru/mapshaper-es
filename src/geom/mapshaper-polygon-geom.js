/* @requires mapshaper-geom, mapshaper-path-geom  */


// A compactness measure designed for testing electoral districts for gerrymandering.
// Returns value in [0-1] range. 1 = perfect circle, 0 = collapsed polygon
geom.calcPolsbyPopperCompactness = function(area, perimeter) {
  if (perimeter <= 0) return 0;
  return Math.abs(area) * Math.PI * 4 / (perimeter * perimeter);
};

// Larger values (less severe penalty) fthan Polsby Popper
geom.calcSchwartzbergCompactness = function(area, perimeter) {
  if (perimeter <= 0) return 0;
  return 2 * Math.PI * Math.sqrt(Math.abs(area) / Math.PI) / perimeter;
};

// Returns: 1 if CW, -1 if CCW, 0 if collapsed
geom.getPathWinding = function(ids, arcs) {
  var area = geom.getPathArea(ids, arcs);
  return area > 0 && 1 || area < 0 && -1 || 0;
};

geom.getShapeArea = function(shp, arcs) {
  // return (arcs.isPlanar() ? geom.getPlanarShapeArea : geom.getSphericalShapeArea)(shp, arcs);
  return (shp || []).reduce(function(area, ids) {
    return area + geom.getPathArea(ids, arcs);
  }, 0);
};

geom.getPlanarShapeArea = function(shp, arcs) {
  return (shp || []).reduce(function(area, ids) {
    return area + geom.getPlanarPathArea(ids, arcs);
  }, 0);
};

geom.getSphericalShapeArea = function(shp, arcs) {
  if (arcs.isPlanar()) {
    error("[getSphericalShapeArea()] Function requires decimal degree coordinates");
  }
  return (shp || []).reduce(function(area, ids) {
    return area + geom.getSphericalPathArea(ids, arcs);
  }, 0);
};

// Return true if point is inside or on boundary of a shape
//
geom.testPointInPolygon = function(x, y, shp, arcs) {
  var isIn = false,
      isOn = false;
  if (shp) {
    shp.forEach(function(ids) {
      var inRing = geom.testPointInRing(x, y, ids, arcs);
      if (inRing == 1) {
        isIn = !isIn;
      } else if (inRing == -1) {
        isOn = true;
      }
    });
  }
  return isOn || isIn;
};

geom.getYIntercept = function(x, ax, ay, bx, by) {
  return ay + (x - ax) * (by - ay) / (bx - ax);
};

geom.getXIntercept = function(y, ax, ay, bx, by) {
  return ax + (y - ay) * (bx - ax) / (by - ay);
};


// Test if point (x, y) is inside, outside or on the boundary of a polygon ring
// Return 0: outside; 1: inside; -1: on boundary
//
geom.testPointInRing = function(x, y, ids, arcs) {
  /*
  // arcs.getSimpleShapeBounds() doesn't apply simplification, can't use here
  //// wait, why not? simplifcation shoudn't expand bounds, so this test makes sense
  if (!arcs.getSimpleShapeBounds(ids).containsPoint(x, y)) {
    return false;
  }
  */
  var isIn = false,
      isOn = false;
  internal.forEachSegmentInPath(ids, arcs, function(a, b, xx, yy) {
    var result = geom.testRayIntersection(x, y, xx[a], yy[a], xx[b], yy[b]);
    if (result == 1) {
      isIn = !isIn;
    } else if (isNaN(result)) {
      isOn = true;
    }
  });
  return isOn ? -1 : (isIn ? 1 : 0);
};

// test if a vertical ray originating at (x, y) intersects a segment
// returns 1 if intersection, 0 if no intersection, NaN if point touches segment
// (Special rules apply to endpoint intersections, to support point-in-polygon testing.)
geom.testRayIntersection = function(x, y, ax, ay, bx, by) {
  var val = geom.getRayIntersection(x, y, ax, ay, bx, by);
  if (val != val) {
    return NaN;
  }
  return val == -Infinity ? 0 : 1;
};

geom.getRayIntersection = function(x, y, ax, ay, bx, by) {
  var hit = -Infinity, // default: no hit
      yInt;

  // case: p is entirely above, left or right of segment
  if (x < ax && x < bx || x > ax && x > bx || y > ay && y > by) {
      // no intersection
  }
  // case: px aligned with a segment vertex
  else if (x === ax || x === bx) {
    // case: vertical segment or collapsed segment
    if (x === ax && x === bx) {
      // p is on segment
      if (y == ay || y == by || y > ay != y > by) {
        hit = NaN;
      }
      // else: no hit
    }
    // case: px equal to ax (only)
    else if (x === ax) {
      if (y === ay) {
        hit = NaN;
      } else if (bx < ax && y < ay) {
        // only score hit if px aligned to rightmost endpoint
        hit = ay;
      }
    }
    // case: px equal to bx (only)
    else {
      if (y === by) {
        hit = NaN;
      } else if (ax < bx && y < by) {
        // only score hit if px aligned to rightmost endpoint
        hit = by;
      }
    }
  // case: px is between endpoints
  } else {
    yInt = geom.getYIntercept(x, ax, ay, bx, by);
    if (yInt > y) {
      hit = yInt;
    } else if (yInt == y) {
      hit = NaN;
    }
  }
  return hit;
};

geom.getPathArea = function(ids, arcs) {
  return (arcs.isPlanar() ? geom.getPlanarPathArea : geom.getSphericalPathArea)(ids, arcs);
};

geom.getSphericalPathArea = function(ids, arcs) {
  var iter = arcs.getShapeIter(ids),
      sum = 0,
      started = false,
      deg2rad = Math.PI / 180,
      x, y, xp, yp;
  while (iter.hasNext()) {
    x = iter.x * deg2rad;
    y = Math.sin(iter.y * deg2rad);
    if (started) {
      sum += (x - xp) * (2 + y + yp);
    } else {
      started = true;
    }
    xp = x;
    yp = y;
  }
  return sum / 2 * 6378137 * 6378137;
};

// Get path area from an array of [x, y] points
// TODO: consider removing duplication with getPathArea(), e.g. by
//   wrapping points in an iterator.
//
geom.getPlanarPathArea2 = function(points) {
  var sum = 0,
      ax, ay, bx, by, dx, dy, p;
  for (var i=0, n=points.length; i<n; i++) {
    p = points[i];
    if (i === 0) {
      ax = 0;
      ay = 0;
      dx = -p[0];
      dy = -p[1];
    } else {
      ax = p[0] + dx;
      ay = p[1] + dy;
      sum += ax * by - bx * ay;
    }
    bx = ax;
    by = ay;
  }
  return sum / 2;
};

geom.getPlanarPathArea = function(ids, arcs) {
  var iter = arcs.getShapeIter(ids),
      sum = 0,
      ax, ay, bx, by, dx, dy;
  if (iter.hasNext()) {
    ax = 0;
    ay = 0;
    dx = -iter.x;
    dy = -iter.y;
    while (iter.hasNext()) {
      bx = ax;
      by = ay;
      ax = iter.x + dx;
      ay = iter.y + dy;
      sum += ax * by - bx * ay;
    }
  }
  return sum / 2;
};

geom.getPathPerimeter = function(ids, arcs) {
  return (arcs.isPlanar() ? geom.getPlanarPathPerimeter : geom.getSphericalPathPerimeter)(ids, arcs);
};

geom.getShapePerimeter = function(shp, arcs) {
  return (shp || []).reduce(function(len, ids) {
    return len + geom.getPathPerimeter(ids, arcs);
  }, 0);
};

geom.getSphericalShapePerimeter = function(shp, arcs) {
  if (arcs.isPlanar()) {
    error("[getSphericalShapePerimeter()] Function requires decimal degree coordinates");
  }
  return (shp || []).reduce(function(len, ids) {
    return len + geom.getSphericalPathPerimeter(ids, arcs);
  }, 0);
};

geom.getPlanarPathPerimeter = function(ids, arcs) {
  return geom.calcPathLen(ids, arcs, false);
};

geom.getSphericalPathPerimeter = function(ids, arcs) {
  return geom.calcPathLen(ids, arcs, true);
};
