/* @require gui-hit-test */

function InteractiveSelection(gui, ext, mouse) {
  var self = new EventDispatcher();
  var storedData = noHitData(); // may include additional data from SVG symbol hit (e.g. hit node)
  var selectionIds = [];
  var active = false;
  var interactionMode;
  var targetLayer;
  var hitTest;
  // event priority is higher than navigation, so stopping propagation disables
  // pan navigation
  var priority = 2;

  self.setLayer = function(mapLayer) {
    hitTest = getPointerHitTest(mapLayer, ext);
    if (!hitTest) {
      hitText = function() {return {ids: []};};
    }
    targetLayer = mapLayer;
    // deselect any  selection
    // TODO: maintain selection if layer & shapes have not changed
    updateSelectionState(null);
  };

  function turnOn(mode) {
    interactionMode = mode;
    active = true;
  }

  function turnOff() {
    if (active) {
      updateSelectionState(null); // no hit data, no event
      active = false;
    }
  }

  function selectable() {
    return interactionMode == 'selection';
  }

  function pinnable() {
    return clickable() && interactionMode != 'selection';
  }

  function draggable() {
    return interactionMode == 'location' || interactionMode == 'labels';
  }

  function clickable() {
    // click used to pin popup and select features
    return interactionMode == 'data' || interactionMode == 'info' || interactionMode == 'selection';
  }

  self.getHitId = function() {return storedData.id;};

  // Get a reference to the active layer, so listeners to hit events can interact
  // with data and shapes
  self.getHitTarget = function() {
    return targetLayer;
  };

  self.addSelectionIds = function(ids) {
    turnOn('selection');
    selectionIds = utils.uniq(selectionIds.concat(ids));
    ids = utils.uniq(storedData.ids.concat(ids));
    updateSelectionState({ids: ids});
  };

  self.clearSelection = function() {
    updateSelectionState(null);
  };

  self.clearHover = function() {
    updateSelectionState(mergeHoverData({ids: []}));
  };

  self.getSelectionIds = function() {
    return selectionIds.concat();
  };

  self.getTargetDataTable = function() {
    var targ = self.getHitTarget();
    return targ && targ.layer.data || null;
  };

  self.getSwitchHandler = function(diff) {
    return function() {
      self.switchSelection(diff);
    };
  };

  self.switchSelection = function(diff) {
    var i = storedData.ids.indexOf(storedData.id);
    var n = storedData.ids.length;
    if (i < 0 || n < 2) return;
    if (diff != 1 && diff != -1) {
      diff = 1;
    }
    storedData.id = storedData.ids[(i + diff + n) % n];
    triggerHitEvent('change');
  };

  // make sure popup is unpinned and turned off when switching editing modes
  // (some modes do not support pinning)
  gui.on('interaction_mode_change', function(e) {
    updateSelectionState(null);
    if (e.mode == 'off' || e.mode == 'box') {
      turnOff();
    } else {
      turnOn(e.mode);
    }
  });

  gui.on('box_drag_start', function() {
    self.clearHover();
  });

  mouse.on('dblclick', handlePointerEvent, null, priority);
  mouse.on('dragstart', handlePointerEvent, null, priority);
  mouse.on('drag', handlePointerEvent, null, priority);
  mouse.on('dragend', handlePointerEvent, null, priority);

  mouse.on('click', function(e) {
    if (!hitTest || !active) return;
    e.stopPropagation();

    // TODO: move pinning to inspection control?
    if (clickable()) {
      updateSelectionState(mergeClickData(hitTest(e)));
    }
    triggerHitEvent('click', e.data);
  }, null, priority);

  // Hits are re-detected on 'hover' (if hit detection is active)
  mouse.on('hover', function(e) {
    if (storedData.pinned || !hitTest || !active) return;
    if (!isOverMap(e)) {
      // mouse is off of map viewport -- clear any current hover ids
      updateSelectionState(mergeHoverData({ids:[]}));
    } else if (e.hover) {
      // mouse is hovering directly over map area -- update hit detection
      updateSelectionState(mergeHoverData(hitTest(e)));
    } else {
      // mouse is over map viewport but not directly over map (e.g. hovering
      // over popup) -- don't update hit detection
    }
  }, null, priority);

  function noHitData() {return {ids: [], id: -1, pinned: false};}

  function mergeClickData(hitData) {
    // mergeCurrentState(hitData);
    // TOGGLE pinned state under some conditions
    var id = hitData.ids.length > 0 ? hitData.ids[0] : -1;
    hitData.id = id;
    if (pinnable()) {
      if (!storedData.pinned && id > -1) {
        hitData.pinned = true; // add pin
      } else if (storedData.pinned && storedData.id == id) {
        delete hitData.pinned; // remove pin
        // hitData.id = -1; // keep highlighting (pointer is still hovering)
      } else if (storedData.pinned && id > -1) {
        hitData.pinned = true; // stay pinned, switch id
      }
    }
    if (selectable()) {
      if (id > -1) {
        selectionIds = toggleId(id, selectionIds);
      }
      hitData.ids = selectionIds;
    }
    return hitData;
  }

  function mergeHoverData(hitData) {
    if (storedData.pinned) {
      hitData.id = storedData.id;
      hitData.pinned = true;
    } else {
      hitData.id = hitData.ids.length > 0 ? hitData.ids[0] : -1;
    }
    if (selectable()) {
      hitData.ids = selectionIds;
      // kludge to inhibit hover effect while dragging a box
      if (gui.keydown) hitData.id = -1;
    }
    return hitData;
  }

  function toggleId(id, ids) {
    if (ids.indexOf(id) > -1) {
      return utils.difference(ids, [id]);
    }
    return [id].concat(ids);
  }

  // If hit ids have changed, update stored hit ids and fire 'hover' event
  // evt: (optional) mouse event
  function updateSelectionState(newData) {
    var nonEmpty = newData && (newData.ids.length || newData.id > -1);
    if (!newData) {
      newData = noHitData();
      selectionIds = [];
    }
    if (!testHitChange(storedData, newData)) {
      return;
    }
    storedData = newData;
    gui.container.findChild('.map-layers').classed('symbol-hit', nonEmpty);
    if (active) {
      triggerHitEvent('change');
    }
  }

  // check if an event is used in the current interaction mode
  function eventIsEnabled(type) {
    if (type == 'click' && !clickable()) {
      return false;
    }
    if ((type == 'drag' || type == 'dragstart' || type == 'dragend') && !draggable()) {
      return false;
    }
    return true;
  }

  function isOverMap(e) {
    return e.x >= 0 && e.y >= 0 && e.x < ext.width() && e.y < ext.height();
  }

  function handlePointerEvent(e) {
    if (!hitTest || !active) return;
    if (self.getHitId() == -1) return; // ignore pointer events when no features are being hit
    // don't block pan and other navigation in modes when they are not being used
    if (eventIsEnabled(e.type)) {
      e.stopPropagation(); // block navigation
      triggerHitEvent(e.type, e.data);
    }
  }

  // d: event data (may be a pointer event object, an ordinary object or null)
  function triggerHitEvent(type, d) {
    // Merge stored hit data into the event data
    var eventData = utils.extend({mode: interactionMode}, d || {}, storedData);
    self.dispatchEvent(type, eventData);
  }

  // Test if two hit data objects are equivalent
  function testHitChange(a, b) {
    // check change in 'container', e.g. so moving from anchor hit to label hit
    //   is detected
    if (sameIds(a.ids, b.ids) && a.container == b.container && a.pinned == b.pinned && a.id == b.id) {
      return false;
    }
    return true;
  }

  function sameIds(a, b) {
    if (a.length != b.length) return false;
    for (var i=0; i<a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  return self;
}
