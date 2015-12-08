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



