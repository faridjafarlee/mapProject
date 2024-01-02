let drawingManager;
let selectedShape;
let colors = ['#1E90FF', '#FF1493', '#32CD32', '#FF8C00', '#4B0082'];
let selectedColor;
let colorButtons = {};
let markers = {};
let polygonsAndLines = {};
let polygon = null;
let map = null;
let referenceLine = null;
let polygonCounter = 0;
let searchInput;

// $rootScope.polygons = [
//     {
//         name: "First Polygon"
//     },
//     {
//         name: "Second Polygon"
//     }
// ];

function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function clearSelection() {
  if (selectedShape) {
    selectedShape.setEditable(false);
    selectedShape = null;
  }
}

function setSelection(shape) {
  clearSelection();
  selectedShape = shape;
  shape.setEditable(true);
  selectColor(shape.get('fillColor') || shape.get('strokeColor'));
}

function deleteSelectedShape() {
  if (selectedShape) {
    selectedShape.setMap(null);
    if (markers[selectedShape.content].length) {
      for (const marker of markers[selectedShape.content]) {
        marker.setMap(null)
      }
    }
  }
}

function selectColor(color) {
  selectedColor = color;
  for (let i = 0; i < colors.length; ++i) {
    let currColor = colors[i];
    colorButtons[currColor].style.border = currColor == color ? '2px solid #789' : '2px solid #fff';
  }

  // Retrieves the current options from the drawing manager and replaces the
  // stroke or fill color as appropriate.
  let polylineOptions = drawingManager.get('polylineOptions');
  polylineOptions.strokeColor = color;
  drawingManager.set('polylineOptions', polylineOptions);

  let rectangleOptions = drawingManager.get('rectangleOptions');
  rectangleOptions.fillColor = color;
  drawingManager.set('rectangleOptions', rectangleOptions);

  let circleOptions = drawingManager.get('circleOptions');
  circleOptions.fillColor = color;
  drawingManager.set('circleOptions', circleOptions);

  let polygonOptions = drawingManager.get('polygonOptions');
  polygonOptions.fillColor = color;
  drawingManager.set('polygonOptions', polygonOptions);
}

function setSelectedShapeColor(color) {
  if (selectedShape) {
    if (selectedShape.type == google.maps.drawing.OverlayType.POLYLINE) {
      selectedShape.set('strokeColor', color);
    } else {
      selectedShape.set('fillColor', color);
    }
  }
}

function makeColorButton(color) {
  let button = document.createElement('span');
  button.className = 'color-button';
  button.style.backgroundColor = color;
  google.maps.event.addDomListener(button, 'click', function () {
    selectColor(color);
    setSelectedShapeColor(color);
  });

  return button;
}

function buildColorPalette() {
  let colorPalette = document.getElementById('color-palette');
  for (let i = 0; i < colors.length; ++i) {
    let currColor = colors[i];
    let colorButton = makeColorButton(currColor);
    colorPalette.appendChild(colorButton);
    colorButtons[currColor] = colorButton;
  }
  selectColor(colors[0]);
}

function drawParallelLines() {
  if (!polygon) {
    alert('Please draw a polygon first.');
    return;
  }

  const distanceInput = prompt('Enter distance for parallel lines (in meters):');
  if (!distanceInput) {
    return; // User canceled
  }

  parallelLinesDistance = parseFloat(distanceInput);

  if (isNaN(parallelLinesDistance)) {
    alert('Invalid distance. Please enter a valid number.');
    return;
  }

  drawParallelLinesInsidePolygon(polygon, referenceLine, parallelLinesDistance);
}

function drawReferenceLine() {
  //alert('Draw reference line.');

  if (referenceLine) {
    referenceLine.setMap(null); // Remove existing reference line
  }

  const lineOptions = {
    clickable: true,
    draggable: false,
    editable: false,
    geodesic: true,
    strokeColor: '#0000FF',
    strokeOpacity: 0.8,
    strokeWeight: 2,
  };

  referenceLine = new google.maps.Polyline(lineOptions);
  referenceLine.setMap(map);

  const path = referenceLine.getPath();

  google.maps.event.addListenerOnce(referenceLine, 'click', function () {
    const distanceInput = prompt('Enter distance for parallel lines (in meters):');
    if (!distanceInput) {
      return; // User canceled
    }

    const parallelLinesDistance = parseFloat(distanceInput);

    if (isNaN(parallelLinesDistance)) {
      alert('Invalid distance. Please enter a valid number.');
      return;
    }

    drawParallelLinesInsidePolygon(polygon, referenceLine, parallelLinesDistance);
  });

  google.maps.event.addListener(map, 'click', function (event) {
    path.push(event.latLng);
  });
}

function extendLine(line, extensionDistance) {
  const startPoint = line.getPath().getAt(0);
  const endPoint = line.getPath().getAt(1);
  const heading = google.maps.geometry.spherical.computeHeading(startPoint, endPoint);
  const extendedEndPoint = google.maps.geometry.spherical.computeOffset(endPoint, extensionDistance, heading);
  line.setPath([startPoint, extendedEndPoint]);
  return line;
}

let rectangle = null;
let rectangleBounds = null;

function putPolygonIntoSquare(polygon) {
  if (rectangle) {
    rectangle.setMap(null);
    rectangle = null;
    rectangleBounds = null;
  }

  const path = polygon.getPath();
  const bounds = new google.maps.LatLngBounds();

  path.forEach(function (point) {
    bounds.extend(point);
  });

  rectangleBounds = bounds;

  rectangle = new google.maps.Rectangle({
    strokeColor: "#FF0000",
    strokeOpacity: 0,
    strokeWeight: 1,
    fillColor: "#FF0000",
    fillOpacity: 0,
    map,
    bounds: bounds,
  });
  rectangle.setMap(map); // hide rectangle
}

function copyPolyLine(polyline) {
  return new google.maps.Polyline({
    path: [
      {
        lat: polyline.getPath().getAt(0).lat(),
        lng: polyline.getPath().getAt(0).lng(),
      },
      {
        lat: polyline.getPath().getAt(1).lat(),
        lng: polyline.getPath().getAt(1).lng(),
      },
    ],
    geodesic: true,
    strokeColor: "#00ff00",
    strokeOpacity: 1,
    strokeWeight: 2,
  });
}

function movePolylineParallellyToNewPoint(polyline, newPoint) {
  let currentPath = polyline.getPath().getArray();
  currentPath = [currentPath[0], currentPath[1]];

  const offsetDistance = google.maps.geometry.spherical.computeDistanceBetween(
    currentPath[0],
    newPoint
  );

  const offsetAngle = google.maps.geometry.spherical.computeHeading(
    currentPath[0],
    newPoint
  );

  const newPath = currentPath.map(function (point) {
    const newPoint = google.maps.geometry.spherical.computeOffset(
      point,
      offsetDistance,
      offsetAngle
    );
    return new google.maps.LatLng(newPoint.lat(), newPoint.lng());
  });

  polyline.setPath(newPath);
  return;
  if (google.maps.geometry.poly.containsLocation(newPath[0], polygon)) {
    polyline.setPath(newPath);
  } else {
    console.error("New path is outside the rectangle!");
  }
}

function fillPolygonWithParallelReferenceLines(polygon, referenceLine, distance) {
  putPolygonIntoSquare(polygon);

  const startPoint = rectangleBounds.getSouthWest();
  const endPoint = new google.maps.LatLng(startPoint.lat(), rectangleBounds.getNorthEast().lng());

  // uzunluq
  const distanceBetweenBounds = google.maps.geometry.spherical.computeDistanceBetween(
    startPoint,
    endPoint
  );

  // lat - hundurluk, long - uzunlug
  const height = google.maps.geometry.spherical.computeDistanceBetween(
    rectangleBounds.getSouthWest(),
    new google.maps.LatLng(rectangleBounds.getNorthEast().lat(), rectangleBounds.getSouthWest().lng()),
  );

  let newPoint = rectangleBounds.getSouthWest();
  referenceLine = extendLine(referenceLine, height);
  const firstPolyLine = copyPolyLine(referenceLine);
  movePolylineParallellyToNewPoint(firstPolyLine, newPoint);
  // firstPolyLine.setMap(map); // hide first parallel line

  referenceLine.setMap(null);
  let lines = [];
  let hasIntersection = true;
  let lastLine = null;
  const originalPolygonCords = [];
  polygon.getPath().g.forEach(coord => {
    originalPolygonCords.push([coord.lng(), coord.lat()]);
  });
  originalPolygonCords.push([polygon.getPath().g[0].lng(), polygon.getPath().g[0].lat()]);
  const turfOriginalPolygon = turf.polygon([originalPolygonCords]);

  let i = 0;
  do {
    const latLngOffset = google.maps.geometry.spherical.computeOffset(
      newPoint,
      distance,
      90,
    );

    console.log(latLngOffset.lat(), latLngOffset.lng());
    newPoint = new google.maps.LatLng(latLngOffset.lat(), latLngOffset.lng());
    const newPolyline = copyPolyLine(referenceLine);
    movePolylineParallellyToNewPoint(newPolyline, newPoint);
    console.log('newPolyline', newPolyline)
    lines.push(newPolyline);
    // newPolyline.setMap(map); // hide parallel lines

    if (!lastLine) lastLine = firstPolyLine;

    const segmentPolygonCoords = [
      [newPolyline.getPath().getAt(0).lng(), newPolyline.getPath().getAt(0).lat()],
      [newPolyline.getPath().getAt(1).lng(), newPolyline.getPath().getAt(1).lat()],
      [lastLine.getPath().getAt(1).lng(), lastLine.getPath().getAt(1).lat()],
      [lastLine.getPath().getAt(0).lng(), lastLine.getPath().getAt(0).lat()],
      [newPolyline.getPath().getAt(0).lng(), newPolyline.getPath().getAt(0).lat()],
    ];

    const segmentPolygon = turf.polygon([segmentPolygonCoords]);

    const intersection = turf.intersect(turfOriginalPolygon, segmentPolygon)
    console.log('intersection', intersection);

    if (intersection?.geometry) {
      intersection.geometry.coordinates.forEach(figure => {
        const newPolygonCoordinates = [];
        if (intersection.geometry.type === 'Polygon') {
          figure.forEach(coord => {
            newPolygonCoordinates.push({lng: coord[0], lat: coord[1]});
          })
        }
        if (intersection.geometry.type === 'MultiPolygon') {
          figure[0].forEach(coord => {
            newPolygonCoordinates.push({lng: coord[0], lat: coord[1]});
          })
        }
        newPolygon = new google.maps.Polygon({
          paths: newPolygonCoordinates,
          map: map,
          strokeColor: '#FF00FF',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#0000FF',
          fillOpacity: 0.35,
        });
        addNumberedMarker(newPolygon, polygonCounter);
        polygonCounter++;
      });
    }

    lastLine = newPolyline;
    i++;

    if (i > 100 && !intersection.geometry) {
      hasIntersection = false;
      // continue;
    }
  } while (hasIntersection);
}

function addNumberedMarker(polygon, number) {
  const bounds = new google.maps.LatLngBounds();
  const path = polygon.getPath();
  path.forEach((latLng) => bounds.extend(latLng));
  const center = bounds.getCenter();

  const marker = new google.maps.Marker({
    position: center,
    map: map,
    label: number.toString(),
  });

  // Опционально: добавляем обработчик события клика на маркер
  marker.addListener('click', () => {
    console.log(`Вы нажали на маркер ${number}`);
  });
}


function drawParallelLinesInsidePolygon(polygon, referenceLine, distance) {
  if (!polygon) {
    alert('Please draw a polygon first.');
    return;
  }

  if (!referenceLine) {
    alert('Please draw a reference line first.');
    return;
  }

  fillPolygonWithParallelReferenceLines(polygon, referenceLine, distance);

  // Reset the reference line
  // if (referenceLine) {
  //   referenceLine.setMap(null);
  //   referenceLine = null;
  // }
}

function findClosestPointOnPolyline(point, polylinePath) {
  let closestPoint = polylinePath[0];

  polylinePath.forEach(function (polylinePoint) {
    if (google.maps.geometry.spherical.computeDistanceBetween(point, polylinePoint) <
      google.maps.geometry.spherical.computeDistanceBetween(point, closestPoint)) {
      closestPoint = polylinePoint;
    }
  });

  return closestPoint;
}


function initialize() {
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 10,
    center: new google.maps.LatLng(22.344, 114.048),
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    disableDefaultUI: true,
    zoomControl: true
  });

  let polyOptions = {
    strokeWeight: 0,
    fillOpacity: 0.45,
    draggable: false,
    editable: false
  };
  // Creates a drawing manager attached to the map that allows the user to draw
  // markers, lines, and shapes.
  drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.POLYGON,
    markerOptions: {
      draggable: false,
      editable: false,
    },
    polylineOptions: {
      draggable: false,
      editable: false,
    },
    rectangleOptions: polyOptions,
    circleOptions: polyOptions,
    polygonOptions: polyOptions,
    map: map
  });

  searchInput = document.getElementById('location-search');
  const searchBox = new google.maps.places.SearchBox(searchInput);

  // Обработка изменений в поле поиска
  searchBox.addListener('places_changed', function () {
    const places = searchBox.getPlaces();

    if (places.length === 0) {
      return;
    }

    // Центрирование карты на выбранном месте
    const bounds = new google.maps.LatLngBounds();
    places.forEach(function (place) {
      if (place.geometry.viewport) {
        bounds.union(place.geometry.viewport);
      } else {
        bounds.extend(place.geometry.location);
      }
    });

    map.fitBounds(bounds);
  });

  google.maps.event.addListener(drawingManager, 'overlaycomplete', function (event) {
    if (event.type != google.maps.drawing.OverlayType.MARKER) {
      // Switch back to non-drawing mode after drawing a shape.
      drawingManager.setDrawingMode(null);

      // Add an event listener that selects the newly-drawn shape when the user
      // mouses down on it.
      let newShape = event.overlay;
      newShape.type = event.type;
      newShape.content = uuidv4();
      google.maps.event.addListener(newShape, 'click', function () {
        setSelection(newShape);
      });
      setSelection(newShape);

      console.log(newShape);
      if (event.type === google.maps.drawing.OverlayType.POLYGON) {
        polygon = newShape;
      }
      const path = event.overlay.getPath();

      const area = google.maps.geometry.spherical.computeArea(path);
      const formattedArea = (area / 1e6).toFixed(2) + ' sq km'; // Convert to square kilometers
      console.log(formattedArea);

      markers[newShape.content] = [];

      for (let i = 0; i < path.getLength(); i++) {
        const segmentStart = path.getAt(i);
        const segmentEnd = path.getAt((i + 1) % path.getLength()); // Use modulo to handle the last point
        const centerLatLng = new google.maps.LatLng(
          (segmentStart.lat() + segmentEnd.lat()) / 2,
          (segmentStart.lng() + segmentEnd.lng()) / 2
        );

        const distance = google.maps.geometry.spherical.computeDistanceBetween(segmentStart, segmentEnd);
        const formattedDistance = (distance / 1000).toFixed(2) + ' km';

        const marker = new google.maps.Marker({
          position: centerLatLng,
          map: map,
          label: {
            text: formattedDistance,
            color: 'white',
          },
        });
        markers[newShape.content].push(marker);
      }
    }
  });

  // Clear the current selection when the drawing mode is changed, or when the
  // map is clicked.
  google.maps.event.addListener(drawingManager, 'drawingmode_changed', clearSelection);
  google.maps.event.addListener(map, 'click', clearSelection);
  google.maps.event.addDomListener(document.getElementById('delete-button'), 'click', deleteSelectedShape);

  buildColorPalette();
}

google.maps.event.addDomListener(window, 'load', initialize);
