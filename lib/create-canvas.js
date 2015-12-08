module.exports = function(divId, width, height, callback) {
	var canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height
	var div = document.getElementById(divId)
	div.appendChild(canvas)
	var ctx = canvas.getContext('2d')
	callback(ctx)
}
