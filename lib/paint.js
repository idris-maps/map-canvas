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
