/* @requires mapshaper-dataset-utils, geojson-import */

api.pointGrid = function(dataset, opts) {
  var gridOpts = internal.getPointGridParams(dataset, opts);
  return internal.createPointGridLayer(internal.createPointGrid(gridOpts), opts);
};

internal.getPointGridParams = function(dataset, opts) {
  var params = {};
  var crs = dataset ? internal.getDatasetCRS(dataset) : null;
  if (opts.interval) {
    params.interval = internal.convertIntervalParam(opts.interval, crs);
  } else if (opts.rows > 0 && opts.cols > 0) {
    params.rows = opts.rows;
    params.cols = opts.cols;
  } else {
    // error, handled later
  }
  if (opts.bbox) {
    params.bbox = opts.bbox;
  } else if (dataset) {
    params.bbox = internal.getDatasetBounds(dataset).toArray();
  } else {
    params.bbox = [-180, -90, 180, 90];
  }
  return params;
};

internal.createPointGridLayer = function(rows, opts) {
  var points = [], lyr;
  rows.forEach(function(row, rowId) {
    for (var i=0; i<row.length; i++) {
      points.push([row[i]]);
    }
  });
  lyr = {
    geometry_type: 'point',
    shapes: points
  };
  if (opts.name) lyr.name = opts.name;
  return lyr;
};


// Returns a grid of [x,y] points so that point(c,r) == arr[r][c]
internal.createPointGrid = function(opts) {
  var bbox = opts.bbox,
      w = bbox[2] - bbox[0],
      h = bbox[3] - bbox[1],
      rowsArr = [], rowArr,
      cols, rows, dx, dy, x0, y0, x, y;

  if (opts.interval > 0) {
    dx = opts.interval;
    dy = opts.interval;
    cols = Math.round(w / dx) - 1;
    rows = Math.round(h / dy) - 1;
    x0 = bbox[0] + (w - cols * dx) / 2;
    y0 = bbox[1] + (h - rows * dy) / 2;
  } else if (opts.rows > 0 && opts.cols > 0) {
    cols = opts.cols;
    rows = opts.rows;
    dx = (w / cols);
    dy = (h / rows);
    x0 = bbox[0] + dx / 2;
    y0 = bbox[1] + dy / 2;
  }

  if (dx > 0 === false || dy > 0 === false) {
    stop('Invalid grid parameters');
  }

  y = y0;
  while (y <= bbox[3]) {
    x = x0;
    rowsArr.push(rowArr = []);
    while (x <= bbox[2]) {
      rowArr.push([x, y]);
      x += dx;
    }
    y += dy;
  }
  return rowsArr;
};
