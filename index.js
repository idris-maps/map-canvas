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
