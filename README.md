<h1 align="center">This repository is now deprecated</h1>
<p align="center">Since creating this fork, the original repository @ <a href="https://github.com/mbloch/mapshaper">mbloch/mapshaper</a> has changed direction, implementing es modules as of <a href="https://github.com/mbloch/mapshaper/compare/v0.4.163...v0.5.0">v0.5.0</a>. <br/> This repository was created when the maintainers of the original project were not considering a switch to es modules, and therefore is <strong>now obsolete</strong>. <br/>  </p>

> ⛔✋ please use the [original mapshaper](https://github.com/mbloch/mapshaper) <br/>
> `npm install mapshaper`
> 

----------------

[![npm](https://img.shields.io/npm/v/mapshaper-es.svg)](https://www.npmjs.com/package/mapshaper-es)
[![license](https://img.shields.io/github/license/danmindru/mapshaper-es.svg)](/LICENSE)

> **mapshaper-es** is a fork of `mapshaper` that is easier to use in a browser.
> Or, that's the plan anyway. Due to the size of the refactoring, this transition will be done in a few steps.
> - [x] bundle as standalone umd (iife). This should work ok with i.e. webpack.
> - [ ] refactor modules to es imports
> - [ ] refactor build and figure out a way to package this
> - [ ] integrate with `mapshaper-es-cli` for drag-and-drop use in i.e. React


## 👩‍💻 Usage

🐚 Install package
```shell
npm i mapshaper-es
```

👩‍💻 In code
```javascript
import * as mapshaper from "mapshaper-es/www/mapshaper.js";
import { oneLine } from "common-tags";

const FILENAMES = {
  TARGET: "target.geojson",
  SOURCE: "source.geojson",
  OUTPUT: "output.geojson"
};

const geojson = { type: "FeatureCollection", features: [] } // etc

const exportCommand = oneLine`
  -i ${FILENAMES.TARGET}
  -o ${FILENAMES.OUTPUT}
  format=shapefile
  encoding=utf-8
`;

mapshaper.applyCommands(
  exportCommand,
  {
    [FILENAMES.TARGET]: geojson
  },
  (err, output) => {
    if (err) {
      mapshaper.internal.logArgs([`${err.toString()} \n`]);
    }

    // TODO: Do something with output.
    // Output is an Object that can be one ore more keys, containing encoded data.
    // Decode using new TextDecoder("utf-8").decode(output[key])
    return output;
  }
```

## Available commands

### I/O commands

```
  -i               input one or more files
  -o               output edited content
```

### Editing commands

```
  -affine          transform coordinates by shifting, scaling and rotating
  -clean           fixes geometry issues, such as polygon overlaps and gaps
  -clip            use a polygon layer to clip another layer
  -colorizer       define a function to convert data values to color classes
  -dissolve        merge features within a layer
  -dissolve2       merge adjacent polygons (repairs overlaps and gaps)
  -divide          divide lines by polygons, copy data from polygons to lines
  -drop            delete layer(s) or elements within the target layer(s)
  -each            create/update/delete data fields using a JS expression
  -erase           use a polygon layer to erase another layer
  -explode         divide multi-part features into single-part features
  -filter          delete features using a JS expression
  -filter-fields   retain a subset of data fields
  -filter-islands  remove small detached polygon rings (islands)
  -filter-slivers  remove small polygon rings
  -graticule       create a graticule layer
  -grid            create a grid of square or hexagonal polygons
  -innerlines      convert polygons to polylines along shared edges
  -join            join data records from a file or layer to a layer
  -lines           convert a polygon or point layer to a polyline layer
  -merge-layers    merge multiple layers into as few layers as possible
  -mosaic          convert a polygon layer with overlaps into a flat mosaic
  -point-grid      create a rectangular grid of points
  -points          create a point layer from a different layer type
  -polygons        convert polylines to polygons
  -proj            project your data (using Proj.4)
  -rectangle       create a rectangle from a bbox or target layer extent
  -rectangles      create a rectangle around each feature in a layer
  -rename-fields   rename data fields
  -rename-layers   assign new names to layers
  -simplify        simplify the geometry of polygon and polyline features
  -sort            sort features using a JS expression
  -split           split a layer into single-feature or multi-feature layers
  -split-on-grid   split features into separate layers using a grid
  -style           set SVG style properties using JS or literal values
  -target          set active layer (or layers)
  -union           create a flat mosaic from two or more polygon layers
  -uniq            delete features with the same id as a previous feature
```

### Experimental commands (may give unexpected results)

```
  -cluster         group polygons into compact clusters
  -data-fill       fill in missing values in a polygon layer
  -include         import JS data and functions for use in JS expressions
  -fuzzy-join      join points to polygons, with data fill and fuzzy match
  -require         require a Node module for use in -each expressions
  -run             create commands on-the-fly and run them
  -shape           create a polyline or polygon from coordinates
  -subdivide       recursively split a layer using a JS expression
```

### Informational commands

```
  -calc            calculate statistics about the features in a layer
  -encodings       print list of supported text encodings (for .dbf import)
  -help, -h        print help; takes optional command name
  -info            print information about data layers
  -inspect         print information about a feature
  -projections     print list of supported projections
  -quiet           inhibit console messages
  -verbose         print verbose processing messages
  -version, -v     print mapshaper version
```

See original repo on [@mbloch/mapshaper](https://github.com/mbloch/mapshaper/wiki) for more.
Original documentation below.

------------------------------

# Documentation from @mblock/mapshaper
See the [full mapshaper README](https://github.com/mbloch/mapshaper/blob/master/README.md) for more information.

## Introduction

Mapshaper is software for editing Shapefile, GeoJSON, [TopoJSON](https://github.com/mbostock/topojson/wiki), CSV and several other data formats, written in JavaScript.

Mapshaper supports essential map making tasks like simplifying shapes, editing attribute data, clipping, erasing, dissolving, filtering and more.

See the [project wiki](https://github.com/mbloch/mapshaper/wiki) for documentation on how to use mapshaper.


## Command line tools

Mapshaper includes several command line programs, which can be run under Mac OS X, Linux and Windows.

* `mapshaper` Runs mapshaper commands.
* `mapshaper-xl` Works the same as `mapshaper`, but runs with more RAM to support larger files.
* `mapshaper-gui` Runs the mapshaper Web interface locally.

The project wiki has an [introduction](https://github.com/mbloch/mapshaper/wiki/Introduction-to-the-Command-Line-Tool) to using the command line tool that includes many simple examples.

For a detailed reference, see the [Command Reference](https://github.com/mbloch/mapshaper/wiki/Command-Reference).


## Interactive web interface

Visit the public website at [www.mapshaper.org](http://www.mapshaper.org) or use the web UI locally via the `mapshaper-gui` script.

All processing is done in the browser, so your data stays private, even when using the public website.

The web UI works in recent desktop versions of Chrome, Firefox, Safari and Internet Explorer. Safari before v10.1 and IE before v10 are not supported.

## Building and testing

From the project directory, run `npm run build` to build both the cli and web UI modules.

Run `npm test` to run mapshaper's tests.

## License

This software is licensed under [MPL 2.0](http://www.mozilla.org/MPL/2.0/).

According to Mozilla's [FAQ](http://www.mozilla.org/MPL/2.0/FAQ.html), "The MPL's ‘file-level’ copyleft is designed to encourage contributors to share modifications they make to your code, while still allowing them to combine your code with code under other licenses (open or proprietary) with minimal restrictions."


## Acknowledgements

My colleagues at The New York Times, for countless suggestions, bug reports and general helpfulness.

Mark Harrower, for collaborating on the original "MapShaper" program at the University of Wisconsin&ndash;Madison.
