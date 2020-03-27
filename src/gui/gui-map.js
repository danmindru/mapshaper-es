/* @requires
gui-lib
gui-maplayer2
gui-map-nav
gui-map-extent
gui-map-style
gui-svg-display
gui-layer-stack
gui-layer-sorting
gui-proxy
gui-coordinates-display
gui-inspection-control2
gui-symbol-dragging2
gui-box-tool
gui-selection-tool
gui-interactive-selection
*/

utils.inherit(MshpMap, EventDispatcher);

function MshpMap(gui) {
  var opts = gui.options,
      el = gui.container.findChild('.map-layers').node(),
      position = new ElementPosition(el),
      model = gui.model,
      map = this,
      _mouse = new MouseArea(el, position),
      _ext = new MapExtent(position),
      _hit = new InteractiveSelection(gui, _ext, _mouse),
      _nav = new MapNav(gui, _ext, _mouse),
      _boxTool = new BoxTool(gui, _ext, _mouse, _nav),
      _selectionTool = new SelectionTool(gui, _ext, _hit),
      _visibleLayers = [], // cached visible map layers
      _fullBounds = null,
      _intersectionLyr, _activeLyr, _overlayLyr,
      _inspector, _stack, _editor,
      _dynamicCRS;

  if (gui.options.showMouseCoordinates) {
    new CoordinatesDisplay(gui, _ext, _mouse);
  }
  _mouse.disable(); // wait for gui.focus() to activate mouse events

  model.on('select', function(e) {
    _intersectionLyr = null;
    _overlayLyr = null;
  });

  gui.on('active', function() {
    _mouse.enable();
  });

  gui.on('inactive', function() {
    _mouse.disable();
  });

  model.on('update', onUpdate);

  // Currently used to show dots at line intersections
  this.setIntersectionLayer = function(lyr, dataset) {
    if (lyr) {
      _intersectionLyr = getMapLayer(lyr, dataset, getDisplayOptions());
      _intersectionLyr.style = MapStyle.getIntersectionStyle(_intersectionLyr.layer);
    } else {
      _intersectionLyr = null;
    }
    _stack.drawOverlay2Layer(_intersectionLyr); // also hides
  };

  this.setLayerVisibility = function(target, isVisible) {
    var lyr = target.layer;
    lyr.visibility = isVisible ? 'visible' : 'hidden';
    // if (_inspector && isActiveLayer(lyr)) {
    //   _inspector.updateLayer(isVisible ? _activeLyr : null);
    // }
    if (isActiveLayer(lyr)) {
      _hit.setLayer(isVisible ? _activeLyr : null);
    }
  };

  this.getCenterLngLat = function() {
    var bounds = _ext.getBounds();
    var crs = this.getDisplayCRS();
    // TODO: handle case where active layer is a frame layer
    if (!bounds.hasBounds() || !crs) {
      return null;
    }
    return internal.toLngLat([bounds.centerX(), bounds.centerY()], crs);
  };

  this.getDisplayCRS = function() {
    var crs;
    if (_activeLyr && _activeLyr.geographic) {
      crs = _activeLyr.dynamic_crs || internal.getDatasetCRS(_activeLyr.source.dataset);
    }
    return crs || null;
  };

  this.getExtent = function() {return _ext;};
  this.isActiveLayer = isActiveLayer;
  this.isVisibleLayer = isVisibleLayer;

  // called by layer menu after layer visibility is updated
  this.redraw = function() {
    updateVisibleMapLayers();
    drawLayers();
  };

  // Set or clear a CRS to use for display, without reprojecting the underlying dataset(s).
  // crs: a CRS object or string, or null to clear the current setting
  this.setDisplayCRS = function(crs) {
    // TODO: update bounds of frame layer, if there is a frame layer
    var oldCRS = this.getDisplayCRS();
    var newCRS = utils.isString(crs) ? internal.getCRS(crs) : crs;
    // TODO: handle case that old and new CRS are the same
    _dynamicCRS = newCRS;
    if (!_activeLyr) return; // stop here if no layers have been selected

    // clear any stored FilteredArcs objects (so they will be recreated with the desired projection)
    clearAllDisplayArcs();

    // Reproject all visible map layers
    if (_activeLyr) _activeLyr = projectDisplayLayer(_activeLyr, newCRS);
    if (_intersectionLyr) _intersectionLyr = projectDisplayLayer(_intersectionLyr, newCRS);
    if (_overlayLyr) {
      _overlayLyr = projectDisplayLayer(_overlayLyr, newCRS);
    }
    updateVisibleMapLayers(); // any other display layers will be projected as they are regenerated
    updateLayerStyles(getDrawableContentLayers()); // kludge to make sure all layers have styles

    // Update map extent (also triggers redraw)
    projectMapExtent(_ext, oldCRS, this.getDisplayCRS(), getFullBounds());
  };

  // Refresh map display in response to data changes, layer selection, etc.
  function onUpdate(e) {
    var prevLyr = _activeLyr || null;
    var fullBounds;
    var needReset;

    if (!prevLyr) {
      initMap(); // first call
    }

    if (arcsMayHaveChanged(e.flags)) {
      // regenerate filtered arcs the next time they are needed for rendering
      // delete e.dataset.displayArcs;
      clearAllDisplayArcs();

      // reset simplification after projection (thresholds have changed)
      // TODO: preserve simplification pct (need to record pct before change)
      if (e.flags.proj && e.dataset.arcs) {
        e.dataset.arcs.setRetainedPct(1);
      }
    }

    if (e.flags.simplify_method) { // no redraw needed
      return false;
    }

    if (e.flags.simplify_amount || e.flags.redraw_only) { // only redraw (slider drag)
      drawLayers();
      return;
    }

    _activeLyr = getMapLayer(e.layer, e.dataset, getDisplayOptions());
    _activeLyr.style = MapStyle.getActiveStyle(_activeLyr.layer);
    _activeLyr.active = true;
    // if (_inspector) _inspector.updateLayer(_activeLyr);
    _hit.setLayer(_activeLyr);
    updateVisibleMapLayers();
    fullBounds = getFullBounds();

    if (!prevLyr || !_fullBounds || prevLyr.tabular || _activeLyr.tabular || isFrameView()) {
      needReset = true;
    } else {
      needReset = GUI.mapNeedsReset(fullBounds, _fullBounds, _ext.getBounds());
    }

    if (isFrameView()) {
      _nav.setZoomFactor(0.05); // slow zooming way down to allow fine-tuning frame placement // 0.03
      _ext.setFrame(getFullBounds()); // TODO: remove redundancy with drawLayers()
      needReset = true; // snap to frame extent
    } else {
      _nav.setZoomFactor(1);
    }
    _ext.setBounds(fullBounds); // update 'home' button extent
    _fullBounds = fullBounds;
    if (needReset) {
      _ext.reset();
    }
    drawLayers();
    map.dispatchEvent('updated');
  }

  // Initialization just before displaying the map for the first time
  function initMap() {
    _ext.resize();
    _stack = new LayerStack(gui, el, _ext, _mouse);
    gui.buttons.show();

    if (opts.inspectorControl) {
      _inspector = new InspectionControl2(gui, _hit);
      _inspector.on('data_change', function(e) {
        // refresh the display if a style variable has been changed interactively
        if (internal.svg.isSupportedSvgStyleProperty(e.field)) {
          drawLayers();
        }
      });
    }

    if (true) { // TODO: add option to disable?
      _editor = new SymbolDragging2(gui, _ext, _hit);
      _editor.on('location_change', function(e) {
        // TODO: optimize redrawing
        drawLayers();
      });
    }

    _ext.on('change', function(e) {
      if (e.reset) return; // don't need to redraw map here if extent has been reset
      if (isFrameView()) {
        updateFrameExtent();
      }
      drawLayers(true);
    });

    _hit.on('change', function(e) {
      // draw highlight effect for hover and select
      _overlayLyr = getMapLayerOverlay(_activeLyr, e);
      _stack.drawOverlayLayer(_overlayLyr);
    });

    gui.on('resize', function() {
      position.update(); // kludge to detect new map size after console toggle
    });
  }

  function getDisplayOptions() {
    return {
      crs: _dynamicCRS
    };
  }

  // Test if an update may have affected the visible shape of arcs
  // @flags Flags from update event
  function arcsMayHaveChanged(flags) {
    return flags.simplify_method || flags.simplify || flags.proj ||
      flags.arc_count || flags.repair || flags.clip || flags.erase ||
      flags.slice || flags.affine || flags.rectangle || flags.buffer ||
      flags.union || flags.mosaic || flags.snap || flags.clean || false;
  }

  // Update map frame after user navigates the map in frame edit mode
  function updateFrameExtent() {
    var frameLyr = internal.findFrameLayer(model);
    var rec = frameLyr.data.getRecordAt(0);
    var viewBounds = _ext.getBounds();
    var w = viewBounds.width() * rec.width / _ext.width();
    var h = w * rec.height / rec.width;
    var cx = viewBounds.centerX();
    var cy = viewBounds.centerY();
    rec.bbox = [cx - w/2, cy - h/2, cx + w/2, cy + h/2];
    _ext.setFrame(getFrameData());
    _ext.setBounds(new Bounds(rec.bbox));
    _ext.reset();
  }

  function getFullBounds() {
    var b = new Bounds();
    var marginPct = 0.025;
    var pad = 1e-4;
    if (isPreviewView()) {
      return internal.getFrameLayerBounds(internal.findFrameLayer(model));
    }
    getDrawableContentLayers().forEach(function(lyr) {
      b.mergeBounds(lyr.bounds);
      if (isTableView()) {
        marginPct = getTableMargin(lyr.layer);
      }
    });
    if (!b.hasBounds()) {
      // assign bounds to empty layers, to prevent rendering errors downstream
      b.setBounds(0,0,0,0);
    }
    // Inflate display bounding box by a tiny amount (gives extent to single-point layers and collapsed shapes)
    b.padBounds(pad,pad,pad,pad);
    // add margin
    b.scale(1 + marginPct * 2);
    return b;
  }

  // Calculate margin when displaying content at full zoom, as pct of screen size
  function getTableMargin(lyr) {
    var n = internal.getFeatureCount(lyr);
    var pct = 0.04;
    if (n < 5) {
      pct = 0.2;
    } else if (n < 100) {
      pct = 0.1;
    }
    return pct;
  }

  function isActiveLayer(lyr) {
    return _activeLyr && lyr == _activeLyr.source.layer || false;
  }

  function isVisibleLayer(lyr) {
    if (isActiveLayer(lyr)) {
      return lyr.visibility != 'hidden';
    }
    return lyr.visibility == 'visible';
  }

  function isVisibleDataLayer(lyr) {
    return isVisibleLayer(lyr) && !internal.isFurnitureLayer(lyr);
  }

  function isFrameLayer(lyr) {
    return !!(lyr && lyr == internal.findFrameLayer(model));
  }

  function isTableView() {
    return !isPreviewView() && !!_activeLyr.tabular;
  }

  function isPreviewView() {
    var frameLyr = internal.findFrameLayer(model);
    return !!frameLyr; //  && isVisibleLayer(frameLyr)
  }

  // Frame view means frame layer is visible and active (selected)
  function isFrameView() {
    var frameLyr = internal.findFrameLayer(model);
    return isActiveLayer(frameLyr) && isVisibleLayer(frameLyr);
  }

  function getFrameData() {
    var frameLyr = internal.findFrameLayer(model);
    return frameLyr && internal.getFurnitureLayerData(frameLyr) || null;
  }

  function clearAllDisplayArcs() {
    model.getDatasets().forEach(function(o) {
      delete o.displayArcs;
    });
  }

  function updateVisibleMapLayers() {
    var layers = [];
    model.getLayers().forEach(function(o) {
      if (!isVisibleLayer(o.layer)) return;
      if (isActiveLayer(o.layer)) {
        layers.push(_activeLyr);
      } else if (!isTableView()) {
        layers.push(getMapLayer(o.layer, o.dataset, getDisplayOptions()));
      }
    });
    _visibleLayers = layers;
  }

  function getVisibleMapLayers() {
    return _visibleLayers;
  }

  function findActiveLayer(layers) {
    return layers.filter(function(o) {
      return o == _activeLyr;
    });
  }

  function getDrawableContentLayers() {
    var layers = getVisibleMapLayers();
    if (isTableView()) return findActiveLayer(layers);
    return layers.filter(function(o) {
      return !!o.geographic;
    });
  }

  function getDrawableFurnitureLayers(layers) {
    if (!isPreviewView()) return [];
    return getVisibleMapLayers().filter(function(o) {
      return internal.isFurnitureLayer(o);
    });
  }

  function updateLayerStyles(layers) {
    layers.forEach(function(mapLayer, i) {
      if (mapLayer.active) {
        // assume: style is already assigned
        if (mapLayer.style.type != 'styled' && layers.length > 1 && mapLayer.style.strokeColors) {
        // if (false) { // always show ghosted arcs
          // kludge to hide ghosted layers when reference layers are present
          // TODO: consider never showing ghosted layers (which appear after
          // commands like dissolve and filter).
          mapLayer.style = utils.defaults({
            strokeColors: [null, mapLayer.style.strokeColors[1]]
          }, mapLayer.style);
        }
      } else {
        if (mapLayer.layer == _activeLyr.layer) {
          console.error("Error: shared map layer");
        }
        mapLayer.style = MapStyle.getReferenceStyle(mapLayer.layer);
      }
    });
  }

  function sortMapLayers(layers) {
    layers.sort(function(a, b) {
      // assume that each layer has a stack_id (assigned by updateLayerStackOrder())
      return a.source.layer.stack_id - b.source.layer.stack_id;
    });
  }

  // onlyNav (bool): only map extent has changed, symbols are unchanged
  function drawLayers(onlyNav) {
    var contentLayers = getDrawableContentLayers();
    var furnitureLayers = getDrawableFurnitureLayers();
    if (!(_ext.width() > 0 && _ext.height() > 0)) {
      // TODO: track down source of these errors
      console.error("[drawLayers()] Collapsed map container, unable to draw.");
      return;
    }
    if (!onlyNav) {
      // kludge to handle layer visibility toggling
      _ext.setFrame(isPreviewView() ? getFrameData() : null);
      _ext.setBounds(getFullBounds());
      updateLayerStyles(contentLayers);
      // update stack_id property of all layers
      internal.updateLayerStackOrder(model.getLayers());
    }
    sortMapLayers(contentLayers);
    _stack.drawContentLayers(contentLayers, onlyNav);
    // draw intersection dots
    _stack.drawOverlay2Layer(_intersectionLyr);
    // draw hover & selection effects
    _stack.drawOverlayLayer(_overlayLyr);
    // _stack.drawFurnitureLayers(furnitureLayers, onlyNav);
    _stack.drawFurnitureLayers(furnitureLayers); // re-render on nav, because scalebars
  }
}

function getMapLayerOverlay(obj, e) {
  var style = MapStyle.getOverlayStyle(obj.layer, e);
  if (!style) return null;
  return utils.defaults({
    layer: filterLayerByIds(obj.layer, style.ids),
    style: style
  }, obj);
}

function filterLayerByIds(lyr, ids) {
  var shapes;
  if (lyr.shapes) {
    shapes = ids.map(function(id) {
      return lyr.shapes[id];
    });
    return utils.defaults({shapes: shapes}, lyr);
  }
  return lyr;
}

// Test if map should be re-framed to show updated layer
GUI.mapNeedsReset = function(newBounds, prevBounds, mapBounds) {
  var viewportPct = GUI.getIntersectionPct(newBounds, mapBounds);
  var contentPct = GUI.getIntersectionPct(mapBounds, newBounds);
  var boundsChanged = !prevBounds.equals(newBounds);
  var inView = newBounds.intersects(mapBounds);
  var areaChg = newBounds.area() / prevBounds.area();
  if (!boundsChanged) return false; // don't reset if layer extent hasn't changed
  if (!inView) return true; // reset if layer is out-of-view
  if (viewportPct < 0.3 && contentPct < 0.9) return true; // reset if content is mostly offscreen
  if (areaChg > 1e8 || areaChg < 1e-8) return true; // large area chg, e.g. after projection
  return false;
};

// TODO: move to utilities file
GUI.getBoundsIntersection = function(a, b) {
  var c = new Bounds();
  if (a.intersects(b)) {
    c.setBounds(Math.max(a.xmin, b.xmin), Math.max(a.ymin, b.ymin),
    Math.min(a.xmax, b.xmax), Math.min(a.ymax, b.ymax));
  }
  return c;
};

// Returns proportion of bb2 occupied by bb1
GUI.getIntersectionPct = function(bb1, bb2) {
  return GUI.getBoundsIntersection(bb1, bb2).area() / bb2.area() || 0;
};
