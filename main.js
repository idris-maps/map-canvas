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











