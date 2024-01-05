(function(app){
  app.controller('AppController', function ($scope, $rootScope) {
    let drawingManager;
    let selectedShape;
    let colors = ['#1E90FF', '#FF1493', '#32CD32', '#FF8C00', '#4B0082'];
    let selectedColor;
    let colorButtons = {};
    let markers = {};
    let polygonsAndLines = {};
    $scope.polygon = null;
    let map = null;
    let referenceLine = null;
    let polygonCounter = 0;
    let searchInput;
    let parallelLine;
    $scope.drawReferenceLineMode = false;
    $scope.anyInnerPolygon = false;
    $scope.polygons = [];

    function uuidv4() {
      return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
    }

    function areArraysEqual(arr1, arr2) {
      if (arr1.length !== arr2.length) {
        return false;
      }

      for (let subarr1 of arr1) {
        if (!arr2.some(subarr2 => subarraysAreEqual(subarr1, subarr2))) {
          return false;
        }
      }

      return true;
    }

    function subarraysAreEqual(subarr1, subarr2) {
      return subarr1.length === subarr2.length && subarr1.every((el, index) => el === subarr2[index]);
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
      // selectColor(shape.get('fillColor') || shape.get('strokeColor'));
    }

    function deleteSelectedShape() {
      if (selectedShape) {
        selectedShape.setMap(null);
        $scope.polygon = null;
        $scope.$apply();
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
      if (!$scope.polygon) {
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

    $scope.overlayBtnPress = function (polygonObj, check) {
      if (check === true) {
        // OVERLAY
        polygonObj.polygon.setOptions({fillColor: '#00FF00'});
      } else {
        // REMOVE OVERLAY
        polygonObj.polygon.setOptions({fillColor: '#0000FF'});
      }
    };

    $scope.showInnerPolygons = function (polygon) {
      polygon.showInnerPolygons = true;
    };

    $scope.hideInnerPolygons = function (polygon) {
      polygon.showInnerPolygons = false;
    };

    $scope.handlePolygonClick  = function (clickedPolygon){
      $scope.polygon.setOptions({
        strokeColor: '#0000FF',
      });
      $scope.polygon = clickedPolygon;
      $scope.polygon.setOptions({
        strokeColor: '#00FF00',
      });
    };

    $scope.deletePolygon = function (polygon) {
      const index = $scope.polygons.findIndex(elem => elem.content === polygon.content);
      const chosenPolygon = $scope.polygons.find(elem => elem.content === polygon.content);
      if (chosenPolygon.innerPolygons?.length) {
        chosenPolygon.innerPolygons?.forEach(innerPolygon => {
          innerPolygon.polygon.setMap(null);
          if (markers[innerPolygon.polygon?.content]?.length) {
            for (const marker of markers[innerPolygon.polygon.content]) {
              marker.setMap(null)
            }
          }
        })
      }
      chosenPolygon.polygon.setMap(null);
      $scope.polygon = null;
      if (markers[chosenPolygon.polygon?.content]?.length) {
        for (const marker of markers[chosenPolygon.polygon.content]) {
          marker.setMap(null)
        }
      }
      $scope.polygons.splice(index, 1);
      $scope.$apply();
    };

    $scope.drawReferenceLine = function () {
      if (referenceLine) {
        referenceLine.setMap(null); // Remove existing reference line
      }

      const lineOptions = {
        clickable: true,
        draggable: false,
        editable: true,
        geodesic: true,
        strokeColor: '#0000FF',
        strokeOpacity: 0.8,
        strokeWeight: 2,
      };

      $scope.drawReferenceLineMode = true;

      referenceLine = new google.maps.Polyline(lineOptions);
      referenceLine.setMap(map);

      const path = referenceLine.getPath();

      google.maps.event.addListenerOnce(referenceLine, 'click', function () {
        $scope.finishReferenceLine();
      });

      google.maps.event.addListener(map, 'click', function (event) {
        if (path.length <= 1) {
          path.push(event.latLng);
        } else {
          drawingManager.setDrawingMode(null);
        }
      });
    }

    $scope.finishReferenceLine = function () {
      const distanceInput = prompt('Enter distance for parallel lines (in meters):');
      if (!distanceInput) {
        return; // User canceled
      }

      const parallelLinesDistance = parseFloat(distanceInput);

      if (isNaN(parallelLinesDistance)) {
        alert('Invalid distance. Please enter a valid number.');
        return;
      }

      $scope.drawReferenceLineMode = false;

      drawParallelLinesInsidePolygon($scope.polygon, referenceLine, parallelLinesDistance);
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

    function offsetToLat(offset) {
      return offset / 111000;
    }

    function findPolygon (polygonsArray, content) {
      for (const polygon of polygonsArray) {
        if (polygon.content === content) return polygon;
        if (polygon.innerPolygons?.length) {
          const checkInnerPolygons = findPolygon(polygon.innerPolygons, content);
          if (checkInnerPolygons) return checkInnerPolygons;
        }
      }
      return null;
    }

    function fillPolygonWithParallelReferenceLines(polygon, referenceLine, distance) {
      putPolygonIntoSquare(polygon);

      const startPoint = rectangleBounds.getSouthWest();
      const endPoint = new google.maps.LatLng(startPoint.lat(), rectangleBounds.getNorthEast().lng());

      let newPoint = rectangleBounds.getSouthWest();

      const heading = google.maps.geometry.spherical.computeHeading(referenceLine.getPath().getAt(0), referenceLine.getPath().getAt(1));
      console.log('heading', heading);

      const diagonalDistance = google.maps.geometry.spherical.computeDistanceBetween(rectangleBounds.getSouthWest(), rectangleBounds.getNorthEast());

      const height = google.maps.geometry.spherical.computeDistanceBetween(
        rectangleBounds.getSouthWest(),
        new google.maps.LatLng(rectangleBounds.getNorthEast().lat(), rectangleBounds.getSouthWest().lng()),
      );

      let movingType = 'x';

      if ((heading >= 0 && heading <= 45) || (heading <= -135 && heading >= -180)) {
        if (heading <= -135 && heading >= -180) {
          referenceLine.setPath([referenceLine.getPath().getAt(1), referenceLine.getPath().getAt(0)]);
        }
        newPoint = new google.maps.LatLng(rectangleBounds.getSouthWest().lat(), rectangleBounds.getNorthEast().lng());
        distance = -distance;
      }

      if ((heading >= -45 && heading < 0) || (heading <= 180 && heading >= 135)) {
        if (heading <= 180 && heading >= 135) {
          referenceLine.setPath([referenceLine.getPath().getAt(1), referenceLine.getPath().getAt(0)]);
        }
      }

      if ((heading > 45 && heading <= 90) || (heading <= -90 && heading > -135)) {
        if (heading <= -90 && heading > -135) {
          referenceLine.setPath([referenceLine.getPath().getAt(1), referenceLine.getPath().getAt(0)]);
        }
        newPoint = new google.maps.LatLng(rectangleBounds.getSouthWest().lat() - offsetToLat(height / 3), rectangleBounds.getSouthWest().lng());
        movingType = 'y';
      }

      if ((heading > 90 && heading < 135) || (heading < -45 && heading > -90)) {
        if (heading < -45 && heading > -90) {
          referenceLine.setPath([referenceLine.getPath().getAt(1), referenceLine.getPath().getAt(0)]);
        }
        newPoint = new google.maps.LatLng(rectangleBounds.getSouthWest().lat() - offsetToLat(height / 3), rectangleBounds.getSouthWest().lng());
        movingType = 'y';
      }

      console.log('distance', distance);
      console.log('newPoint', newPoint);

      referenceLine = extendLine(referenceLine, diagonalDistance * 4);
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
      let metPolygon = false;
      let hasEnded = false;
      const actualPolygon = findPolygon($scope.polygons, polygon.content);
      let innerPolygonCounter = 0;
      do {
        let latLngOffset = null;
        if (movingType === 'x') {
          latLngOffset = google.maps.geometry.spherical.computeOffset(
            newPoint,
            distance,
            90,
          );
        }
        if (movingType === 'y') {
          latLngOffset = google.maps.geometry.spherical.computeOffset(
            newPoint,
            distance,
            0,
          );
        }

        newPoint = new google.maps.LatLng(latLngOffset.lat(), latLngOffset.lng());
        const newPolyline = copyPolyLine(referenceLine);
        movePolylineParallellyToNewPoint(newPolyline, newPoint);
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

            addNumberedMarker(newPolygon, actualPolygon.id + '-' + innerPolygonCounter);

            let area = google.maps.geometry.spherical.computeArea(newPolygon.getPath());
            if (area > 100000) {
              area =  (area / 1000000).toFixed(2) + ' sq km';
            } else {
              area = area.toFixed(2) + 'sq m';
            }
            let perimeter = google.maps.geometry.spherical.computeLength(newPolygon.getPath());
            if (perimeter > 1000) {
              perimeter = (perimeter / 1000).toFixed(2) + ' km';
            } else {
              perimeter = perimeter.toFixed(2) + ' m';
            }

            actualPolygon.innerPolygons.push({
              id: actualPolygon.id + '-' + innerPolygonCounter,
              content: newPolygon.content,
              polygon: newPolygon,
              area,
              perimeter,
              outerPolygonContent: actualPolygon.content,
              contentChain: actualPolygon.content + ':' + newPolygon.content,
              innerPolygons: [],
            });
            innerPolygonCounter++;
          });
        }

        lastLine = newPolyline;

        if(intersection?.geometry) {
          metPolygon = true;
        }

        if (metPolygon && !intersection?.geometry) {
          hasIntersection = false;
          i++;
          if (i > 50) {
            hasEnded = true
          }
          // continue;
        }
      } while (!hasEnded);

      $scope.$apply();
    }

    function addNumberedMarker(polygon, number) {
      if (!markers[polygon.content]) markers[polygon.content] = [];

      const bounds = new google.maps.LatLngBounds();
      const path = polygon.getPath();
      path.forEach((latLng) => bounds.extend(latLng));
      const center = bounds.getCenter();

      const marker = new google.maps.Marker({
        position: center,
        map: map,
        icon: 'https://faridjafarli.me/tasks/test-task/transp.png?v=2',
        label: number.toString(),
      });

      markers[polygon.content].push(marker);
    }


    function drawParallelLinesInsidePolygon(polygon, referenceLine, distance) {
      if (!$scope.polygon) {
        alert('Please draw a polygon first.');
        return;
      }

      // if (!$scope.polygon.outerPolygonContent) {
      //   alert('Please select inner polygon.')
      //   return;
      // }

      if (!referenceLine) {
        alert('Please draw a reference line first.');
        return;
      }

      fillPolygonWithParallelReferenceLines($scope.polygon, referenceLine, distance);

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

    function handleKeyPress(event) {
      if (event.key === 'Backspace') {
        $scope.deletePolygon($scope.polygon);
      }
    }

    function initialize() {
      map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: {
          lat: -38.085898,
          lng: 145.406453,
        },
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        streetViewControl: false,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: true,
        heading: 0,
        tilt: 0,
        mapId: "90f87356969d889c",
      });

      document.addEventListener('keydown', handleKeyPress);

      let polyOptions = {
        strokeColor: '#0000FF',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#0000FF',
        fillOpacity: 0,
        draggable: false,
        editable: false
      };
      drawingManager = new google.maps.drawing.DrawingManager({
        // drawingMode: google.maps.drawing.OverlayType.POLYGON,
        drawingControlOptions: {
          drawingModes: [google.maps.drawing.OverlayType.POLYGON],
        },
        polygonOptions: polyOptions,
        map: map
      });

      searchInput = document.getElementById('location-search');
      const searchBox = new google.maps.places.SearchBox(searchInput);

      searchBox.addListener('places_changed', function () {
        const places = searchBox.getPlaces();

        if (places.length === 0) {
          return;
        }

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
          if (event.type !== google.maps.drawing.OverlayType.POLYGON) {
            return;
          }

          drawingManager.setDrawingMode(null);

          let newShape = event.overlay;
          newShape.type = event.type;
          newShape.content = uuidv4();
          google.maps.event.addListener(newShape, 'click', function () {
            setSelection(newShape);
          });
          setSelection(newShape);

          if (event.type === google.maps.drawing.OverlayType.POLYGON) {
            const newPolygonCords = [];
            newShape.getPath().g.forEach(coord => {
              newPolygonCords.push([coord.lng(), coord.lat()]);
            });
            newPolygonCords.push([newShape.getPath().g[0].lng(), newShape.getPath().g[0].lat()]);
            const turfNewPolygon = turf.polygon([newPolygonCords]);

            let outerPolygon;
            let isInnerPolygon = false;
            let hasIntersection = false;

            $scope.polygons.forEach(polygonObj => {
              const currPolygon = polygonObj.polygon;
              const currPolygonCords = [];
              currPolygon.getPath().g.forEach(coord => {
                currPolygonCords.push([coord.lng(), coord.lat()]);
              });
              currPolygonCords.push([currPolygon.getPath().g[0].lng(), currPolygon.getPath().g[0].lat()]);
              const turfCurrPolygon = turf.polygon([currPolygonCords]);

              const intersection = turf.intersect(turfCurrPolygon, turfNewPolygon);
              if (intersection) {
                if (intersection.geometry.coordinates[0]) {
                  hasIntersection = true;
                  isInnerPolygon = areArraysEqual(intersection.geometry.coordinates[0], turfNewPolygon.geometry.coordinates[0]);
                  if (polygonObj.innerPolygons.length) {

                  }
                  if (isInnerPolygon) {
                    outerPolygon = polygonObj;
                    $scope.anyInnerPolygon = true;
                  }
                }
              }
            });

            if (hasIntersection && !isInnerPolygon) {
              alert('New polygon has intersection with other, but is not inner polygon.');
              newShape.setMap(null);
              return;
            }

            if ($scope.polygon) {
              $scope.polygon.setOptions({
                strokeColor: "#0000FF",
              });
            }
            if (isInnerPolygon) {
              $scope.polygon = newShape;
              $scope.polygon.setOptions({
                strokeColor: "#00FF00",
              });
            }

            let area = google.maps.geometry.spherical.computeArea(newShape.getPath());
            if (area > 100000) {
              area =  (area / 1000000).toFixed(2) + ' sq km';
            } else {
              area = area.toFixed(2) + 'sq m';
            }
            let perimeter = google.maps.geometry.spherical.computeLength(newShape.getPath());
            if (perimeter > 1000) {
              perimeter = (perimeter / 1000).toFixed(2) + ' km';
            } else {
              perimeter = perimeter.toFixed(2) + ' m';
            }

            if (isInnerPolygon) {
              outerPolygon.innerPolygons.push({
                id: outerPolygon.id + '-' + (outerPolygon.innerPolygons.length + 1),
                content: newShape.content,
                polygon: newShape,
                area,
                perimeter,
                outerPolygonContent: outerPolygon.content,
                contentChain: outerPolygon.content + ':' + newShape.content,
                innerPolygons: [],
              })
            } else {
              $scope.polygons.push({
                id: polygonCounter,
                content: newShape.content,
                polygon: newShape,
                area,
                perimeter,
                contentChain: newShape.content,
                innerPolygons: [],
              })
              polygonCounter++;
            }

            $scope.$apply();

            google.maps.event.addListener(newShape, 'click', function (event) {
              const checkIfOuter = $scope.polygons.find(elem => elem.content === newShape.content);
              if (checkIfOuter) return;
              $scope.handlePolygonClick(newShape);
            });
          }
          const path = event.overlay.getPath();

          const area = google.maps.geometry.spherical.computeArea(path);
          const formattedArea = (area / 1e6).toFixed(2) + ' sq km';

          markers[newShape.content] = [];

          for (let i = 0; i < path.getLength(); i++) {
            const segmentStart = path.getAt(i);
            const segmentEnd = path.getAt((i + 1) % path.getLength());
            const centerLatLng = new google.maps.LatLng(
              (segmentStart.lat() + segmentEnd.lat()) / 2,
              (segmentStart.lng() + segmentEnd.lng()) / 2
            );

            const distance = google.maps.geometry.spherical.computeDistanceBetween(segmentStart, segmentEnd);
            const formattedDistance = (distance / 1000).toFixed(2) + ' km';

            const marker = new google.maps.Marker({
              position: centerLatLng,
              map: map,
              icon: 'https://faridjafarli.me/tasks/test-task/transp.png?v=2',
              label: {
                text: formattedDistance,
                color: 'white',
              },
            });
            markers[newShape.content].push(marker);
          }
        }
      });

      google.maps.event.addListener(drawingManager, 'drawingmode_changed', clearSelection);
      google.maps.event.addListener(map, 'click', clearSelection);
      google.maps.event.addDomListener(document.getElementById('delete-button'), 'click', deleteSelectedShape);

      const buttons = [
        ["Rotate Left", "rotate", 20, google.maps.ControlPosition.LEFT_CENTER],
        ["Rotate Right", "rotate", -20, google.maps.ControlPosition.RIGHT_CENTER],
        // ["Tilt Down", "tilt", 20, google.maps.ControlPosition.TOP_CENTER],
        // ["Tilt Up", "tilt", -20, google.maps.ControlPosition.BOTTOM_CENTER],
      ];

      buttons.forEach(([text, mode, amount, position]) => {
        const controlDiv = document.createElement("div");
        const controlUI = document.createElement("button");

        controlUI.classList.add("ui-button");
        controlUI.innerText = `${text}`;
        controlUI.addEventListener("click", () => {
          adjustMap(mode, amount);
        });
        controlDiv.appendChild(controlUI);
        map.controls[position].push(controlDiv);
      });

      const adjustMap = function (mode, amount) {
        switch (mode) {
          case "tilt":
            map.setTilt(map.getTilt() + amount);
            break;
          case "rotate":
            map.setHeading(map.getHeading() + amount);
            break;
          default:
            break;
        }
      };

      // buildColorPalette();
    }

    google.maps.event.addDomListener(window, 'load', initialize);
  });
})(myApp);
