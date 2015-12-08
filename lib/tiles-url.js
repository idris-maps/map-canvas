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
