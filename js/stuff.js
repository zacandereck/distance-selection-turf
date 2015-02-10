// setting default distances
var innerDistance = 250, 
	outerDistance = 500;
var CSV = window.location.search.substring(1);

if (!CSV) {
	CSV = 'sf'
}

//On change to the text inputs, set the innerDistance and outerDistance
$( "#innerBuffer" ).change(function(e) {
	innerDistance = e.target.value;
});

$( "#outerBuffer" ).change(function(e) {
	outerDistance = e.target.value;
});

// configure reset button
$('#resetButton').click(function(e){
	window.location.reload();
});

//basemap variables
var satellite = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
}),
    streets   = L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png', {
	maxZoom: 18,
	attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
		'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
		'Imagery © <a href="http://mapbox.com">Mapbox</a>',
	id: 'hoganmaps.ikkpodh4'
});

// map object
var map = L.map('map',{
	scrollWheelZoom: true,
	zoomControl: false,
	layers: [satellite, streets]
}).setView([38.515875, -98.779462], 13);

//basemap variable controls
var baseMaps = {
    "Satellite": satellite,
    "Streets": streets
};
L.control.layers(baseMaps).addTo(map);



//declare empty point layer which will have data added to it when d3 parses the csv
var geoJsonLyr, geoData, nearestToPoint;

//circle marker styles
var greenMarker = { radius: 9, fillColor: "#00b200", color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.9 },
	orangeMarker   = { radius: 6, fillColor: "#ff7800", color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.8 },
	greyMarker  = { radius: 6, fillColor: "#6B6B6B", color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.8 };


function feet2km(input){
	//input feet * 0.0003048 = km
	return (Number(input)*0.0003048)
}


// array to store clicked points
var usedPointArray = []
var identifiedPointsLayer = L.layerGroup();
var polyAreaUnion, polyAreaUnionDisplay, selectablePoints;

var toggle = false;
function toggleBufLayer(){
	if(!toggle){
		$('#toggleShowBuffers').html('Hide All Buffers');
		$('#toggleShowBuffers').addClass('active');
		map.addLayer(polyAreaUnionDisplay);
	}
	else {
		$('#toggleShowBuffers').html('Show All Buffers');
		$('#toggleShowBuffers').removeClass('active');
		map.removeLayer(polyAreaUnionDisplay);
	}
	toggle = !toggle;
}
//Toggle Union Layer Toggle
$('#toggleShowBuffers').click(function(){
	toggleBufLayer();
});

var pointNumber = 1;

//clickstart set up
function onMapClick(e) {
	if(selectablePoints){
		map.removeLayer(selectablePoints);
	}
	var reTurnOnBuffers = false;
	if(map.hasLayer(polyAreaUnionDisplay)){
		toggleBufLayer();
		reTurnOnBuffers = !reTurnOnBuffers;
	};
	//get the clicked point as a turf point
    var selectedTurfPoint = turf.point(e.layer.feature.geometry.coordinates);
    $('.outputTable').append('<tbody><tr><td>'+ String(pointNumber) +',</td><td>'+e.layer.feature.properties.uid+',</td><td>'+String(e.layer.feature.geometry.coordinates[1])+',</td><td>'+String(e.layer.feature.geometry.coordinates[0])+'</td></tr></tbody>');
    //push in to the usedPointArray
    // usedPointArray.push(e.layer.feature)
	
    //add the point as geojson to the map
 //    var startPoint = L.geoJson(selectedTurfPoint,{
 //    	pointToLayer: function (feature, latlng) {
	//         return L.circleMarker(latlng, greenMarker);
	//     }
	// }).addTo(map);
	
	identifiedPointsLayer.addLayer(
		L.circleMarker([
			e.layer.feature.geometry.coordinates[1],
			e.layer.feature.geometry.coordinates[0]],
			{
				radius: 9, fillColor: "#00b200", color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.9
			}
	).bindPopup(String(pointNumber)));
	pointNumber = pointNumber + 1;
	// console.log(e.layer.feature.geometry.coordinates);
	delete e.layer;
	//generate the minimum distance buffer
    var bufferedTurfPolyNear = turf.buffer(selectedTurfPoint, feet2km(innerDistance), 'kilometers');

	    //generate maximum distance buffer
	    var bufferedTurfPolyFar = turf.buffer(selectedTurfPoint, feet2km(outerDistance), 'kilometers');

	    //erase the min dist buffer from max dist buffer, donut!
	    var justFarBuffer = turf.erase(
	    	turf.polygon(bufferedTurfPolyFar.features[0].geometry.coordinates), 
	    	turf.polygon(bufferedTurfPolyNear.features[0].geometry.coordinates)
	    );

	    //Show the buffer donut on the map
	    var buffShow = L.geoJson(justFarBuffer,{icon: greenMarker}).addTo(map);
	    if(!polyAreaUnion){
	    	polyAreaUnion = justFarBuffer;
	    	polyAreaUnionDisplay = L.geoJson(justFarBuffer);
	    }
	    else {
	    	polyAreaUnion = turf.union(polyAreaUnion, justFarBuffer);
	    	polyAreaUnionDisplay = L.geoJson(polyAreaUnion);
	    }
	    // polyAreaUnion = turf.union(polyAreaUnion, justFarBuffer);
	    //Union the poly into thepolyAreaUnion
	    
	    //find all the points within the buffer donut
	    var bigBufferPoints = turf.within(geoData, turf.featurecollection([justFarBuffer]));
	    selectablePoints = L.geoJson(bigBufferPoints,{
	    	pointToLayer: function (feature, latlng) {
		        return L.circleMarker(latlng, orangeMarker);
		    }
		})
	    .on('click', onMapClick)
		.addTo(map);

	    try{
		    for (i = 0; i < usedPointArray.length; i++) { 
		    	for (j = 0; j < bigBufferPoints.features.length; j++) { 
		    		if(
		    			(bigBufferPoints.features[j].geometry.coordinates[0] === usedPointArray[i][0]) && 
		    			(bigBufferPoints.features[j].geometry.coordinates[1] === usedPointArray[i][1]) ){
		    			// 	console.log('deleting a point');
		    			// console.log(bigBufferPoints.features[j]);
		    			delete bigBufferPoints.features[j];
		    		}
		    	}
			};
		}
		catch(err){
			//err
		}
	    //calculate the buffer donut point closest to the origin/selectedTurfPoint and show it on map
		// nearestToPoint = turf.nearest(selectedTurfPoint, bigBufferPoints);
	    // L.geoJson(nearestToPoint,{
	    // 	pointToLayer: function (feature, latlng) {
		   //      return L.circleMarker(latlng, redMarker);
		   //  }
	    // }).addTo(map);

		// if the user had the Show all Buffer Layers selected, turn them back on
	    if(reTurnOnBuffers){
	    	toggleBufLayer();
	    };
	    map.removeLayer(identifiedPointsLayer);
	    identifiedPointsLayer.addTo(map);
	    // map.removeLayer(identifiedPointsLayer);
	    // map.addLayer(identifiedPointsLayer);
	    setTimeout( function(){map.removeLayer(buffShow)}, 2500 );

};



//parse the CSV, turn it in to geojson, and put it on the map.
d3.csv('data/' + CSV + '.csv', function(err, inData){
	//borrowed from here http://bl.ocks.org/sumbera/10463358
    var data = [];
    inData.map(function (d, i) {
        data.push({
            id: i,
            type: "Feature",
            properties: {
            	uid: d.UID
            },
            geometry: {
                coordinates: [+d.Longitude, +d.Latitude],
                type: "Point"
            }
        });
    });
    geoData = { type: "FeatureCollection", features: data };
    geoJsonLyr = L.geoJson(geoData, {
        	pointToLayer: function (feature, latlng) {
		        return L.circleMarker(latlng, greyMarker);
		    }
		})
    	//enable click, using function from above
    	.on('click', onMapClick)
    	.addTo(map);
    map.fitBounds(geoJsonLyr.getBounds());
});