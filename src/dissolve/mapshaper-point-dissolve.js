/* @requires mapshaper-expressions */

internal.dissolvePointGeometry = function(lyr, getGroupId, opts) {
  var dissolve = opts.group_points ?
      dissolvePointsAsGroups : dissolvePointsAsCentroids;
  return dissolve(lyr, getGroupId, opts);
};

function dissolvePointsAsGroups(lyr, getGroupId, opts) {
  var shapes = internal.cloneShapes(lyr.shapes);
  var shapes2 = [];
  lyr.shapes.forEach(function(shp, i) {
    var groupId = getGroupId(i);
    if (!shp) return;
    if (!shapes2[groupId]) {
      shapes2[groupId] = shp;
    } else {
      shapes2[groupId].push.apply(shapes2[groupId], shp);
    }
  });
  return shapes2;
}

function dissolvePointsAsCentroids(lyr, getGroupId, opts) {
  var useSph = !opts.planar && internal.probablyDecimalDegreeBounds(internal.getLayerBounds(lyr));
  var getWeight = opts.weight ? internal.compileValueExpression(opts.weight, lyr) : null;
  var groups = [];

  // TODO: support multipoints
  if (internal.countMultiPartFeatures(lyr.shapes) !== 0) {
    stop("Dissolving multi-part points is not supported");
  }

  lyr.shapes.forEach(function(shp, i) {
    var groupId = getGroupId(i);
    var weight = getWeight ? getWeight(i) : 1;
    var p = shp && shp[0]; // Using first point (TODO: handle multi-point features)
    var tmp;
    if (!p) return;
    if (useSph) {
      tmp = [];
      lngLatToXYZ(p[0], p[1], tmp);
      p = tmp;
    }
    groups[groupId] = reducePointCentroid(groups[groupId], p, weight);
  });

  return groups.map(function(memo) {
    var p1, p2;
    if (!memo) return null;
    if (useSph) {
      p1 = memo.centroid;
      p2 = [];
      xyzToLngLat(p1[0], p1[1], p1[2], p2);
    } else {
      p2 = memo.centroid;
    }
    return memo ? [p2] : null;
  });
}

function reducePointCentroid(memo, p, weight) {
  var x = p[0],
      y = p[1],
      sum, k;

  if (x == x && y == y && weight > 0) {
    if (!memo) {
      memo = {sum: weight, centroid: p.concat()};
    } else {
      sum = memo.sum + weight;
      k = memo.sum / sum;
      memo.centroid[0] = k * memo.centroid[0] + weight * x / sum;
      memo.centroid[1] = k * memo.centroid[1] + weight * y / sum;
      if (p.length == 3) {
        memo.centroid[2] = k * memo.centroid[2] + weight * p[2] / sum;
      }
      memo.sum = sum;
    }
  }
  return memo;
}
