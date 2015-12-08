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
