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
    $scope.overlays = [];
    $scope.unitsType = 'me';
    $scope.showMode = 'polygons';
    $scope.polygonsToMerge = [];


    $scope.switchToPolygons = function () {
      if ($scope.showMode !== 'polygons') {
        // hidePolygons
        $scope.polygons.forEach(outerPolygon => {
          outerPolygon.polygon.setMap(map);
          if (markers[outerPolygon.content].length) {
            for (const marker of markers[outerPolygon.content]) {
              marker.setMap(map)
            }
          }
          if (outerPolygon.innerPolygons?.length) {
            outerPolygon.innerPolygons.forEach(innerPolygon => {
              innerPolygon.polygon.setMap(map);
              if (markers[innerPolygon.content].length) {
                for (const marker of markers[innerPolygon.content]) {
                  marker.setMap(map)
                }
              }
              // if (innerPolygon.innerPolygons?.length) {
              //   innerPolygon.innerPolygons.forEach(segmentPolygon => {
              //     segmentPolygon.polygon.setMap(map);
              //     if (markers[segmentPolygon.content].length) {
              //       for (const marker of markers[segmentPolygon.content]) {
              //         marker.setMap(map)
              //       }
              //     }
              //   });
              // }
            })
          }
        });

        // showOverlays
        $scope.overlays.forEach(overlayPolygon => {
          overlayPolygon.polygon.setMap(null);
          if (markers[overlayPolygon.content].length) {
            for (const marker of markers[overlayPolygon.content]) {
              marker.setMap(null)
            }
          }
        });

        $scope.showMode = 'polygons';
      }
    }

    $scope.switchToOverlays = function () {
      if ($scope.showMode !== 'overlays') {
        // hidePolygons
        $scope.polygons.forEach(outerPolygon => {
          outerPolygon.polygon.setMap(null);
          if (markers[outerPolygon.content].length) {
            for (const marker of markers[outerPolygon.content]) {
              marker.setMap(null)
            }
          }
          if (outerPolygon.innerPolygons?.length) {
            outerPolygon.innerPolygons.forEach(innerPolygon => {
              innerPolygon.polygon.setMap(null);
              if (markers[innerPolygon.content].length) {
                for (const marker of markers[innerPolygon.content]) {
                  marker.setMap(null)
                }
              }
              // if (innerPolygon.innerPolygons?.length) {
              //   innerPolygon.innerPolygons.forEach(segmentPolygon => {
              //     segmentPolygon.polygon.setMap(null);
              //     if (markers[segmentPolygon.content].length) {
              //       for (const marker of markers[segmentPolygon.content]) {
              //         marker.setMap(null)
              //       }
              //     }
              //   });
              // }
            })
          }
        });

        // showOverlays
        $scope.overlays.forEach(overlayPolygon => {
          overlayPolygon.polygon.setMap(map);
          if (markers[overlayPolygon.content].length) {
            for (const marker of markers[overlayPolygon.content]) {
              marker.setMap(map)
            }
          }
        });

        $scope.showMode = 'overlays';
      }
    }

    function squareMetersToAcres(squareMeters) {
      // 1 acre = 4046.86 square meters
      const acres = squareMeters / 4046.86;
      return acres;
    }

    function squareMetersToHectares(squareMeters) {
      // 1 hectare = 10,000 square meters
      const hectares = squareMeters / 10000;
      return hectares;
    }

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
        if (markers[selectedShape.content].length) {
          for (const marker of markers[selectedShape.content]) {
            marker.setMap(null)
          }
        }
        try {
          $scope.$apply();
        } catch (e) {}
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
        $scope.polygonsToMerge.push(polygonObj);
      } else {
        // REMOVE OVERLAY
        polygonObj.polygon.setOptions({fillColor: '#0000FF'});
        $scope.polygonsToMerge = $scope.polygonsToMerge.filter(item => item.content !== polygonObj.content);
      }
    };

    $scope.showInnerPolygons = function (polygon) {
      polygon.showInnerPolygons = true;
    };

    $scope.hideInnerPolygons = function (polygon) {
      polygon.showInnerPolygons = false;
    };

    $scope.handlePolygonClick  = function (latLng, clickedPolygon){
      if (google.maps.geometry.poly.isLocationOnEdge(latLng, polygon, 1e-9)) {
        $scope.polygon.setOptions({
          strokeColor: '#0000FF',
        });
        $scope.polygon = clickedPolygon;
        $scope.polygon.setOptions({
          strokeColor: '#00FF00',
        });
      }
    };

    function handleOverlayPolygonChange() {
      const polygon = $scope.overlays[$scope.overlays.length - 1].polygon;

      const originalPolygonCords = [];
      polygon.getPath().Ig.forEach(coord => {
        originalPolygonCords.push([coord.lng(), coord.lat()]);
      });
      originalPolygonCords.push([polygon.getPath().Ig[0].lng(), polygon.getPath().Ig[0].lat()]);
      const turfOriginalPolygon = turf.polygon([originalPolygonCords]);

      const difference = turf.difference(turfOriginalPolygon, $scope.originalOverlayTurf);
      if (difference) {
        // UNDO last change
        alert('You could not enlarge polygon.');
        polygon.setPath($scope.currentOverlayVertices.map(({ lat, lng }) => new google.maps.LatLng(lat, lng)));
        google.maps.event.addListener(polygon.getPath(), 'insert_at', handleOverlayPolygonChange);
        google.maps.event.addListener(polygon.getPath(), 'remove_at', handleOverlayPolygonChange);
        google.maps.event.addListener(polygon.getPath(), 'set_at', handleOverlayPolygonChange);
        return;
      }

      let area = google.maps.geometry.spherical.computeArea(polygon.getPath());
      let areaAcres = squareMetersToAcres(area).toFixed(2) + ' acres';
      let areaHectares = squareMetersToHectares(area).toFixed(2) + ' ha';
      if (area > 100000) {
        area =  (area / 1000000).toFixed(2) + ' sq km';
      } else {
        area = area.toFixed(2) + 'sq m';
      }
      let perimeter = google.maps.geometry.spherical.computeLength(polygon.getPath());
      if (perimeter > 1000) {
        perimeter = (perimeter / 1000).toFixed(2) + ' km';
      } else {
        perimeter = perimeter.toFixed(2) + ' m';
      }

      $scope.overlays[$scope.overlays.length - 1] = {
        ...$scope.overlays[$scope.overlays.length - 1],
        area,
        areaAcres,
        areaHectares,
        perimeter,
      };

      $scope.currentOverlayVertices = polygon.getPath().getArray().map((latLng) => ({ lat: latLng.lat(), lng: latLng.lng() }));

      try {
        $scope.$apply();
      } catch (e) {}
    }

    $scope.mergePolygons = function () {
      // $scope.polygonsToMerge.sort((a, b) => a.order - b.order);
      //
      // let isSequential = true;
      //
      // for (let i = 1; i < $scope.polygonsToMerge.length; i++) {
      //   if ($scope.polygonsToMerge[i].order - $scope.polygonsToMerge[i - 1].order !== 1) {
      //     isSequential = false;
      //     break;
      //   }
      // }
      //
      // if (isSequential === false) {
      //   alert('Order of marked polygons is not sequential.');
      //   return;
      // }

      const polygons = $scope.polygonsToMerge.map(polygonToMerge => {
        const polygon = polygonToMerge.polygon;
        const originalPolygonCords = [];
        polygon.getPath().Ig.forEach(coord => {
          originalPolygonCords.push([coord.lng(), coord.lat()]);
        });
        originalPolygonCords.push([polygon.getPath().Ig[0].lng(), polygon.getPath().Ig[0].lat()]);
        const turfOriginalPolygon = turf.polygon([originalPolygonCords]);
        return turfOriginalPolygon;
      });

      try {
        const joinedPolygon = polygons.reduce((a, b) => turf.union(a, b), polygons[0])

        console.log('joinedPolygon', joinedPolygon);
        const newPolygonCoordinates = [];
        if (joinedPolygon.geometry.type === 'Polygon') {
          joinedPolygon.geometry.coordinates[0].forEach(coord => {
            newPolygonCoordinates.push({lng: coord[0], lat: coord[1]});
          })
        }
        if (joinedPolygon.geometry.type === 'MultiPolygon') {
          if (joinedPolygon.geometry.coordinates.length > 1) {
            alert('Order of marked polygons is not sequential.');
            return;
          }
          joinedPolygon.geometry.coordinates[0].forEach(coord => {
            newPolygonCoordinates.push({lng: coord[0], lat: coord[1]});
          })
        }

        const newPolygon = new google.maps.Polygon({
          paths: newPolygonCoordinates,
          map: map,
          strokeColor: '#FF00FF',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#0000FF',
          fillOpacity: 0.35,
          editable: true,
        });

        // newPolygon.setOptions({
        //   fillColor: 'transparent',
        //   strokeColor: 'transparent',
        // });
        newPolygon.setMap(null);

        newPolygon.content = uuidv4();

        markers[newPolygon.content] = [];

        let area = google.maps.geometry.spherical.computeArea(newPolygon.getPath());
        let areaAcres = squareMetersToAcres(area).toFixed(2) + ' acres';
        let areaHectares = squareMetersToHectares(area).toFixed(2) + ' ha';
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

        $scope.overlays.push({
          id: polygonCounter,
          name: polygonCounter,
          content: newPolygon.content,
          polygon: newPolygon,
          area,
          areaAcres,
          areaHectares,
          perimeter,
          finished: false,
          contentChain: newPolygon.content,
          innerPolygons: [],
        });
        polygonCounter++;

        const originalPolygonCords = [];
        newPolygon.getPath().Ig.forEach(coord => {
          originalPolygonCords.push([coord.lng(), coord.lat()]);
        });
        originalPolygonCords.push([newPolygon.getPath().Ig[0].lng(), newPolygon.getPath().Ig[0].lat()]);
        $scope.originalOverlayTurf = turf.polygon([originalPolygonCords]);
        $scope.currentOverlayVertices = newPolygon.getPath().getArray().map((latLng) => ({ lat: latLng.lat(), lng: latLng.lng() }));


        google.maps.event.addListener(newPolygon.getPath(), 'insert_at', handleOverlayPolygonChange);
        google.maps.event.addListener(newPolygon.getPath(), 'remove_at', handleOverlayPolygonChange);
        google.maps.event.addListener(newPolygon.getPath(), 'set_at', handleOverlayPolygonChange);

        document.getElementById('overlays-tab').click();

        $scope.polygonsToMerge = [];

        $scope.polygons.forEach(outerPolygon => {
          if (outerPolygon.innerPolygons?.length) {
            outerPolygon.innerPolygons.forEach(innerPolygon => {
              if (innerPolygon.innerPolygons?.length) {
                innerPolygon.innerPolygons.forEach(segmentPolygon => {
                  if (segmentPolygon.overlayItemCheck === true) {
                    segmentPolygon.polygon.setOptions({fillColor: '#0000FF'});
                    segmentPolygon.overlayItemCheck = false;
                  }
                });
              }
            });
          }
        });

        try {
          $scope.$apply();
        } catch (e) {};
      } catch (e) {
        console.error('e', e);
        alert('Something went wrong.');
      }
    }

    $scope.finishOverlay = function (polygonObj) {
      const polygon = polygonObj.polygon;
      polygon.setOptions({
        editable: false,
      });

      markers[polygon.content] = [];
      addNumberedMarker(polygon, polygonObj.name);

      const path = polygon.getPath();

      for (let i = 0; i < path.getLength(); i++) {
        const segmentStart = path.getAt(i);
        const segmentEnd = path.getAt((i + 1) % path.getLength());
        const centerLatLng = new google.maps.LatLng(
          (segmentStart.lat() + segmentEnd.lat()) / 2,
          (segmentStart.lng() + segmentEnd.lng()) / 2
        );

        const distance = google.maps.geometry.spherical.computeDistanceBetween(segmentStart, segmentEnd);
        let formattedDistance = '';
        if (distance > 1000) {
          formattedDistance = (distance / 1000).toFixed(2) + ' km';
        } else {
          formattedDistance = (distance).toFixed(2) + ' m';
        }
        if (distance !== 0) {
          const marker = new google.maps.Marker({
            position: centerLatLng,
            map: map,
            icon: 'https://faridjafarli.me/tasks/test-task/transp.png?v=2',
            label: {
              text: formattedDistance,
              color: 'green',
            },
          });
          markers[polygon.content].push(marker);
        }
      }
    };

    function deleteInnerPolygons(innerPolygon) {
      if (innerPolygon.innerPolygons.length) {
        for (const innerP of innerPolygon.innerPolygons) {
          deleteInnerPolygons(innerP);
        }
      }
      innerPolygon.polygon.setMap(null);
      if (markers[innerPolygon.polygon?.content]?.length) {
        for (const marker of markers[innerPolygon.polygon.content]) {
          marker.setMap(null)
        }
      }
    }

    $scope.editPolygon = function (polygon) {
      polygon.editMode = true;
      try {
        $scope.$apply();
      } catch (e) {}
    };

    $scope.updatePolygon = function (polygon, type) {
      polygon.editMode = false;
      for (const marker of markers[polygon.content]) {
        marker.setMap(null)
      }
      addNumberedMarker(polygon.polygon, polygon.name, (type === 'overlay') ? 'red' : 'black');
      try {
        $scope.$apply();
      } catch (e) {}
    };

    $scope.deletePolygon = function (polygon) {
      const index = $scope.polygons.findIndex(elem => elem.content === polygon.content);
      const chosenPolygon = $scope.polygons.find(elem => elem.content === polygon.content);
      if (chosenPolygon.innerPolygons?.length) {
        chosenPolygon.innerPolygons?.forEach(innerPolygon => {
          if (innerPolygon.innerPolygons?.length) {
            // 2nd deep inner Polygons
            innerPolygon.innerPolygons?.forEach(innerPolygon => {
              innerPolygon.polygon.setMap(null);
              if (markers[innerPolygon.polygon?.content]?.length) {
                for (const marker of markers[innerPolygon.polygon.content]) {
                  marker.setMap(null)
                }
              }
            });
          }

          // 1st deep inner Polygons
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
      try {
        $scope.$apply();
      } catch (e) {}
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

      drawingManager.setDrawingMode();
      google.maps.event.addListenerOnce(referenceLine, 'click', function () {
        $scope.finishReferenceLine();
      });

      google.maps.event.addListener(map, 'click', function (event) {
        console.log('drawReferenceLine-event', event);
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

    function extendLineByPoints(startPoint, endPoint, extensionDistance) {
      const endHeading = google.maps.geometry.spherical.computeHeading(startPoint, endPoint);
      const startHeading = google.maps.geometry.spherical.computeHeading(endPoint, startPoint);
      const extendedStartPoint = google.maps.geometry.spherical.computeOffset(startPoint, extensionDistance, startHeading);
      const extendedEndPoint = google.maps.geometry.spherical.computeOffset(endPoint, extensionDistance, endHeading);
      return {
        startPoint: extendedStartPoint,
        endPoint: extendedEndPoint,
      }
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

    function isCoordinateOnPolygonBorder(lineCoords, pointCoords, polygonCoords) {
      const line = turf.lineString(lineCoords);
      const center = turf.point(turf.center(line).geometry.coordinates);
      const point = turf.point(pointCoords);
      const polygonEdges = turf.lineString(polygonCoords);
      const turfPolygon = turf.polygon([polygonCoords]);
      // const polygonEdges = turf.lineString(turfPolygon.geometry.coordinates[0]);

      // const booleanIntersects = turf.booleanIntersects(polygonEdges, point)
      // const booleanWithin = turf.booleanWithin(point, polygonEdges)
      // const booleanWithinCenter = turf.booleanWithin(center, polygonEdges)
      // const booleanContains = turf.booleanContains(polygonEdges, point)
      // const booleanContainsCenter = turf.booleanContains(polygonEdges, center)
      // const contains = turf.booleanContains(polygonEdges, line)
      // const onBorder = turf.booleanPointOnLine(point, polygonEdges);
      const onBorderCenter = turf.booleanPointOnLine(center, polygonEdges);
      // const lineIntersect = turf.lineIntersect(polygonEdges, line)

      // console.log('booleanIntersects', booleanIntersects);
      // console.log('booleanWithin', booleanWithin);
      // console.log('booleanWithinCenter', booleanWithinCenter);
      // console.log('booleanContains', booleanContains);
      // console.log('booleanContainsCenter', booleanContainsCenter);
      // console.log('contains', contains);
      // console.log('onBorder', onBorder);
      console.log('onBorderCenter', onBorderCenter);
      // console.log('lineIntersect', lineIntersect);

      return onBorderCenter;
    }

    function areParallel(edge1, edge2) {
      const edge1Start = edge1[0];
      const edge1End = edge1[1];
      const edge2Start = edge2[0];
      const edge2End = edge2[1];
      // const { startPoint: edge1Start, endPoint: edge1End } = extendLineByPoints(edge1[0], edge1[1], 500000);
      // const { startPoint: edge2Start, endPoint: edge2End } = extendLineByPoints(edge2[0], edge2[1], 500000);
      // console.log(
      //   "[[edge1[0].lng(), edge1[0].lat()], [edge1[1].lng(), edge1[1].lat()]]",
      //   [[edge1[0].lng(), edge1[0].lat()], [edge1[1].lng(), edge1[1].lat()]],
      // )
      // console.log(
      //   "[[edge1Start.lng(), edge1Start.lat()], [edge1End.lng(), edge1End.lat()]]",
      //   [[edge1Start.lng(), edge1Start.lat()], [edge1End.lng(), edge1End.lat()]],
      // )
      const line1 = turf.lineString([[edge1Start.lng(), edge1Start.lat()], [edge1End.lng(), edge1End.lat()]]);
      const line2 = turf.lineString([[edge2Start.lng(), edge2Start.lat()], [edge2End.lng(), edge2End.lat()]]);
      console.log('line1', line1)
      console.log('line2', line2)
      const point1 = turf.point([edge1Start.lng(), edge1Start.lat()]);
      const point2 = turf.point([edge1End.lng(), edge1End.lat()]);
      const bearing1 = turf.bearing(point1, point2);
      const point3 = turf.point([edge2Start.lng(), edge2Start.lat()]);
      const point4 = turf.point([edge2End.lng(), edge2End.lat()]);
      const bearing2 = turf.bearing(point3, point4);
      const angleTolerance = 0.5;
      const areParallel = (Math.abs(bearing1 - bearing2) < angleTolerance)
        || (Math.abs(bearing1 - bearing2 - 180) < angleTolerance);
      // || (Math.abs(bearing1 - bearing2 + 180) < angleTolerance);
      console.log(`bearing1: ${bearing1}, bearing2: ${bearing2} are ${areParallel}`);
      return areParallel;
      try {
        const isParallel = turf.booleanParallel(line1, line2);
        return isParallel;
      } catch (e) {
        // console.error(e);
        if (e.message === 'invalid polygon') {
          const point1 = turf.point([edge1Start.lng(), edge1Start.lat()]);
          const point2 = turf.point([edge1End.lng(), edge1End.lat()]);
          const bearing1 = turf.bearing(point1, point2);
          const point3 = turf.point([edge2Start.lng(), edge2Start.lat()]);
          const point4 = turf.point([edge2End.lng(), edge2End.lat()]);
          const bearing2 = turf.bearing(point3, point4);
          const angleTolerance = 1;
          const areParallel = (Math.abs(bearing1 - bearing2) < angleTolerance);
          console.log(`bearing1: ${bearing1}, bearing2: ${bearing2} are ${areParallel}`);
          return areParallel;
          // const vector1 = turf.getCoords(line1)[1].map((coord, index) => coord - turf.getCoords(line1)[0][index]);
          // const vector2 = turf.getCoords(line2)[1].map((coord, index) => coord - turf.getCoords(line2)[0][index]);
          // const dotProduct = vector1[0] * vector2[0] + vector1[1] * vector2[1];
          // const magnitude1 = Math.sqrt(vector1[0] * vector1[0] + vector1[1] * vector1[1]);
          // const magnitude2 = Math.sqrt(vector2[0] * vector2[0] + vector2[1] * vector2[1]);
          // const angleInRadians = Math.acos(dotProduct / (magnitude1 * magnitude2));
          // const angleInDegrees = angleInRadians * (180 / Math.PI);
          // const angleTolerance = 1; // Adjust this value based on your needs
          // const areParallel = Math.abs(angleInDegrees - 180) < angleTolerance;
          // console.log(`angleInDegrees: ${angleInDegrees} are ${areParallel}`);
          // return areParallel;
          // const angle1 = turf.lineAngle(line1);
          // const angle2 = turf.lineAngle(line2);
          // const angleTolerance = 1; // Adjust this value based on your needs
          // const areParallel = Math.abs(angle1 - angle2) < angleTolerance;
          // console.log(`angle1: ${angle1}, angle2: ${angle2} are ${areParallel}`);
          // return areParallel;
          // const intersects = turf.lineIntersect(line1, line2);
          // console.log(intersects.features);
          // return intersects?.features?.length === 0;
        }
      }
      return false;
      // const heading1 = google.maps.geometry.spherical.computeHeading(edge1[0], edge1[1]);
      // const heading2 = google.maps.geometry.spherical.computeHeading(edge2[0], edge2[1]);
      // const tolerance = 1e-6;
      // console.log('heading1', heading1)
      // console.log('heading2', heading2)
      // const check1 = Math.abs(heading1 - heading2);
      // const check2 = Math.abs(heading1 - heading2 - 180);
      // console.log('check1', check1)
      // console.log('check2', check2);
      // console.log('tolerance', tolerance);
      // console.log('check1 < tolerance || check2 < tolerance', check1 < tolerance || check2 < tolerance);
      // return check1 < tolerance || check2 < tolerance;
    }

    function findParallelEdges(path) {
      console.log('path', path);
      let parallelEdges = [];
      for (let i = 0; i < path.getLength(); i++) {
        const edge1Start = path.getAt(i);
        const edge1End = path.getAt((i + 1) % path.getLength());
        const edge1 = [edge1Start, edge1End];
        for (let j = i + 1; j < path.getLength(); j++) {
          if(((j + 1) % path.getLength()) !== 0) {
            const edge2Start = path.getAt(j);
            const edge2End = path.getAt((j + 1) % path.getLength());
            console.log('i', i);
            console.log('(i + 1) % path.getLength()', (i + 1) % path.getLength());
            console.log('j', j);
            console.log('(j + 1) % path.getLength()', (j + 1) % path.getLength());
            const edge2 = [edge2Start, edge2End];
            const areParallelEdges = areParallel(edge1, edge2);
            console.log(`${i} and ${j} are parallel: ${areParallelEdges}`);
            if (areParallelEdges) {
              parallelEdges[i] = edge1;
              parallelEdges[j] = edge2;
            }
          }
        }
      }
      return parallelEdges;
    }

    function fillPolygonWithParallelReferenceLines(polygon, referenceLine, distance) {
      putPolygonIntoSquare(polygon);

      const startPoint = rectangleBounds.getSouthWest();
      const endPoint = new google.maps.LatLng(startPoint.lat(), rectangleBounds.getNorthEast().lng());

      let newPoint = rectangleBounds.getSouthWest();

      const heading = google.maps.geometry.spherical.computeHeading(referenceLine.getPath().getAt(0), referenceLine.getPath().getAt(1));

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

      referenceLine = extendLine(referenceLine, diagonalDistance * 4);
      const firstPolyLine = copyPolyLine(referenceLine);
      movePolylineParallellyToNewPoint(firstPolyLine, newPoint);
      // firstPolyLine.setMap(map); // hide first parallel line

      referenceLine.setMap(null);
      let lines = [];
      let hasIntersection = true;
      let lastLine = null;
      const originalPolygonCords = [];
      polygon.getPath().Ig.forEach(coord => {
        originalPolygonCords.push([coord.lng(), coord.lat()]);
      });
      originalPolygonCords.push([polygon.getPath().Ig[0].lng(), polygon.getPath().Ig[0].lat()]);
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

            newPolygon.content = uuidv4();

            markers[newPolygon.content] = [];
            addNumberedMarker(newPolygon, actualPolygon.id + '-' + innerPolygonCounter);

            const path = newPolygon.getPath();

            const parallelEdges = findParallelEdges(path);
            if (parallelEdges.length) {
              for (const edge of parallelEdges) {
                if (edge) {
                  const segmentStart = edge[0];
                  const segmentEnd = edge[1];
                  const lat = ((segmentStart.lat() + segmentEnd.lat()) / 2);
                  const lng = ((segmentStart.lng() + segmentEnd.lng()) / 2);
                  const centerLatLng = new google.maps.LatLng(lat, lng);
                  const distance = google.maps.geometry.spherical.computeDistanceBetween(segmentStart, segmentEnd);
                  let formattedDistance = '';
                  if (distance > 1000) {
                    formattedDistance = (distance / 1000).toFixed(2) + ' km';
                  } else {
                    formattedDistance = (distance).toFixed(2) + ' m';
                  }
                  if (
                    distance !== 0
                  ) {
                    const marker = new google.maps.Marker({
                      position: centerLatLng,
                      map: map,
                      icon: 'https://faridjafarli.me/tasks/test-task/transp.png?v=2',
                      label: {
                        text: formattedDistance,
                        color: 'white',
                      },
                    });
                    markers[newPolygon.content].push(marker);
                  }
                }
              }
            }

            // for (let i = 0; i < path.getLength(); i++) {
            //   const segmentStart = path.getAt(i);
            //   const segmentEnd = path.getAt((i + 1) % path.getLength());
            //   const lat = ((segmentStart.lat() + segmentEnd.lat()) / 2);
            //   const lng = ((segmentStart.lng() + segmentEnd.lng()) / 2);
            //   const centerLatLng = new google.maps.LatLng(lat, lng);
            //
            //   const distance = google.maps.geometry.spherical.computeDistanceBetween(segmentStart, segmentEnd);
            //   let formattedDistance = '';
            //   if (distance > 1000) {
            //     formattedDistance = (distance / 1000).toFixed(2) + ' km';
            //   } else {
            //     formattedDistance = (distance).toFixed(2) + ' m';
            //   }
            //   if (
            //      distance !== 0
            //   ) {
            //     const marker = new google.maps.Marker({
            //       position: centerLatLng,
            //       map: map,
            //       icon: 'https://faridjafarli.me/tasks/test-task/transp.png?v=2',
            //       label: {
            //         text: formattedDistance,
            //         color: 'white',
            //       },
            //     });
            //     markers[newPolygon.content].push(marker);
            //   }
            // }

            let area = google.maps.geometry.spherical.computeArea(newPolygon.getPath());
            let areaAcres = squareMetersToAcres(area).toFixed(2) + ' acres';
            let areaHectares = squareMetersToHectares(area).toFixed(2) + ' ha';
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
              name: actualPolygon.id + '-' + innerPolygonCounter,
              content: newPolygon.content,
              polygon: newPolygon,
              order: innerPolygonCounter,
              area,
              areaAcres,
              areaHectares,
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

      try {
        $scope.$apply();
      } catch (e) {}
    }

    function addNumberedMarker(polygon, number, color = 'black') {
      if (!markers[polygon.content]) markers[polygon.content] = [];

      const bounds = new google.maps.LatLngBounds();
      const path = polygon.getPath();
      path.forEach((latLng) => bounds.extend(latLng));
      const center = bounds.getCenter();

      const marker = new google.maps.Marker({
        position: center,
        map: map,
        icon: 'https://faridjafarli.me/tasks/test-task/transp.png?v=2',
        label: {
          text: number.toString(),
          color,
        },
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
        // $scope.lastAction
        if (event.type != google.maps.drawing.OverlayType.MARKER) {
          if (event.type !== google.maps.drawing.OverlayType.POLYGON) {
            return;
          }

          drawingManager.setDrawingMode(null);

          let newShape = event.overlay;
          newShape.type = event.type;
          newShape.content = uuidv4();
          // google.maps.event.addListener(newShape, 'click', function () {
          //     setSelection(newShape);
          // });
          setSelection(newShape);

          if (event.type === google.maps.drawing.OverlayType.POLYGON) {
            const newPolygonCords = [];
            newShape.getPath().Ig.forEach(coord => {
              newPolygonCords.push([coord.lng(), coord.lat()]);
            });
            newPolygonCords.push([newShape.getPath().Ig[0].lng(), newShape.getPath().Ig[0].lat()]);
            const turfNewPolygon = turf.polygon([newPolygonCords]);

            let outerPolygon;
            let isInnerPolygon = false;
            let hasIntersection = false;

            $scope.polygons.forEach(polygonObj => {
              const currPolygon = polygonObj.polygon;
              const currPolygonCords = [];
              currPolygon.getPath().Ig.forEach(coord => {
                currPolygonCords.push([coord.lng(), coord.lat()]);
              });
              currPolygonCords.push([currPolygon.getPath().Ig[0].lng(), currPolygon.getPath().Ig[0].lat()]);
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
            let areaAcres = squareMetersToAcres(area).toFixed(2) + ' acres';
            let areaHectares = squareMetersToHectares(area).toFixed(2) + ' ha';
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
                name: outerPolygon.id + '-' + (outerPolygon.innerPolygons.length + 1),
                content: newShape.content,
                polygon: newShape,
                area,
                areaAcres,
                areaHectares,
                perimeter,
                outerPolygonContent: outerPolygon.content,
                contentChain: outerPolygon.content + ':' + newShape.content,
                innerPolygons: [],
              })
            } else {
              $scope.polygons.push({
                id: polygonCounter,
                name: polygonCounter,
                content: newShape.content,
                polygon: newShape,
                area,
                areaAcres,
                areaHectares,
                perimeter,
                contentChain: newShape.content,
                innerPolygons: [],
              })
              polygonCounter++;
            }

            try {
              $scope.$apply();
            } catch (e) {}

            google.maps.event.addListener(newShape, 'click', function (event) {
              console.log('handlePolygonClick-event', event);
              if ($scope.drawReferenceLineMode) {
                const path = referenceLine.getPath();
                if (path.length <= 1) {
                  path.push(event.latLng);
                } else {
                  drawingManager.setDrawingMode(null);
                }
                return;
              }
              const checkIfOuter = $scope.polygons.find(elem => elem.content === newShape.content);
              if (checkIfOuter) return;
              $scope.handlePolygonClick(event.latLng, newShape);
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
            let formattedDistance = '';
            if (distance > 1000) {
              formattedDistance = (distance / 1000).toFixed(2) + ' km';
            } else {
              formattedDistance = (distance).toFixed(2) + ' m';
            }
            if (distance !== 0) {
              const marker = new google.maps.Marker({
                position: centerLatLng,
                map: map,
                icon: 'https://faridjafarli.me/tasks/test-task/transp.png?v=2',
                label: {
                  text: formattedDistance,
                  color: 'red',
                },
              });
              markers[newShape.content].push(marker);
            }
          }
        }
      });

      google.maps.event.addListener(drawingManager, 'drawingmode_changed', clearSelection);

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Shift') {
          map.setTilt(0);
          map.setOptions({ tilt: 0 });
        }
      });

      document.addEventListener('keyup', (event) => {
        if (event.key === 'Shift') {
          map.setTilt(0);
        }
      });

      // google.maps.event.addListener(map, 'click', clearSelection);
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

      var directionx = "";
      let oldx = 0;
      document.addEventListener('mousemove', function(e) {
        var rightclk = false;
        if(e.which) {
          rightclk  = (e.which == 3);
        }
        if(rightclk == true){
          if(e.pageX == oldx){

          } else {
            if (e.pageX < oldx) {
              directionx = 'left';
            } else if (e.pageX > oldx) {
              directionx = 'right';
            }
            oldx = e.pageX;
            if(directionx == 'left'){
              map.setHeading(map.getHeading()-3);
            }
            if(directionx == 'right'){
              map.setHeading(map.getHeading()+3);
            }
          }
        }
      });
      // buildColorPalette();
    }

    google.maps.event.addDomListener(window, 'load', initialize);
  });
})(myApp);
