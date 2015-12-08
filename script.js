(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var createCanvas = require('./lib/create-canvas')
var createScale = require('./lib/scales')
var addTiles = require('./lib/tiles')
var paint = require('./lib/paint')


module.exports = function(divId, collections, options) {
	draw(divId, collections, options)
}

function draw(divId, collections, options) {
	var w = window.innerWidth - 20
	var h = window.innerHeight - 20
	var bbox = null
	var tileService = null
	if(options !== undefined) {
		if(options.width !== undefined) { var w = options.width }
		if(options.height !== undefined) { var h = options.height }
		if(options.bbox !== undefined) { var bbox = options.bbox }
		if(options.tileService !== undefined) { var tileService = options.tileService }
	}

	createCanvas(divId, w, h, function(ctx) {
		createScale(w, h, bbox, collections[0].geojson, function(scale, bb) {
			addTiles(tileService, ctx, scale, bb, function() {
				paint(collections, ctx, scale, function() {
					console.log('done drawing')
				})	
			})
		})
	})
}

},{"./lib/create-canvas":2,"./lib/paint":3,"./lib/scales":4,"./lib/tiles":6}],2:[function(require,module,exports){
module.exports = function(divId, width, height, callback) {
	var canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height
	var div = document.getElementById(divId)
	div.appendChild(canvas)
	var ctx = canvas.getContext('2d')
	callback(ctx)
}

},{}],3:[function(require,module,exports){
module.exports = function(collections, ctx, scale, callback) {
	paintCollections(0, collections, ctx, scale, function() {
		callback()
	})
}

function paintCollections(count, collections, ctx, scale, callback) {
	if(count === collections.length) { callback() }
	else {
		var c = collections[count]
		paintFeatures(0, c.geojson.features, c.style, ctx, scale, function() {
			count = count + 1
			paintCollections(count, collections, ctx, scale, callback)
		})
	}
}

function paintFeatures(count, feats, style, ctx, scale, callback) {
	if(count === feats.length) { callback() }
	else {
		var feat = feats[count]
		paint(ctx, feat, style, scale, function() {
			count = count + 1
			paintFeatures(count, feats, style, ctx, scale, callback)
		})
	}
}

function paint(ctx, feature, style, scale, callback) {
	
	if(feature.geometry.type === 'Polygon') {
		var polygons = [feature.geometry.coordinates]
	} else if(feature.geometry.type === 'MultiPolygon') {
		var polygons = feature.geometry.coordinates
	}

	for(j=0;j<polygons.length;j++) {
		var coords = polygons[j][0]
		ctx.beginPath()

		for(x=0;x<polygons[j].length;x++) {
			var cs = polygons[j][x]
			var f = scale(cs[0])
			ctx.moveTo(f[0], f[1])
			for(i=1;i<cs.length;i++) {
				var p = scale(cs[i])
				ctx.lineTo(p[0], p[1])
			} 
		}

		ctx.closePath()

		if(style.fillOpacity !== undefined) {
			ctx.globalAlpha = style.fillOpacity
		}
		if(style.fillColor !== undefined) {
			ctx.fillStyle = style.fillColor
		}

		ctx.fill()
		ctx.globalAlpha = 1

		var drawStroke = false
		if(style.strokeOpacity !== undefined) {
			ctx.globalAlpha = style.strokeOpacity
			drawStroke = true
		}
		if(style.strokeColor !== undefined) {
			ctx.strokeStyle = style.strokeColor
			drawStroke = true
		}
		if(style.strokeWidth !== undefined) {
			ctx.lineWidth = style.strokeWidth
			drawStroke = true
		}
		if(drawStroke === true) { ctx.stroke() }
		
		ctx.globalAlpha = 1
	}

	callback()
}

},{}],4:[function(require,module,exports){
var geojsonExtent = require('geojson-extent')
var scale = require('d3-scale')

module.exports = function(width, height, bbox, collection, callback) { 
	if(bbox === null || bbox === undefined) {
		var bbox = geojsonExtent(collection)
	}
	var pixelWidth = width
	var pixelHeight = height

	var minLng = Conv.ll2m(bbox[0], bbox[1]).x
	var minLat = Conv.ll2m(bbox[0], bbox[1]).y
	var maxLng = Conv.ll2m(bbox[2], bbox[3]).x
	var maxLat = Conv.ll2m(bbox[2], bbox[3]).y

	var coordWidth = maxLng - minLng
	var coordHeight = maxLat - minLat

	var pixelRatio = pixelWidth / pixelHeight
	var coordRatio = coordWidth / coordHeight

	if(pixelRatio > coordRatio) {
		var featureWidth =  pixelHeight / coordHeight * coordWidth
		var featureHeight = pixelHeight
	} else {
		var featureWidth =  pixelWidth
		var featureHeight = pixelWidth / coordWidth * coordHeight
	}

	var marginLeft = (pixelWidth - featureWidth) / 2
	var marginTop = (pixelHeight - featureHeight) / 2

	var xScale = scale.linear()
		.domain([minLng, maxLng])
		.range([marginLeft, marginLeft + featureWidth])

	var yScale = scale.linear()
		.domain([minLat, maxLat])
		.range([marginTop + featureHeight, marginTop])

	function coord2Pixels(arr) {
		var mercator = Conv.ll2m(arr[0], arr[1])
		return [xScale(mercator.x), yScale(mercator.y)]
		
	}

	callback(coord2Pixels, bbox)
}

var Conv=({
	r_major:6378137.0,//Equatorial Radius, WGS84
	r_minor:6356752.314245179,//defined as constant
	f:298.257223563,//1/f=(a-b)/a , a=r_major, b=r_minor
	deg2rad:function(d)
	{
		var r=d*(Math.PI/180.0);
		return r;
	},
	rad2deg:function(r)
	{
		var d=r/(Math.PI/180.0);
		return d;
	},
	ll2m:function(lon,lat) //lat lon to mercator
	{
		//lat, lon in rad
		var x=this.r_major * this.deg2rad(lon);
 
		if (lat > 89.5) lat = 89.5;
		if (lat < -89.5) lat = -89.5;
 
 
		var temp = this.r_minor / this.r_major;
		var es = 1.0 - (temp * temp);
		var eccent = Math.sqrt(es);
 
		var phi = this.deg2rad(lat);
 
		var sinphi = Math.sin(phi);
 
		var con = eccent * sinphi;
		var com = .5 * eccent;
		var con2 = Math.pow((1.0-con)/(1.0+con), com);
		var ts = Math.tan(.5 * (Math.PI*0.5 - phi))/con2;
		var y = 0 - this.r_major * Math.log(ts);
		var ret={'x':x,'y':y};
		return ret;
	},
	m2ll:function(x,y) //mercator to lat lon
	{
		var lon=this.rad2deg((x/this.r_major));
 
		var temp = this.r_minor / this.r_major;
		var e = Math.sqrt(1.0 - (temp * temp));
		var lat=this.rad2deg(this.pj_phi2( Math.exp( 0-(y/this.r_major)), e));
 
		var ret={'lon':lon,'lat':lat};
		return ret;
	},
	pj_phi2:function(ts, e) 
	{
		var N_ITER=15;
		var HALFPI=Math.PI/2;
 
 
		var TOL=0.0000000001;
		var eccnth, Phi, con, dphi;
		var i;
		var eccnth = .5 * e;
		Phi = HALFPI - 2. * Math.atan (ts);
		i = N_ITER;
		do 
		{
			con = e * Math.sin (Phi);
			dphi = HALFPI - 2. * Math.atan (ts * Math.pow((1. - con) / (1. + con), eccnth)) - Phi;
			Phi += dphi;
 
		} 
		while ( Math.abs(dphi)>TOL && --i);
		return Phi;
	}
})




},{"d3-scale":8,"geojson-extent":16}],5:[function(require,module,exports){
module.exports = function(tileService, x, y, z, callback) {
	parseURL(tileService, x, y, z, function(err, url) {
		if(err) { 
			console.log('Errors getting tiles: ') 
			for(i=0;i<err.length;i++) {
				console.log('*  ' + err[i])
			}
		}
		callback(url)
	})
}

function parseURL(tileService, x, y, z, callback) {
	var base = tileService.url
	var parts = splitURL(base)
	addCoords(parts, x, y, z, function(err, withCoords) {
		addSubdomain(err, withCoords, tileService, function(err, withSubdomains) {
			addRest(err, withSubdomains, tileService, function(err, withRest) {
				createURL(err, withRest, function(err, url) {
					if(err.length === 0) { err = null }
					callback(err, url)
				})		
			})
		})
	})
}

function createURL(err, parts, callback) {
	var url = ''
	for(i=0;i<parts.length;i++) {
		if(parts[i].type === 'part') { url = url + parts[i].txt }
		else {
			err.push('"' + parts[i].txt + '" is missing, URL will be created without.')
		}
	}
	callback(err, url)
}

function addRest(err, parts, tileService, callback) {
	var newParts = []
	for(i=0;i<parts.length;i++) {
		if(parts[i].type === 'key') {
			var k = parts[i].txt
			var val = tileService[k]
			if(val === undefined) {
				err.push('"' + k + '" is required by the URL but was not provided.')
				newParts.push(parts[i])
			} else {
				newParts.push({ type: 'part', txt: val })
			}
		} else {
			newParts.push(parts[i])
		}
	}
	callback(err, newParts)
}

function addSubdomain(err, parts, tileService, callback) {
	var subdomains = tileService.subdomains
	if(subdomains === undefined) {
		var needed = false
		for(i=0;i<parts.length;i++) {
			if(parts[i].type === 'key' && parts[i].txt === 's') { 
				needed = true 
				parts[i].type = 'part'
				parts[i].txt = 'a'
			}
		}	
		if(needed === false) { callback(err, parts) }
		else {
			err.push('The URL requires subdomains that were not provided, trying with "a"')
			callback(err, parts)
		}
	}
	else {
		var index = Math.floor(Math.random() * subdomains.length)
		var sub = subdomains[index]
		var newParts = []
		var exists = false
		for(i=0;i<parts.length;i++) {
			if(parts[i].type === 'key' && parts[i].txt === 's') {
				exists = true
				newParts.push({ type: 'part', txt: sub })
			} else {
				newParts.push(parts[i])
			}
		}
		if(exists === false) { err.push('Subdomains were provided but are not required in URL') }
		callback(err, newParts)
	}
}

function splitURL(url) {
	var startSplit = url.split('{')
	var parts = [{ type: 'part', txt: startSplit[0]}]
	for(i=1;i<startSplit.length;i++) {
		var newSplit = startSplit[i].split('}')
		parts.push({ type: 'key', txt: newSplit[0] })
		parts.push({ type: 'part', txt: newSplit[1] })
	}
	return parts
}

function addCoords(parts, x, y, z, callback) {
	var newParts = []
	var exist = {
		x: false,
		y: false,
		z: false
	}
	for(i=0;i<parts.length;i++) {
		if(parts[i].type === 'part') {
			newParts.push(parts[i])
		} else {
			if(parts[i].txt === 'x') {
				newParts.push({type: 'part', txt: x })
				exist.x = true
			} else if(parts[i].txt === 'y') {
				newParts.push({type: 'part', txt: y })
				exist.y = true
			} else if(parts[i].txt === 'z') {
				newParts.push({type: 'part', txt: z })
				exist.z = true
			} else {
				newParts.push(parts[i])
			}
		}
	} 
	var err = []
	if(exist.x === false) { err.push('URL has no "x" field.') }
	if(exist.y === false) { err.push('URL has no "y" field.') }
	if(exist.z === false) { err.push('URL has no "z" field.') }
	callback(err, newParts)
}

},{}],6:[function(require,module,exports){
var tilebelt = require('tilebelt')
var tileURL = require('./tiles-url')

module.exports = function(tileService, ctx, scale, bb, callback) {
	if(tileService === null) { callback() }
	else {
		var main = tilebelt.bboxToTile(bb)
		findTiles([main], bb, scale, function(children) {
			addTilesLoop(0, children, tileService, ctx, scale, function() {
				callback()
			})
		})
	}
}

function findTiles(existing, bb, scale, callback) {
	var oldZ = existing[0][2]
	var z = oldZ + 1
	var topLeftTile = tilebelt.pointToTile(bb[0], bb[3], z)
	var bottomRightTile = tilebelt.pointToTile(bb[2], bb[1], z)
	var children = []
	for(x=topLeftTile[0];x<bottomRightTile[0] + 1;x++) {
		for(y=topLeftTile[1];y<bottomRightTile[1] + 1;y++) {
			children.push([x, y, z])
		}
	}
	var tileBbox = tilebelt.tileToBBOX(children[0])
	var topLeft = scale([tileBbox[0], tileBbox[3]])
	var bottomRight = scale([tileBbox[2], tileBbox[1]])
	var width = bottomRight[0] - topLeft[0]
	if(width > 300) {
		findTiles(children, bb, scale, callback)
	} else {
		callback(children)
	}
}

function addTilesLoop(count, children, tileService, ctx, scale, callback) {
	if(count === children.length) { callback() }
	else {
		var tile = children[count]
		var tileBbox = tilebelt.tileToBBOX(tile)
		var topLeft = scale([tileBbox[0], tileBbox[3]])
		var bottomRight = scale([tileBbox[2], tileBbox[1]])
		var width = bottomRight[0] - topLeft[0]
		var height = bottomRight[1] - topLeft[1]
		var tileImg = new Image()
		tileURL(tileService, tile[0], tile[1], tile[2], function(src) {
			tileImg.src = src
			tileImg.onload = function() {
				ctx.globalAlpha = 0.5
				ctx.drawImage(tileImg, topLeft[0], topLeft[1], width, height)
				ctx.globalAlpha = 1
				count = count + 1
				addTilesLoop(count, children, tileService, ctx, scale, callback)
			}
		})
	}
}

},{"./tiles-url":5,"tilebelt":23}],7:[function(require,module,exports){
var mapCanvas = require('./index')
var cantons = require('./test_data/cantons.json')

var style = {
	fillColor: '#99d8c9',
	fillOpacity: 0.5,
	strokeColor: 'white',
	strokeOpacity: 1,	
	strokeWidth: 1
}
var options = {
	tileService: {
		url: 'http://stamen-tiles-{s}.a.ssl.fastly.net/toner-background/{z}/{x}/{y}.{ext}', 
		attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		subdomains: 'abcd',
		minZoom: 0,
		maxZoom: 20,
		ext: 'png'
	}
}

mapCanvas('map', [{geojson: cantons, style: style}], options)












},{"./index":1,"./test_data/cantons.json":24}],8:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-color'), require('d3-interpolate'), require('d3-arrays'), require('d3-format'), require('d3-time-format'), require('d3-time')) :
  typeof define === 'function' && define.amd ? define('d3-scale', ['exports', 'd3-color', 'd3-interpolate', 'd3-arrays', 'd3-format', 'd3-time-format', 'd3-time'], factory) :
  factory((global.d3_scale = {}),global.d3_color,global.d3_interpolate,global.d3_arrays,global.d3_format,global.d3_time_format,global.d3_time);
}(this, function (exports,d3Color,d3Interpolate,d3Arrays,d3Format,d3TimeFormat,d3Time) { 'use strict';

  function steps(length, start, step) {
    var steps = new Array(length), i = -1;
    while (++i < length) steps[i] = start + step * i;
    return steps;
  }

  function newOrdinal(domain, ranger) {
    var index,
        range,
        rangeBand;

    function scale(x) {
      var k = x + "", i = index.get(k);
      if (!i) {
        if (ranger.t !== "range") return;
        index.set(k, i = domain.push(x));
      }
      return range[(i - 1) % range.length];
    }

    scale.domain = function(x) {
      if (!arguments.length) return domain.slice();
      domain = [];
      index = d3Arrays.map();
      var i = -1, n = x.length, xi, xk;
      while (++i < n) if (!index.has(xk = (xi = x[i]) + "")) index.set(xk, domain.push(xi));
      return scale[ranger.t].apply(scale, ranger.a);
    };

    scale.range = function(x) {
      if (!arguments.length) return range.slice();
      range = x.slice();
      rangeBand = 0;
      ranger = {t: "range", a: arguments};
      return scale;
    };

    scale.rangePoints = function(x, padding) {
      padding = arguments.length < 2 ? 0 : +padding;
      var start = +x[0],
          stop = +x[1],
          step = domain.length < 2 ? (start = (start + stop) / 2, 0) : (stop - start) / (domain.length - 1 + padding);
      range = steps(domain.length, start + step * padding / 2, step);
      rangeBand = 0;
      ranger = {t: "rangePoints", a: arguments};
      return scale;
    };

    scale.rangeRoundPoints = function(x, padding) {
      padding = arguments.length < 2 ? 0 : +padding;
      var start = +x[0],
          stop = +x[1],
          step = domain.length < 2 ? (start = stop = Math.round((start + stop) / 2), 0) : (stop - start) / (domain.length - 1 + padding) | 0; // bitwise floor for symmetry
      range = steps(domain.length, start + Math.round(step * padding / 2 + (stop - start - (domain.length - 1 + padding) * step) / 2), step);
      rangeBand = 0;
      ranger = {t: "rangeRoundPoints", a: arguments};
      return scale;
    };

    scale.rangeBands = function(x, padding, outerPadding) {
      padding = arguments.length < 2 ? 0 : +padding;
      outerPadding = arguments.length < 3 ? padding : +outerPadding;
      var reverse = +x[1] < +x[0],
          start = +x[reverse - 0],
          stop = +x[1 - reverse],
          step = (stop - start) / (domain.length - padding + 2 * outerPadding);
      range = steps(domain.length, start + step * outerPadding, step);
      if (reverse) range.reverse();
      rangeBand = step * (1 - padding);
      ranger = {t: "rangeBands", a: arguments};
      return scale;
    };

    scale.rangeRoundBands = function(x, padding, outerPadding) {
      padding = arguments.length < 2 ? 0 : +padding;
      outerPadding = arguments.length < 3 ? padding : +outerPadding;
      var reverse = +x[1] < +x[0],
          start = +x[reverse - 0],
          stop = +x[1 - reverse],
          step = Math.floor((stop - start) / (domain.length - padding + 2 * outerPadding));
      range = steps(domain.length, start + Math.round((stop - start - (domain.length - padding) * step) / 2), step);
      if (reverse) range.reverse();
      rangeBand = Math.round(step * (1 - padding));
      ranger = {t: "rangeRoundBands", a: arguments};
      return scale;
    };

    scale.rangeBand = function() {
      return rangeBand;
    };

    scale.rangeExtent = function() {
      var t = ranger.a[0], start = t[0], stop = t[t.length - 1];
      if (stop < start) t = stop, stop = start, start = t;
      return [start, stop];
    };

    scale.copy = function() {
      return newOrdinal(domain, ranger);
    };

    return scale.domain(domain);
  }

  function ordinal() {
    return newOrdinal([], {t: "range", a: [[]]});
  };

  function category10() {
    return ordinal().range([
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf"
    ]);
  };

  function category20b() {
    return ordinal().range([
      "#393b79", "#5254a3", "#6b6ecf", "#9c9ede",
      "#637939", "#8ca252", "#b5cf6b", "#cedb9c",
      "#8c6d31", "#bd9e39", "#e7ba52", "#e7cb94",
      "#843c39", "#ad494a", "#d6616b", "#e7969c",
      "#7b4173", "#a55194", "#ce6dbd", "#de9ed6"
    ]);
  };

  function category20c() {
    return ordinal().range([
      "#3182bd", "#6baed6", "#9ecae1", "#c6dbef",
      "#e6550d", "#fd8d3c", "#fdae6b", "#fdd0a2",
      "#31a354", "#74c476", "#a1d99b", "#c7e9c0",
      "#756bb1", "#9e9ac8", "#bcbddc", "#dadaeb",
      "#636363", "#969696", "#bdbdbd", "#d9d9d9"
    ]);
  };

  function category20() {
    return ordinal().range([
      "#1f77b4", "#aec7e8",
      "#ff7f0e", "#ffbb78",
      "#2ca02c", "#98df8a",
      "#d62728", "#ff9896",
      "#9467bd", "#c5b0d5",
      "#8c564b", "#c49c94",
      "#e377c2", "#f7b6d2",
      "#7f7f7f", "#c7c7c7",
      "#bcbd22", "#dbdb8d",
      "#17becf", "#9edae5"
    ]);
  };

  function nice(domain, step) {
    domain = domain.slice();
    if (!step) return domain;

    var i0 = 0,
        i1 = domain.length - 1,
        x0 = domain[i0],
        x1 = domain[i1],
        t;

    if (x1 < x0) {
      t = i0, i0 = i1, i1 = t;
      t = x0, x0 = x1, x1 = t;
    }

    domain[i0] = Math.floor(x0 / step) * step;
    domain[i1] = Math.ceil(x1 / step) * step;
    return domain;
  };

  var e10 = Math.sqrt(50);
  var e5 = Math.sqrt(10);
  var e2 = Math.sqrt(2);
  function tickRange(domain, count) {
    if (count == null) count = 10;

    var start = domain[0],
        stop = domain[domain.length - 1];

    if (stop < start) error = stop, stop = start, start = error;

    var span = stop - start,
        step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10)),
        error = span / count / step;

    // Filter ticks to get closer to the desired count.
    if (error >= e10) step *= 10;
    else if (error >= e5) step *= 5;
    else if (error >= e2) step *= 2;

    // Round start and stop values to step interval.
    return [
      Math.ceil(start / step) * step,
      Math.floor(stop / step) * step + step / 2, // inclusive
      step
    ];
  };

  function ticks(domain, count) {
    return d3Arrays.range.apply(null, tickRange(domain, count));
  };

  function tickFormat(domain, count, specifier) {
    var range = tickRange(domain, count);
    if (specifier == null) {
      specifier = ",." + d3Format.precisionFixed(range[2]) + "f";
    } else {
      switch (specifier = d3Format.formatSpecifier(specifier), specifier.type) {
        case "s": {
          var value = Math.max(Math.abs(range[0]), Math.abs(range[1]));
          if (specifier.precision == null) specifier.precision = d3Format.precisionPrefix(range[2], value);
          return d3Format.formatPrefix(specifier, value);
        }
        case "":
        case "e":
        case "g":
        case "p":
        case "r": {
          if (specifier.precision == null) specifier.precision = d3Format.precisionRound(range[2], Math.max(Math.abs(range[0]), Math.abs(range[1]))) - (specifier.type === "e");
          break;
        }
        case "f":
        case "%": {
          if (specifier.precision == null) specifier.precision = d3Format.precisionFixed(range[2]) - (specifier.type === "%") * 2;
          break;
        }
      }
    }
    return d3Format.format(specifier);
  };

  function uninterpolateClamp(a, b) {
    b = (b -= a = +a) || 1 / b;
    return function(x) {
      return Math.max(0, Math.min(1, (x - a) / b));
    };
  }

  function uninterpolateNumber(a, b) {
    b = (b -= a = +a) || 1 / b;
    return function(x) {
      return (x - a) / b;
    };
  }

  function bilinear(domain, range, uninterpolate, interpolate) {
    var u = uninterpolate(domain[0], domain[1]),
        i = interpolate(range[0], range[1]);
    return function(x) {
      return i(u(x));
    };
  }

  function polylinear(domain, range, uninterpolate, interpolate) {
    var k = Math.min(domain.length, range.length) - 1,
        u = new Array(k),
        i = new Array(k),
        j = -1;

    // Handle descending domains.
    if (domain[k] < domain[0]) {
      domain = domain.slice().reverse();
      range = range.slice().reverse();
    }

    while (++j < k) {
      u[j] = uninterpolate(domain[j], domain[j + 1]);
      i[j] = interpolate(range[j], range[j + 1]);
    }

    return function(x) {
      var j = d3Arrays.bisect(domain, x, 1, k) - 1;
      return i[j](u[j](x));
    };
  }

  function newLinear(domain, range, interpolate, clamp) {
    var output,
        input;

    function rescale() {
      var linear = Math.min(domain.length, range.length) > 2 ? polylinear : bilinear,
          uninterpolate = clamp ? uninterpolateClamp : uninterpolateNumber;
      output = linear(domain, range, uninterpolate, interpolate);
      input = linear(range, domain, uninterpolate, d3Interpolate.number);
      return scale;
    }

    function scale(x) {
      return output(x);
    }

    scale.invert = function(y) {
      return input(y);
    };

    scale.domain = function(x) {
      if (!arguments.length) return domain.slice();
      domain = x.map(Number);
      return rescale();
    };

    scale.range = function(x) {
      if (!arguments.length) return range.slice();
      range = x.slice();
      return rescale();
    };

    scale.rangeRound = function(x) {
      return scale.range(x).interpolate(d3Interpolate.round);
    };

    scale.clamp = function(x) {
      if (!arguments.length) return clamp;
      clamp = !!x;
      return rescale();
    };

    scale.interpolate = function(x) {
      if (!arguments.length) return interpolate;
      interpolate = x;
      return rescale();
    };

    scale.ticks = function(count) {
      return ticks(domain, count);
    };

    scale.tickFormat = function(count, specifier) {
      return tickFormat(domain, count, specifier);
    };

    scale.nice = function(count) {
      domain = nice(domain, tickRange(domain, count)[2]);
      return rescale();
    };

    scale.copy = function() {
      return newLinear(domain, range, interpolate, clamp);
    };

    return rescale();
  }

  function rebind(scale, linear) {
    scale.range = function() {
      var x = linear.range.apply(linear, arguments);
      return x === linear ? scale : x;
    };

    scale.rangeRound = function() {
      var x = linear.rangeRound.apply(linear, arguments);
      return x === linear ? scale : x;
    };

    scale.clamp = function() {
      var x = linear.clamp.apply(linear, arguments);
      return x === linear ? scale : x;
    };

    scale.interpolate = function() {
      var x = linear.interpolate.apply(linear, arguments);
      return x === linear ? scale : x;
    };

    return scale;
  };

  function linear() {
    return newLinear([0, 1], [0, 1], d3Interpolate.value, false);
  };

  function cubehelix() {
    return linear()
        .interpolate(d3Interpolate.cubehelixLong)
        .range([d3Color.cubehelix(300, 0.5, 0.0), d3Color.cubehelix(-240, 0.5, 1.0)]);
  };

  function newIdentity(domain) {

    function scale(x) {
      return +x;
    }

    scale.invert = scale;

    scale.domain = scale.range = function(x) {
      if (!arguments.length) return domain.slice();
      domain = x.map(Number);
      return scale;
    };

    scale.ticks = function(count) {
      return ticks(domain, count);
    };

    scale.tickFormat = function(count, specifier) {
      return tickFormat(domain, count, specifier);
    };

    scale.copy = function() {
      return newIdentity(domain);
    };

    return scale;
  }

  function identity() {
    return newIdentity([0, 1]);
  };

  var tickFormat10 = d3Format.format(".0e");
  var tickFormatOther = d3Format.format(",");
  function newLog(linear, base, domain) {

    function log(x) {
      return (domain[0] < 0 ? -Math.log(x > 0 ? 0 : -x) : Math.log(x < 0 ? 0 : x)) / Math.log(base);
    }

    function pow(x) {
      return domain[0] < 0 ? -Math.pow(base, -x) : Math.pow(base, x);
    }

    function scale(x) {
      return linear(log(x));
    }

    scale.invert = function(x) {
      return pow(linear.invert(x));
    };

    scale.base = function(x) {
      if (!arguments.length) return base;
      base = +x;
      return scale.domain(domain);
    };

    scale.domain = function(x) {
      if (!arguments.length) return domain.slice();
      domain = x.map(Number);
      linear.domain(domain.map(log));
      return scale;
    };

    scale.nice = function() {
      var x = nice(linear.domain(), 1);
      linear.domain(x);
      domain = x.map(pow);
      return scale;
    };

    scale.ticks = function() {
      var u = domain[0],
          v = domain[domain.length - 1];
      if (v < u) i = u, u = v, v = i;
      var i = Math.floor(log(u)),
          j = Math.ceil(log(v)),
          k,
          t,
          n = base % 1 ? 2 : base,
          ticks = [];

      if (isFinite(j - i)) {
        if (u > 0) {
          for (--j, k = 1; k < n; ++k) if ((t = pow(i) * k) < u) continue; else ticks.push(t);
          while (++i < j) for (k = 1; k < n; ++k) ticks.push(pow(i) * k);
          for (k = 1; k < n; ++k) if ((t = pow(i) * k) > v) break; else ticks.push(t);
        } else {
          for (++i, k = n - 1; k >= 1; --k) if ((t = pow(i) * k) < u) continue; else ticks.push(t);
          while (++i < j) for (k = n - 1; k >= 1; --k) ticks.push(pow(i) * k);
          for (k = n - 1; k >= 1; --k) if ((t = pow(i) * k) > v) break; else ticks.push(t);
        }
      }

      return ticks;
    };

    scale.tickFormat = function(count, specifier) {
      if (specifier == null) specifier = base === 10 ? tickFormat10 : tickFormatOther;
      else if (typeof specifier !== "function") specifier = d3Format.format(specifier);
      if (count == null) return specifier;
      var k = Math.min(base, scale.ticks().length / count),
          f = domain[0] > 0 ? (e = 1e-12, Math.ceil) : (e = -1e-12, Math.floor),
          e;
      return function(d) {
        return pow(f(log(d) + e)) / d >= k ? specifier(d) : "";
      };
    };

    scale.copy = function() {
      return newLog(linear.copy(), base, domain);
    };

    return rebind(scale, linear);
  }

  function log() {
    return newLog(linear(), 10, [1, 10]);
  };

  function newPow(linear, exponent, domain) {

    function powp(x) {
      return x < 0 ? -Math.pow(-x, exponent) : Math.pow(x, exponent);
    }

    function powb(x) {
      return x < 0 ? -Math.pow(-x, 1 / exponent) : Math.pow(x, 1 / exponent);
    }

    function scale(x) {
      return linear(powp(x));
    }

    scale.invert = function(x) {
      return powb(linear.invert(x));
    };

    scale.exponent = function(x) {
      if (!arguments.length) return exponent;
      exponent = +x;
      return scale.domain(domain);
    };

    scale.domain = function(x) {
      if (!arguments.length) return domain.slice();
      domain = x.map(Number);
      linear.domain(domain.map(powp));
      return scale;
    };

    scale.ticks = function(count) {
      return ticks(domain, count);
    };

    scale.tickFormat = function(count, specifier) {
      return tickFormat(domain, count, specifier);
    };

    scale.nice = function(count) {
      return scale.domain(nice(domain, tickRange(domain, count)[2]));
    };

    scale.copy = function() {
      return newPow(linear.copy(), exponent, domain);
    };

    return rebind(scale, linear);
  }

  function sqrt() {
    return newPow(linear(), .5, [0, 1]);
  };

  function pow() {
    return newPow(linear(), 1, [0, 1]);
  };

  function newQuantile(domain, range) {
    var thresholds;

    function rescale() {
      var k = 0,
          q = range.length;
      thresholds = [];
      while (++k < q) thresholds[k - 1] = d3Arrays.quantile(domain, k / q);
      return scale;
    }

    function scale(x) {
      if (!isNaN(x = +x)) return range[d3Arrays.bisect(thresholds, x)];
    }

    scale.domain = function(x) {
      if (!arguments.length) return domain;
      domain = [];
      for (var i = 0, n = x.length, v; i < n; ++i) if (v = x[i], v != null && !isNaN(v = +v)) domain.push(v);
      domain.sort(d3Arrays.ascending);
      return rescale();
    };

    scale.range = function(x) {
      if (!arguments.length) return range.slice();
      range = x.slice();
      return rescale();
    };

    scale.quantiles = function() {
      return thresholds;
    };

    scale.invertExtent = function(y) {
      y = range.indexOf(y);
      return y < 0 ? [NaN, NaN] : [
        y > 0 ? thresholds[y - 1] : domain[0],
        y < thresholds.length ? thresholds[y] : domain[domain.length - 1]
      ];
    };

    scale.copy = function() {
      return newQuantile(domain, range); // copy on write!
    };

    return rescale();
  }

  function quantile() {
    return newQuantile([], []);
  };

  function newQuantize(x0, x1, range) {
    var kx, i;

    function scale(x) {
      return range[Math.max(0, Math.min(i, Math.floor(kx * (x - x0))))];
    }

    function rescale() {
      kx = range.length / (x1 - x0);
      i = range.length - 1;
      return scale;
    }

    scale.domain = function(x) {
      if (!arguments.length) return [x0, x1];
      x0 = +x[0];
      x1 = +x[x.length - 1];
      return rescale();
    };

    scale.range = function(x) {
      if (!arguments.length) return range.slice();
      range = x.slice();
      return rescale();
    };

    scale.invertExtent = function(y) {
      y = range.indexOf(y);
      y = y < 0 ? NaN : y / kx + x0;
      return [y, y + 1 / kx];
    };

    scale.copy = function() {
      return newQuantize(x0, x1, range); // copy on write
    };

    return rescale();
  }

  function quantize() {
    return newQuantize(0, 1, [0, 1]);
  };

  function rainbow() {
    return linear()
        .interpolate(d3Interpolate.cubehelixLong)
        .domain([0, 0.5, 1.0])
        .range([d3Color.cubehelix(-100, 0.75, 0.35), d3Color.cubehelix(80, 1.50, 0.8), d3Color.cubehelix(260, 0.75, 0.35)]);
  };

  function newThreshold(domain, range, n) {

    function scale(x) {
      if (x <= x) return range[d3Arrays.bisect(domain, x, 0, n)];
    }

    scale.domain = function(x) {
      if (!arguments.length) return domain.slice();
      domain = x.slice(), n = Math.min(domain.length, range.length - 1);
      return scale;
    };

    scale.range = function(x) {
      if (!arguments.length) return range.slice();
      range = x.slice(), n = Math.min(domain.length, range.length - 1);
      return scale;
    };

    scale.invertExtent = function(y) {
      return y = range.indexOf(y), [domain[y - 1], domain[y]];
    };

    scale.copy = function() {
      return newThreshold(domain, range);
    };

    return scale;
  };

  function threshold() {
    return newThreshold([.5], [0, 1], 1);
  };

  var millisecondsPerSecond = 1000;
  var millisecondsPerMinute = millisecondsPerSecond * 60;
  var millisecondsPerHour = millisecondsPerMinute * 60;
  var millisecondsPerDay = millisecondsPerHour * 24;
  var millisecondsPerWeek = millisecondsPerDay * 7;
  var millisecondsPerMonth = millisecondsPerDay * 30;
  var millisecondsPerYear = millisecondsPerDay * 365;
  var bisectTickIntervals = d3Arrays.bisector(function(method) { return method[2]; }).right;
  function newDate(t) {
    return new Date(t);
  }

  function newTime(linear, year, month, week, day, hour, minute, second, millisecond, format) {
    var formatMillisecond = format(".%L"),
        formatSecond = format(":%S"),
        formatMinute = format("%I:%M"),
        formatHour = format("%I %p"),
        formatDay = format("%a %d"),
        formatWeek = format("%b %d"),
        formatMonth = format("%B"),
        formatYear = format("%Y");

    var tickIntervals = [
      [second,  1,      millisecondsPerSecond],
      [second,  5,  5 * millisecondsPerSecond],
      [second, 15, 15 * millisecondsPerSecond],
      [second, 30, 30 * millisecondsPerSecond],
      [minute,  1,      millisecondsPerMinute],
      [minute,  5,  5 * millisecondsPerMinute],
      [minute, 15, 15 * millisecondsPerMinute],
      [minute, 30, 30 * millisecondsPerMinute],
      [  hour,  1,      millisecondsPerHour  ],
      [  hour,  3,  3 * millisecondsPerHour  ],
      [  hour,  6,  6 * millisecondsPerHour  ],
      [  hour, 12, 12 * millisecondsPerHour  ],
      [   day,  1,      millisecondsPerDay   ],
      [   day,  2,  2 * millisecondsPerDay   ],
      [  week,  1,      millisecondsPerWeek  ],
      [ month,  1,      millisecondsPerMonth ],
      [ month,  3,  3 * millisecondsPerMonth ],
      [  year,  1,      millisecondsPerYear  ]
    ];

    function scale(x) {
      return linear(x);
    }

    scale.invert = function(x) {
      return newDate(linear.invert(x));
    };

    scale.domain = function(x) {
      if (!arguments.length) return linear.domain().map(newDate);
      linear.domain(x);
      return scale;
    };

    function tickFormat(date) {
      return (second(date) < date ? formatMillisecond
          : minute(date) < date ? formatSecond
          : hour(date) < date ? formatMinute
          : day(date) < date ? formatHour
          : month(date) < date ? (week(date) < date ? formatDay : formatWeek)
          : year(date) < date ? formatMonth
          : formatYear)(date);
    }

    function tickInterval(interval, start, stop, step) {
      if (interval == null) interval = 10;

      // If a desired tick count is specified, pick a reasonable tick interval
      // based on the extent of the domain and a rough estimate of tick size.
      // Otherwise, assume interval is already a time interval and use it.
      if (typeof interval === "number") {
        var target = Math.abs(stop - start) / interval,
            i = bisectTickIntervals(tickIntervals, target);
        if (i === tickIntervals.length) {
          step = tickRange([start / millisecondsPerYear, stop / millisecondsPerYear], interval)[2];
          interval = year;
        } else if (i) {
          i = tickIntervals[target / tickIntervals[i - 1][2] < tickIntervals[i][2] / target ? i - 1 : i];
          step = i[1];
          interval = i[0];
        } else {
          step = tickRange([start, stop], interval)[2];
          interval = millisecond;
        }
      }

      return step == null ? interval : interval.every(step);
    }

    scale.ticks = function(interval, step) {
      var domain = linear.domain(),
          t0 = domain[0],
          t1 = domain[domain.length - 1],
          t;

      if (t1 < t0) t = t0, t0 = t1, t1 = t;

      return (interval = tickInterval(interval, t0, t1, step))
          ? interval.range(t0, t1 + 1) // inclusive stop
          : [];
    };

    scale.tickFormat = function(specifier) {
      return specifier == null ? tickFormat : format(specifier);
    };

    scale.nice = function(interval, step) {
      var domain = linear.domain(),
          i0 = 0,
          i1 = domain.length - 1,
          t0 = domain[i0],
          t1 = domain[i1],
          t;

      if (t1 < t0) {
        t = i0, i0 = i1, i1 = t;
        t = t0, t0 = t1, t1 = t;
      }

      if (interval = tickInterval(interval, t0, t1, step)) {
        domain[i0] = +interval.floor(t0);
        domain[i1] = +interval.ceil(t1);
        linear.domain(domain);
      }

      return scale;
    };

    scale.copy = function() {
      return newTime(linear.copy(), year, month, week, day, hour, minute, second, millisecond, format);
    };

    return rebind(scale, linear);
  };

  function time() {
    return newTime(linear(), d3Time.year, d3Time.month, d3Time.week, d3Time.day, d3Time.hour, d3Time.minute, d3Time.second, d3Time.millisecond, d3TimeFormat.format).domain([new Date(2000, 0, 1), new Date(2000, 0, 2)]);
  };

  function utcTime() {
    return newTime(linear(), d3Time.utcYear, d3Time.utcMonth, d3Time.utcWeek, d3Time.utcDay, d3Time.utcHour, d3Time.utcMinute, d3Time.utcSecond, d3Time.utcMillisecond, d3TimeFormat.utcFormat).domain([Date.UTC(2000, 0, 1), Date.UTC(2000, 0, 2)]);
  };

  var version = "0.2.0";

  exports.version = version;
  exports.category10 = category10;
  exports.category20b = category20b;
  exports.category20c = category20c;
  exports.category20 = category20;
  exports.cubehelix = cubehelix;
  exports.identity = identity;
  exports.linear = linear;
  exports.log = log;
  exports.ordinal = ordinal;
  exports.pow = pow;
  exports.sqrt = sqrt;
  exports.quantile = quantile;
  exports.quantize = quantize;
  exports.rainbow = rainbow;
  exports.threshold = threshold;
  exports.time = time;
  exports.utcTime = utcTime;

}));
},{"d3-arrays":9,"d3-color":10,"d3-format":11,"d3-interpolate":12,"d3-time":15,"d3-time-format":13}],9:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define('d3-arrays', ['exports'], factory) :
  factory((global.d3_arrays = {}));
}(this, function (exports) { 'use strict';

  function ascending(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  };

  function bisector(compare) {
    if (compare.length === 1) compare = ascendingComparator(compare);
    return {
      left: function(a, x, lo, hi) {
        if (arguments.length < 3) lo = 0;
        if (arguments.length < 4) hi = a.length;
        while (lo < hi) {
          var mid = lo + hi >>> 1;
          if (compare(a[mid], x) < 0) lo = mid + 1;
          else hi = mid;
        }
        return lo;
      },
      right: function(a, x, lo, hi) {
        if (arguments.length < 3) lo = 0;
        if (arguments.length < 4) hi = a.length;
        while (lo < hi) {
          var mid = lo + hi >>> 1;
          if (compare(a[mid], x) > 0) hi = mid;
          else lo = mid + 1;
        }
        return lo;
      }
    };
  };

  function ascendingComparator(f) {
    return function(d, x) {
      return ascending(f(d), x);
    };
  }

  var ascendingBisect = bisector(ascending);
  var bisectRight = ascendingBisect.right;
  var bisectLeft = ascendingBisect.left;

  function descending(a, b) {
    return b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
  };

  function number(x) {
    return x === null ? NaN : +x;
  };

  function variance(array, f) {
    var n = array.length,
        m = 0,
        a,
        d,
        s = 0,
        i = -1,
        j = 0;

    if (arguments.length === 1) {
      while (++i < n) {
        if (!isNaN(a = number(array[i]))) {
          d = a - m;
          m += d / ++j;
          s += d * (a - m);
        }
      }
    }

    else {
      while (++i < n) {
        if (!isNaN(a = number(f(array[i], i, array)))) {
          d = a - m;
          m += d / ++j;
          s += d * (a - m);
        }
      }
    }

    if (j > 1) return s / (j - 1);
  };

  function deviation() {
    var v = variance.apply(this, arguments);
    return v ? Math.sqrt(v) : v;
  };

  function entries(map) {
    var entries = [];
    for (var key in map) entries.push({key: key, value: map[key]});
    return entries;
  };

  function extent(array, f) {
    var i = -1,
        n = array.length,
        a,
        b,
        c;

    if (arguments.length === 1) {
      while (++i < n) if ((b = array[i]) != null && b >= b) { a = c = b; break; }
      while (++i < n) if ((b = array[i]) != null) {
        if (a > b) a = b;
        if (c < b) c = b;
      }
    }

    else {
      while (++i < n) if ((b = f(array[i], i, array)) != null && b >= b) { a = c = b; break; }
      while (++i < n) if ((b = f(array[i], i, array)) != null) {
        if (a > b) a = b;
        if (c < b) c = b;
      }
    }

    return [a, c];
  };

  function keys(map) {
    var keys = [];
    for (var key in map) keys.push(key);
    return keys;
  };

  var prefix = "$";

  function Map() {}

  Map.prototype = map.prototype = {
    has: function(key) {
      return (prefix + key) in this;
    },
    get: function(key) {
      return this[prefix + key];
    },
    set: function(key, value) {
      this[prefix + key] = value;
      return this;
    },
    remove: function(key) {
      var property = prefix + key;
      return property in this && delete this[property];
    },
    clear: function() {
      for (var property in this) if (property[0] === prefix) delete this[property];
    },
    keys: function() {
      var keys = [];
      for (var property in this) if (property[0] === prefix) keys.push(property.slice(1));
      return keys;
    },
    values: function() {
      var values = [];
      for (var property in this) if (property[0] === prefix) values.push(this[property]);
      return values;
    },
    entries: function() {
      var entries = [];
      for (var property in this) if (property[0] === prefix) entries.push({key: property.slice(1), value: this[property]});
      return entries;
    },
    size: function() {
      var size = 0;
      for (var property in this) if (property[0] === prefix) ++size;
      return size;
    },
    empty: function() {
      for (var property in this) if (property[0] === prefix) return false;
      return true;
    },
    each: function(f) {
      for (var property in this) if (property[0] === prefix) f(this[property], property.slice(1), this);
    }
  };

  function map(object, f) {
    var map = new Map;

    // Copy constructor.
    if (object instanceof Map) object.each(function(value, key) { map.set(key, value); });

    // Index array by numeric index or specified key function.
    else if (Array.isArray(object)) {
      var i = -1,
          n = object.length,
          o;

      if (arguments.length === 1) while (++i < n) map.set(i, object[i]);
      else while (++i < n) map.set(f(o = object[i], i, object), o);
    }

    // Convert object to map.
    else if (object) for (var key in object) map.set(key, object[key]);

    return map;
  }

  function max(array, f) {
    var i = -1,
        n = array.length,
        a,
        b;

    if (arguments.length === 1) {
      while (++i < n) if ((b = array[i]) != null && b >= b) { a = b; break; }
      while (++i < n) if ((b = array[i]) != null && b > a) a = b;
    }

    else {
      while (++i < n) if ((b = f(array[i], i, array)) != null && b >= b) { a = b; break; }
      while (++i < n) if ((b = f(array[i], i, array)) != null && b > a) a = b;
    }

    return a;
  };

  function mean(array, f) {
    var s = 0,
        n = array.length,
        a,
        i = -1,
        j = n;

    if (arguments.length === 1) {
      while (++i < n) if (!isNaN(a = number(array[i]))) s += a; else --j;
    }

    else {
      while (++i < n) if (!isNaN(a = number(f(array[i], i, array)))) s += a; else --j;
    }

    if (j) return s / j;
  };

  // R-7 per <http://en.wikipedia.org/wiki/Quantile>
  function quantile(values, p) {
    var H = (values.length - 1) * p + 1,
        h = Math.floor(H),
        v = +values[h - 1],
        e = H - h;
    return e ? v + e * (values[h] - v) : v;
  };

  function median(array, f) {
    var numbers = [],
        n = array.length,
        a,
        i = -1;

    if (arguments.length === 1) {
      while (++i < n) if (!isNaN(a = number(array[i]))) numbers.push(a);
    }

    else {
      while (++i < n) if (!isNaN(a = number(f(array[i], i, array)))) numbers.push(a);
    }

    if (numbers.length) return quantile(numbers.sort(ascending), .5);
  };

  function merge(arrays) {
    var n = arrays.length,
        m,
        i = -1,
        j = 0,
        merged,
        array;

    while (++i < n) j += arrays[i].length;
    merged = new Array(j);

    while (--n >= 0) {
      array = arrays[n];
      m = array.length;
      while (--m >= 0) {
        merged[--j] = array[m];
      }
    }

    return merged;
  };

  function min(array, f) {
    var i = -1,
        n = array.length,
        a,
        b;

    if (arguments.length === 1) {
      while (++i < n) if ((b = array[i]) != null && b >= b) { a = b; break; }
      while (++i < n) if ((b = array[i]) != null && a > b) a = b;
    }

    else {
      while (++i < n) if ((b = f(array[i], i, array)) != null && b >= b) { a = b; break; }
      while (++i < n) if ((b = f(array[i], i, array)) != null && a > b) a = b;
    }

    return a;
  };

  function nest() {
    var keys = [],
        sortKeys = [],
        sortValues,
        rollup,
        nest;

    function apply(array, depth, createResult, setResult) {
      if (depth >= keys.length) return rollup
          ? rollup(array) : (sortValues
          ? array.sort(sortValues)
          : array);

      var i = -1,
          n = array.length,
          key = keys[depth++],
          keyValue,
          value,
          valuesByKey = map(),
          values,
          result = createResult();

      while (++i < n) {
        if (values = valuesByKey.get(keyValue = key(value = array[i]) + "")) {
          values.push(value);
        } else {
          valuesByKey.set(keyValue, [value]);
        }
      }

      valuesByKey.each(function(values, key) {
        setResult(result, key, apply(values, depth, createResult, setResult));
      });

      return result;
    }

    function entries(map, depth) {
      if (depth >= keys.length) return map;

      var array = [],
          sortKey = sortKeys[depth++];

      map.each(function(value, key) {
        array.push({key: key, values: entries(value, depth)});
      });

      return sortKey
          ? array.sort(function(a, b) { return sortKey(a.key, b.key); })
          : array;
    }

    return nest = {
      object: function(array) { return apply(array, 0, createObject, setObject); },
      map: function(array) { return apply(array, 0, createMap, setMap); },
      entries: function(array) { return entries(apply(array, 0, createMap, setMap), 0); },
      key: function(d) { keys.push(d); return nest; },
      sortKeys: function(order) { sortKeys[keys.length - 1] = order; return nest; },
      sortValues: function(order) { sortValues = order; return nest; },
      rollup: function(f) { rollup = f; return nest; }
    };
  };

  function createObject() {
    return {};
  }

  function setObject(object, key, value) {
    object[key] = value;
  }

  function createMap() {
    return map();
  }

  function setMap(map, key, value) {
    map.set(key, value);
  }

  function pairs(array) {
    var i = 0, n = array.length - 1, p0, p1 = array[0], pairs = new Array(n < 0 ? 0 : n);
    while (i < n) pairs[i] = [p0 = p1, p1 = array[++i]];
    return pairs;
  };

  function permute(array, indexes) {
    var i = indexes.length, permutes = new Array(i);
    while (i--) permutes[i] = array[indexes[i]];
    return permutes;
  };

  function range(start, stop, step) {
    if ((n = arguments.length) < 3) {
      step = 1;
      if (n < 2) {
        stop = start;
        start = 0;
      }
    }

    var i = -1,
        n = Math.max(0, Math.ceil((stop - start) / step)) | 0,
        range = new Array(n);

    while (++i < n) {
      range[i] = start + i * step;
    }

    return range;
  };

  function Set() {}

  var proto = map.prototype;

  Set.prototype = set.prototype = {
    has: proto.has,
    add: function(value) {
      value += "";
      this[prefix + value] = value;
      return this;
    },
    remove: proto.remove,
    clear: proto.clear,
    values: proto.keys,
    size: proto.size,
    empty: proto.empty,
    each: proto.each
  };

  function set(object) {
    var set = new Set;

    // Copy constructor.
    if (object instanceof Set) object.each(function(value) { set.add(value); });

    // Otherwise, assume it’s an array.
    else if (object) for (var i = 0, n = object.length; i < n; ++i) set.add(object[i]);

    return set;
  }

  function shuffle(array, i0, i1) {
    if ((m = arguments.length) < 3) {
      i1 = array.length;
      if (m < 2) i0 = 0;
    }

    var m = i1 - i0,
        t,
        i;

    while (m) {
      i = Math.random() * m-- | 0;
      t = array[m + i0];
      array[m + i0] = array[i + i0];
      array[i + i0] = t;
    }

    return array;
  };

  function sum(array, f) {
    var s = 0,
        n = array.length,
        a,
        i = -1;

    if (arguments.length === 1) {
      while (++i < n) if (!isNaN(a = +array[i])) s += a; // Note: zero and null are equivalent.
    }

    else {
      while (++i < n) if (!isNaN(a = +f(array[i], i, array))) s += a;
    }

    return s;
  };

  function transpose(matrix) {
    if (!(n = matrix.length)) return [];
    for (var i = -1, m = min(matrix, length), transpose = new Array(m); ++i < m;) {
      for (var j = -1, n, row = transpose[i] = new Array(n); ++j < n;) {
        row[j] = matrix[j][i];
      }
    }
    return transpose;
  };

  function length(d) {
    return d.length;
  }

  function values(map) {
    var values = [];
    for (var key in map) values.push(map[key]);
    return values;
  };

  function zip() {
    return transpose(arguments);
  };

  var version = "0.4.0";

  exports.version = version;
  exports.bisect = bisectRight;
  exports.bisectRight = bisectRight;
  exports.bisectLeft = bisectLeft;
  exports.ascending = ascending;
  exports.bisector = bisector;
  exports.descending = descending;
  exports.deviation = deviation;
  exports.entries = entries;
  exports.extent = extent;
  exports.keys = keys;
  exports.map = map;
  exports.max = max;
  exports.mean = mean;
  exports.median = median;
  exports.merge = merge;
  exports.min = min;
  exports.nest = nest;
  exports.pairs = pairs;
  exports.permute = permute;
  exports.quantile = quantile;
  exports.range = range;
  exports.set = set;
  exports.shuffle = shuffle;
  exports.sum = sum;
  exports.transpose = transpose;
  exports.values = values;
  exports.variance = variance;
  exports.zip = zip;

}));
},{}],10:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define('d3-color', ['exports'], factory) :
  factory((global.d3_color = {}));
}(this, function (exports) { 'use strict';

  function Color() {};

  var reHex3 = /^#([0-9a-f]{3})$/;
  var reHex6 = /^#([0-9a-f]{6})$/;
  var reRgbInteger = /^rgb\(\s*([-+]?\d+)\s*,\s*([-+]?\d+)\s*,\s*([-+]?\d+)\s*\)$/;
  var reRgbPercent = /^rgb\(\s*([-+]?\d+(?:\.\d+)?)%\s*,\s*([-+]?\d+(?:\.\d+)?)%\s*,\s*([-+]?\d+(?:\.\d+)?)%\s*\)$/;
  var reHslPercent = /^hsl\(\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)%\s*,\s*([-+]?\d+(?:\.\d+)?)%\s*\)$/;
  color.prototype = Color.prototype = {
    displayable: function() {
      return this.rgb().displayable();
    },
    toString: function() {
      return this.rgb() + "";
    }
  };

  function color(format) {
    var m;
    format = (format + "").trim().toLowerCase();
    return (m = reHex3.exec(format)) ? (m = parseInt(m[1], 16), rgb((m >> 8 & 0xf) | (m >> 4 & 0x0f0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf))) // #f00
        : (m = reHex6.exec(format)) ? rgbn(parseInt(m[1], 16)) // #ff0000
        : (m = reRgbInteger.exec(format)) ? rgb(m[1], m[2], m[3]) // rgb(255,0,0)
        : (m = reRgbPercent.exec(format)) ? rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100) // rgb(100%,0%,0%)
        : (m = reHslPercent.exec(format)) ? hsl(m[1], m[2] / 100, m[3] / 100) // hsl(120,50%,50%)
        : named.hasOwnProperty(format) ? rgbn(named[format])
        : null;
  };

  function rgbn(n) {
    return rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff);
  }

  var named = {
    aliceblue: 0xf0f8ff,
    antiquewhite: 0xfaebd7,
    aqua: 0x00ffff,
    aquamarine: 0x7fffd4,
    azure: 0xf0ffff,
    beige: 0xf5f5dc,
    bisque: 0xffe4c4,
    black: 0x000000,
    blanchedalmond: 0xffebcd,
    blue: 0x0000ff,
    blueviolet: 0x8a2be2,
    brown: 0xa52a2a,
    burlywood: 0xdeb887,
    cadetblue: 0x5f9ea0,
    chartreuse: 0x7fff00,
    chocolate: 0xd2691e,
    coral: 0xff7f50,
    cornflowerblue: 0x6495ed,
    cornsilk: 0xfff8dc,
    crimson: 0xdc143c,
    cyan: 0x00ffff,
    darkblue: 0x00008b,
    darkcyan: 0x008b8b,
    darkgoldenrod: 0xb8860b,
    darkgray: 0xa9a9a9,
    darkgreen: 0x006400,
    darkgrey: 0xa9a9a9,
    darkkhaki: 0xbdb76b,
    darkmagenta: 0x8b008b,
    darkolivegreen: 0x556b2f,
    darkorange: 0xff8c00,
    darkorchid: 0x9932cc,
    darkred: 0x8b0000,
    darksalmon: 0xe9967a,
    darkseagreen: 0x8fbc8f,
    darkslateblue: 0x483d8b,
    darkslategray: 0x2f4f4f,
    darkslategrey: 0x2f4f4f,
    darkturquoise: 0x00ced1,
    darkviolet: 0x9400d3,
    deeppink: 0xff1493,
    deepskyblue: 0x00bfff,
    dimgray: 0x696969,
    dimgrey: 0x696969,
    dodgerblue: 0x1e90ff,
    firebrick: 0xb22222,
    floralwhite: 0xfffaf0,
    forestgreen: 0x228b22,
    fuchsia: 0xff00ff,
    gainsboro: 0xdcdcdc,
    ghostwhite: 0xf8f8ff,
    gold: 0xffd700,
    goldenrod: 0xdaa520,
    gray: 0x808080,
    green: 0x008000,
    greenyellow: 0xadff2f,
    grey: 0x808080,
    honeydew: 0xf0fff0,
    hotpink: 0xff69b4,
    indianred: 0xcd5c5c,
    indigo: 0x4b0082,
    ivory: 0xfffff0,
    khaki: 0xf0e68c,
    lavender: 0xe6e6fa,
    lavenderblush: 0xfff0f5,
    lawngreen: 0x7cfc00,
    lemonchiffon: 0xfffacd,
    lightblue: 0xadd8e6,
    lightcoral: 0xf08080,
    lightcyan: 0xe0ffff,
    lightgoldenrodyellow: 0xfafad2,
    lightgray: 0xd3d3d3,
    lightgreen: 0x90ee90,
    lightgrey: 0xd3d3d3,
    lightpink: 0xffb6c1,
    lightsalmon: 0xffa07a,
    lightseagreen: 0x20b2aa,
    lightskyblue: 0x87cefa,
    lightslategray: 0x778899,
    lightslategrey: 0x778899,
    lightsteelblue: 0xb0c4de,
    lightyellow: 0xffffe0,
    lime: 0x00ff00,
    limegreen: 0x32cd32,
    linen: 0xfaf0e6,
    magenta: 0xff00ff,
    maroon: 0x800000,
    mediumaquamarine: 0x66cdaa,
    mediumblue: 0x0000cd,
    mediumorchid: 0xba55d3,
    mediumpurple: 0x9370db,
    mediumseagreen: 0x3cb371,
    mediumslateblue: 0x7b68ee,
    mediumspringgreen: 0x00fa9a,
    mediumturquoise: 0x48d1cc,
    mediumvioletred: 0xc71585,
    midnightblue: 0x191970,
    mintcream: 0xf5fffa,
    mistyrose: 0xffe4e1,
    moccasin: 0xffe4b5,
    navajowhite: 0xffdead,
    navy: 0x000080,
    oldlace: 0xfdf5e6,
    olive: 0x808000,
    olivedrab: 0x6b8e23,
    orange: 0xffa500,
    orangered: 0xff4500,
    orchid: 0xda70d6,
    palegoldenrod: 0xeee8aa,
    palegreen: 0x98fb98,
    paleturquoise: 0xafeeee,
    palevioletred: 0xdb7093,
    papayawhip: 0xffefd5,
    peachpuff: 0xffdab9,
    peru: 0xcd853f,
    pink: 0xffc0cb,
    plum: 0xdda0dd,
    powderblue: 0xb0e0e6,
    purple: 0x800080,
    rebeccapurple: 0x663399,
    red: 0xff0000,
    rosybrown: 0xbc8f8f,
    royalblue: 0x4169e1,
    saddlebrown: 0x8b4513,
    salmon: 0xfa8072,
    sandybrown: 0xf4a460,
    seagreen: 0x2e8b57,
    seashell: 0xfff5ee,
    sienna: 0xa0522d,
    silver: 0xc0c0c0,
    skyblue: 0x87ceeb,
    slateblue: 0x6a5acd,
    slategray: 0x708090,
    slategrey: 0x708090,
    snow: 0xfffafa,
    springgreen: 0x00ff7f,
    steelblue: 0x4682b4,
    tan: 0xd2b48c,
    teal: 0x008080,
    thistle: 0xd8bfd8,
    tomato: 0xff6347,
    turquoise: 0x40e0d0,
    violet: 0xee82ee,
    wheat: 0xf5deb3,
    white: 0xffffff,
    whitesmoke: 0xf5f5f5,
    yellow: 0xffff00,
    yellowgreen: 0x9acd32
  };

  var darker = .7;
  var brighter = 1 / darker;

  function rgb(r, g, b) {
    if (arguments.length === 1) {
      if (!(r instanceof Color)) r = color(r);
      if (r) {
        r = r.rgb();
        b = r.b;
        g = r.g;
        r = r.r;
      } else {
        r = g = b = NaN;
      }
    }
    return new Rgb(r, g, b);
  };

  function Rgb(r, g, b) {
    this.r = +r;
    this.g = +g;
    this.b = +b;
  };

  var prototype = rgb.prototype = Rgb.prototype = new Color;

  prototype.brighter = function(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k);
  };

  prototype.darker = function(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k);
  };

  prototype.rgb = function() {
    return this;
  };

  prototype.displayable = function() {
    return (0 <= this.r && this.r <= 255)
        && (0 <= this.g && this.g <= 255)
        && (0 <= this.b && this.b <= 255);
  };

  prototype.toString = function() {
    var r = Math.round(this.r),
        g = Math.round(this.g),
        b = Math.round(this.b);
    return "#"
        + (isNaN(r) || r <= 0 ? "00" : r < 16 ? "0" + r.toString(16) : r >= 255 ? "ff" : r.toString(16))
        + (isNaN(g) || g <= 0 ? "00" : g < 16 ? "0" + g.toString(16) : g >= 255 ? "ff" : g.toString(16))
        + (isNaN(b) || b <= 0 ? "00" : b < 16 ? "0" + b.toString(16) : b >= 255 ? "ff" : b.toString(16));
  };

  function hsl(h, s, l) {
    if (arguments.length === 1) {
      if (h instanceof Hsl) {
        l = h.l;
        s = h.s;
        h = h.h;
      } else {
        if (!(h instanceof Color)) h = color(h);
        if (h) {
          if (h instanceof Hsl) return h;
          h = h.rgb();
          var r = h.r / 255,
              g = h.g / 255,
              b = h.b / 255,
              min = Math.min(r, g, b),
              max = Math.max(r, g, b),
              range = max - min;
          l = (max + min) / 2;
          if (range) {
            s = l < .5 ? range / (max + min) : range / (2 - max - min);
            if (r === max) h = (g - b) / range + (g < b) * 6;
            else if (g === max) h = (b - r) / range + 2;
            else h = (r - g) / range + 4;
            h *= 60;
          } else {
            h = NaN;
            s = l > 0 && l < 1 ? 0 : h;
          }
        } else {
          h = s = l = NaN;
        }
      }
    }
    return new Hsl(h, s, l);
  };

  function Hsl(h, s, l) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
  };

  var prototype$1 = hsl.prototype = Hsl.prototype = new Color;

  prototype$1.brighter = function(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k);
  };

  prototype$1.darker = function(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k);
  };

  prototype$1.rgb = function() {
    var h = this.h % 360 + (this.h < 0) * 360,
        s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
        l = this.l,
        m2 = l + (l < .5 ? l : 1 - l) * s,
        m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2)
    );
  };

  prototype$1.displayable = function() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s))
        && (0 <= this.l && this.l <= 1);
  };

  /* From FvD 13.37, CSS Color Module Level 3 */
  function hsl2rgb(h, m1, m2) {
    return (h < 60 ? m1 + (m2 - m1) * h / 60
        : h < 180 ? m2
        : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
        : m1) * 255;
  }

  var deg2rad = Math.PI / 180;
  var rad2deg = 180 / Math.PI;

  function hcl(h, c, l) {
    if (arguments.length === 1) {
      if (h instanceof Hcl) {
        l = h.l;
        c = h.c;
        h = h.h;
      } else {
        if (!(h instanceof Lab)) h = lab(h);
        l = h.l;
        c = Math.sqrt(h.a * h.a + h.b * h.b);
        h = Math.atan2(h.b, h.a) * rad2deg;
        if (h < 0) h += 360;
      }
    }
    return new Hcl(h, c, l);
  };

  function Hcl(h, c, l) {
    this.h = +h;
    this.c = +c;
    this.l = +l;
  };

  var prototype$3 = hcl.prototype = Hcl.prototype = new Color;

  prototype$3.brighter = function(k) {
    return new Hcl(this.h, this.c, this.l + Kn * (k == null ? 1 : k));
  };

  prototype$3.darker = function(k) {
    return new Hcl(this.h, this.c, this.l - Kn * (k == null ? 1 : k));
  };

  prototype$3.rgb = function() {
    return lab(this).rgb();
  };

  var Kn = 18;

  var Xn = 0.950470;
  var Yn = 1;
  var Zn = 1.088830;
  var t0 = 4 / 29;
  var t1 = 6 / 29;
  var t2 = 3 * t1 * t1;
  var t3 = t1 * t1 * t1;
  function lab(l, a, b) {
    if (arguments.length === 1) {
      if (l instanceof Lab) {
        b = l.b;
        a = l.a;
        l = l.l;
      } else if (l instanceof Hcl) {
        var h = l.h * deg2rad;
        b = Math.sin(h) * l.c;
        a = Math.cos(h) * l.c;
        l = l.l;
      } else {
        if (!(l instanceof Rgb)) l = rgb(l);
        var r = rgb2xyz(l.r),
            g = rgb2xyz(l.g),
            b = rgb2xyz(l.b),
            x = xyz2lab((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / Xn),
            y = xyz2lab((0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / Yn),
            z = xyz2lab((0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / Zn);
        b = 200 * (y - z);
        a = 500 * (x - y);
        l = 116 * y - 16;
      }
    }
    return new Lab(l, a, b);
  };

  function Lab(l, a, b) {
    this.l = +l;
    this.a = +a;
    this.b = +b;
  };

  var prototype$2 = lab.prototype = Lab.prototype = new Color;

  prototype$2.brighter = function(k) {
    return new Lab(this.l + Kn * (k == null ? 1 : k), this.a, this.b);
  };

  prototype$2.darker = function(k) {
    return new Lab(this.l - Kn * (k == null ? 1 : k), this.a, this.b);
  };

  prototype$2.rgb = function() {
    var y = (this.l + 16) / 116,
        x = isNaN(this.a) ? y : y + this.a / 500,
        z = isNaN(this.b) ? y : y - this.b / 200;
    y = Yn * lab2xyz(y);
    x = Xn * lab2xyz(x);
    z = Zn * lab2xyz(z);
    return new Rgb(
      xyz2rgb( 3.2404542 * x - 1.5371385 * y - 0.4985314 * z), // D65 -> sRGB
      xyz2rgb(-0.9692660 * x + 1.8760108 * y + 0.0415560 * z),
      xyz2rgb( 0.0556434 * x - 0.2040259 * y + 1.0572252 * z)
    );
  };

  function xyz2lab(t) {
    return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
  }

  function lab2xyz(t) {
    return t > t1 ? t * t * t : t2 * (t - t0);
  }

  function xyz2rgb(x) {
    return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
  }

  function rgb2xyz(x) {
    return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }

  var A = -0.14861;
  var B = +1.78277;
  var C = -0.29227;
  var D = -0.90649;
  var E = +1.97294;
  var ED = E * D;
  var EB = E * B;
  var BC_DA = B * C - D * A;
  function cubehelix(h, s, l) {
    if (arguments.length === 1) {
      if (h instanceof Cubehelix) {
        l = h.l;
        s = h.s;
        h = h.h;
      } else {
        if (!(h instanceof Rgb)) h = rgb(h);
        var r = h.r / 255, g = h.g / 255, b = h.b / 255;
        l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB);
        var bl = b - l, k = (E * (g - l) - C * bl) / D;
        s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)); // NaN if l=0 or l=1
        h = s ? Math.atan2(k, bl) * rad2deg - 120 : NaN;
        if (h < 0) h += 360;
      }
    }
    return new Cubehelix(h, s, l);
  };

  function Cubehelix(h, s, l) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
  };

  var prototype$4 = cubehelix.prototype = Cubehelix.prototype = new Color;

  prototype$4.brighter = function(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Cubehelix(this.h, this.s, this.l * k);
  };

  prototype$4.darker = function(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Cubehelix(this.h, this.s, this.l * k);
  };

  prototype$4.rgb = function() {
    var h = isNaN(this.h) ? 0 : (this.h + 120) * deg2rad,
        l = +this.l,
        a = isNaN(this.s) ? 0 : this.s * l * (1 - l),
        cosh = Math.cos(h),
        sinh = Math.sin(h);
    return new Rgb(
      255 * (l + a * (A * cosh + B * sinh)),
      255 * (l + a * (C * cosh + D * sinh)),
      255 * (l + a * (E * cosh))
    );
  };

  var version = "0.3.1";

  exports.version = version;
  exports.color = color;
  exports.rgb = rgb;
  exports.hsl = hsl;
  exports.lab = lab;
  exports.hcl = hcl;
  exports.cubehelix = cubehelix;

}));
},{}],11:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define('d3-format', ['exports'], factory) :
  factory((global.d3_format = {}));
}(this, function (exports) { 'use strict';

  // Computes the decimal coefficient and exponent of the specified number x with
  // significant digits p, where x is positive and p is in [1, 21] or undefined.
  // For example, formatDecimal(1.23) returns ["123", 0].
  function formatDecimal(x, p) {
    if ((i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e")) < 0) return null; // NaN, ±Infinity
    var i, coefficient = x.slice(0, i);

    // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
    // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
    return [
      coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
      +x.slice(i + 1)
    ];
  };

  function exponent(x) {
    return x = formatDecimal(Math.abs(x)), x ? x[1] : NaN;
  };

  function formatGroup(grouping, thousands) {
    return function(value, width) {
      var i = value.length,
          t = [],
          j = 0,
          g = grouping[0],
          length = 0;

      while (i > 0 && g > 0) {
        if (length + g + 1 > width) g = Math.max(1, width - length);
        t.push(value.substring(i -= g, i + g));
        if ((length += g + 1) > width) break;
        g = grouping[j = (j + 1) % grouping.length];
      }

      return t.reverse().join(thousands);
    };
  };

  var prefixExponent;

  function formatPrefixAuto(x, p) {
    var d = formatDecimal(x, p);
    if (!d) return x + "";
    var coefficient = d[0],
        exponent = d[1],
        i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
        n = coefficient.length;
    return i === n ? coefficient
        : i > n ? coefficient + new Array(i - n + 1).join("0")
        : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
        : "0." + new Array(1 - i).join("0") + formatDecimal(x, Math.max(0, p + i - 1))[0]; // less than 1y!
  };

  function formatRounded(x, p) {
    var d = formatDecimal(x, p);
    if (!d) return x + "";
    var coefficient = d[0],
        exponent = d[1];
    return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
        : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
        : coefficient + new Array(exponent - coefficient.length + 2).join("0");
  };

  function formatDefault(x, p) {
    x = x.toPrecision(p);

    out: for (var n = x.length, i = 1, i0 = -1, i1; i < n; ++i) {
      switch (x[i]) {
        case ".": i0 = i1 = i; break;
        case "0": if (i0 === 0) i0 = i; i1 = i; break;
        case "e": break out;
        default: if (i0 > 0) i0 = 0; break;
      }
    }

    return i0 > 0 ? x.slice(0, i0) + x.slice(i1 + 1) : x;
  };

  var formatTypes = {
    "": formatDefault,
    "%": function(x, p) { return (x * 100).toFixed(p); },
    "b": function(x) { return Math.round(x).toString(2); },
    "c": function(x) { return x + ""; },
    "d": function(x) { return Math.round(x).toString(10); },
    "e": function(x, p) { return x.toExponential(p); },
    "f": function(x, p) { return x.toFixed(p); },
    "g": function(x, p) { return x.toPrecision(p); },
    "o": function(x) { return Math.round(x).toString(8); },
    "p": function(x, p) { return formatRounded(x * 100, p); },
    "r": formatRounded,
    "s": formatPrefixAuto,
    "X": function(x) { return Math.round(x).toString(16).toUpperCase(); },
    "x": function(x) { return Math.round(x).toString(16); }
  };

  // [[fill]align][sign][symbol][0][width][,][.precision][type]
  var re = /^(?:(.)?([<>=^]))?([+\-\( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?([a-z%])?$/i;

  function formatSpecifier(specifier) {
    return new FormatSpecifier(specifier);
  };

  function FormatSpecifier(specifier) {
    if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);

    var match,
        fill = match[1] || " ",
        align = match[2] || ">",
        sign = match[3] || "-",
        symbol = match[4] || "",
        zero = !!match[5],
        width = match[6] && +match[6],
        comma = !!match[7],
        precision = match[8] && +match[8].slice(1),
        type = match[9] || "";

    // The "n" type is an alias for ",g".
    if (type === "n") comma = true, type = "g";

    // Map invalid types to the default format.
    else if (!formatTypes[type]) type = "";

    // If zero fill is specified, padding goes after sign and before digits.
    if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

    this.fill = fill;
    this.align = align;
    this.sign = sign;
    this.symbol = symbol;
    this.zero = zero;
    this.width = width;
    this.comma = comma;
    this.precision = precision;
    this.type = type;
  }

  FormatSpecifier.prototype.toString = function() {
    return this.fill
        + this.align
        + this.sign
        + this.symbol
        + (this.zero ? "0" : "")
        + (this.width == null ? "" : Math.max(1, this.width | 0))
        + (this.comma ? "," : "")
        + (this.precision == null ? "" : "." + Math.max(0, this.precision | 0))
        + this.type;
  };

  var prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

  function identity(x) {
    return x;
  }

  function locale(locale) {
    var group = locale.grouping && locale.thousands ? formatGroup(locale.grouping, locale.thousands) : identity,
        currency = locale.currency,
        decimal = locale.decimal;

    function format(specifier) {
      specifier = formatSpecifier(specifier);

      var fill = specifier.fill,
          align = specifier.align,
          sign = specifier.sign,
          symbol = specifier.symbol,
          zero = specifier.zero,
          width = specifier.width,
          comma = specifier.comma,
          precision = specifier.precision,
          type = specifier.type;

      // Compute the prefix and suffix.
      // For SI-prefix, the suffix is lazily computed.
      var prefix = symbol === "$" ? currency[0] : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : "",
          suffix = symbol === "$" ? currency[1] : /[%p]/.test(type) ? "%" : "";

      // What format function should we use?
      // Is this an integer type?
      // Can this type generate exponential notation?
      var formatType = formatTypes[type],
          maybeSuffix = !type || /[defgprs%]/.test(type);

      // Set the default precision if not specified,
      // or clamp the specified precision to the supported range.
      // For significant precision, it must be in [1, 21].
      // For fixed precision, it must be in [0, 20].
      precision = precision == null ? (type ? 6 : 12)
          : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
          : Math.max(0, Math.min(20, precision));

      return function(value) {
        var valuePrefix = prefix,
            valueSuffix = suffix;

        if (type === "c") {
          valueSuffix = formatType(value) + valueSuffix;
          value = "";
        } else {
          value = +value;

          // Convert negative to positive, and compute the prefix.
          // Note that -0 is not less than 0, but 1 / -0 is!
          var valueNegative = (value < 0 || 1 / value < 0) && (value *= -1, true);

          // Perform the initial formatting.
          value = formatType(value, precision);

          // If the original value was negative, it may be rounded to zero during
          // formatting; treat this as (positive) zero.
          if (valueNegative) {
            var i = -1, n = value.length, c;
            valueNegative = false;
            while (++i < n) {
              if (c = value.charCodeAt(i), (48 < c && c < 58)
                  || (type === "x" && 96 < c && c < 103)
                  || (type === "X" && 64 < c && c < 71)) {
                valueNegative = true;
                break;
              }
            }
          }

          // Compute the prefix and suffix.
          valuePrefix = (valueNegative ? (sign === "(" ? sign : "-") : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
          valueSuffix = valueSuffix + (type === "s" ? prefixes[8 + prefixExponent / 3] : "") + (valueNegative && sign === "(" ? ")" : "");

          // Break the formatted value into the integer “value” part that can be
          // grouped, and fractional or exponential “suffix” part that is not.
          if (maybeSuffix) {
            var i = -1, n = value.length, c;
            while (++i < n) {
              if (c = value.charCodeAt(i), 48 > c || c > 57) {
                valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
                value = value.slice(0, i);
                break;
              }
            }
          }
        }

        // If the fill character is not "0", grouping is applied before padding.
        if (comma && !zero) value = group(value, Infinity);

        // Compute the padding.
        var length = valuePrefix.length + value.length + valueSuffix.length,
            padding = length < width ? new Array(width - length + 1).join(fill) : "";

        // If the fill character is "0", grouping is applied after padding.
        if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

        // Reconstruct the final output based on the desired alignment.
        switch (align) {
          case "<": return valuePrefix + value + valueSuffix + padding;
          case "=": return valuePrefix + padding + value + valueSuffix;
          case "^": return padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length);
        }
        return padding + valuePrefix + value + valueSuffix;
      };
    }

    function formatPrefix(specifier, value) {
      var f = format((specifier = formatSpecifier(specifier), specifier.type = "f", specifier)),
          e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
          k = Math.pow(10, -e),
          prefix = prefixes[8 + e / 3];
      return function(value) {
        return f(k * value) + prefix;
      };
    }

    return {
      format: format,
      formatPrefix: formatPrefix
    };
  };

  var defaultLocale = locale({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    currency: ["$", ""]
  });

  var caES = locale({
    decimal: ",",
    thousands: ".",
    grouping: [3],
    currency: ["", "\xa0€"]
  });

  var deCH = locale({
    decimal: ",",
    thousands: "'",
    grouping: [3],
    currency: ["", "\xa0CHF"]
  });

  var deDE = locale({
    decimal: ",",
    thousands: ".",
    grouping: [3],
    currency: ["", "\xa0€"]
  });

  var enCA = locale({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    currency: ["$", ""]
  });

  var enGB = locale({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    currency: ["£", ""]
  });

  var esES = locale({
    decimal: ",",
    thousands: ".",
    grouping: [3],
    currency: ["", "\xa0€"]
  });

  var fiFI = locale({
    decimal: ",",
    thousands: "\xa0",
    grouping: [3],
    currency: ["", "\xa0€"]
  });

  var frCA = locale({
    decimal: ",",
    thousands: "\xa0",
    grouping: [3],
    currency: ["", "$"]
  });

  var frFR = locale({
    decimal: ",",
    thousands: ".",
    grouping: [3],
    currency: ["", "\xa0€"]
  });

  var heIL = locale({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    currency: ["₪", ""]
  });

  var huHU = locale({
    decimal: ",",
    thousands: "\xa0",
    grouping: [3],
    currency: ["", "\xa0Ft"]
  });

  var itIT = locale({
    decimal: ",",
    thousands: ".",
    grouping: [3],
    currency: ["€", ""]
  });

  var jaJP = locale({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    currency: ["", "円"]
  });

  var koKR = locale({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    currency: ["₩", ""]
  });

  var mkMK = locale({
    decimal: ",",
    thousands: ".",
    grouping: [3],
    currency: ["", "\xa0ден."]
  });

  var nlNL = locale({
    decimal: ",",
    thousands: ".",
    grouping: [3],
    currency: ["€\xa0", ""]
  });

  var plPL = locale({
    decimal: ",",
    thousands: ".",
    grouping: [3],
    currency: ["", "zł"]
  });

  var ptBR = locale({
    decimal: ",",
    thousands: ".",
    grouping: [3],
    currency: ["R$", ""]
  });

  var ruRU = locale({
    decimal: ",",
    thousands: "\xa0",
    grouping: [3],
    currency: ["", "\xa0руб."]
  });

  var svSE = locale({
    decimal: ",",
    thousands: "\xa0",
    grouping: [3],
    currency: ["", "SEK"]
  });

  var zhCN = locale({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    currency: ["¥", ""]
  });

  function precisionFixed(step) {
    return Math.max(0, -exponent(Math.abs(step)));
  };

  function precisionPrefix(step, value) {
    return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3 - exponent(Math.abs(step)));
  };

  function precisionRound(step, max) {
    return Math.max(0, exponent(Math.abs(max)) - exponent(Math.abs(step))) + 1;
  };

  var format = defaultLocale.format;
  var formatPrefix = defaultLocale.formatPrefix;

  var version = "0.4.0";

  exports.version = version;
  exports.format = format;
  exports.formatPrefix = formatPrefix;
  exports.locale = locale;
  exports.localeCaEs = caES;
  exports.localeDeCh = deCH;
  exports.localeDeDe = deDE;
  exports.localeEnCa = enCA;
  exports.localeEnGb = enGB;
  exports.localeEnUs = defaultLocale;
  exports.localeEsEs = esES;
  exports.localeFiFi = fiFI;
  exports.localeFrCa = frCA;
  exports.localeFrFr = frFR;
  exports.localeHeIl = heIL;
  exports.localeHuHu = huHU;
  exports.localeItIt = itIT;
  exports.localeJaJp = jaJP;
  exports.localeKoKr = koKR;
  exports.localeMkMk = mkMK;
  exports.localeNlNl = nlNL;
  exports.localePlPl = plPL;
  exports.localePtBr = ptBR;
  exports.localeRuRu = ruRU;
  exports.localeSvSe = svSE;
  exports.localeZhCn = zhCN;
  exports.formatSpecifier = formatSpecifier;
  exports.precisionFixed = precisionFixed;
  exports.precisionPrefix = precisionPrefix;
  exports.precisionRound = precisionRound;

}));
},{}],12:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-color')) :
  typeof define === 'function' && define.amd ? define('d3-interpolate', ['exports', 'd3-color'], factory) :
  factory((global.d3_interpolate = {}),global.d3_color);
}(this, function (exports,d3Color) { 'use strict';

  function deltaHue(h1, h0) {
    var delta = h1 - h0;
    return delta > 180 || delta < -180
        ? delta - 360 * Math.round(delta / 360)
        : delta;
  };

  function cubehelixGamma(gamma) {
    return function(a, b) {
      a = d3Color.cubehelix(a);
      b = d3Color.cubehelix(b);
      var ah = isNaN(a.h) ? b.h : a.h,
          as = isNaN(a.s) ? b.s : a.s,
          al = a.l,
          bh = isNaN(b.h) ? 0 : deltaHue(b.h, ah),
          bs = isNaN(b.s) ? 0 : b.s - as,
          bl = b.l - al;
      return function(t) {
        a.h = ah + bh * t;
        a.s = as + bs * t;
        a.l = al + bl * Math.pow(t, gamma);
        return a + "";
      };
    };
  };

  function cubehelixGammaLong(gamma) {
    return function(a, b) {
      a = d3Color.cubehelix(a);
      b = d3Color.cubehelix(b);
      var ah = isNaN(a.h) ? b.h : a.h,
          as = isNaN(a.s) ? b.s : a.s,
          al = a.l,
          bh = isNaN(b.h) ? 0 : b.h - ah,
          bs = isNaN(b.s) ? 0 : b.s - as,
          bl = b.l - al;
      return function(t) {
        a.h = ah + bh * t;
        a.s = as + bs * t;
        a.l = al + bl * Math.pow(t, gamma);
        return a + "";
      };
    };
  };

  function rgb(a, b) {
    a = d3Color.rgb(a);
    b = d3Color.rgb(b);
    var ar = a.r,
        ag = a.g,
        ab = a.b,
        br = b.r - ar,
        bg = b.g - ag,
        bb = b.b - ab;
    return function(t) {
      a.r = ar + br * t;
      a.g = ag + bg * t;
      a.b = ab + bb * t;
      return a + "";
    };
  };

  function number(a, b) {
    return a = +a, b -= a, function(t) {
      return a + b * t;
    };
  };

  function object(a, b) {
    var i = {},
        c = {},
        k;

    for (k in a) {
      if (k in b) {
        i[k] = value(a[k], b[k]);
      } else {
        c[k] = a[k];
      }
    }

    for (k in b) {
      if (!(k in a)) {
        c[k] = b[k];
      }
    }

    return function(t) {
      for (k in i) c[k] = i[k](t);
      return c;
    };
  };

  var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
  var reB = new RegExp(reA.source, "g");
  function zero(b) {
    return function() {
      return b;
    };
  }

  function one(b) {
    return function(t) {
      return b(t) + "";
    };
  }

  function string(a, b) {
    var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
        am, // current match in a
        bm, // current match in b
        bs, // string preceding current number in b, if any
        i = -1, // index in s
        s = [], // string constants and placeholders
        q = []; // number interpolators

    // Coerce inputs to strings.
    a = a + "", b = b + "";

    // Interpolate pairs of numbers in a & b.
    while ((am = reA.exec(a))
        && (bm = reB.exec(b))) {
      if ((bs = bm.index) > bi) { // a string precedes the next number in b
        bs = b.slice(bi, bs);
        if (s[i]) s[i] += bs; // coalesce with previous string
        else s[++i] = bs;
      }
      if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
        if (s[i]) s[i] += bm; // coalesce with previous string
        else s[++i] = bm;
      } else { // interpolate non-matching numbers
        s[++i] = null;
        q.push({i: i, x: number(am, bm)});
      }
      bi = reB.lastIndex;
    }

    // Add remains of b.
    if (bi < b.length) {
      bs = b.slice(bi);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }

    // Special optimization for only a single match.
    // Otherwise, interpolate each of the numbers and rejoin the string.
    return s.length < 2 ? (q[0]
        ? one(q[0].x)
        : zero(b))
        : (b = q.length, function(t) {
            for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
            return s.join("");
          });
  };

  var values = [
    function(a, b) {
      var t = typeof b, c;
      return (t === "string" ? ((c = d3Color.color(b)) ? (b = c, rgb) : string)
          : b instanceof d3Color.color ? rgb
          : Array.isArray(b) ? array
          : t === "object" && isNaN(b) ? object
          : number)(a, b);
    }
  ];

  function value(a, b) {
    var i = values.length, f;
    while (--i >= 0 && !(f = values[i](a, b)));
    return f;
  };

  // TODO sparse arrays?
  function array(a, b) {
    var x = [],
        c = [],
        na = a.length,
        nb = b.length,
        n0 = Math.min(a.length, b.length),
        i;

    for (i = 0; i < n0; ++i) x.push(value(a[i], b[i]));
    for (; i < na; ++i) c[i] = a[i];
    for (; i < nb; ++i) c[i] = b[i];

    return function(t) {
      for (i = 0; i < n0; ++i) c[i] = x[i](t);
      return c;
    };
  };

  function round(a, b) {
    return a = +a, b -= a, function(t) {
      return Math.round(a + b * t);
    };
  };

  var rad2deg = 180 / Math.PI;
  var identity = {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0};
  var g;
  // Compute x-scale and normalize the first row.
  // Compute shear and make second row orthogonal to first.
  // Compute y-scale and normalize the second row.
  // Finally, compute the rotation.
  function Transform(string) {
    if (!g) g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    if (string) g.setAttribute("transform", string), t = g.transform.baseVal.consolidate();

    var t,
        m = t ? t.matrix : identity,
        r0 = [m.a, m.b],
        r1 = [m.c, m.d],
        kx = normalize(r0),
        kz = dot(r0, r1),
        ky = normalize(combine(r1, r0, -kz)) || 0;

    if (r0[0] * r1[1] < r1[0] * r0[1]) {
      r0[0] *= -1;
      r0[1] *= -1;
      kx *= -1;
      kz *= -1;
    }

    this.rotate = (kx ? Math.atan2(r0[1], r0[0]) : Math.atan2(-r1[0], r1[1])) * rad2deg;
    this.translate = [m.e, m.f];
    this.scale = [kx, ky];
    this.skew = ky ? Math.atan2(kz, ky) * rad2deg : 0;
  }

  function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1];
  }

  function normalize(a) {
    var k = Math.sqrt(dot(a, a));
    if (k) a[0] /= k, a[1] /= k;
    return k;
  }

  function combine(a, b, k) {
    a[0] += k * b[0];
    a[1] += k * b[1];
    return a;
  }

  function pop(s) {
    return s.length ? s.pop() + "," : "";
  }

  function translate(ta, tb, s, q) {
    if (ta[0] !== tb[0] || ta[1] !== tb[1]) {
      var i = s.push("translate(", null, ",", null, ")");
      q.push({i: i - 4, x: number(ta[0], tb[0])}, {i: i - 2, x: number(ta[1], tb[1])});
    } else if (tb[0] || tb[1]) {
      s.push("translate(" + tb + ")");
    }
  }

  function rotate(ra, rb, s, q) {
    if (ra !== rb) {
      if (ra - rb > 180) rb += 360; else if (rb - ra > 180) ra += 360; // shortest path
      q.push({i: s.push(pop(s) + "rotate(", null, ")") - 2, x: number(ra, rb)});
    } else if (rb) {
      s.push(pop(s) + "rotate(" + rb + ")");
    }
  }

  function skew(wa, wb, s, q) {
    if (wa !== wb) {
      q.push({i: s.push(pop(s) + "skewX(", null, ")") - 2, x: number(wa, wb)});
    } else if (wb) {
      s.push(pop(s) + "skewX(" + wb + ")");
    }
  }

  function scale(ka, kb, s, q) {
    if (ka[0] !== kb[0] || ka[1] !== kb[1]) {
      var i = s.push(pop(s) + "scale(", null, ",", null, ")");
      q.push({i: i - 4, x: number(ka[0], kb[0])}, {i: i - 2, x: number(ka[1], kb[1])});
    } else if (kb[0] !== 1 || kb[1] !== 1) {
      s.push(pop(s) + "scale(" + kb + ")");
    }
  }

  function transform(a, b) {
    var s = [], // string constants and placeholders
        q = []; // number interpolators
    a = new Transform(a), b = new Transform(b);
    translate(a.translate, b.translate, s, q);
    rotate(a.rotate, b.rotate, s, q);
    skew(a.skew, b.skew, s, q);
    scale(a.scale, b.scale, s, q);
    a = b = null; // gc
    return function(t) {
      var i = -1, n = q.length, o;
      while (++i < n) s[(o = q[i]).i] = o.x(t);
      return s.join("");
    };
  };

  var rho = Math.SQRT2;
  var rho2 = 2;
  var rho4 = 4;
  var epsilon2 = 1e-12;
  function cosh(x) {
    return ((x = Math.exp(x)) + 1 / x) / 2;
  }

  function sinh(x) {
    return ((x = Math.exp(x)) - 1 / x) / 2;
  }

  function tanh(x) {
    return ((x = Math.exp(2 * x)) - 1) / (x + 1);
  }

  // p0 = [ux0, uy0, w0]
  // p1 = [ux1, uy1, w1]
  function zoom(p0, p1) {
    var ux0 = p0[0], uy0 = p0[1], w0 = p0[2],
        ux1 = p1[0], uy1 = p1[1], w1 = p1[2],
        dx = ux1 - ux0,
        dy = uy1 - uy0,
        d2 = dx * dx + dy * dy,
        i,
        S;

    // Special case for u0 ≅ u1.
    if (d2 < epsilon2) {
      S = Math.log(w1 / w0) / rho;
      i = function(t) {
        return [
          ux0 + t * dx,
          uy0 + t * dy,
          w0 * Math.exp(rho * t * S)
        ];
      }
    }

    // General case.
    else {
      var d1 = Math.sqrt(d2),
          b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1),
          b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1),
          r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0),
          r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      S = (r1 - r0) / rho;
      i = function(t) {
        var s = t * S,
            coshr0 = cosh(r0),
            u = w0 / (rho2 * d1) * (coshr0 * tanh(rho * s + r0) - sinh(r0));
        return [
          ux0 + u * dx,
          uy0 + u * dy,
          w0 * coshr0 / cosh(rho * s + r0)
        ];
      }
    }

    i.duration = S * 1000;

    return i;
  };

  function hsl(a, b) {
    a = d3Color.hsl(a);
    b = d3Color.hsl(b);
    var ah = isNaN(a.h) ? b.h : a.h,
        as = isNaN(a.s) ? b.s : a.s,
        al = a.l,
        bh = isNaN(b.h) ? 0 : deltaHue(b.h, ah),
        bs = isNaN(b.s) ? 0 : b.s - as,
        bl = b.l - al;
    return function(t) {
      a.h = ah + bh * t;
      a.s = as + bs * t;
      a.l = al + bl * t;
      return a + "";
    };
  };

  function hslLong(a, b) {
    a = d3Color.hsl(a);
    b = d3Color.hsl(b);
    var ah = isNaN(a.h) ? b.h : a.h,
        as = isNaN(a.s) ? b.s : a.s,
        al = a.l,
        bh = isNaN(b.h) ? 0 : b.h - ah,
        bs = isNaN(b.s) ? 0 : b.s - as,
        bl = b.l - al;
    return function(t) {
      a.h = ah + bh * t;
      a.s = as + bs * t;
      a.l = al + bl * t;
      return a + "";
    };
  };

  function lab(a, b) {
    a = d3Color.lab(a);
    b = d3Color.lab(b);
    var al = a.l,
        aa = a.a,
        ab = a.b,
        bl = b.l - al,
        ba = b.a - aa,
        bb = b.b - ab;
    return function(t) {
      a.l = al + bl * t;
      a.a = aa + ba * t;
      a.b = ab + bb * t;
      return a + "";
    };
  };

  function hcl(a, b) {
    a = d3Color.hcl(a);
    b = d3Color.hcl(b);
    var ah = isNaN(a.h) ? b.h : a.h,
        ac = isNaN(a.c) ? b.c : a.c,
        al = a.l,
        bh = isNaN(b.h) ? 0 : deltaHue(b.h, ah),
        bc = isNaN(b.c) ? 0 : b.c - ac,
        bl = b.l - al;
    return function(t) {
      a.h = ah + bh * t;
      a.c = ac + bc * t;
      a.l = al + bl * t;
      return a + "";
    };
  };

  function hclLong(a, b) {
    a = d3Color.hcl(a);
    b = d3Color.hcl(b);
    var ah = isNaN(a.h) ? b.h : a.h,
        ac = isNaN(a.c) ? b.c : a.c,
        al = a.l,
        bh = isNaN(b.h) ? 0 : b.h - ah,
        bc = isNaN(b.c) ? 0 : b.c - ac,
        bl = b.l - al;
    return function(t) {
      a.h = ah + bh * t;
      a.c = ac + bc * t;
      a.l = al + bl * t;
      return a + "";
    };
  };

  var cubehelix = cubehelixGamma(1);
  var cubehelixLong = cubehelixGammaLong(1);

  var version = "0.2.0";

  exports.version = version;
  exports.cubehelix = cubehelix;
  exports.cubehelixLong = cubehelixLong;
  exports.cubehelixGamma = cubehelixGamma;
  exports.cubehelixGammaLong = cubehelixGammaLong;
  exports.array = array;
  exports.number = number;
  exports.object = object;
  exports.round = round;
  exports.string = string;
  exports.transform = transform;
  exports.values = values;
  exports.value = value;
  exports.zoom = zoom;
  exports.rgb = rgb;
  exports.hsl = hsl;
  exports.hslLong = hslLong;
  exports.lab = lab;
  exports.hcl = hcl;
  exports.hclLong = hclLong;

}));
},{"d3-color":10}],13:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-time')) :
  typeof define === 'function' && define.amd ? define('d3-time-format', ['exports', 'd3-time'], factory) :
  factory((global.d3_time_format = {}),global.d3_time);
}(this, function (exports,d3Time) { 'use strict';

  function localDate(d) {
    if (0 <= d.y && d.y < 100) {
      var date = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
      date.setFullYear(d.y);
      return date;
    }
    return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
  }

  function utcDate(d) {
    if (0 <= d.y && d.y < 100) {
      var date = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
      date.setUTCFullYear(d.y);
      return date;
    }
    return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
  }

  function newYear(y) {
    return {y: y, m: 0, d: 1, H: 0, M: 0, S: 0, L: 0};
  }

  function locale$1(locale) {
    var locale_dateTime = locale.dateTime,
        locale_date = locale.date,
        locale_time = locale.time,
        locale_periods = locale.periods,
        locale_weekdays = locale.days,
        locale_shortWeekdays = locale.shortDays,
        locale_months = locale.months,
        locale_shortMonths = locale.shortMonths;

    var periodRe = formatRe(locale_periods),
        periodLookup = formatLookup(locale_periods),
        weekdayRe = formatRe(locale_weekdays),
        weekdayLookup = formatLookup(locale_weekdays),
        shortWeekdayRe = formatRe(locale_shortWeekdays),
        shortWeekdayLookup = formatLookup(locale_shortWeekdays),
        monthRe = formatRe(locale_months),
        monthLookup = formatLookup(locale_months),
        shortMonthRe = formatRe(locale_shortMonths),
        shortMonthLookup = formatLookup(locale_shortMonths);

    var formats = {
      "a": formatShortWeekday,
      "A": formatWeekday,
      "b": formatShortMonth,
      "B": formatMonth,
      "c": null,
      "d": formatDayOfMonth,
      "e": formatDayOfMonth,
      "H": formatHour24,
      "I": formatHour12,
      "j": formatDayOfYear,
      "L": formatMilliseconds,
      "m": formatMonthNumber,
      "M": formatMinutes,
      "p": formatPeriod,
      "S": formatSeconds,
      "U": formatWeekNumberSunday,
      "w": formatWeekdayNumber,
      "W": formatWeekNumberMonday,
      "x": null,
      "X": null,
      "y": formatYear,
      "Y": formatFullYear,
      "Z": formatZone,
      "%": formatLiteralPercent
    };

    var utcFormats = {
      "a": formatUTCShortWeekday,
      "A": formatUTCWeekday,
      "b": formatUTCShortMonth,
      "B": formatUTCMonth,
      "c": null,
      "d": formatUTCDayOfMonth,
      "e": formatUTCDayOfMonth,
      "H": formatUTCHour24,
      "I": formatUTCHour12,
      "j": formatUTCDayOfYear,
      "L": formatUTCMilliseconds,
      "m": formatUTCMonthNumber,
      "M": formatUTCMinutes,
      "p": formatUTCPeriod,
      "S": formatUTCSeconds,
      "U": formatUTCWeekNumberSunday,
      "w": formatUTCWeekdayNumber,
      "W": formatUTCWeekNumberMonday,
      "x": null,
      "X": null,
      "y": formatUTCYear,
      "Y": formatUTCFullYear,
      "Z": formatUTCZone,
      "%": formatLiteralPercent
    };

    var parses = {
      "a": parseShortWeekday,
      "A": parseWeekday,
      "b": parseShortMonth,
      "B": parseMonth,
      "c": parseLocaleDateTime,
      "d": parseDayOfMonth,
      "e": parseDayOfMonth,
      "H": parseHour24,
      "I": parseHour24,
      "j": parseDayOfYear,
      "L": parseMilliseconds,
      "m": parseMonthNumber,
      "M": parseMinutes,
      "p": parsePeriod,
      "S": parseSeconds,
      "U": parseWeekNumberSunday,
      "w": parseWeekdayNumber,
      "W": parseWeekNumberMonday,
      "x": parseLocaleDate,
      "X": parseLocaleTime,
      "y": parseYear,
      "Y": parseFullYear,
      "Z": parseZone,
      "%": parseLiteralPercent
    };

    // These recursive directive definitions must be deferred.
    formats.x = newFormat(locale_date, formats);
    formats.X = newFormat(locale_time, formats);
    formats.c = newFormat(locale_dateTime, formats);
    utcFormats.x = newFormat(locale_date, utcFormats);
    utcFormats.X = newFormat(locale_time, utcFormats);
    utcFormats.c = newFormat(locale_dateTime, utcFormats);

    function newFormat(specifier, formats) {
      return function(date) {
        var string = [],
            i = -1,
            j = 0,
            n = specifier.length,
            c,
            pad,
            format;

        if (!(date instanceof Date)) date = new Date(+date);

        while (++i < n) {
          if (specifier.charCodeAt(i) === 37) {
            string.push(specifier.slice(j, i));
            if ((pad = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
            else pad = c === "e" ? " " : "0";
            if (format = formats[c]) c = format(date, pad);
            string.push(c);
            j = i + 1;
          }
        }

        string.push(specifier.slice(j, i));
        return string.join("");
      };
    }

    function newParse(specifier, newDate) {
      return function(string) {
        var d = newYear(1900),
            i = parseSpecifier(d, specifier, string += "", 0);
        if (i != string.length) return null;

        // The am-pm flag is 0 for AM, and 1 for PM.
        if ("p" in d) d.H = d.H % 12 + d.p * 12;

        // Convert day-of-week and week-of-year to day-of-year.
        if ("W" in d || "U" in d) {
          if (!("w" in d)) d.w = "W" in d ? 1 : 0;
          var day = "Z" in d ? utcDate(newYear(d.y)).getUTCDay() : newDate(newYear(d.y)).getDay();
          d.m = 0;
          d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day + 5) % 7 : d.w + d.U * 7 - (day + 6) % 7;
        }

        // If a time zone is specified, all fields are interpreted as UTC and then
        // offset according to the specified time zone.
        if ("Z" in d) {
          d.H += d.Z / 100 | 0;
          d.M += d.Z % 100;
          return utcDate(d);
        }

        // Otherwise, all fields are in local time.
        return newDate(d);
      };
    }

    function parseSpecifier(d, specifier, string, j) {
      var i = 0,
          n = specifier.length,
          m = string.length,
          c,
          parse;

      while (i < n) {
        if (j >= m) return -1;
        c = specifier.charCodeAt(i++);
        if (c === 37) {
          c = specifier.charAt(i++);
          parse = parses[c in pads ? specifier.charAt(i++) : c];
          if (!parse || ((j = parse(d, string, j)) < 0)) return -1;
        } else if (c != string.charCodeAt(j++)) {
          return -1;
        }
      }

      return j;
    }

    function parsePeriod(d, string, i) {
      var n = periodRe.exec(string.slice(i));
      return n ? (d.p = periodLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseShortWeekday(d, string, i) {
      var n = shortWeekdayRe.exec(string.slice(i));
      return n ? (d.w = shortWeekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseWeekday(d, string, i) {
      var n = weekdayRe.exec(string.slice(i));
      return n ? (d.w = weekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseShortMonth(d, string, i) {
      var n = shortMonthRe.exec(string.slice(i));
      return n ? (d.m = shortMonthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseMonth(d, string, i) {
      var n = monthRe.exec(string.slice(i));
      return n ? (d.m = monthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseLocaleDateTime(d, string, i) {
      return parseSpecifier(d, locale_dateTime, string, i);
    }

    function parseLocaleDate(d, string, i) {
      return parseSpecifier(d, locale_date, string, i);
    }

    function parseLocaleTime(d, string, i) {
      return parseSpecifier(d, locale_time, string, i);
    }

    function formatShortWeekday(d) {
      return locale_shortWeekdays[d.getDay()];
    }

    function formatWeekday(d) {
      return locale_weekdays[d.getDay()];
    }

    function formatShortMonth(d) {
      return locale_shortMonths[d.getMonth()];
    }

    function formatMonth(d) {
      return locale_months[d.getMonth()];
    }

    function formatPeriod(d) {
      return locale_periods[+(d.getHours() >= 12)];
    }

    function formatUTCShortWeekday(d) {
      return locale_shortWeekdays[d.getUTCDay()];
    }

    function formatUTCWeekday(d) {
      return locale_weekdays[d.getUTCDay()];
    }

    function formatUTCShortMonth(d) {
      return locale_shortMonths[d.getUTCMonth()];
    }

    function formatUTCMonth(d) {
      return locale_months[d.getUTCMonth()];
    }

    function formatUTCPeriod(d) {
      return locale_periods[+(d.getUTCHours() >= 12)];
    }

    return {
      format: function(specifier) {
        var f = newFormat(specifier += "", formats);
        f.parse = newParse(specifier, localDate);
        f.toString = function() { return specifier; };
        return f;
      },
      utcFormat: function(specifier) {
        var f = newFormat(specifier += "", utcFormats);
        f.parse = newParse(specifier, utcDate);
        f.toString = function() { return specifier; };
        return f;
      }
    };
  };

  var pads = {"-": "", "_": " ", "0": "0"};
  var numberRe = /^\s*\d+/;
  var percentRe = /^%/;
  var requoteRe = /[\\\^\$\*\+\?\|\[\]\(\)\.\{\}]/g;
  function pad(value, fill, width) {
    var sign = value < 0 ? "-" : "",
        string = (sign ? -value : value) + "",
        length = string.length;
    return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
  }

  function requote(s) {
    return s.replace(requoteRe, "\\$&");
  }

  function formatRe(names) {
    return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
  }

  function formatLookup(names) {
    var map = {}, i = -1, n = names.length;
    while (++i < n) map[names[i].toLowerCase()] = i;
    return map;
  }

  function parseWeekdayNumber(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.w = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberSunday(d, string, i) {
    var n = numberRe.exec(string.slice(i));
    return n ? (d.U = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberMonday(d, string, i) {
    var n = numberRe.exec(string.slice(i));
    return n ? (d.W = +n[0], i + n[0].length) : -1;
  }

  function parseFullYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 4));
    return n ? (d.y = +n[0], i + n[0].length) : -1;
  }

  function parseYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2000), i + n[0].length) : -1;
  }

  function parseZone(d, string, i) {
    var n = /^(Z)|([+-]\d\d)(?:\:?(\d\d))?/.exec(string.slice(i, i + 6));
    return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
  }

  function parseMonthNumber(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
  }

  function parseDayOfMonth(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.d = +n[0], i + n[0].length) : -1;
  }

  function parseDayOfYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 3));
    return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
  }

  function parseHour24(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.H = +n[0], i + n[0].length) : -1;
  }

  function parseMinutes(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.M = +n[0], i + n[0].length) : -1;
  }

  function parseSeconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.S = +n[0], i + n[0].length) : -1;
  }

  function parseMilliseconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 3));
    return n ? (d.L = +n[0], i + n[0].length) : -1;
  }

  function parseLiteralPercent(d, string, i) {
    var n = percentRe.exec(string.slice(i, i + 1));
    return n ? i + n[0].length : -1;
  }

  function formatDayOfMonth(d, p) {
    return pad(d.getDate(), p, 2);
  }

  function formatHour24(d, p) {
    return pad(d.getHours(), p, 2);
  }

  function formatHour12(d, p) {
    return pad(d.getHours() % 12 || 12, p, 2);
  }

  function formatDayOfYear(d, p) {
    return pad(1 + d3Time.day.count(d3Time.year(d), d), p, 3);
  }

  function formatMilliseconds(d, p) {
    return pad(d.getMilliseconds(), p, 3);
  }

  function formatMonthNumber(d, p) {
    return pad(d.getMonth() + 1, p, 2);
  }

  function formatMinutes(d, p) {
    return pad(d.getMinutes(), p, 2);
  }

  function formatSeconds(d, p) {
    return pad(d.getSeconds(), p, 2);
  }

  function formatWeekNumberSunday(d, p) {
    return pad(d3Time.sunday.count(d3Time.year(d), d), p, 2);
  }

  function formatWeekdayNumber(d) {
    return d.getDay();
  }

  function formatWeekNumberMonday(d, p) {
    return pad(d3Time.monday.count(d3Time.year(d), d), p, 2);
  }

  function formatYear(d, p) {
    return pad(d.getFullYear() % 100, p, 2);
  }

  function formatFullYear(d, p) {
    return pad(d.getFullYear() % 10000, p, 4);
  }

  function formatZone(d) {
    var z = d.getTimezoneOffset();
    return (z > 0 ? "-" : (z *= -1, "+"))
        + pad(z / 60 | 0, "0", 2)
        + pad(z % 60, "0", 2);
  }

  function formatUTCDayOfMonth(d, p) {
    return pad(d.getUTCDate(), p, 2);
  }

  function formatUTCHour24(d, p) {
    return pad(d.getUTCHours(), p, 2);
  }

  function formatUTCHour12(d, p) {
    return pad(d.getUTCHours() % 12 || 12, p, 2);
  }

  function formatUTCDayOfYear(d, p) {
    return pad(1 + d3Time.utcDay.count(d3Time.utcYear(d), d), p, 3);
  }

  function formatUTCMilliseconds(d, p) {
    return pad(d.getUTCMilliseconds(), p, 3);
  }

  function formatUTCMonthNumber(d, p) {
    return pad(d.getUTCMonth() + 1, p, 2);
  }

  function formatUTCMinutes(d, p) {
    return pad(d.getUTCMinutes(), p, 2);
  }

  function formatUTCSeconds(d, p) {
    return pad(d.getUTCSeconds(), p, 2);
  }

  function formatUTCWeekNumberSunday(d, p) {
    return pad(d3Time.utcSunday.count(d3Time.utcYear(d), d), p, 2);
  }

  function formatUTCWeekdayNumber(d) {
    return d.getUTCDay();
  }

  function formatUTCWeekNumberMonday(d, p) {
    return pad(d3Time.utcMonday.count(d3Time.utcYear(d), d), p, 2);
  }

  function formatUTCYear(d, p) {
    return pad(d.getUTCFullYear() % 100, p, 2);
  }

  function formatUTCFullYear(d, p) {
    return pad(d.getUTCFullYear() % 10000, p, 4);
  }

  function formatUTCZone() {
    return "+0000";
  }

  function formatLiteralPercent() {
    return "%";
  }

  var locale = locale$1({
    dateTime: "%a %b %e %X %Y",
    date: "%m/%d/%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  });

  var caES = locale$1({
    dateTime: "%A, %e de %B de %Y, %X",
    date: "%d/%m/%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"],
    days: ["diumenge", "dilluns", "dimarts", "dimecres", "dijous", "divendres", "dissabte"],
    shortDays: ["dg.", "dl.", "dt.", "dc.", "dj.", "dv.", "ds."],
    months: ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"],
    shortMonths: ["gen.", "febr.", "març", "abr.", "maig", "juny", "jul.", "ag.", "set.", "oct.", "nov.", "des."]
  });

  var deCH = locale$1({
    dateTime: "%A, der %e. %B %Y, %X",
    date: "%d.%m.%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"], // unused
    days: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
    shortDays: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    shortMonths: ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
  });

  var deDE = locale$1({
    dateTime: "%A, der %e. %B %Y, %X",
    date: "%d.%m.%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"], // unused
    days: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
    shortDays: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    shortMonths: ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
  });

  var enCA = locale$1({
    dateTime: "%a %b %e %X %Y",
    date: "%Y-%m-%d",
    time: "%H:%M:%S",
    periods: ["AM", "PM"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  });

  var enGB = locale$1({
    dateTime: "%a %e %b %X %Y",
    date: "%d/%m/%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  });

  var esES = locale$1({
    dateTime: "%A, %e de %B de %Y, %X",
    date: "%d/%m/%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"],
    days: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    shortDays: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    shortMonths: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
  });

  var fiFI = locale$1({
    dateTime: "%A, %-d. %Bta %Y klo %X",
    date: "%-d.%-m.%Y",
    time: "%H:%M:%S",
    periods: ["a.m.", "p.m."],
    days: ["sunnuntai", "maanantai", "tiistai", "keskiviikko", "torstai", "perjantai", "lauantai"],
    shortDays: ["Su", "Ma", "Ti", "Ke", "To", "Pe", "La"],
    months: ["tammikuu", "helmikuu", "maaliskuu", "huhtikuu", "toukokuu", "kesäkuu", "heinäkuu", "elokuu", "syyskuu", "lokakuu", "marraskuu", "joulukuu"],
    shortMonths: ["Tammi", "Helmi", "Maalis", "Huhti", "Touko", "Kesä", "Heinä", "Elo", "Syys", "Loka", "Marras", "Joulu"]
  });

  var frCA = locale$1({
    dateTime: "%a %e %b %Y %X",
    date: "%Y-%m-%d",
    time: "%H:%M:%S",
    periods: ["", ""],
    days: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
    shortDays: ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"],
    months: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    shortMonths: ["jan", "fév", "mar", "avr", "mai", "jui", "jul", "aoû", "sep", "oct", "nov", "déc"]
  });

  var frFR = locale$1({
    dateTime: "%A, le %e %B %Y, %X",
    date: "%d/%m/%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"], // unused
    days: ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
    shortDays: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
    months: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    shortMonths: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
  });

  var heIL = locale$1({
    dateTime: "%A, %e ב%B %Y %X",
    date: "%d.%m.%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"],
    days: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
    shortDays: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"],
    months: ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"],
    shortMonths: ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"]
  });

  var huHU = locale$1({
    dateTime: "%Y. %B %-e., %A %X",
    date: "%Y. %m. %d.",
    time: "%H:%M:%S",
    periods: ["de.", "du."], // unused
    days: ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"],
    shortDays: ["V", "H", "K", "Sze", "Cs", "P", "Szo"],
    months: ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"],
    shortMonths: ["jan.", "feb.", "már.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."]
  });

  var itIT = locale$1({
    dateTime: "%A %e %B %Y, %X",
    date: "%d/%m/%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"], // unused
    days: ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"],
    shortDays: ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"],
    months: ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"],
    shortMonths: ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"]
  });

  var jaJP = locale$1({
    dateTime: "%Y %b %e %a %X",
    date: "%Y/%m/%d",
    time: "%H:%M:%S",
    periods: ["AM", "PM"],
    days: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"],
    shortDays: ["日", "月", "火", "水", "木", "金", "土"],
    months: ["睦月", "如月", "弥生", "卯月", "皐月", "水無月", "文月", "葉月", "長月", "神無月", "霜月", "師走"],
    shortMonths: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
  });

  var koKR = locale$1({
    dateTime: "%Y/%m/%d %a %X",
    date: "%Y/%m/%d",
    time: "%H:%M:%S",
    periods: ["오전", "오후"],
    days: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
    shortDays: ["일", "월", "화", "수", "목", "금", "토"],
    months: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
    shortMonths: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]
  });

  var mkMK = locale$1({
    dateTime: "%A, %e %B %Y г. %X",
    date: "%d.%m.%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"],
    days: ["недела", "понеделник", "вторник", "среда", "четврток", "петок", "сабота"],
    shortDays: ["нед", "пон", "вто", "сре", "чет", "пет", "саб"],
    months: ["јануари", "февруари", "март", "април", "мај", "јуни", "јули", "август", "септември", "октомври", "ноември", "декември"],
    shortMonths: ["јан", "фев", "мар", "апр", "мај", "јун", "јул", "авг", "сеп", "окт", "ное", "дек"]
  });

  var nlNL = locale$1({
    dateTime: "%a %e %B %Y %T",
    date: "%d-%m-%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"], // unused
    days: ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"],
    shortDays: ["zo", "ma", "di", "wo", "do", "vr", "za"],
    months: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],
    shortMonths: ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]
  });

  var plPL = locale$1({
    dateTime: "%A, %e %B %Y, %X",
    date: "%d/%m/%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"], // unused
    days: ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"],
    shortDays: ["Niedz.", "Pon.", "Wt.", "Śr.", "Czw.", "Pt.", "Sob."],
    months: ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"],
    shortMonths: ["Stycz.", "Luty", "Marz.", "Kwie.", "Maj", "Czerw.", "Lipc.", "Sierp.", "Wrz.", "Paźdz.", "Listop.", "Grudz."]/* In Polish language abbraviated months are not commonly used so there is a dispute about the proper abbraviations. */
  });

  var ptBR = locale$1({
    dateTime: "%A, %e de %B de %Y. %X",
    date: "%d/%m/%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"],
    days: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
    shortDays: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
    months: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
    shortMonths: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
  });

  var ruRU = locale$1({
    dateTime: "%A, %e %B %Y г. %X",
    date: "%d.%m.%Y",
    time: "%H:%M:%S",
    periods: ["AM", "PM"],
    days: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
    shortDays: ["вс", "пн", "вт", "ср", "чт", "пт", "сб"],
    months: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
    shortMonths: ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]
  });

  var svSE = locale$1({
    dateTime: "%A den %d %B %Y %X",
    date: "%Y-%m-%d",
    time: "%H:%M:%S",
    periods: ["fm", "em"],
    days: ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"],
    shortDays: ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"],
    months: ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"],
    shortMonths: ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"]
  });

  var zhCN = locale$1({
    dateTime: "%a %b %e %X %Y",
    date: "%Y/%-m/%-d",
    time: "%H:%M:%S",
    periods: ["上午", "下午"],
    days: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
    shortDays: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"],
    months: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
    shortMonths: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"]
  });

  var isoSpecifier = "%Y-%m-%dT%H:%M:%S.%LZ";

  function formatIsoNative(date) {
    return date.toISOString();
  }

  formatIsoNative.parse = function(string) {
    var date = new Date(string);
    return isNaN(date) ? null : date;
  };

  formatIsoNative.toString = function() {
    return isoSpecifier;
  };

  var formatIso = Date.prototype.toISOString && +new Date("2000-01-01T00:00:00.000Z")
      ? formatIsoNative
      : locale.utcFormat(isoSpecifier);

  var format = locale.format;
  var utcFormat = locale.utcFormat;

  var version = "0.2.0";

  exports.version = version;
  exports.format = format;
  exports.utcFormat = utcFormat;
  exports.locale = locale$1;
  exports.localeCaEs = caES;
  exports.localeDeCh = deCH;
  exports.localeDeDe = deDE;
  exports.localeEnCa = enCA;
  exports.localeEnGb = enGB;
  exports.localeEnUs = locale;
  exports.localeEsEs = esES;
  exports.localeFiFi = fiFI;
  exports.localeFrCa = frCA;
  exports.localeFrFr = frFR;
  exports.localeHeIl = heIL;
  exports.localeHuHu = huHU;
  exports.localeItIt = itIT;
  exports.localeJaJp = jaJP;
  exports.localeKoKr = koKR;
  exports.localeMkMk = mkMK;
  exports.localeNlNl = nlNL;
  exports.localePlPl = plPL;
  exports.localePtBr = ptBR;
  exports.localeRuRu = ruRU;
  exports.localeSvSe = svSE;
  exports.localeZhCn = zhCN;
  exports.isoFormat = formatIso;

}));
},{"d3-time":14}],14:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define('d3-time', ['exports'], factory) :
  factory((global.d3_time = {}));
}(this, function (exports) { 'use strict';

  var t0 = new Date;
  var t1 = new Date;
  function newInterval(floori, offseti, count) {

    function interval(date) {
      return floori(date = new Date(+date)), date;
    }

    interval.floor = interval;

    interval.round = function(date) {
      var d0 = new Date(+date),
          d1 = new Date(date - 1);
      floori(d0), floori(d1), offseti(d1, 1);
      return date - d0 < d1 - date ? d0 : d1;
    };

    interval.ceil = function(date) {
      return floori(date = new Date(date - 1)), offseti(date, 1), date;
    };

    interval.offset = function(date, step) {
      return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
    };

    interval.range = function(start, stop, step) {
      var range = [];
      start = new Date(start - 1);
      stop = new Date(+stop);
      step = step == null ? 1 : Math.floor(step);
      if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
      offseti(start, 1), floori(start);
      if (start < stop) range.push(new Date(+start));
      while (offseti(start, step), floori(start), start < stop) range.push(new Date(+start));
      return range;
    };

    interval.filter = function(test) {
      return newInterval(function(date) {
        while (floori(date), !test(date)) date.setTime(date - 1);
      }, function(date, step) {
        while (--step >= 0) while (offseti(date, 1), !test(date));
      });
    };

    if (count) interval.count = function(start, end) {
      t0.setTime(+start), t1.setTime(+end);
      floori(t0), floori(t1);
      return Math.floor(count(t0, t1));
    };

    return interval;
  };

  var millisecond = newInterval(function() {
    // noop
  }, function(date, step) {
    date.setTime(+date + step);
  }, function(start, end) {
    return end - start;
  });

  var second = newInterval(function(date) {
    date.setMilliseconds(0);
  }, function(date, step) {
    date.setTime(+date + step * 1e3);
  }, function(start, end) {
    return (end - start) / 1e3;
  });

  var minute = newInterval(function(date) {
    date.setSeconds(0, 0);
  }, function(date, step) {
    date.setTime(+date + step * 6e4);
  }, function(start, end) {
    return (end - start) / 6e4;
  });

  var hour = newInterval(function(date) {
    date.setMinutes(0, 0, 0);
  }, function(date, step) {
    date.setTime(+date + step * 36e5);
  }, function(start, end) {
    return (end - start) / 36e5;
  });

  var day = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setDate(date.getDate() + step);
  }, function(start, end) {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * 6e4) / 864e5;
  });

  function weekday(i) {
    return newInterval(function(date) {
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
    }, function(date, step) {
      date.setDate(date.getDate() + step * 7);
    }, function(start, end) {
      return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * 6e4) / 6048e5;
    });
  }

  var sunday = weekday(0);
  var monday = weekday(1);
  var tuesday = weekday(2);
  var wednesday = weekday(3);
  var thursday = weekday(4);
  var friday = weekday(5);
  var saturday = weekday(6);

  var month = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
    date.setDate(1);
  }, function(date, step) {
    date.setMonth(date.getMonth() + step);
  }, function(start, end) {
    return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
  });

  var year = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
    date.setMonth(0, 1);
  }, function(date, step) {
    date.setFullYear(date.getFullYear() + step);
  }, function(start, end) {
    return end.getFullYear() - start.getFullYear();
  });

  var utcSecond = newInterval(function(date) {
    date.setUTCMilliseconds(0);
  }, function(date, step) {
    date.setTime(+date + step * 1e3);
  }, function(start, end) {
    return (end - start) / 1e3;
  });

  var utcMinute = newInterval(function(date) {
    date.setUTCSeconds(0, 0);
  }, function(date, step) {
    date.setTime(+date + step * 6e4);
  }, function(start, end) {
    return (end - start) / 6e4;
  });

  var utcHour = newInterval(function(date) {
    date.setUTCMinutes(0, 0, 0);
  }, function(date, step) {
    date.setTime(+date + step * 36e5);
  }, function(start, end) {
    return (end - start) / 36e5;
  });

  var utcDay = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCDate(date.getUTCDate() + step);
  }, function(start, end) {
    return (end - start) / 864e5;
  });

  function utcWeekday(i) {
    return newInterval(function(date) {
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
    }, function(date, step) {
      date.setUTCDate(date.getUTCDate() + step * 7);
    }, function(start, end) {
      return (end - start) / 6048e5;
    });
  }

  var utcSunday = utcWeekday(0);
  var utcMonday = utcWeekday(1);
  var utcTuesday = utcWeekday(2);
  var utcWednesday = utcWeekday(3);
  var utcThursday = utcWeekday(4);
  var utcFriday = utcWeekday(5);
  var utcSaturday = utcWeekday(6);

  var utcMonth = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(1);
  }, function(date, step) {
    date.setUTCMonth(date.getUTCMonth() + step);
  }, function(start, end) {
    return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
  });

  var utcYear = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCMonth(0, 1);
  }, function(date, step) {
    date.setUTCFullYear(date.getUTCFullYear() + step);
  }, function(start, end) {
    return end.getUTCFullYear() - start.getUTCFullYear();
  });

  var milliseconds = millisecond.range;
  var seconds = second.range;
  var minutes = minute.range;
  var hours = hour.range;
  var days = day.range;
  var sundays = sunday.range;
  var mondays = monday.range;
  var tuesdays = tuesday.range;
  var wednesdays = wednesday.range;
  var thursdays = thursday.range;
  var fridays = friday.range;
  var saturdays = saturday.range;
  var weeks = sunday.range;
  var months = month.range;
  var years = year.range;

  var utcMillisecond = millisecond;
  var utcMilliseconds = milliseconds;
  var utcSeconds = utcSecond.range;
  var utcMinutes = utcMinute.range;
  var utcHours = utcHour.range;
  var utcDays = utcDay.range;
  var utcSundays = utcSunday.range;
  var utcMondays = utcMonday.range;
  var utcTuesdays = utcTuesday.range;
  var utcWednesdays = utcWednesday.range;
  var utcThursdays = utcThursday.range;
  var utcFridays = utcFriday.range;
  var utcSaturdays = utcSaturday.range;
  var utcWeeks = utcSunday.range;
  var utcMonths = utcMonth.range;
  var utcYears = utcYear.range;

  var version = "0.0.7";

  exports.version = version;
  exports.milliseconds = milliseconds;
  exports.seconds = seconds;
  exports.minutes = minutes;
  exports.hours = hours;
  exports.days = days;
  exports.sundays = sundays;
  exports.mondays = mondays;
  exports.tuesdays = tuesdays;
  exports.wednesdays = wednesdays;
  exports.thursdays = thursdays;
  exports.fridays = fridays;
  exports.saturdays = saturdays;
  exports.weeks = weeks;
  exports.months = months;
  exports.years = years;
  exports.utcMillisecond = utcMillisecond;
  exports.utcMilliseconds = utcMilliseconds;
  exports.utcSeconds = utcSeconds;
  exports.utcMinutes = utcMinutes;
  exports.utcHours = utcHours;
  exports.utcDays = utcDays;
  exports.utcSundays = utcSundays;
  exports.utcMondays = utcMondays;
  exports.utcTuesdays = utcTuesdays;
  exports.utcWednesdays = utcWednesdays;
  exports.utcThursdays = utcThursdays;
  exports.utcFridays = utcFridays;
  exports.utcSaturdays = utcSaturdays;
  exports.utcWeeks = utcWeeks;
  exports.utcMonths = utcMonths;
  exports.utcYears = utcYears;
  exports.millisecond = millisecond;
  exports.second = second;
  exports.minute = minute;
  exports.hour = hour;
  exports.day = day;
  exports.sunday = sunday;
  exports.monday = monday;
  exports.tuesday = tuesday;
  exports.wednesday = wednesday;
  exports.thursday = thursday;
  exports.friday = friday;
  exports.saturday = saturday;
  exports.week = sunday;
  exports.month = month;
  exports.year = year;
  exports.utcSecond = utcSecond;
  exports.utcMinute = utcMinute;
  exports.utcHour = utcHour;
  exports.utcDay = utcDay;
  exports.utcSunday = utcSunday;
  exports.utcMonday = utcMonday;
  exports.utcTuesday = utcTuesday;
  exports.utcWednesday = utcWednesday;
  exports.utcThursday = utcThursday;
  exports.utcFriday = utcFriday;
  exports.utcSaturday = utcSaturday;
  exports.utcWeek = utcSunday;
  exports.utcMonth = utcMonth;
  exports.utcYear = utcYear;
  exports.interval = newInterval;

}));
},{}],15:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define('d3-time', ['exports'], factory) :
  factory((global.d3_time = {}));
}(this, function (exports) { 'use strict';

  var t0 = new Date;
  var t1 = new Date;
  function newInterval(floori, offseti, count, field) {

    function interval(date) {
      return floori(date = new Date(+date)), date;
    }

    interval.floor = interval;

    interval.round = function(date) {
      var d0 = new Date(+date),
          d1 = new Date(date - 1);
      floori(d0), floori(d1), offseti(d1, 1);
      return date - d0 < d1 - date ? d0 : d1;
    };

    interval.ceil = function(date) {
      return floori(date = new Date(date - 1)), offseti(date, 1), date;
    };

    interval.offset = function(date, step) {
      return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
    };

    interval.range = function(start, stop, step) {
      var range = [];
      start = new Date(start - 1);
      stop = new Date(+stop);
      step = step == null ? 1 : Math.floor(step);
      if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
      offseti(start, 1), floori(start);
      if (start < stop) range.push(new Date(+start));
      while (offseti(start, step), floori(start), start < stop) range.push(new Date(+start));
      return range;
    };

    interval.filter = function(test) {
      return newInterval(function(date) {
        while (floori(date), !test(date)) date.setTime(date - 1);
      }, function(date, step) {
        while (--step >= 0) while (offseti(date, 1), !test(date));
      });
    };

    if (count) {
      interval.count = function(start, end) {
        t0.setTime(+start), t1.setTime(+end);
        floori(t0), floori(t1);
        return Math.floor(count(t0, t1));
      };

      interval.every = function(step) {
        step = Math.floor(step);
        return !isFinite(step) || !(step > 0) ? null
            : !(step > 1) ? interval
            : interval.filter(field
                ? function(d) { return field(d) % step === 0; }
                : function(d) { return interval.count(0, d) % step === 0; });
      };
    }

    return interval;
  };

  var millisecond = newInterval(function() {
    // noop
  }, function(date, step) {
    date.setTime(+date + step);
  }, function(start, end) {
    return end - start;
  });

  // An optimized implementation for this simple case.
  millisecond.every = function(k) {
    k = Math.floor(k);
    if (!isFinite(k) || !(k > 0)) return null;
    if (!(k > 1)) return millisecond;
    return newInterval(function(date) {
      date.setTime(Math.floor(date / k) * k);
    }, function(date, step) {
      date.setTime(+date + step * k);
    }, function(start, end) {
      return (end - start) / k;
    });
  };

  var second = newInterval(function(date) {
    date.setMilliseconds(0);
  }, function(date, step) {
    date.setTime(+date + step * 1e3);
  }, function(start, end) {
    return (end - start) / 1e3;
  }, function(date) {
    return date.getSeconds();
  });

  var minute = newInterval(function(date) {
    date.setSeconds(0, 0);
  }, function(date, step) {
    date.setTime(+date + step * 6e4);
  }, function(start, end) {
    return (end - start) / 6e4;
  }, function(date) {
    return date.getMinutes();
  });

  var hour = newInterval(function(date) {
    date.setMinutes(0, 0, 0);
  }, function(date, step) {
    date.setTime(+date + step * 36e5);
  }, function(start, end) {
    return (end - start) / 36e5;
  }, function(date) {
    return date.getHours();
  });

  var day = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setDate(date.getDate() + step);
  }, function(start, end) {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * 6e4) / 864e5;
  }, function(date) {
    return date.getDate() - 1;
  });

  function weekday(i) {
    return newInterval(function(date) {
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
    }, function(date, step) {
      date.setDate(date.getDate() + step * 7);
    }, function(start, end) {
      return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * 6e4) / 6048e5;
    });
  }

  var sunday = weekday(0);
  var monday = weekday(1);
  var tuesday = weekday(2);
  var wednesday = weekday(3);
  var thursday = weekday(4);
  var friday = weekday(5);
  var saturday = weekday(6);

  var month = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
    date.setDate(1);
  }, function(date, step) {
    date.setMonth(date.getMonth() + step);
  }, function(start, end) {
    return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
  }, function(date) {
    return date.getMonth();
  });

  var year = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
    date.setMonth(0, 1);
  }, function(date, step) {
    date.setFullYear(date.getFullYear() + step);
  }, function(start, end) {
    return end.getFullYear() - start.getFullYear();
  }, function(date) {
    return date.getFullYear();
  });

  var utcSecond = newInterval(function(date) {
    date.setUTCMilliseconds(0);
  }, function(date, step) {
    date.setTime(+date + step * 1e3);
  }, function(start, end) {
    return (end - start) / 1e3;
  }, function(date) {
    return date.getUTCSeconds();
  });

  var utcMinute = newInterval(function(date) {
    date.setUTCSeconds(0, 0);
  }, function(date, step) {
    date.setTime(+date + step * 6e4);
  }, function(start, end) {
    return (end - start) / 6e4;
  }, function(date) {
    return date.getUTCMinutes();
  });

  var utcHour = newInterval(function(date) {
    date.setUTCMinutes(0, 0, 0);
  }, function(date, step) {
    date.setTime(+date + step * 36e5);
  }, function(start, end) {
    return (end - start) / 36e5;
  }, function(date) {
    return date.getUTCHours();
  });

  var utcDay = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCDate(date.getUTCDate() + step);
  }, function(start, end) {
    return (end - start) / 864e5;
  }, function(date) {
    return date.getUTCDate() - 1;
  });

  function utcWeekday(i) {
    return newInterval(function(date) {
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
    }, function(date, step) {
      date.setUTCDate(date.getUTCDate() + step * 7);
    }, function(start, end) {
      return (end - start) / 6048e5;
    });
  }

  var utcSunday = utcWeekday(0);
  var utcMonday = utcWeekday(1);
  var utcTuesday = utcWeekday(2);
  var utcWednesday = utcWeekday(3);
  var utcThursday = utcWeekday(4);
  var utcFriday = utcWeekday(5);
  var utcSaturday = utcWeekday(6);

  var utcMonth = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(1);
  }, function(date, step) {
    date.setUTCMonth(date.getUTCMonth() + step);
  }, function(start, end) {
    return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
  }, function(date) {
    return date.getUTCMonth();
  });

  var utcYear = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCMonth(0, 1);
  }, function(date, step) {
    date.setUTCFullYear(date.getUTCFullYear() + step);
  }, function(start, end) {
    return end.getUTCFullYear() - start.getUTCFullYear();
  }, function(date) {
    return date.getUTCFullYear();
  });

  var milliseconds = millisecond.range;
  var seconds = second.range;
  var minutes = minute.range;
  var hours = hour.range;
  var days = day.range;
  var sundays = sunday.range;
  var mondays = monday.range;
  var tuesdays = tuesday.range;
  var wednesdays = wednesday.range;
  var thursdays = thursday.range;
  var fridays = friday.range;
  var saturdays = saturday.range;
  var weeks = sunday.range;
  var months = month.range;
  var years = year.range;

  var utcMillisecond = millisecond;
  var utcMilliseconds = milliseconds;
  var utcSeconds = utcSecond.range;
  var utcMinutes = utcMinute.range;
  var utcHours = utcHour.range;
  var utcDays = utcDay.range;
  var utcSundays = utcSunday.range;
  var utcMondays = utcMonday.range;
  var utcTuesdays = utcTuesday.range;
  var utcWednesdays = utcWednesday.range;
  var utcThursdays = utcThursday.range;
  var utcFridays = utcFriday.range;
  var utcSaturdays = utcSaturday.range;
  var utcWeeks = utcSunday.range;
  var utcMonths = utcMonth.range;
  var utcYears = utcYear.range;

  var version = "0.1.0";

  exports.version = version;
  exports.milliseconds = milliseconds;
  exports.seconds = seconds;
  exports.minutes = minutes;
  exports.hours = hours;
  exports.days = days;
  exports.sundays = sundays;
  exports.mondays = mondays;
  exports.tuesdays = tuesdays;
  exports.wednesdays = wednesdays;
  exports.thursdays = thursdays;
  exports.fridays = fridays;
  exports.saturdays = saturdays;
  exports.weeks = weeks;
  exports.months = months;
  exports.years = years;
  exports.utcMillisecond = utcMillisecond;
  exports.utcMilliseconds = utcMilliseconds;
  exports.utcSeconds = utcSeconds;
  exports.utcMinutes = utcMinutes;
  exports.utcHours = utcHours;
  exports.utcDays = utcDays;
  exports.utcSundays = utcSundays;
  exports.utcMondays = utcMondays;
  exports.utcTuesdays = utcTuesdays;
  exports.utcWednesdays = utcWednesdays;
  exports.utcThursdays = utcThursdays;
  exports.utcFridays = utcFridays;
  exports.utcSaturdays = utcSaturdays;
  exports.utcWeeks = utcWeeks;
  exports.utcMonths = utcMonths;
  exports.utcYears = utcYears;
  exports.millisecond = millisecond;
  exports.second = second;
  exports.minute = minute;
  exports.hour = hour;
  exports.day = day;
  exports.sunday = sunday;
  exports.monday = monday;
  exports.tuesday = tuesday;
  exports.wednesday = wednesday;
  exports.thursday = thursday;
  exports.friday = friday;
  exports.saturday = saturday;
  exports.week = sunday;
  exports.month = month;
  exports.year = year;
  exports.utcSecond = utcSecond;
  exports.utcMinute = utcMinute;
  exports.utcHour = utcHour;
  exports.utcDay = utcDay;
  exports.utcSunday = utcSunday;
  exports.utcMonday = utcMonday;
  exports.utcTuesday = utcTuesday;
  exports.utcWednesday = utcWednesday;
  exports.utcThursday = utcThursday;
  exports.utcFriday = utcFriday;
  exports.utcSaturday = utcSaturday;
  exports.utcWeek = utcSunday;
  exports.utcMonth = utcMonth;
  exports.utcYear = utcYear;
  exports.interval = newInterval;

}));
},{}],16:[function(require,module,exports){
var geojsonCoords = require('geojson-coords'),
    traverse = require('traverse'),
    extent = require('extent');

module.exports = function(_) {
    return getExtent(_).bbox();
};

module.exports.polygon = function(_) {
    return getExtent(_).polygon();
};

module.exports.bboxify = function(_) {
    return traverse(_).map(function(value) {
        if (value && typeof value.type === 'string') {
            value.bbox = getExtent(value).bbox();
            this.update(value);
        }
    });
};

function getExtent(_) {
    var bbox = [Infinity, Infinity, -Infinity, -Infinity],
        ext = extent(),
        coords = geojsonCoords(_);
    for (var i = 0; i < coords.length; i++) ext.include(coords[i]);
    return ext;
}

},{"extent":17,"geojson-coords":19,"traverse":22}],17:[function(require,module,exports){
module.exports = Extent;

function Extent() {
    if (!(this instanceof Extent)) {
        return new Extent();
    }
    this._bbox = [Infinity, Infinity, -Infinity, -Infinity];
    this._valid = false;
}

Extent.prototype.include = function(ll) {
    this._valid = true;
    this._bbox[0] = Math.min(this._bbox[0], ll[0]);
    this._bbox[1] = Math.min(this._bbox[1], ll[1]);
    this._bbox[2] = Math.max(this._bbox[2], ll[0]);
    this._bbox[3] = Math.max(this._bbox[3], ll[1]);
    return this;
};

Extent.prototype.union = function(other) {
    this._valid = true;
    this._bbox[0] = Math.min(this._bbox[0], other[0]);
    this._bbox[1] = Math.min(this._bbox[1], other[1]);
    this._bbox[2] = Math.max(this._bbox[2], other[2]);
    this._bbox[3] = Math.max(this._bbox[3], other[3]);
    return this;
};

Extent.prototype.bbox = function() {
    if (!this._valid) return null;
    return this._bbox;
};

Extent.prototype.contains = function(ll) {
    if (!this._valid) return null;
    return this._bbox[0] <= ll[0] &&
        this._bbox[1] <= ll[1] &&
        this._bbox[2] >= ll[0] &&
        this._bbox[3] >= ll[1];
};

Extent.prototype.polygon = function() {
    if (!this._valid) return null;
    return {
        type: 'Polygon',
        coordinates: [
            [
                // W, S
                [this._bbox[0], this._bbox[1]],
                // E, S
                [this._bbox[2], this._bbox[1]],
                // E, N
                [this._bbox[2], this._bbox[3]],
                // W, N
                [this._bbox[0], this._bbox[3]],
                // W, S
                [this._bbox[0], this._bbox[1]]
            ]
        ]
    };
};

},{}],18:[function(require,module,exports){
module.exports = function flatten(list, depth) {
    return _flatten(list);

    function _flatten(list) {
        if (Array.isArray(list) && list.length &&
            typeof list[0] === 'number') {
            return [list];
        }
        return list.reduce(function (acc, item) {
            if (Array.isArray(item) && Array.isArray(item[0])) {
                return acc.concat(_flatten(item));
            } else {
                acc.push(item);
                return acc;
            }
        }, []);
    }
};

},{}],19:[function(require,module,exports){
var geojsonNormalize = require('geojson-normalize'),
    geojsonFlatten = require('geojson-flatten'),
    flatten = require('./flatten');

module.exports = function(_) {
    if (!_) return [];
    var normalized = geojsonFlatten(geojsonNormalize(_)),
        coordinates = [];
    normalized.features.forEach(function(feature) {
        if (!feature.geometry) return;
        coordinates = coordinates.concat(flatten(feature.geometry.coordinates));
    });
    return coordinates;
};

},{"./flatten":18,"geojson-flatten":20,"geojson-normalize":21}],20:[function(require,module,exports){
module.exports = flatten;

function flatten(gj, up) {
    switch ((gj && gj.type) || null) {
        case 'FeatureCollection':
            gj.features = gj.features.reduce(function(mem, feature) {
                return mem.concat(flatten(feature));
            }, []);
            return gj;
        case 'Feature':
            return flatten(gj.geometry).map(function(geom) {
                return {
                    type: 'Feature',
                    properties: JSON.parse(JSON.stringify(gj.properties)),
                    geometry: geom
                };
            });
        case 'MultiPoint':
            return gj.coordinates.map(function(_) {
                return { type: 'Point', coordinates: _ };
            });
        case 'MultiPolygon':
            return gj.coordinates.map(function(_) {
                return { type: 'Polygon', coordinates: _ };
            });
        case 'MultiLineString':
            return gj.coordinates.map(function(_) {
                return { type: 'LineString', coordinates: _ };
            });
        case 'GeometryCollection':
            return gj.geometries;
        case 'Point':
        case 'Polygon':
        case 'LineString':
            return [gj];
        default:
            return gj;
    }
}

},{}],21:[function(require,module,exports){
module.exports = normalize;

var types = {
    Point: 'geometry',
    MultiPoint: 'geometry',
    LineString: 'geometry',
    MultiLineString: 'geometry',
    Polygon: 'geometry',
    MultiPolygon: 'geometry',
    GeometryCollection: 'geometry',
    Feature: 'feature',
    FeatureCollection: 'featurecollection'
};

/**
 * Normalize a GeoJSON feature into a FeatureCollection.
 *
 * @param {object} gj geojson data
 * @returns {object} normalized geojson data
 */
function normalize(gj) {
    if (!gj || !gj.type) return null;
    var type = types[gj.type];
    if (!type) return null;

    if (type === 'geometry') {
        return {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                properties: {},
                geometry: gj
            }]
        };
    } else if (type === 'feature') {
        return {
            type: 'FeatureCollection',
            features: [gj]
        };
    } else if (type === 'featurecollection') {
        return gj;
    }
}

},{}],22:[function(require,module,exports){
var traverse = module.exports = function (obj) {
    return new Traverse(obj);
};

function Traverse (obj) {
    this.value = obj;
}

Traverse.prototype.get = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!node || !hasOwnProperty.call(node, key)) {
            node = undefined;
            break;
        }
        node = node[key];
    }
    return node;
};

Traverse.prototype.has = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!node || !hasOwnProperty.call(node, key)) {
            return false;
        }
        node = node[key];
    }
    return true;
};

Traverse.prototype.set = function (ps, value) {
    var node = this.value;
    for (var i = 0; i < ps.length - 1; i ++) {
        var key = ps[i];
        if (!hasOwnProperty.call(node, key)) node[key] = {};
        node = node[key];
    }
    node[ps[i]] = value;
    return value;
};

Traverse.prototype.map = function (cb) {
    return walk(this.value, cb, true);
};

Traverse.prototype.forEach = function (cb) {
    this.value = walk(this.value, cb, false);
    return this.value;
};

Traverse.prototype.reduce = function (cb, init) {
    var skip = arguments.length === 1;
    var acc = skip ? this.value : init;
    this.forEach(function (x) {
        if (!this.isRoot || !skip) {
            acc = cb.call(this, acc, x);
        }
    });
    return acc;
};

Traverse.prototype.paths = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.path); 
    });
    return acc;
};

Traverse.prototype.nodes = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.node);
    });
    return acc;
};

Traverse.prototype.clone = function () {
    var parents = [], nodes = [];
    
    return (function clone (src) {
        for (var i = 0; i < parents.length; i++) {
            if (parents[i] === src) {
                return nodes[i];
            }
        }
        
        if (typeof src === 'object' && src !== null) {
            var dst = copy(src);
            
            parents.push(src);
            nodes.push(dst);
            
            forEach(objectKeys(src), function (key) {
                dst[key] = clone(src[key]);
            });
            
            parents.pop();
            nodes.pop();
            return dst;
        }
        else {
            return src;
        }
    })(this.value);
};

function walk (root, cb, immutable) {
    var path = [];
    var parents = [];
    var alive = true;
    
    return (function walker (node_) {
        var node = immutable ? copy(node_) : node_;
        var modifiers = {};
        
        var keepGoing = true;
        
        var state = {
            node : node,
            node_ : node_,
            path : [].concat(path),
            parent : parents[parents.length - 1],
            parents : parents,
            key : path.slice(-1)[0],
            isRoot : path.length === 0,
            level : path.length,
            circular : null,
            update : function (x, stopHere) {
                if (!state.isRoot) {
                    state.parent.node[state.key] = x;
                }
                state.node = x;
                if (stopHere) keepGoing = false;
            },
            'delete' : function (stopHere) {
                delete state.parent.node[state.key];
                if (stopHere) keepGoing = false;
            },
            remove : function (stopHere) {
                if (isArray(state.parent.node)) {
                    state.parent.node.splice(state.key, 1);
                }
                else {
                    delete state.parent.node[state.key];
                }
                if (stopHere) keepGoing = false;
            },
            keys : null,
            before : function (f) { modifiers.before = f },
            after : function (f) { modifiers.after = f },
            pre : function (f) { modifiers.pre = f },
            post : function (f) { modifiers.post = f },
            stop : function () { alive = false },
            block : function () { keepGoing = false }
        };
        
        if (!alive) return state;
        
        function updateState() {
            if (typeof state.node === 'object' && state.node !== null) {
                if (!state.keys || state.node_ !== state.node) {
                    state.keys = objectKeys(state.node)
                }
                
                state.isLeaf = state.keys.length == 0;
                
                for (var i = 0; i < parents.length; i++) {
                    if (parents[i].node_ === node_) {
                        state.circular = parents[i];
                        break;
                    }
                }
            }
            else {
                state.isLeaf = true;
                state.keys = null;
            }
            
            state.notLeaf = !state.isLeaf;
            state.notRoot = !state.isRoot;
        }
        
        updateState();
        
        // use return values to update if defined
        var ret = cb.call(state, state.node);
        if (ret !== undefined && state.update) state.update(ret);
        
        if (modifiers.before) modifiers.before.call(state, state.node);
        
        if (!keepGoing) return state;
        
        if (typeof state.node == 'object'
        && state.node !== null && !state.circular) {
            parents.push(state);
            
            updateState();
            
            forEach(state.keys, function (key, i) {
                path.push(key);
                
                if (modifiers.pre) modifiers.pre.call(state, state.node[key], key);
                
                var child = walker(state.node[key]);
                if (immutable && hasOwnProperty.call(state.node, key)) {
                    state.node[key] = child.node;
                }
                
                child.isLast = i == state.keys.length - 1;
                child.isFirst = i == 0;
                
                if (modifiers.post) modifiers.post.call(state, child);
                
                path.pop();
            });
            parents.pop();
        }
        
        if (modifiers.after) modifiers.after.call(state, state.node);
        
        return state;
    })(root).node;
}

function copy (src) {
    if (typeof src === 'object' && src !== null) {
        var dst;
        
        if (isArray(src)) {
            dst = [];
        }
        else if (isDate(src)) {
            dst = new Date(src.getTime ? src.getTime() : src);
        }
        else if (isRegExp(src)) {
            dst = new RegExp(src);
        }
        else if (isError(src)) {
            dst = { message: src.message };
        }
        else if (isBoolean(src)) {
            dst = new Boolean(src);
        }
        else if (isNumber(src)) {
            dst = new Number(src);
        }
        else if (isString(src)) {
            dst = new String(src);
        }
        else if (Object.create && Object.getPrototypeOf) {
            dst = Object.create(Object.getPrototypeOf(src));
        }
        else if (src.constructor === Object) {
            dst = {};
        }
        else {
            var proto =
                (src.constructor && src.constructor.prototype)
                || src.__proto__
                || {}
            ;
            var T = function () {};
            T.prototype = proto;
            dst = new T;
        }
        
        forEach(objectKeys(src), function (key) {
            dst[key] = src[key];
        });
        return dst;
    }
    else return src;
}

var objectKeys = Object.keys || function keys (obj) {
    var res = [];
    for (var key in obj) res.push(key)
    return res;
};

function toS (obj) { return Object.prototype.toString.call(obj) }
function isDate (obj) { return toS(obj) === '[object Date]' }
function isRegExp (obj) { return toS(obj) === '[object RegExp]' }
function isError (obj) { return toS(obj) === '[object Error]' }
function isBoolean (obj) { return toS(obj) === '[object Boolean]' }
function isNumber (obj) { return toS(obj) === '[object Number]' }
function isString (obj) { return toS(obj) === '[object String]' }

var isArray = Array.isArray || function isArray (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

var forEach = function (xs, fn) {
    if (xs.forEach) return xs.forEach(fn)
    else for (var i = 0; i < xs.length; i++) {
        fn(xs[i], i, xs);
    }
};

forEach(objectKeys(Traverse.prototype), function (key) {
    traverse[key] = function (obj) {
        var args = [].slice.call(arguments, 1);
        var t = new Traverse(obj);
        return t[key].apply(t, args);
    };
});

var hasOwnProperty = Object.hasOwnProperty || function (obj, key) {
    return key in obj;
};

},{}],23:[function(require,module,exports){
// a tile is an array [x,y,z]
var d2r = Math.PI / 180,
    r2d = 180 / Math.PI;

function tileToBBOX (tile) {
    var e = tile2lon(tile[0]+1,tile[2]);
    var w = tile2lon(tile[0],tile[2]);
    var s = tile2lat(tile[1]+1,tile[2]);
    var n = tile2lat(tile[1],tile[2]);
    return [w,s,e,n];
}

function tileToGeoJSON (tile) {
    var bbox = tileToBBOX(tile);
    var poly = {
        type: 'Polygon',
        coordinates:
            [
                [
                    [bbox[0],bbox[1]],
                    [bbox[0], bbox[3]],
                    [bbox[2], bbox[3]],
                    [bbox[2], bbox[1]],
                    [bbox[0], bbox[1]]
                ]
            ]
    };
    return poly;
}

function tile2lon(x, z) {
    return (x/Math.pow(2,z)*360-180);
}

function tile2lat(y, z) {
    var n=Math.PI-2*Math.PI*y/Math.pow(2,z);
    return (r2d*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))));
}

function pointToTile(lon, lat, z) {
    var tile = pointToTileFraction(lon, lat, z);
    tile[0] = Math.floor(tile[0]);
    tile[1] = Math.floor(tile[1]);
    return tile;
}

function getChildren (tile) {
    return [
        [tile[0]*2, tile[1]*2, tile[2]+1],
        [tile[0]*2+1, tile[1]*2, tile[2 ]+1],
        [tile[0]*2+1, tile[1]*2+1, tile[2]+1],
        [tile[0]*2, tile[1]*2+1, tile[2]+1],
    ];
}

function getParent (tile) {
    // top left
    if(tile[0]%2===0 && tile[1]%2===0) {
        return [tile[0]/2, tile[1]/2, tile[2]-1];
    }
    // bottom left
    else if((tile[0]%2===0) && (!tile[1]%2===0)) {
        return [tile[0]/2, (tile[1]-1)/2, tile[2]-1];
    }
    // top right
    else if((!tile[0]%2===0) && (tile[1]%2===0)) {
        return [(tile[0]-1)/2, (tile[1])/2, tile[2]-1];
    }
    // bottom right
    else {
        return [(tile[0]-1)/2, (tile[1]-1)/2, tile[2]-1];
    }
}

function getSiblings (tile) {
    return getChildren(getParent(tile));
}

function hasSiblings(tile, tiles) {
    var siblings = getSiblings(tile);
    for (var i = 0; i < siblings.length; i++) {
        if (!hasTile(tiles, siblings[i])) return false;
    }
    return true;
}

function hasTile(tiles, tile) {
    for (var i = 0; i < tiles.length; i++) {
        if (tilesEqual(tiles[i], tile)) return true;
    }
    return false;
}

function tilesEqual(tile1, tile2) {
    return (
        tile1[0] === tile2[0] &&
        tile1[1] === tile2[1] &&
        tile1[2] === tile2[2]
    );
}

function tileToQuadkey(tile) {
  var index = '';
  for (var z = tile[2]; z > 0; z--) {
      var b = 0;
      var mask = 1 << (z - 1);
      if ((tile[0] & mask) !== 0) b++;
      if ((tile[1] & mask) !== 0) b += 2;
      index += b.toString();
  }
  return index;
}

function quadkeyToTile(quadkey) {
    var x = 0;
    var y = 0;
    var z = quadkey.length;

    for (var i = z; i > 0; i--) {
        var mask = 1 << (i - 1);
        switch (quadkey[z - i]) {
            case '0':
                break;

            case '1':
                x |= mask;
                break;

            case '2':
                y |= mask;
                break;

            case '3':
                x |= mask;
                y |= mask;
                break;
        }
    }
    return [x,y,z];
}

function bboxToTile(bboxCoords) {
    var min = pointToTile(bboxCoords[0], bboxCoords[1], 32);
    var max = pointToTile(bboxCoords[2], bboxCoords[3], 32);
    var bbox = [min[0], min[1], max[0], max[1]];

    var z = getBboxZoom(bbox);
    if (z === 0) return [0,0,0];
    var x = bbox[0] >>> (32 - z);
    var y = bbox[1] >>> (32 - z);
    return [x,y,z];
}

function getBboxZoom(bbox) {
    var MAX_ZOOM = 28;
    for (var z = 0; z < MAX_ZOOM; z++) {
        var mask = 1 << (32 - (z + 1));
        if (((bbox[0] & mask) != (bbox[2] & mask)) ||
            ((bbox[1] & mask) != (bbox[3] & mask))) {
            return z;
        }
    }

    return MAX_ZOOM;
}

function pointToTileFraction(lon, lat, z) {
    var sin = Math.sin(lat * d2r),
        z2 = Math.pow(2, z),
        x = z2 * (lon / 360 + 0.5),
        y = z2 * (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);
    return [x, y, z];
}

module.exports = {
    tileToGeoJSON: tileToGeoJSON,
    tileToBBOX: tileToBBOX,
    getChildren: getChildren,
    getParent: getParent,
    getSiblings: getSiblings,
    hasTile: hasTile,
    hasSiblings: hasSiblings,
    tilesEqual: tilesEqual,
    tileToQuadkey: tileToQuadkey,
    quadkeyToTile: quadkeyToTile,
    pointToTile: pointToTile,
    bboxToTile: bboxToTile,
    pointToTileFraction: pointToTileFraction
};

},{}],24:[function(require,module,exports){
module.exports={"type":"FeatureCollection","features":[{"type":"Feature","properties":{"abbrev":"SZ","name":"Schwyz","name_de":"Schwyz","name_fr":"Schwytz","name_it":"Svitto","iso":"CH-SZ","canton_id":5},"geometry":{"type":"Polygon","coordinates":[[[9.0047149,47.1732618],[8.9673854,47.13663510000001],[8.9662821,47.08084039999999],[8.948345099999997,47.0498395],[8.9009513,47.0372022],[8.900041,47.020965200000006],[8.9292996,46.9968376],[8.932142800000001,46.9822889],[8.962295500000002,46.953866899999994],[8.9632758,46.926836200000004],[8.935372,46.919872],[8.8743982,46.89501210000001],[8.827778399999998,46.91934749999999],[8.8107023,46.9414033],[8.791931899999998,46.9307976],[8.770920299999998,46.9414527],[8.7154904,46.9180938],[8.699566800000001,46.922979500000004],[8.692925699999998,46.9468797],[8.6707416,46.944109399999995],[8.620748507195325,46.95248947615856],[8.6055412,46.993533],[8.5788824,47.0007893],[8.5556097,46.9903317],[8.473802185315835,46.995583827717965],[8.509040800000001,47.0044968],[8.500601399999999,47.024688],[8.469923,47.0474823],[8.430227473046262,47.06541981464527],[8.40045457477764,47.05967736128185],[8.4100135,47.0935014],[8.449997399999999,47.1144263],[8.476268053118368,47.10613598365369],[8.4639843,47.0960954],[8.5209947,47.0625883],[8.521690718357139,47.09000534156226],[8.562459200000003,47.09375310000001],[8.5656651,47.081032300000004],[8.6117845,47.0949744],[8.637242699999998,47.09333070000001],[8.681301799999998,47.1248226],[8.699008699999998,47.1504392],[8.692195,47.1634006],[8.681063599999998,47.184072300000004],[8.713114718537444,47.2030393018414],[8.7355624,47.2082168],[8.7982012,47.2059499],[8.8187481,47.1947597],[8.8873112,47.208771],[8.8959807,47.2041021],[8.937080415545577,47.217857673175025],[8.937724326975749,47.2177621278146],[8.94144684950298,47.21813280128138],[8.969954800000002,47.2170932],[8.962134400000002,47.17937980000001],[9.0047149,47.1732618]]]}},
{"type":"Feature","properties":{"abbrev":"ZG","name":"Zug","name_de":"Zug","name_fr":"Zoug","name_it":"Zugo","iso":"CH-ZG","canton_id":9},"geometry":{"type":"Polygon","coordinates":[[[8.521690718357139,47.09000534156226],[8.4948235,47.1237214],[8.506122,47.136586],[8.5141353,47.1693377],[8.4615056,47.1779959],[8.4579823,47.1434678],[8.4658209,47.1384418],[8.467123258673034,47.11880816916964],[8.467148372929987,47.11880772404459],[8.46739173257938,47.11884537716384],[8.4676,47.1188006],[8.454106000000001,47.1136967],[8.4498558,47.129563100000006],[8.416925099999998,47.12313000000001],[8.4122057,47.1405668],[8.414968599999998,47.16550130000001],[8.3949593,47.225040400000005],[8.410073399999998,47.24837580000001],[8.4216847,47.22332080000001],[8.441121699999997,47.225215300000016],[8.479897500000002,47.2086217],[8.539215099999998,47.22305540000001],[8.5833397,47.216827499999994],[8.6157158,47.198616400000006],[8.628039,47.17897850000001],[8.661229299999999,47.1609515],[8.692195,47.1634006],[8.699008699999998,47.1504392],[8.681301799999998,47.1248226],[8.637242699999998,47.09333070000001],[8.6117845,47.0949744],[8.5656651,47.081032300000004],[8.562459200000003,47.09375310000001],[8.521690718357139,47.09000534156226]]]}},
{"type":"Feature","properties":{"abbrev":"GL","name":"Glarus","name_de":"Glarus","name_fr":"Glaris","name_it":"Glarona","iso":"CH-GL","canton_id":8},"geometry":{"type":"Polygon","coordinates":[[[9.248889499999999,46.91627139999999],[9.204126099999998,46.88309749999999],[9.1561653,46.879392],[9.1405478,46.8618409],[9.1093542,46.85082839999999],[9.0949332,46.870872399999996],[9.0647082,46.8752091],[9.0090128,46.811181299999994],[8.9278867,46.7965845],[8.914858599999999,46.8111533],[8.877046400000001,46.8129185],[8.875282400000001,46.84368749999999],[8.907582500000002,46.8602236],[8.9559119,46.87533210000001],[8.957277099999999,46.8879052],[8.935372,46.919872],[8.9632758,46.926836200000004],[8.962295500000002,46.953866899999994],[8.932142800000001,46.9822889],[8.9292996,46.9968376],[8.900041,47.020965200000006],[8.9009513,47.0372022],[8.948345099999997,47.0498395],[8.9662821,47.08084039999999],[8.9673854,47.13663510000001],[9.0047149,47.1732618],[9.069459500000002,47.129811200000006],[9.1154179,47.13275270000001],[9.1898696,47.123699900000005],[9.190290599999999,47.069892700000004],[9.167394,47.0494002],[9.138058799999998,47.03913520000001],[9.180518,47.02592250000001],[9.201652699999999,47.0351215],[9.236348799999998,47.0239832],[9.249674299999999,46.997958100000005],[9.239128399999997,46.939385900000005],[9.248889499999999,46.91627139999999]]]}},
{"type":"Feature","properties":{"abbrev":"JU","name":"Jura","name_de":"Jura","name_fr":"Jura","name_it":"Giura","iso":"CH-JU","canton_id":26},"geometry":{"type":"Polygon","coordinates":[[[7.5583409,47.32236290000001],[7.4960402,47.3021174],[7.476043900000001,47.30707399999999],[7.4216885,47.307062599999995],[7.3803957,47.31404459999999],[7.337508,47.305908900000006],[7.3169619,47.29037810000001],[7.2777859,47.2841647],[7.2426113,47.28522290000001],[7.2059944,47.295465400000005],[7.168819399999999,47.294496],[7.1686737,47.2747245],[7.1487334,47.26903620000001],[7.1397549,47.2431775],[7.0795219000000005,47.24775880000001],[7.061648400000001,47.2432481],[7.0234483,47.19569980000001],[6.996425100000001,47.193327800000006],[6.9855672,47.1765534],[6.9521605,47.18734439999999],[6.906089400000001,47.1571532],[6.8837139,47.1503973],[6.861515999999999,47.16558920000001],[6.858623000000001,47.16550280000001],[6.8804605,47.200517700000006],[6.921344,47.22050780000001],[6.955666700000001,47.24377510000001],[6.9407057000000005,47.28623880000001],[7.0097526000000006,47.302758100000005],[7.0099836,47.32451520000001],[7.0456145999999995,47.326481599999994],[7.0623707,47.344034199999996],[7.0498885,47.3613968],[7.0118024000000005,47.37264699999999],[6.9950018,47.363256],[6.9240461,47.3551794],[6.8836070000000005,47.3728593],[6.9384103,47.4060862],[6.940272300000001,47.433327399999996],[7.0021261,47.454157699999996],[6.986024400000001,47.49334],[7.024927799999999,47.504283699999995],[7.072079700000001,47.4923848],[7.1391517,47.5017999],[7.190908599999999,47.48855530000001],[7.1702182,47.442979300000005],[7.205580599999999,47.435413800000006],[7.228939199999999,47.4399405],[7.2550971,47.424420399999995],[7.2847261,47.43519330000001],[7.3272903,47.440015100000004],[7.3587199,47.41515390000001],[7.375945799999999,47.41409949999999],[7.4162762,47.384788799999995],[7.4373242,47.38088849999999],[7.463493700000001,47.3702566],[7.5237238,47.3720704],[7.552201,47.3453097],[7.5583409,47.32236290000001]]]}},
{"type":"Feature","properties":{"abbrev":"LU","name":"Luzern","name_de":"Luzern","name_fr":"Lucerne","name_it":"Lucerna","iso":"CH-LU","canton_id":3},"geometry":{"type":"MultiPolygon","coordinates":[[[[8.473802185315835,46.995583827717965],[8.4822565,47.0131265],[8.4353856,47.0320243],[8.430227473046262,47.06541981464527],[8.469923,47.0474823],[8.500601399999999,47.024688],[8.509040800000001,47.0044968],[8.473802185315835,46.995583827717965]]],[[[8.312602992452788,46.99840990359796],[8.265489300000002,46.99818260000001],[8.228872599999997,46.9731468],[8.187332099999999,46.971747099999995],[8.1500976,46.957526099999995],[8.1648412,46.9396042],[8.122496100000001,46.9094698],[8.089210999999999,46.9091935],[8.0698227,46.89573000000001],[8.0715913,46.873718800000006],[8.0423122,46.8365705],[8.064174,46.8084423],[8.046936800000001,46.787115500000006],[8.031484800000001,46.790155300000016],[7.984570499999999,46.774990300000006],[7.9578957,46.7894177],[7.9223894,46.8200081],[7.8770771,46.8370701],[7.8585989,46.8852943],[7.882660100000001,46.903535500000004],[7.8769266,46.9273754],[7.915258700000001,46.934637499999994],[7.945354,46.96784449999999],[7.949433600000001,47.005834],[7.9018248,47.006252700000005],[7.8917861,47.0304954],[7.866015599999999,47.053419399999996],[7.8804652,47.0844989],[7.868144899999999,47.1119748],[7.8900972,47.140725],[7.882880899999999,47.172118200000014],[7.8594916,47.1933276],[7.838664700000001,47.234818100000005],[7.9101007,47.2439465],[7.9334826000000005,47.23589570000001],[7.961878400000001,47.254058900000004],[7.949161600000001,47.27253960000001],[7.986887100000001,47.2760234],[8.0168109,47.259323800000004],[8.0157512,47.244162800000005],[8.0629796,47.2466594],[8.088375799999998,47.2628873],[8.1090964,47.244530000000005],[8.165147600000001,47.2501815],[8.160756600000001,47.2317576],[8.175982800000002,47.221903700000006],[8.2033045,47.2314416],[8.228571599999997,47.27341590000001],[8.250716800000001,47.286086999999995],[8.285368899999998,47.27999330000001],[8.31172,47.2454847],[8.3385953,47.1784435],[8.375939700000002,47.141018100000004],[8.4122057,47.1405668],[8.416925099999998,47.12313000000001],[8.4498558,47.129563100000006],[8.454106000000001,47.1136967],[8.4676,47.1188006],[8.476268053118368,47.10613598365369],[8.449997399999999,47.1144263],[8.4100135,47.0935014],[8.40045457477764,47.05967736128185],[8.3626873,47.0333505],[8.3328556,47.0542012],[8.3417492,47.0056354],[8.312602992452788,46.99840990359796]]]]}},
{"type":"Feature","properties":{"abbrev":"UR","name":"Uri","name_de":"Uri","name_fr":"Uri","name_it":"Uri","iso":"CH-UR","canton_id":4},"geometry":{"type":"Polygon","coordinates":[[[8.877046400000001,46.8129185],[8.8477105,46.79351950000001],[8.826304,46.78835260000001],[8.812978699999999,46.737314700000006],[8.7819848,46.72831210000002],[8.769588800000001,46.7443493],[8.747639,46.73591060000001],[8.7490648,46.72074020000001],[8.7089842,46.69896210000001],[8.6763262,46.6942145],[8.678607399999999,46.6642656],[8.654878399999998,46.649972000000005],[8.6510632,46.6345886],[8.6766766,46.6199699],[8.6787459,46.57919390000001],[8.6407392,46.564098800000004],[8.626565699999999,46.5763764],[8.590531200000001,46.5734078],[8.5725087,46.5837501],[8.5390025,46.5864789],[8.5130602,46.558077],[8.520374699999998,46.542554],[8.4776224,46.5276306],[8.4290073,46.5434931],[8.406140800000001,46.5859648],[8.420400800000001,46.61635220000001],[8.421367499999999,46.644503300000004],[8.410228899999998,46.653028],[8.398055099999999,46.6742285],[8.415282500000002,46.6874839],[8.452286000000003,46.6887448],[8.448318599999997,46.763423200000005],[8.491432200000002,46.77253010000001],[8.478549200000002,46.7892748],[8.478214099999999,46.8126366],[8.4978667,46.853728],[8.4708359,46.85485119999999],[8.4790907,46.882522900000005],[8.4642629,46.904737499999996],[8.541077199999998,46.92641520000001],[8.555869300000001,46.939235800000006],[8.5549667,46.9632164],[8.57422863217448,46.98388878224117],[8.5967959,46.9826436],[8.5799182,46.9289061],[8.5939938,46.8952081],[8.624191,46.9023563],[8.6106646,46.9291321],[8.620748507195325,46.95248947615856],[8.6707416,46.944109399999995],[8.692925699999998,46.9468797],[8.699566800000001,46.922979500000004],[8.7154904,46.9180938],[8.770920299999998,46.9414527],[8.791931899999998,46.9307976],[8.8107023,46.9414033],[8.827778399999998,46.91934749999999],[8.8743982,46.89501210000001],[8.935372,46.919872],[8.957277099999999,46.8879052],[8.9559119,46.87533210000001],[8.907582500000002,46.8602236],[8.875282400000001,46.84368749999999],[8.877046400000001,46.8129185]]]}},
{"type":"Feature","properties":{"abbrev":"GR","name":"Graubünden - Grigioni - Grischun","name_de":"Graubünden","name_fr":"Grisons","name_it":"Grigioni","iso":"CH-GR","canton_id":18},"geometry":{"type":"Polygon","coordinates":[[[9.1593659,46.169618500000006],[9.1355391,46.18037820000001],[9.111228199999998,46.204987599999995],[9.0890524,46.2123805],[9.0760223,46.237875900000006],[9.077761399999998,46.26030430000001],[9.053707900000001,46.293049200000006],[9.075106300000002,46.3146059],[9.064326,46.32537790000001],[9.088266899999999,46.3492032],[9.0893661,46.387112800000004],[9.1029153,46.4135546],[9.0870058,46.4437003],[9.0950675,46.460396300000006],[9.060544000000002,46.4763071],[9.021990399999998,46.51253690000001],[9.0166229,46.53205390000001],[9.0298926,46.5713449],[9.043750099999999,46.5872507],[9.0340908,46.6000269],[8.9953467,46.611734399999996],[8.9622012,46.6026448],[8.941453,46.6184975],[8.9057507,46.61225280000001],[8.916234200000002,46.592846900000005],[8.9036713,46.584105],[8.8432303,46.56336030000001],[8.829672,46.5713718],[8.800737000000002,46.563284499999995],[8.750586700000001,46.576055700000005],[8.717509399999999,46.5711114],[8.6787459,46.57919390000001],[8.6766766,46.6199699],[8.6510632,46.6345886],[8.654878399999998,46.649972000000005],[8.678607399999999,46.6642656],[8.6763262,46.6942145],[8.7089842,46.69896210000001],[8.7490648,46.72074020000001],[8.747639,46.73591060000001],[8.769588800000001,46.7443493],[8.7819848,46.72831210000002],[8.812978699999999,46.737314700000006],[8.826304,46.78835260000001],[8.8477105,46.79351950000001],[8.877046400000001,46.8129185],[8.914858599999999,46.8111533],[8.9278867,46.7965845],[9.0090128,46.811181299999994],[9.0647082,46.8752091],[9.0949332,46.870872399999996],[9.1093542,46.85082839999999],[9.1405478,46.8618409],[9.1561653,46.879392],[9.204126099999998,46.88309749999999],[9.248889499999999,46.91627139999999],[9.274070799999999,46.9067366],[9.3816947,46.8976333],[9.4332544,46.8845738],[9.4668226,46.88608759999999],[9.477784500000002,46.9205665],[9.518941599999998,46.970355100000006],[9.5455732,46.9765687],[9.5106838,47.0091449],[9.475786500000003,47.0517524],[9.4857484,47.0490919],[9.539511399999999,47.0650047],[9.559786900000002,47.048572400000005],[9.607198099999998,47.0607084],[9.6798285,47.06221310000001],[9.718554399999999,47.0433442],[9.7474502,47.0370584],[9.784361899999997,47.03854520000001],[9.8307567,47.014318900000006],[9.876246400000001,47.0212266],[9.8732561,47.0063484],[9.8919566,46.9889257],[9.8747183,46.9720605],[9.879917,46.9350666],[9.946120999999998,46.9123495],[10.0264672,46.895805700000004],[10.059405500000002,46.860787599999995],[10.087229399999998,46.861188999999996],[10.1051887,46.840901099999996],[10.122911499999999,46.8484387],[10.1687041,46.850614199999995],[10.193658699999999,46.8664423],[10.231919299999998,46.8667296],[10.226625199999999,46.893071],[10.241679799999998,46.931628999999994],[10.2898876,46.922889],[10.3169971,46.92593510000001],[10.3093489,46.9501997],[10.355641800000003,46.99233080000001],[10.398309099999999,46.99712530000001],[10.427145699999999,46.974953],[10.422106900000001,46.960190700000005],[10.488068099999998,46.93873890000001],[10.4862047,46.9154534],[10.464784500000002,46.88450639999999],[10.4717956,46.8487714],[10.456590300000002,46.8301893],[10.4476632,46.8011534],[10.4234639,46.7868853],[10.444237,46.7598206],[10.4001258,46.73277950000001],[10.418009399999999,46.7145345],[10.384477500000001,46.6828826],[10.4013023,46.6371815],[10.4546651,46.63746449999999],[10.4912662,46.61133890000001],[10.474686100000001,46.5666535],[10.472234100000001,46.54353090000001],[10.452789700000002,46.530709],[10.418250899999999,46.5513348],[10.397115,46.5439435],[10.363998,46.5554492],[10.336782600000001,46.5432623],[10.296064,46.549975800000006],[10.287458899999999,46.5703447],[10.241463199999998,46.589113100000006],[10.258876099999998,46.6104438],[10.224172399999997,46.62912600000001],[10.187973399999997,46.6255876],[10.127641099999998,46.6050826],[10.1029563,46.6108142],[10.101526999999999,46.585082],[10.0678807,46.55024409999999],[10.043958199999999,46.54011800000001],[10.0539911,46.522588400000004],[10.042372299999998,46.5101254],[10.0543439,46.4646302],[10.0391547,46.446943999999995],[10.086980200000001,46.4213468],[10.1431841,46.42832250000001],[10.1639813,46.390639],[10.1274641,46.3775456],[10.129101699999998,46.3608681],[10.1080369,46.35167949999999],[10.1045192,46.3330906],[10.1165953,46.31408649999999],[10.138667699999997,46.304676699999995],[10.1605909,46.283618100000005],[10.174912599999999,46.2546131],[10.1457038,46.2306066],[10.103462200000001,46.22857140000001],[10.0714427,46.21807020000001],[10.043942999999999,46.22963870000001],[10.060430700000001,46.2479576],[10.055524300000002,46.265841200000004],[9.9959074,46.2849432],[10.0000553,46.313175900000005],[9.9808979,46.322965200000006],[9.9961194,46.3426053],[9.952759200000003,46.379301399999996],[9.917005699999999,46.3703425],[9.909723,46.3796118],[9.8648249,46.36462739999999],[9.832392500000001,46.3611001],[9.818319099999998,46.3496752],[9.7698082,46.3357837],[9.737173599999997,46.35078099999999],[9.7229422,46.3407052],[9.726141399999998,46.319492999999994],[9.7144877,46.29289220000001],[9.676486100000002,46.3028918],[9.649840099999999,46.289773700000005],[9.618674999999998,46.2873716],[9.5831559,46.294335900000014],[9.5339479,46.3121612],[9.5135279,46.33313390000001],[9.496268399999998,46.36443739999999],[9.4611859,46.3758563],[9.4687973,46.3889361],[9.454640500000002,46.4189715],[9.4655789,46.469505100000006],[9.462656200000003,46.49801980000001],[9.4341806,46.49791280000001],[9.422942200000001,46.475199100000005],[9.390467300000001,46.4733141],[9.368448800000001,46.4942198],[9.373349800000002,46.503961399999994],[9.310899000000001,46.504058300000004],[9.281778499999998,46.4960455],[9.2750106,46.45949739999999],[9.246983299999998,46.446806599999995],[9.2496466,46.4311536],[9.2799473,46.41464459999999],[9.2770402,46.3685876],[9.295436100000002,46.3556165],[9.299244,46.3275461],[9.284850299999999,46.29705810000001],[9.2597533,46.27903590000001],[9.2467993,46.23234330000001],[9.2206923,46.22781500000001],[9.201351299999997,46.20674530000001],[9.194166599999999,46.1784976],[9.1593659,46.169618500000006]]]}},
{"type":"Feature","properties":{"abbrev":"TG","name":"Thurgau","name_de":"Thurgau","name_fr":"Thurgovie","name_it":"Turgovia","iso":"CH-TG","canton_id":20},"geometry":{"type":"MultiPolygon","coordinates":[[[[9.476796515915527,47.48974439512122],[9.476565329641724,47.48947761897711],[9.464505800000001,47.48704099999999],[9.449448138908625,47.501380115844825],[9.450207123052547,47.500946968878935],[9.450319066153437,47.50092091756071],[9.450869293864567,47.50065369967959],[9.453348756399715,47.50016508775738],[9.453394557123707,47.50015510318351],[9.453511742546084,47.50010798443881],[9.453781038399011,47.499659951168866],[9.453879979247464,47.499624559504284],[9.456538298714568,47.4984887302074],[9.456748496448384,47.49839313890435],[9.457373823343593,47.49817503679714],[9.45753889364156,47.49812052133441],[9.457561429213206,47.49811013906911],[9.45814444060881,47.49784154242228],[9.458232119598554,47.497801148215885],[9.458569659678078,47.49764881422601],[9.45871120306197,47.49760806371105],[9.459037764173306,47.49751404636393],[9.46034598550421,47.49713740782768],[9.460590891497166,47.49706689908995],[9.461233961332564,47.49688175849043],[9.461290684066238,47.49686542794538],[9.462065246329635,47.496898112586976],[9.462166971604695,47.49696376891122],[9.462203962171866,47.49698764365298],[9.462544233082356,47.496976813408075],[9.465151447383066,47.49666089216093],[9.465856513966948,47.496418417294585],[9.46726792125875,47.49535383977942],[9.467253998347331,47.495293964723736],[9.467886060448427,47.49511384753314],[9.468736775022617,47.49454169889317],[9.469292881578928,47.49379971286668],[9.471247655081354,47.492295711379676],[9.471292501638944,47.4922755459532],[9.471411560121993,47.49222201085004],[9.472083278140015,47.49191997026912],[9.47226486249449,47.49183832016828],[9.47228858995232,47.49183471816498],[9.472327526400012,47.49183185473317],[9.4724381,47.4917523],[9.47263,47.4915382],[9.473139429739726,47.491288061037686],[9.473189533380214,47.491246532398755],[9.47324140378614,47.491203539367945],[9.4732711188542,47.49117890989351],[9.47594815332883,47.49017788868828],[9.476796515915527,47.48974439512122]]],[[[9.435785309059646,47.50659256461002],[9.406458,47.4924896],[9.341798099999998,47.5037224],[9.3531534,47.5192251],[9.318645,47.5315204],[9.2822861,47.52068439999999],[9.291559999999999,47.50666439999999],[9.3200558,47.49683890000001],[9.2986449,47.4772327],[9.262584000000002,47.4745002],[9.1691694,47.49830580000001],[9.1226901,47.4806761],[9.0835434,47.4937642],[9.012477800000001,47.4899739],[9.010048,47.47162839999999],[9.047458099999998,47.444233499999996],[8.989464800000002,47.4294378],[8.988571599999998,47.41188469999999],[8.966346600000001,47.3857039],[8.9435245,47.375917],[8.9415458,47.3873169],[8.912514200000002,47.4126901],[8.908979399999998,47.447731399999995],[8.8848961,47.469666499999995],[8.896749300000002,47.52561280000001],[8.840761399999998,47.53271130000001],[8.806038200000001,47.5831495],[8.748218899999996,47.59231050000001],[8.745827699999998,47.620822200000006],[8.789796500000001,47.6094092],[8.8131607,47.61653270000001],[8.8261772,47.646953800000006],[8.785398099999998,47.65511610000001],[8.743358599999997,47.639771200000006],[8.6880095,47.6500318],[8.669417900000001,47.684893499999994],[8.690452500000001,47.69542690000001],[8.717855599999998,47.6906978],[8.728052699999997,47.6926837],[8.7960128,47.67539130000001],[8.8168889,47.677806399999994],[8.862833050770675,47.654943970736525],[8.9063821,47.6435951],[8.9702513,47.6591403],[8.9841535,47.6694559],[9.0369829,47.6750779],[9.089293,47.6735295],[9.0962617,47.6666154],[9.157839200000002,47.66576310000001],[9.169738,47.6560231],[9.249332,47.6304844],[9.2992458,47.6109147],[9.3272325,47.5929108],[9.3852357,47.5700445],[9.3873033,47.5459778],[9.4292188,47.5205169],[9.435785309059646,47.50659256461002]]]]}},
{"type":"Feature","properties":{"abbrev":"SH","name":"Schaffhausen","name_de":"Schaffhausen","name_fr":"Schaffhouse","name_it":"Sciaffusa","iso":"CH-SH","canton_id":14},"geometry":{"type":"MultiPolygon","coordinates":[[[[8.595746000000002,47.6055872],[8.5800884,47.5784735],[8.5542602,47.553029499999994],[8.5353357,47.58711830000001],[8.563066000000001,47.599448900000006],[8.595746000000002,47.6055872]]],[[[8.862833050770675,47.654943970736525],[8.8168889,47.677806399999994],[8.7960128,47.67539130000001],[8.796823299999998,47.70275240000001],[8.769697200000001,47.71783739999999],[8.7965504,47.73455820000001],[8.8255139,47.7110107],[8.8682806,47.705386700000005],[8.850531300000002,47.681177],[8.873426000000002,47.67021870000001],[8.862833050770675,47.654943970736525]]],[[[8.728052699999997,47.6926837],[8.717855599999998,47.6906978],[8.704626699999999,47.7134361],[8.683823299999998,47.70873690000001],[8.663453500000001,47.6858858],[8.624574299999999,47.6912613],[8.6062596,47.668871100000004],[8.5775929,47.6615273],[8.5607921,47.67041530000001],[8.533782,47.64911060000001],[8.4774188,47.644506],[8.4451024,47.653873999999995],[8.405576100000001,47.674199800000004],[8.404628599999999,47.698045400000005],[8.4453242,47.723080100000004],[8.456016100000001,47.7484635],[8.4731316,47.7640803],[8.5563313,47.783880599999996],[8.579880200000002,47.8001213],[8.6114098,47.8019101],[8.6194299,47.7676677],[8.642383099999998,47.76521560000001],[8.656847800000001,47.8004536],[8.6823546,47.7837097],[8.688693299999999,47.758369300000005],[8.714054699999998,47.76540870000001],[8.7236098,47.74565810000001],[8.711143799999999,47.7301477],[8.7329853,47.71851550000001],[8.728052699999997,47.6926837]]]]}},
{"type":"Feature","properties":{"abbrev":"GE","name":"Genève","name_de":"Genf","name_fr":"Genève","name_it":"Ginevra","iso":"CH-GE","canton_id":25},"geometry":{"type":"Polygon","coordinates":[[[6.125790299999999,46.317462799999994],[6.170229900000003,46.294851200000004],[6.170716,46.2756778],[6.1516903,46.2512965],[6.1541921,46.2043527],[6.1905496,46.2330279],[6.1967505,46.2615738],[6.238379700000001,46.281647299999996],[6.2667923000000005,46.247691399999994],[6.2898068,46.259959300000006],[6.310287799999999,46.2439735],[6.294685899999999,46.225152600000015],[6.2473695000000005,46.205341000000004],[6.232624700000001,46.20595910000001],[6.1861874,46.178315800000014],[6.1887837999999995,46.16638580000001],[6.1364595,46.1415966],[6.0918209,46.1519451],[6.0522995,46.151387099999994],[6.0371774,46.138057800000006],[5.9642377,46.144615200000004],[5.9948887,46.1830579],[5.963715499999999,46.1970214],[5.979123100000002,46.2172373],[6.0014888,46.22050630000001],[6.0336572,46.23855480000001],[6.083208300000001,46.246199700000005],[6.1014498,46.2376461],[6.124452899999999,46.251255300000004],[6.1025637,46.2848528],[6.1217492,46.299086100000004],[6.125790299999999,46.317462799999994]]]}},
{"type":"Feature","properties":{"abbrev":"ZH","name":"Zürich","name_de":"Zürich","name_fr":"Zurich","name_it":"Zurigo","iso":"CH-ZH","canton_id":1},"geometry":{"type":"Polygon","coordinates":[[[8.795803855081171,47.23898178469695],[8.7352777,47.233431],[8.6772334,47.2585775],[8.6144638,47.278469],[8.5765948,47.3174949],[8.5651496,47.3452533],[8.5377658,47.3410272],[8.5602257,47.3036634],[8.5945877,47.2625951],[8.6523083,47.2486792],[8.713114718537444,47.2030393018414],[8.681063599999998,47.184072300000004],[8.692195,47.1634006],[8.661229299999999,47.1609515],[8.628039,47.17897850000001],[8.6157158,47.198616400000006],[8.5833397,47.216827499999994],[8.539215099999998,47.22305540000001],[8.479897500000002,47.2086217],[8.441121699999997,47.225215300000016],[8.4216847,47.22332080000001],[8.410073399999998,47.24837580000001],[8.3911146,47.28744759999999],[8.417049,47.2938218],[8.4320429,47.311546099999994],[8.4038608,47.346568],[8.407298699999998,47.355693099999996],[8.3835219,47.3952577],[8.3922283,47.421883599999994],[8.363263,47.48085639999999],[8.3612212,47.5101016],[8.4169263,47.55026899999999],[8.425633000000001,47.5678387],[8.466855,47.584248699999996],[8.457024,47.597380900000005],[8.515646800000003,47.633791300000006],[8.5578837,47.624455700000006],[8.563066000000001,47.599448900000006],[8.5353357,47.58711830000001],[8.5542602,47.553029499999994],[8.5800884,47.5784735],[8.595746000000002,47.6055872],[8.604295699999998,47.61780149999999],[8.595690900000001,47.6430375],[8.612374299999999,47.649887299999996],[8.6062596,47.668871100000004],[8.624574299999999,47.6912613],[8.663453500000001,47.6858858],[8.669417900000001,47.684893499999994],[8.6880095,47.6500318],[8.743358599999997,47.639771200000006],[8.785398099999998,47.65511610000001],[8.8261772,47.646953800000006],[8.8131607,47.61653270000001],[8.789796500000001,47.6094092],[8.745827699999998,47.620822200000006],[8.748218899999996,47.59231050000001],[8.806038200000001,47.5831495],[8.840761399999998,47.53271130000001],[8.896749300000002,47.52561280000001],[8.8848961,47.469666499999995],[8.908979399999998,47.447731399999995],[8.912514200000002,47.4126901],[8.9415458,47.3873169],[8.9435245,47.375917],[8.97441,47.3473753],[8.9849407,47.31938939999999],[8.956520300000001,47.304260299999996],[8.9444545,47.2694976],[8.933096500000001,47.25888749999999],[8.873487500000003,47.251991499999995],[8.8268174,47.25146749999999],[8.795803855081171,47.23898178469695]]]}},
{"type":"Feature","properties":{"abbrev":"NE","name":"Neuchâtel","name_de":"Neuenburg","name_fr":"Neuchâtel","name_it":"Neuchâtel","iso":"CH-NE","canton_id":24},"geometry":{"type":"MultiPolygon","coordinates":[[[[7.0876538999999985,47.059733300000005],[7.076192457073798,47.0506367548629],[7.0403585,47.0369646],[7.026398910296264,47.004315620306045],[6.9836388,47.0110667],[6.9547965,46.9960296],[6.8736048,46.9703728],[6.8710918,46.9450651],[6.8466268,46.9382311],[6.8044936,46.9152854],[6.755324450981469,46.87045276298052],[6.7368009,46.8738118],[6.740114799999999,46.8948101],[6.7210012,46.905380900000004],[6.7156266,46.934787099999994],[6.6472295,46.9106982],[6.627086099999999,46.8887095],[6.5872571,46.884160699999995],[6.5286929,46.85906049999999],[6.4822708,46.8466022],[6.4601921,46.851293899999995],[6.4645461,46.890278200000004],[6.4326552,46.9286841],[6.4603267,46.94386909999999],[6.496502700000001,46.9741095],[6.504793,46.965673],[6.6336875,46.99818290000001],[6.659293300000001,47.0273404],[6.7115123,47.0480374],[6.700308000000001,47.0696638],[6.7146622,47.088195400000004],[6.7388741,47.09047270000001],[6.7564554,47.1169888],[6.8066078,47.131152400000005],[6.858623000000001,47.16550280000001],[6.861515999999999,47.16558920000001],[6.888803,47.13112580000001],[6.8668643,47.0851144],[6.9265867,47.109146],[6.99784,47.119401599999996],[7.075677000000001,47.09625880000001],[7.0876538999999985,47.059733300000005]]],[[[7.03925836208361,46.98145261836348],[7.0401636000000005,46.9798427],[7.0403444,46.979520900000004],[7.038651672169631,46.97985090042572],[7.03925836208361,46.98145261836348]]]]}},
{"type":"Feature","properties":{"abbrev":"BL","name":"Basel-Landschaft","name_de":"Basel-Landschaft","name_fr":"Bâle-Campagne","name_it":"Basilea Campagna","iso":"CH-BL","canton_id":13},"geometry":{"type":"MultiPolygon","coordinates":[[[[7.375945799999999,47.41409949999999],[7.3587199,47.41515390000001],[7.3272903,47.440015100000004],[7.381198,47.4320817],[7.375945799999999,47.41409949999999]]],[[[7.4373242,47.38088849999999],[7.4162762,47.384788799999995],[7.375945799999999,47.41409949999999],[7.447491100000001,47.41448419999999],[7.455576499999999,47.4279232],[7.4209041,47.4459442],[7.4457652,47.461972800000005],[7.4565122,47.4492558],[7.4982107000000005,47.45968669999999],[7.530679100000001,47.4611886],[7.5317892,47.49739890000001],[7.5104466,47.5026276],[7.530955799999999,47.52904530000001],[7.5188571,47.546334900000005],[7.5546583,47.5643681],[7.564785399999999,47.5456863],[7.5947814,47.519293999999995],[7.633955799999999,47.5612235],[7.667970999999999,47.5357644],[7.7134685,47.5397835],[7.737974199999999,47.527325000000005],[7.789858300000001,47.5190259],[7.807418199999999,47.497138500000005],[7.8573097999999995,47.5332111],[7.863956799999999,47.5193092],[7.8939938,47.5060566],[7.904822,47.4849093],[7.9325716,47.48142149999999],[7.9568349,47.4552115],[7.9467846,47.4431934],[7.9618317,47.4218343],[7.909737700000001,47.398521],[7.8053835,47.3623861],[7.7935609,47.339052300000006],[7.7541924,47.343172100000004],[7.727913799999999,47.368858900000006],[7.7019536,47.372447199999996],[7.6442033,47.367208399999996],[7.6327228,47.4100311],[7.679802100000001,47.417514],[7.685004899999999,47.4475751],[7.7066078000000005,47.46857850000001],[7.6997610000000005,47.4806325],[7.668326599999999,47.4863467],[7.640966,47.4827341],[7.6072998,47.4893984],[7.604524299999999,47.4705364],[7.622601599999999,47.45714449999999],[7.614019599999999,47.433354900000005],[7.5920692,47.43271180000001],[7.5660724,47.4134092],[7.5430785,47.4140329],[7.5186167,47.388222999999996],[7.4923275,47.3852318],[7.4773510000000005,47.401025499999996],[7.441311400000001,47.40017890000001],[7.4373242,47.38088849999999]]]]}},
{"type":"Feature","properties":{"abbrev":"SG","name":"Sankt Gallen","name_de":"Sankt Gallen","name_fr":"Saint-Gall","name_it":"San Gallo","iso":"CH-SG","canton_id":17},"geometry":{"type":"MultiPolygon","coordinates":[[[[9.475786500000003,47.0517524],[9.5106838,47.0091449],[9.5455732,46.9765687],[9.518941599999998,46.970355100000006],[9.477784500000002,46.9205665],[9.4668226,46.88608759999999],[9.4332544,46.8845738],[9.3816947,46.8976333],[9.274070799999999,46.9067366],[9.248889499999999,46.91627139999999],[9.239128399999997,46.939385900000005],[9.249674299999999,46.997958100000005],[9.236348799999998,47.0239832],[9.201652699999999,47.0351215],[9.180518,47.02592250000001],[9.138058799999998,47.03913520000001],[9.167394,47.0494002],[9.190290599999999,47.069892700000004],[9.1898696,47.123699900000005],[9.1154179,47.13275270000001],[9.069459500000002,47.129811200000006],[9.0047149,47.1732618],[8.962134400000002,47.17937980000001],[8.969954800000002,47.2170932],[8.94144684950298,47.21813280128138],[8.919351,47.2259211],[8.8775936,47.2155391],[8.8155346,47.2226807],[8.795803855081171,47.23898178469695],[8.8268174,47.25146749999999],[8.873487500000003,47.251991499999995],[8.933096500000001,47.25888749999999],[8.9444545,47.2694976],[8.956520300000001,47.304260299999996],[8.9849407,47.31938939999999],[8.97441,47.3473753],[8.9435245,47.375917],[8.966346600000001,47.3857039],[8.988571599999998,47.41188469999999],[8.989464800000002,47.4294378],[9.047458099999998,47.444233499999996],[9.010048,47.47162839999999],[9.012477800000001,47.4899739],[9.0835434,47.4937642],[9.1226901,47.4806761],[9.1691694,47.49830580000001],[9.262584000000002,47.4745002],[9.2986449,47.4772327],[9.3200558,47.49683890000001],[9.291559999999999,47.50666439999999],[9.2822861,47.52068439999999],[9.318645,47.5315204],[9.3531534,47.5192251],[9.341798099999998,47.5037224],[9.406458,47.4924896],[9.435785309059646,47.50659256461002],[9.449448138908625,47.501380115844825],[9.464505800000001,47.48704099999999],[9.476565329641724,47.48947761897711],[9.4985914,47.4780659],[9.5306715,47.4804763],[9.563472800000001,47.4942207],[9.592921099999998,47.46590030000001],[9.654416300000001,47.454252399999994],[9.644363299999997,47.4358537],[9.6518975,47.4083614],[9.673821199999999,47.3908307],[9.653866500000001,47.3680802],[9.6244598,47.366145100000004],[9.5993193,47.344817299999995],[9.5835354,47.3126155],[9.554499200000002,47.29562030000001],[9.533147099999999,47.2730917],[9.5046405,47.22512540000001],[9.4859776,47.180525],[9.5081841,47.1407276],[9.519580600000001,47.09833730000001],[9.5127602,47.085142100000006],[9.475092800000002,47.066967],[9.475786500000003,47.0517524]],[[9.3432648,47.249398600000006],[9.382006700000002,47.233996600000005],[9.4419863,47.25328449999999],[9.4877576,47.2882911],[9.502909500000001,47.3474363],[9.498949,47.363606999999995],[9.5095577,47.3946992],[9.555282200000002,47.3964518],[9.5830108,47.4096486],[9.589521099999999,47.425635400000004],[9.617829299999999,47.4376767],[9.612973599999998,47.448782800000004],[9.5796749,47.462706700000005],[9.5325141,47.46784749999999],[9.5239391,47.45136739999999],[9.453099100000001,47.432686999999994],[9.435002200000001,47.434294099999995],[9.426483600000001,47.4075194],[9.4018649,47.4008402],[9.3716713,47.4077137],[9.302946300000002,47.3952218],[9.271869399999998,47.4010325],[9.231824599999998,47.38777639999999],[9.198637399999999,47.34778239999999],[9.2246068,47.3425515],[9.212558699999999,47.319904099999995],[9.224090699999998,47.29359920000001],[9.206250999999998,47.2763964],[9.2327167,47.2655644],[9.273584600000001,47.26999290000001],[9.3186333,47.2478785],[9.3432648,47.249398600000006]]],[[[9.472500065312731,47.49176460806499],[9.472475300520367,47.491779276844994],[9.472327526400012,47.49183185473317],[9.47228858995232,47.49183471816498],[9.472442,47.4918245],[9.472500065312731,47.49176460806499]]]]}},
{"type":"Feature","properties":{"abbrev":"VS","name":"Valais - Wallis","name_de":"Wallis","name_fr":"Valais","name_it":"Vallese","iso":"CH-VS","canton_id":23},"geometry":{"type":"Polygon","coordinates":[[[8.384737500000002,46.452153100000004],[8.366967800000001,46.4520028],[8.290991899999998,46.4088143],[8.3171912,46.3939237],[8.3127607,46.377162],[8.2496575,46.3407198],[8.2220029,46.3298492],[8.198657099999998,46.3022554],[8.159609500000002,46.2960605],[8.138141799999998,46.30199759999999],[8.0808675,46.258436700000004],[8.110159099999999,46.249509200000006],[8.138882599999999,46.22615260000001],[8.1652756,46.1770043],[8.1511295,46.16542200000001],[8.146215599999998,46.1377542],[8.115261099999998,46.1302395],[8.108218199999998,46.11162469999999],[8.034723199999998,46.1008515],[8.0238439,46.063086999999996],[8.0340968,46.043395600000004],[8.0139108,46.0303666],[7.988665100000001,45.995994200000005],[7.908696000000001,45.9969671],[7.8781064,45.973568],[7.8635632,45.916700399999996],[7.8219436,45.9270147],[7.8025471,45.91784059999999],[7.769385,45.9369682],[7.747963700000001,45.9403754],[7.735114199999999,45.9240306],[7.707362600000001,45.935217],[7.7099398,45.9480114],[7.681055199999999,45.9569556],[7.6578284,45.976640399999994],[7.636994,45.970157],[7.586981,45.970926399999996],[7.5783760000000004,45.986049599999994],[7.550180199999999,45.98597290000001],[7.543119,45.957347199999994],[7.519135499999999,45.9613067],[7.478602800000001,45.9525756],[7.474917,45.93650220000001],[7.444748100000001,45.93151520000001],[7.4341783,45.9199741],[7.401409000000001,45.910954399999994],[7.382970499999999,45.8965091],[7.3447404,45.914851799999994],[7.28584,45.916296499999994],[7.276803600000001,45.9007355],[7.2164189,45.8887288],[7.1906175999999995,45.8586781],[7.1536499000000005,45.87927139999999],[7.118131599999999,45.8591789],[7.064189899999999,45.9002288],[7.0439612,45.9228216],[7.0357954000000005,45.955839499999996],[7.010416899999999,45.99726749999999],[6.9853106,46.0041985],[6.924598499999999,46.0652411],[6.8914056,46.0426379],[6.8720667,46.0510053],[6.890959799999999,46.0740908],[6.882336199999999,46.09517930000001],[6.8979439,46.1219811],[6.7980480000000005,46.13615030000001],[6.7917076000000005,46.16281280000001],[6.812557399999999,46.181420499999994],[6.8038243,46.20250210000001],[6.8398013,46.24821920000001],[6.8519884,46.25213790000001],[6.864372499999999,46.283099],[6.8253737,46.311958999999995],[6.786698500000001,46.332145700000005],[6.770626200000001,46.3554324],[6.805437199999999,46.378410200000005],[6.858819899999999,46.3946587],[6.8852804,46.375479399999996],[6.8821691000000005,46.353662199999995],[6.9005028,46.3387541],[6.9299019,46.3302108],[6.9389012,46.295924400000004],[7.0019592,46.23310980000001],[7.0122939,46.205097900000005],[7.0325304,46.1874349],[7.0881229,46.20153320000001],[7.1501486,46.2430785],[7.196955499999999,46.2891276],[7.1890894,46.302754900000004],[7.221729700000001,46.3294194],[7.2542983,46.3311231],[7.262305499999999,46.3582368],[7.2907006,46.3671762],[7.312529,46.3636531],[7.3156452,46.34366149999999],[7.353964899999999,46.350341799999995],[7.3996257000000005,46.3765624],[7.4432312000000005,46.383001099999994],[7.486867700000001,46.3707236],[7.526966,46.37462449999999],[7.555269900000001,46.3889749],[7.5340874,46.4098148],[7.5784418,46.4172728],[7.595526499999999,46.411428099999995],[7.6088007,46.435067599999996],[7.626100799999999,46.4450525],[7.6936105999999995,46.424654399999994],[7.708647200000001,46.4139147],[7.7782845,46.4434859],[7.798138499999999,46.4586006],[7.8446273,46.4784867],[7.89779,46.4825305],[7.9431116,46.5080036],[7.9708165,46.516531300000004],[7.9690054,46.5448423],[8.0152667,46.5632279],[8.060036900000002,46.552647199999996],[8.1144938,46.546590800000004],[8.126206999999999,46.5373078],[8.174335699999999,46.5313918],[8.191170999999997,46.52300520000001],[8.241230899999998,46.52657610000001],[8.302766100000001,46.545529800000004],[8.3366047,46.561123],[8.3646716,46.5824784],[8.3618932,46.6017862],[8.3792331,46.633631300000005],[8.410228899999998,46.653028],[8.421367499999999,46.644503300000004],[8.420400800000001,46.61635220000001],[8.406140800000001,46.5859648],[8.4290073,46.5434931],[8.4776224,46.5276306],[8.4429412,46.4954834],[8.391653699999999,46.491678900000004],[8.384737500000002,46.452153100000004]]]}},
{"type":"Feature","properties":{"abbrev":"TI","name":"Ticino","name_de":"Tessin","name_fr":"Tessin","name_it":"Ticino","iso":"CH-TI","canton_id":21},"geometry":{"type":"MultiPolygon","coordinates":[[[[8.384737500000002,46.452153100000004],[8.391653699999999,46.491678900000004],[8.4429412,46.4954834],[8.4776224,46.5276306],[8.520374699999998,46.542554],[8.5130602,46.558077],[8.5390025,46.5864789],[8.5725087,46.5837501],[8.590531200000001,46.5734078],[8.626565699999999,46.5763764],[8.6407392,46.564098800000004],[8.6787459,46.57919390000001],[8.717509399999999,46.5711114],[8.750586700000001,46.576055700000005],[8.800737000000002,46.563284499999995],[8.829672,46.5713718],[8.8432303,46.56336030000001],[8.9036713,46.584105],[8.916234200000002,46.592846900000005],[8.9057507,46.61225280000001],[8.941453,46.6184975],[8.9622012,46.6026448],[8.9953467,46.611734399999996],[9.0340908,46.6000269],[9.043750099999999,46.5872507],[9.0298926,46.5713449],[9.0166229,46.53205390000001],[9.021990399999998,46.51253690000001],[9.060544000000002,46.4763071],[9.0950675,46.460396300000006],[9.0870058,46.4437003],[9.1029153,46.4135546],[9.0893661,46.387112800000004],[9.088266899999999,46.3492032],[9.064326,46.32537790000001],[9.075106300000002,46.3146059],[9.053707900000001,46.293049200000006],[9.077761399999998,46.26030430000001],[9.0760223,46.237875900000006],[9.0890524,46.2123805],[9.111228199999998,46.204987599999995],[9.1355391,46.18037820000001],[9.1593659,46.169618500000006],[9.1209473,46.1345213],[9.0723726,46.1179781],[9.0890597,46.0900947],[9.076934900000001,46.063972400000004],[9.050197200000001,46.06237810000001],[9.017197399999999,46.0497541],[9.0090476,46.02695260000001],[9.0225671,46.0168108],[8.9814225,45.9999312],[8.9499269,46.0011569],[8.9555053,45.9766293],[8.9373213,45.9405933],[8.9170289,45.9227112],[8.897657,45.9329057],[8.9046489,45.9497655],[8.8949767,45.975685],[8.8698062,45.9606363],[8.8306818,45.988064699999995],[8.787241999999999,45.991383],[8.805882800000003,46.021954300000004],[8.8293385,46.046438200000004],[8.854503900000001,46.061586399999996],[8.852034800000004,46.075630600000004],[8.815553300000001,46.097204399999995],[8.783008299999999,46.0940992],[8.7568015,46.1035741],[8.8061899,46.1353122],[8.8578075,46.1487883],[8.834302,46.179908],[8.8011774,46.1693975],[8.8028469,46.1502513],[8.7667547,46.1547581],[8.7346726,46.1478633],[8.6972473,46.1035605],[8.6576119,46.1127419],[8.6458918,46.12382590000001],[8.6127224,46.1216117],[8.5697931,46.1770171],[8.540871399999997,46.1974097],[8.5325471,46.218362600000006],[8.468761699999998,46.233041],[8.455853900000001,46.26380820000001],[8.42775,46.29831510000002],[8.465346300000002,46.333848399999994],[8.4700021,46.3615867],[8.4610347,46.3864257],[8.4707154,46.3957661],[8.458170899999999,46.4201873],[8.466138200000001,46.442498300000004],[8.438194399999999,46.4642213],[8.384737500000002,46.452153100000004]]],[[[9.024702283406292,46.00084595183679],[8.988971399999997,45.970342200000005],[9.0139802,45.9605935],[9.0196129,45.9300603],[9.0427083,45.9275286],[9.074487900000001,45.9123601],[9.0778344,45.885094699999996],[9.054782200000002,45.8735794],[9.028878799999998,45.82068639999999],[8.9928834,45.823259900000004],[8.948890999999998,45.8434913],[8.914254999999999,45.8422426],[8.937379399999998,45.867397399999994],[8.9223977,45.896746300000004],[8.9247826,45.9166352],[8.9757221,45.9616889],[8.9806598,45.985871],[9.024702283406292,46.00084595183679]]]]}},
{"type":"Feature","properties":{"abbrev":"BS","name":"Basel-Stadt","name_de":"Basel-Stadt","name_fr":"Bâle-Ville","name_it":"Basilea Città","iso":"CH-BS","canton_id":12},"geometry":{"type":"Polygon","coordinates":[[[7.633955799999999,47.5612235],[7.5947814,47.519293999999995],[7.564785399999999,47.5456863],[7.5546583,47.5643681],[7.5890388,47.5898969],[7.619134299999999,47.576869699999996],[7.645669600000001,47.59695520000001],[7.667330099999999,47.5919456],[7.6836701000000005,47.5739056],[7.633955799999999,47.5612235]]]}},
{"type":"Feature","properties":{"abbrev":"AI","name":"Appenzell Innerrhoden","name_de":"Appenzell Innerrhoden","name_fr":"Appenzell Rhodes-Intérieures","name_it":"Appenzello Interno","iso":"CH-AI","canton_id":16},"geometry":{"type":"MultiPolygon","coordinates":[[[[9.5830108,47.4096486],[9.5706259,47.4343432],[9.617829299999999,47.4376767],[9.589521099999999,47.425635400000004],[9.5830108,47.4096486]]],[[[9.555282200000002,47.3964518],[9.5095577,47.3946992],[9.524098699999998,47.4212115],[9.552739700000002,47.42739830000001],[9.573489000000002,47.408501300000005],[9.555282200000002,47.3964518]]],[[[9.3432648,47.249398600000006],[9.313557200000002,47.291448700000004],[9.3169994,47.316104499999994],[9.3436679,47.352181699999996],[9.3653577,47.3583686],[9.350729300000001,47.3831584],[9.3770228,47.387176],[9.4118851,47.3687673],[9.4305859,47.3677032],[9.465746900000003,47.346424799999994],[9.502909500000001,47.3474363],[9.4877576,47.2882911],[9.4419863,47.25328449999999],[9.382006700000002,47.233996600000005],[9.3432648,47.249398600000006]]]]}},
{"type":"Feature","properties":{"abbrev":"AR","name":"Appenzell Ausserrhoden","name_de":"Appenzell Ausserrhoden","name_fr":"Appenzell Rhodes-Extérieures","name_it":"Appenzello Esterno","iso":"CH-AR","canton_id":15},"geometry":{"type":"Polygon","coordinates":[[[9.617829299999999,47.4376767],[9.5706259,47.4343432],[9.5830108,47.4096486],[9.555282200000002,47.3964518],[9.573489000000002,47.408501300000005],[9.552739700000002,47.42739830000001],[9.524098699999998,47.4212115],[9.5095577,47.3946992],[9.498949,47.363606999999995],[9.502909500000001,47.3474363],[9.465746900000003,47.346424799999994],[9.4305859,47.3677032],[9.4118851,47.3687673],[9.3770228,47.387176],[9.350729300000001,47.3831584],[9.3653577,47.3583686],[9.3436679,47.352181699999996],[9.3169994,47.316104499999994],[9.313557200000002,47.291448700000004],[9.3432648,47.249398600000006],[9.3186333,47.2478785],[9.273584600000001,47.26999290000001],[9.2327167,47.2655644],[9.206250999999998,47.2763964],[9.224090699999998,47.29359920000001],[9.212558699999999,47.319904099999995],[9.2246068,47.3425515],[9.198637399999999,47.34778239999999],[9.231824599999998,47.38777639999999],[9.271869399999998,47.4010325],[9.302946300000002,47.3952218],[9.3716713,47.4077137],[9.4018649,47.4008402],[9.426483600000001,47.4075194],[9.435002200000001,47.434294099999995],[9.453099100000001,47.432686999999994],[9.5239391,47.45136739999999],[9.5325141,47.46784749999999],[9.5796749,47.462706700000005],[9.612973599999998,47.448782800000004],[9.617829299999999,47.4376767]]]}},
{"type":"Feature","properties":{"abbrev":"AG","name":"Aargau","name_de":"Aargau","name_fr":"Argovie","name_it":"Argovia","iso":"CH-AG","canton_id":19},"geometry":{"type":"Polygon","coordinates":[[[8.410073399999998,47.24837580000001],[8.3949593,47.225040400000005],[8.414968599999998,47.16550130000001],[8.4122057,47.1405668],[8.375939700000002,47.141018100000004],[8.3385953,47.1784435],[8.31172,47.2454847],[8.285368899999998,47.27999330000001],[8.250716800000001,47.286086999999995],[8.228571599999997,47.27341590000001],[8.2033045,47.2314416],[8.175982800000002,47.221903700000006],[8.160756600000001,47.2317576],[8.165147600000001,47.2501815],[8.1090964,47.244530000000005],[8.088375799999998,47.2628873],[8.0629796,47.2466594],[8.0157512,47.244162800000005],[8.0168109,47.259323800000004],[7.986887100000001,47.2760234],[7.949161600000001,47.27253960000001],[7.961878400000001,47.254058900000004],[7.9334826000000005,47.23589570000001],[7.9101007,47.2439465],[7.838664700000001,47.234818100000005],[7.825106899999999,47.26557230000002],[7.8418057,47.2744707],[7.860412199999999,47.305533800000006],[7.888661300000001,47.31126709999999],[7.909338900000001,47.340961699999994],[7.976503300000001,47.3234438],[8.0051906,47.3367516],[8.0104736,47.3569507],[8.027333599999999,47.3701892],[8.0265612,47.3956224],[7.9631993,47.42235470000001],[7.987270700000001,47.4287435],[7.9742854,47.4595479],[7.9568349,47.4552115],[7.9325716,47.48142149999999],[7.904822,47.4849093],[7.8939938,47.5060566],[7.863956799999999,47.5193092],[7.8573097999999995,47.5332111],[7.807418199999999,47.497138500000005],[7.789858300000001,47.5190259],[7.737974199999999,47.527325000000005],[7.7134685,47.5397835],[7.7506395,47.5442756],[7.795685199999999,47.5573822],[7.822544399999999,47.58798779999999],[7.8451623,47.5822085],[7.8919977999999995,47.587422999999994],[7.9106453000000005,47.5710659],[7.916447600000001,47.5479185],[7.9468215,47.54406899999999],[7.9602825,47.558058],[8.0207163,47.550405399999995],[8.0710963,47.56413800000001],[8.098905399999998,47.562223200000005],[8.1101412,47.5827505],[8.1338175,47.583399],[8.1845464,47.60471870000001],[8.2053645,47.6210607],[8.2237668,47.6074306],[8.255289600000001,47.6151867],[8.288699999999999,47.6102043],[8.2958002,47.591947399999995],[8.329626600000001,47.5709048],[8.382541300000002,47.565354600000006],[8.399594900000002,47.576909300000004],[8.425633000000001,47.5678387],[8.4169263,47.55026899999999],[8.3612212,47.5101016],[8.363263,47.48085639999999],[8.3922283,47.421883599999994],[8.3835219,47.3952577],[8.407298699999998,47.355693099999996],[8.4038608,47.346568],[8.4320429,47.311546099999994],[8.417049,47.2938218],[8.3911146,47.28744759999999],[8.410073399999998,47.24837580000001]]]}},
{"type":"Feature","properties":{"abbrev":"VD","name":"Vaud","name_de":"Waadt","name_fr":"Vaud","name_it":"Vaud","iso":"CH-VD","canton_id":22},"geometry":{"type":"MultiPolygon","coordinates":[[[[7.0908601,46.9038187],[7.0833048,46.89611880000001],[7.071031400000001,46.8734517],[7.042916799999999,46.846886299999994],[7.030433,46.875280499999995],[6.961744182997495,46.92746044261733],[7.0185283,46.9585512],[7.038651672169631,46.97985090042572],[7.0403444,46.979520900000004],[7.0579041999999985,46.9654084],[7.06005901155696,46.93638706707748],[7.0349977,46.9233493],[7.0462117,46.9059439],[7.084458191078184,46.91286149746636],[7.0908601,46.9038187]]],[[[7.221729700000001,46.3294194],[7.1890894,46.302754900000004],[7.196955499999999,46.2891276],[7.1501486,46.2430785],[7.0881229,46.20153320000001],[7.0325304,46.1874349],[7.0122939,46.205097900000005],[7.0019592,46.23310980000001],[6.9389012,46.295924400000004],[6.9299019,46.3302108],[6.9005028,46.3387541],[6.8821691000000005,46.353662199999995],[6.8852804,46.375479399999996],[6.858819899999999,46.3946587],[6.9151308,46.3952638],[6.9304188,46.406956],[6.9087787,46.430697],[6.8312303,46.4680098],[6.7761337,46.4747466],[6.743543,46.4894172],[6.7217028,46.4864916],[6.6978212,46.4989629],[6.6579801,46.5059358],[6.6206041,46.5060819],[6.5906023,46.5183722],[6.5601099,46.5078768],[6.5074091,46.5158],[6.4458966,46.4730715],[6.4018144,46.4589072],[6.3818742,46.4651786],[6.3471995,46.4614173],[6.2905115,46.4220276],[6.2740778,46.3901762],[6.2591158,46.3930001],[6.212682956938134,46.35316911933408],[6.206987174841787,46.33885500204647],[6.1942599,46.315986],[6.170229900000003,46.294851200000004],[6.125790299999999,46.317462799999994],[6.137804999999999,46.338305600000005],[6.169935999999999,46.3660776],[6.0976447,46.4091536],[6.063857799999999,46.416395200000004],[6.0856139,46.44084039999999],[6.072797100000001,46.465441399999996],[6.0969537,46.481234799999996],[6.1126314,46.509596200000004],[6.1566588,46.5452979],[6.110526599999999,46.576478200000004],[6.126510299999999,46.5899378],[6.2075361,46.635403700000005],[6.267269400000001,46.6761435],[6.2829787999999995,46.6913411],[6.371863800000001,46.72411600000001],[6.3953484000000005,46.7484084],[6.438244400000001,46.761596100000006],[6.4584751,46.788547900000005],[6.434768100000001,46.8013187],[6.4431544,46.832714100000004],[6.4601921,46.851293899999995],[6.4822708,46.8466022],[6.5286929,46.85906049999999],[6.5872571,46.884160699999995],[6.627086099999999,46.8887095],[6.6472295,46.9106982],[6.7156266,46.934787099999994],[6.7210012,46.905380900000004],[6.740114799999999,46.8948101],[6.7368009,46.8738118],[6.755324450981469,46.87045276298052],[6.706666,46.837713],[6.6365782,46.8035679],[6.6536653,46.7846649],[6.7182027,46.8061794],[6.767481222215858,46.8086565331346],[6.797940799999999,46.7828742],[6.8217056,46.7762899],[6.8590959,46.788001300000005],[6.879551,46.775298400000004],[6.9121992,46.7813566],[6.931462000000002,46.8056899],[6.9108001,46.8125424],[6.9101726,46.838763900000004],[6.930626900000001,46.853240299999996],[6.9210072,46.8713286],[6.890805026812213,46.88754876986139],[6.922724744485128,46.90445777223386],[6.9236811000000005,46.8949856],[6.9888965,46.873457699999996],[6.9778885,46.849965999999995],[6.992363700000001,46.833170200000005],[6.965329100000001,46.827750800000004],[6.9666165,46.8026527],[6.920114599999999,46.7598576],[6.9379664000000005,46.7494706],[6.935593700000001,46.733222000000005],[6.8990514,46.709633100000005],[6.8535257,46.6554594],[6.8333886,46.662227800000004],[6.8069443,46.65060439999999],[6.7969217,46.633141300000005],[6.8038989,46.60939630000001],[6.7989409,46.5820535],[6.834850299999999,46.575334000000005],[6.8463385,46.5839124],[6.8744622,46.5649682],[6.869241400000001,46.543340900000004],[6.8182773,46.5364942],[6.8108786,46.525126500000006],[6.837838,46.499486499999996],[6.8627644,46.4938442],[6.8976696,46.5148252],[6.972785,46.48988129999999],[6.9801608,46.4589564],[6.992116199999999,46.448794],[7.0202363,46.45944449999999],[7.0658259999999995,46.4890399],[7.106161,46.490233800000006],[7.1934221,46.546136100000005],[7.2076536,46.53290560000001],[7.2370801,46.553793399999996],[7.2489739,46.5172385],[7.224146799999999,46.486885599999994],[7.2323341,46.4539369],[7.1928233,46.43375880000001],[7.209873400000001,46.416276499999995],[7.1937111,46.378930700000005],[7.222557199999999,46.34857230000001],[7.221729700000001,46.3294194]],[[6.786266900000001,46.7476073],[6.748703400000001,46.7318004],[6.770666500000001,46.720654],[6.786266900000001,46.7476073]],[[6.8820937,46.7498031],[6.852140599999999,46.7743625],[6.8145937,46.737277399999996],[6.8618707,46.724583200000005],[6.8820937,46.7498031]]]]}},
{"type":"Feature","properties":{"abbrev":"FR","name":"Fribourg - Freiburg","name_de":"Freiburg","name_fr":"Fribourg","name_it":"Friburgo","iso":"CH-FR","canton_id":10},"geometry":{"type":"MultiPolygon","coordinates":[[[[6.786266900000001,46.7476073],[6.770666500000001,46.720654],[6.748703400000001,46.7318004],[6.786266900000001,46.7476073]]],[[[6.8820937,46.7498031],[6.8618707,46.724583200000005],[6.8145937,46.737277399999996],[6.852140599999999,46.7743625],[6.8820937,46.7498031]]],[[[6.767481222215858,46.8086565331346],[6.800088,46.832444],[6.8582749,46.8599166],[6.890805026812213,46.88754876986139],[6.9210072,46.8713286],[6.930626900000001,46.853240299999996],[6.9101726,46.838763900000004],[6.9108001,46.8125424],[6.931462000000002,46.8056899],[6.9121992,46.7813566],[6.879551,46.775298400000004],[6.8590959,46.788001300000005],[6.8217056,46.7762899],[6.797940799999999,46.7828742],[6.767481222215858,46.8086565331346]]],[[[7.2370801,46.553793399999996],[7.2076536,46.53290560000001],[7.1934221,46.546136100000005],[7.106161,46.490233800000006],[7.0658259999999995,46.4890399],[7.0202363,46.45944449999999],[6.992116199999999,46.448794],[6.9801608,46.4589564],[6.972785,46.48988129999999],[6.8976696,46.5148252],[6.8627644,46.4938442],[6.837838,46.499486499999996],[6.8108786,46.525126500000006],[6.8182773,46.5364942],[6.869241400000001,46.543340900000004],[6.8744622,46.5649682],[6.8463385,46.5839124],[6.834850299999999,46.575334000000005],[6.7989409,46.5820535],[6.8038989,46.60939630000001],[6.7969217,46.633141300000005],[6.8069443,46.65060439999999],[6.8333886,46.662227800000004],[6.8535257,46.6554594],[6.8990514,46.709633100000005],[6.935593700000001,46.733222000000005],[6.9379664000000005,46.7494706],[6.920114599999999,46.7598576],[6.9666165,46.8026527],[6.965329100000001,46.827750800000004],[6.992363700000001,46.833170200000005],[6.9778885,46.849965999999995],[6.9888965,46.873457699999996],[6.9236811000000005,46.8949856],[6.922724744485128,46.90445777223386],[6.961744182997495,46.92746044261733],[7.030433,46.875280499999995],[7.042916799999999,46.846886299999994],[7.071031400000001,46.8734517],[7.0833048,46.89611880000001],[7.0908601,46.9038187],[7.084458191078184,46.91286149746636],[7.1337142,46.9447756],[7.1130305,46.957597],[7.06005901155696,46.93638706707748],[7.0579041999999985,46.9654084],[7.0403444,46.979520900000004],[7.0401636000000005,46.9798427],[7.092301,46.9761236],[7.156080199999999,46.986032900000005],[7.2174409,47.006275800000004],[7.2356198,46.9846009],[7.2168635000000005,46.97271380000001],[7.2042242,46.93742149999999],[7.2078089,46.90913320000001],[7.289379500000001,46.89377],[7.327544899999999,46.8934955],[7.3535034999999995,46.886313200000004],[7.359247000000001,46.863106900000005],[7.3233281,46.840410399999996],[7.317461799999999,46.81385769999999],[7.2912843,46.77334080000001],[7.303594899999999,46.7591894],[7.2970957,46.7264976],[7.348267400000001,46.71271500000001],[7.3467219,46.698860800000006],[7.3769317,46.69271960000001],[7.3693322,46.655635800000006],[7.320996599999999,46.654651099999995],[7.3132658,46.6366248],[7.3207037,46.5918347],[7.298290000000001,46.5792091],[7.281358600000001,46.584110800000005],[7.255085899999999,46.559884999999994],[7.2370801,46.553793399999996]]]]}},
{"type":"Feature","properties":{"abbrev":"OW","name":"Obwalden","name_de":"Obwalden","name_fr":"Obwald","name_it":"Obvaldo","iso":"CH-OW","canton_id":6},"geometry":{"type":"MultiPolygon","coordinates":[[[[8.448318599999997,46.763423200000005],[8.4146324,46.774322100000006],[8.3952224,46.77151670000001],[8.396532500000003,46.79545420000001],[8.377512800000002,46.8230572],[8.3639081,46.85948689999999],[8.419484900000002,46.852235300000004],[8.4708359,46.85485119999999],[8.4978667,46.853728],[8.478214099999999,46.8126366],[8.478549200000002,46.7892748],[8.491432200000002,46.77253010000001],[8.448318599999997,46.763423200000005]]],[[[8.368933,46.787924],[8.333688,46.7805978],[8.283484200000002,46.753171900000005],[8.239065799999999,46.76961070000001],[8.1679329,46.76535490000001],[8.146941299999998,46.7548388],[8.090770699999998,46.7843668],[8.046936800000001,46.787115500000006],[8.064174,46.8084423],[8.0423122,46.8365705],[8.0715913,46.873718800000006],[8.0698227,46.89573000000001],[8.089210999999999,46.9091935],[8.122496100000001,46.9094698],[8.1648412,46.9396042],[8.1500976,46.957526099999995],[8.187332099999999,46.971747099999995],[8.228872599999997,46.9731468],[8.254245,46.9801165],[8.3013376,46.97766109999999],[8.310867110793545,46.969108855356936],[8.306180386603812,46.955735571833415],[8.288284999999998,46.933887299999995],[8.309634400000002,46.924305700000005],[8.338118899999998,46.92931380000001],[8.343471699999998,46.9149007],[8.328369899999998,46.87797749999999],[8.334964,46.8275493],[8.322135300000001,46.8202206],[8.368933,46.787924]]]]}},
{"type":"Feature","properties":{"abbrev":"NW","name":"Nidwalden","name_de":"Nidwalden","name_fr":"Nidwald","name_it":"Nidvaldo","iso":"CH-NW","canton_id":7},"geometry":{"type":"MultiPolygon","coordinates":[[[[8.4708359,46.85485119999999],[8.419484900000002,46.852235300000004],[8.3639081,46.85948689999999],[8.377512800000002,46.8230572],[8.396532500000003,46.79545420000001],[8.3952224,46.77151670000001],[8.368933,46.787924],[8.322135300000001,46.8202206],[8.334964,46.8275493],[8.328369899999998,46.87797749999999],[8.343471699999998,46.9149007],[8.338118899999998,46.92931380000001],[8.309634400000002,46.924305700000005],[8.288284999999998,46.933887299999995],[8.306180386603812,46.955735571833415],[8.3359083,46.9693092],[8.367973,47.0033964],[8.384693108657576,47.00294669057951],[8.426760650624676,47.002268247646974],[8.4269425,46.9750328],[8.4661314,46.9721263],[8.4956023,46.9620478],[8.5497676,46.9733432],[8.57422863217448,46.98388878224117],[8.5549667,46.9632164],[8.555869300000001,46.939235800000006],[8.541077199999998,46.92641520000001],[8.4642629,46.904737499999996],[8.4790907,46.882522900000005],[8.4708359,46.85485119999999]]],[[[8.310867110793545,46.969108855356936],[8.3013376,46.97766109999999],[8.254245,46.9801165],[8.228872599999997,46.9731468],[8.265489300000002,46.99818260000001],[8.312602992452788,46.99840990359796],[8.310867110793545,46.969108855356936]]]]}},
{"type":"Feature","properties":{"abbrev":"SO","name":"Solothurn","name_de":"Solothurn","name_fr":"Soleure","name_it":"Soletta","iso":"CH-SO","canton_id":11},"geometry":{"type":"MultiPolygon","coordinates":[[[[7.375945799999999,47.41409949999999],[7.381198,47.4320817],[7.4209041,47.4459442],[7.455576499999999,47.4279232],[7.447491100000001,47.41448419999999],[7.375945799999999,47.41409949999999]]],[[[7.4457652,47.461972800000005],[7.429391000000001,47.4829407],[7.4349836,47.49810110000001],[7.4720070000000005,47.480382999999996],[7.5104466,47.5026276],[7.5317892,47.49739890000001],[7.530679100000001,47.4611886],[7.4982107000000005,47.45968669999999],[7.4565122,47.4492558],[7.4457652,47.461972800000005]]],[[[7.825106899999999,47.26557230000002],[7.7845206,47.257263599999995],[7.732667200000001,47.25911330000001],[7.688558,47.290445500000004],[7.6482741999999995,47.2819898],[7.5801066,47.27634830000001],[7.5959384,47.245569],[7.6261801999999985,47.22631430000001],[7.643945499999999,47.22544570000001],[7.657818199999999,47.2006916],[7.6746292,47.190899],[7.6728612,47.168394500000005],[7.6512652,47.1574731],[7.586140400000001,47.147545300000004],[7.5634674,47.16835410000001],[7.520556699999999,47.1597696],[7.509723400000001,47.12554570000001],[7.4613252,47.10823270000001],[7.4750778,47.087083299999996],[7.445859400000001,47.0743823],[7.4340002,47.10050030000001],[7.390052,47.09229630000001],[7.3704402,47.1153804],[7.403748200000001,47.117675999999996],[7.439950400000001,47.1504963],[7.4676327,47.151281299999994],[7.4970383,47.1700873],[7.4557442,47.1888286],[7.4183948,47.171153800000006],[7.3919109999999995,47.16627390000001],[7.3404127,47.2175697],[7.4208731000000006,47.2428911],[7.4410055,47.26291970000001],[7.4658424000000005,47.264651300000004],[7.4853399000000005,47.2842593],[7.5328638,47.294534000000006],[7.5583409,47.32236290000001],[7.552201,47.3453097],[7.5237238,47.3720704],[7.463493700000001,47.3702566],[7.4373242,47.38088849999999],[7.441311400000001,47.40017890000001],[7.4773510000000005,47.401025499999996],[7.4923275,47.3852318],[7.5186167,47.388222999999996],[7.5430785,47.4140329],[7.5660724,47.4134092],[7.5920692,47.43271180000001],[7.614019599999999,47.433354900000005],[7.622601599999999,47.45714449999999],[7.604524299999999,47.4705364],[7.6072998,47.4893984],[7.640966,47.4827341],[7.668326599999999,47.4863467],[7.6997610000000005,47.4806325],[7.7066078000000005,47.46857850000001],[7.685004899999999,47.4475751],[7.679802100000001,47.417514],[7.6327228,47.4100311],[7.6442033,47.367208399999996],[7.7019536,47.372447199999996],[7.727913799999999,47.368858900000006],[7.7541924,47.343172100000004],[7.7935609,47.339052300000006],[7.8053835,47.3623861],[7.909737700000001,47.398521],[7.9618317,47.4218343],[7.9467846,47.4431934],[7.9568349,47.4552115],[7.9742854,47.4595479],[7.987270700000001,47.4287435],[7.9631993,47.42235470000001],[8.0265612,47.3956224],[8.027333599999999,47.3701892],[8.0104736,47.3569507],[8.0051906,47.3367516],[7.976503300000001,47.3234438],[7.909338900000001,47.340961699999994],[7.888661300000001,47.31126709999999],[7.860412199999999,47.305533800000006],[7.8418057,47.2744707],[7.825106899999999,47.26557230000002]]]]}},
{"type":"Feature","properties":{"abbrev":"BE","name":"Bern - Berne","name_de":"Bern","name_fr":"Berne","name_it":"Berna","iso":"CH-BE","canton_id":2},"geometry":{"type":"Polygon","coordinates":[[[8.410228899999998,46.653028],[8.3792331,46.633631300000005],[8.3618932,46.6017862],[8.3646716,46.5824784],[8.3366047,46.561123],[8.302766100000001,46.545529800000004],[8.241230899999998,46.52657610000001],[8.191170999999997,46.52300520000001],[8.174335699999999,46.5313918],[8.126206999999999,46.5373078],[8.1144938,46.546590800000004],[8.060036900000002,46.552647199999996],[8.0152667,46.5632279],[7.9690054,46.5448423],[7.9708165,46.516531300000004],[7.9431116,46.5080036],[7.89779,46.4825305],[7.8446273,46.4784867],[7.798138499999999,46.4586006],[7.7782845,46.4434859],[7.708647200000001,46.4139147],[7.6936105999999995,46.424654399999994],[7.626100799999999,46.4450525],[7.6088007,46.435067599999996],[7.595526499999999,46.411428099999995],[7.5784418,46.4172728],[7.5340874,46.4098148],[7.555269900000001,46.3889749],[7.526966,46.37462449999999],[7.486867700000001,46.3707236],[7.4432312000000005,46.383001099999994],[7.3996257000000005,46.3765624],[7.353964899999999,46.350341799999995],[7.3156452,46.34366149999999],[7.312529,46.3636531],[7.2907006,46.3671762],[7.262305499999999,46.3582368],[7.2542983,46.3311231],[7.221729700000001,46.3294194],[7.222557199999999,46.34857230000001],[7.1937111,46.378930700000005],[7.209873400000001,46.416276499999995],[7.1928233,46.43375880000001],[7.2323341,46.4539369],[7.224146799999999,46.486885599999994],[7.2489739,46.5172385],[7.2370801,46.553793399999996],[7.255085899999999,46.559884999999994],[7.281358600000001,46.584110800000005],[7.298290000000001,46.5792091],[7.3207037,46.5918347],[7.3132658,46.6366248],[7.320996599999999,46.654651099999995],[7.3693322,46.655635800000006],[7.3769317,46.69271960000001],[7.3467219,46.698860800000006],[7.348267400000001,46.71271500000001],[7.2970957,46.7264976],[7.303594899999999,46.7591894],[7.2912843,46.77334080000001],[7.317461799999999,46.81385769999999],[7.3233281,46.840410399999996],[7.359247000000001,46.863106900000005],[7.3535034999999995,46.886313200000004],[7.327544899999999,46.8934955],[7.289379500000001,46.89377],[7.2078089,46.90913320000001],[7.2042242,46.93742149999999],[7.2168635000000005,46.97271380000001],[7.2356198,46.9846009],[7.2174409,47.006275800000004],[7.156080199999999,46.986032900000005],[7.092301,46.9761236],[7.0401636000000005,46.9798427],[7.03925836208361,46.98145261836348],[7.026398910296264,47.004315620306045],[7.0403585,47.0369646],[7.076192457073798,47.0506367548629],[7.1198552,47.038077],[7.1628933,47.0498891],[7.1889871,47.0683078],[7.2174095,47.1071488],[7.1767904,47.1012654],[7.0876538999999985,47.059733300000005],[7.075677000000001,47.09625880000001],[6.99784,47.119401599999996],[6.9265867,47.109146],[6.8668643,47.0851144],[6.888803,47.13112580000001],[6.861515999999999,47.16558920000001],[6.8837139,47.1503973],[6.906089400000001,47.1571532],[6.9521605,47.18734439999999],[6.9855672,47.1765534],[6.996425100000001,47.193327800000006],[7.0234483,47.19569980000001],[7.061648400000001,47.2432481],[7.0795219000000005,47.24775880000001],[7.1397549,47.2431775],[7.1487334,47.26903620000001],[7.1686737,47.2747245],[7.168819399999999,47.294496],[7.2059944,47.295465400000005],[7.2426113,47.28522290000001],[7.2777859,47.2841647],[7.3169619,47.29037810000001],[7.337508,47.305908900000006],[7.3803957,47.31404459999999],[7.4216885,47.307062599999995],[7.476043900000001,47.30707399999999],[7.4960402,47.3021174],[7.5583409,47.32236290000001],[7.5328638,47.294534000000006],[7.4853399000000005,47.2842593],[7.4658424000000005,47.264651300000004],[7.4410055,47.26291970000001],[7.4208731000000006,47.2428911],[7.3404127,47.2175697],[7.3919109999999995,47.16627390000001],[7.4183948,47.171153800000006],[7.4557442,47.1888286],[7.4970383,47.1700873],[7.4676327,47.151281299999994],[7.439950400000001,47.1504963],[7.403748200000001,47.117675999999996],[7.3704402,47.1153804],[7.390052,47.09229630000001],[7.4340002,47.10050030000001],[7.445859400000001,47.0743823],[7.4750778,47.087083299999996],[7.4613252,47.10823270000001],[7.509723400000001,47.12554570000001],[7.520556699999999,47.1597696],[7.5634674,47.16835410000001],[7.586140400000001,47.147545300000004],[7.6512652,47.1574731],[7.6728612,47.168394500000005],[7.6746292,47.190899],[7.657818199999999,47.2006916],[7.643945499999999,47.22544570000001],[7.6261801999999985,47.22631430000001],[7.5959384,47.245569],[7.5801066,47.27634830000001],[7.6482741999999995,47.2819898],[7.688558,47.290445500000004],[7.732667200000001,47.25911330000001],[7.7845206,47.257263599999995],[7.825106899999999,47.26557230000002],[7.838664700000001,47.234818100000005],[7.8594916,47.1933276],[7.882880899999999,47.172118200000014],[7.8900972,47.140725],[7.868144899999999,47.1119748],[7.8804652,47.0844989],[7.866015599999999,47.053419399999996],[7.8917861,47.0304954],[7.9018248,47.006252700000005],[7.949433600000001,47.005834],[7.945354,46.96784449999999],[7.915258700000001,46.934637499999994],[7.8769266,46.9273754],[7.882660100000001,46.903535500000004],[7.8585989,46.8852943],[7.8770771,46.8370701],[7.9223894,46.8200081],[7.9578957,46.7894177],[7.984570499999999,46.774990300000006],[8.031484800000001,46.790155300000016],[8.046936800000001,46.787115500000006],[8.090770699999998,46.7843668],[8.146941299999998,46.7548388],[8.1679329,46.76535490000001],[8.239065799999999,46.76961070000001],[8.283484200000002,46.753171900000005],[8.333688,46.7805978],[8.368933,46.787924],[8.3952224,46.77151670000001],[8.4146324,46.774322100000006],[8.448318599999997,46.763423200000005],[8.452286000000003,46.6887448],[8.415282500000002,46.6874839],[8.398055099999999,46.6742285],[8.410228899999998,46.653028]],[[7.6882187,46.6885762],[7.7030282,46.6744363],[7.7604828,46.6543559],[7.8298315,46.6696289],[7.7920024,46.6857731],[7.7525899,46.6807292],[7.7247026,46.7074849],[7.6886059,46.7163675],[7.6385581,46.7461942],[7.6289753,46.7214356],[7.6634043,46.6972654],[7.6882187,46.6885762]],[[7.9444181,46.7256214],[7.8857357,46.6921244],[7.9207766,46.6889434],[7.9496911,46.7062796],[8.0361805,46.7401592],[8.0161954,46.757926],[7.9728884,46.7443827],[7.9444181,46.7256214]]]}}]}

},{}]},{},[7]);
