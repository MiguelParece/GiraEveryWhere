import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import './Map.css';
import axios from "axios";
import 'mapbox-gl/dist/mapbox-gl.css';
//please be decent and don't abuse my token
mapboxgl.accessToken = "pk.eyJ1IjoicGFyZWNlIiwiYSI6ImNsazdpd2NwNjA3eW4zZnJ0ZDV4cndoZjEifQ.kmT8xFMsAjvSqG1_Z7R9Hw";

const Map = () => {
    const mapContainerRef = useRef(null);
    const [stations, setStations] = useState([]);
    const [lng, setLng] = useState(-9.153);
    const [lat, setLat] = useState(38.751);
    const [zoom, setZoom] = useState(12);
    const [stationsLoaded, setStationsLoaded] = useState(false);
    const [estimatedDuration, setEstimatedDuration] = useState(0);
    const [distance, setDistance] = useState(0);
    const [betterWalk, setBetterWalk] = useState(false);
    var start = null
    var end = null;
    var firstWalkStart = null;
    var secondWalkEnd = null;

    useEffect(() => {
        const getStations = async () => {
            try {

                const response = await axios.get("https://cors-anywhere.herokuapp.com/https://opendata.emel.pt/cycling/gira/station/availability");
                const stations = response.data.features;
                setStations(stations);
                setStationsLoaded(true);
                // Create markers for each station and add popups
                if (stationsLoaded) {
                    stations.forEach(station => {
                        const coordinates = station.geometry.coordinates[0]; // Assuming MultiPoint geometry with a single point

                        // Create a marker
                        const marker = new mapboxgl.Marker({
                            scale: zoom * 0.03
                        }).setLngLat(coordinates);

                        // Create a popup
                        const popup = new mapboxgl.Popup({
                            closeButton: false, // Remove the close button
                            maxWidth: 'none', // Allow the popup to expand horizontally
                            offset: [25, 0], // Adjust the offset to position the popup to the left of the marker
                            anchor: "left",
                        }).setHTML(
                            `
                                <div>
                                <strong>Station ID:</strong> ${station.properties.id_expl}<br/>
                                <strong>State:</strong> ${station.properties.estado}<br/>
                                <strong>Number of Bikes:</strong> ${station.properties.num_bicicletas}<br/>
                                <strong>Number of Stations:</strong> ${station.properties.num_docas}
                                </div>
                              `
                        );

                        // Add the popup to the marker
                        marker.setPopup(popup);

                        // Add the marker to the map
                        marker.addTo(map);
                    });
                }
            } catch (err) {
                console.log(err);
            }

        }

        getStations();
        const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            style: 'mapbox://styles/mapbox/dark-v11',
            center: [lng, lat],
            zoom: zoom,
            doubleClickZoom: false,
            bearing: false,
            touchPitch: false,
        });

        // Add navigation control (the +/- zoom buttons)
        map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

        map.addControl(
            new mapboxgl.GeolocateControl({
                positionOptions: {
                    enableHighAccuracy: true
                },
                // When active the map will receive updates to the device's location as it changes.
                trackUserLocation: true,
                // Draw an arrow next to the location dot to indicate which direction the device is heading.
                showUserHeading: true
            }),
            'bottom-right'
        );

        map.on('move', () => {
            setLng(map.getCenter().lng.toFixed(4));
            setLat(map.getCenter().lat.toFixed(4));
            setZoom(map.getZoom().toFixed(2));
        });


        // Event listener for double-click to set start and end points
        map.on('dblclick', async (event) => {
            if (stationsLoaded) {
                console.log("start", start);
                console.log("end", end);
                const coords = Object.keys(event.lngLat).map((key) => event.lngLat[key]);
                console.log("coords->", coords);
                if (start != null && end != null) {
                    console.log("reset");
                    start = null;
                    end = null;
                    setDistance(0);
                    setEstimatedDuration(0);
                    // if the route already exists on the map, we'll remove it
                    removeLayer(map, 'cyclingRoute');
                    removeLayer(map, 'firstWalkRoute');
                    removeLayer(map, 'secondWalkRoute');
                    removeLayer(map, 'start');
                    removeLayer(map, 'end');

                }
                if (start == null) {
                    firstWalkStart = coords;
                    console.log("coords->", coords);
                    start = findClosestActiveStation(coords, stations);
                    console.log("some,null =>", start, end);
                    // Add starting point to the map
                    map.addLayer({
                        id: 'start',
                        type: 'circle',
                        source: {
                            type: 'geojson',
                            data: {
                                type: 'FeatureCollection',
                                features: [
                                    {
                                        type: 'Feature',
                                        properties: {},
                                        geometry: {
                                            type: 'Point',
                                            coordinates: coords
                                        }
                                    }
                                ]
                            }
                        },
                        paint: {
                            'circle-radius': 5,
                            'circle-color': '#3887be'
                        }
                    }
                    );

                } else if (start != null && end == null) {
                    secondWalkEnd = coords;
                    end = findClosestActiveStation(coords, stations);

                    console.log("some,some", start, end);
                    map.addLayer({
                        id: 'end',
                        type: 'circle',
                        source: {
                            type: 'geojson',
                            data: {
                                type: 'FeatureCollection',
                                features: [
                                    {
                                        type: 'Feature',
                                        properties: {},
                                        geometry: {
                                            type: 'Point',
                                            coordinates: coords
                                        }
                                    }
                                ]
                            }
                        },
                        paint: {
                            'circle-radius': 5,
                            'circle-color': '#f30'
                        }
                    });
                    const info1 = await getRoute(map, firstWalkStart, start, 'walking', 'grey', 'firstWalkRoute');

                    const info2 = await getRoute(map, start, end, 'cycling', 'green', 'cyclingRoute');

                    const info3 = await getRoute(map, secondWalkEnd, end, 'walking', 'grey', 'secondWalkRoute');
                    console.log("alo", (info1[1], info2[1], info3[1]));
                    console.log("alo1", (info1[0], info2[0], info3[0]));
                    if (info2[0] == 0) { setBetterWalk(true); } else { setBetterWalk(false); }
                    setEstimatedDuration(((info1[1] + info2[1] + info3[1]) / 60).toFixed(0));
                    setDistance(((info1[0] + info2[0] + info3[0]) / 1000).toFixed(2));


                }

            }
            else {
                console.log('Stations data not loaded yet.');
            }
        });

        // Clean up on unmount
        return () => map.remove();
    }, [stationsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    async function getRoute(map, start, end, profile, color, layerName) {
        try {
            const query = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/${profile}/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`,
                { method: 'GET' }
            );

            const json = await query.json();
            const routes = json.routes;

            if (!Array.isArray(routes) || routes.length === 0) {
                throw new Error('No routes found.');
            }

            const data = routes[0];

            if (!data || !data.geometry || !data.geometry.coordinates) {
                throw new Error('Invalid route data.');
            }

            const route = data.geometry.coordinates;
            const info = [data.distance, data.duration];

            const geojson = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: route
                }
            };

            if (map.getSource(layerName)) {
                map.getSource(layerName).setData(geojson);
            } else {
                map.addLayer({
                    id: layerName,
                    type: 'line',
                    source: {
                        type: 'geojson',
                        data: geojson
                    },
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': color,
                        'line-width': 5,
                        'line-opacity': 0.75
                    }
                });
            }

            return info;
        } catch (error) {
            console.error('Error fetching or processing route data:', error);
            // Handle the error gracefully, you might want to return a default value or rethrow the error.
            // For now, we'll return null in case of an error.
            return null;
        }
    }

    const findClosestActiveStation = (coords, stations) => {
        let closestStation = null;
        let closestDistance = Infinity;

        // Iterate through each station
        stations.forEach(station => {
            // Check if the station is active and has available bikes
            if (station.properties.estado === 'active' && station.properties.num_bicicletas > 0) {
                const stationCoords = station.geometry.coordinates[0];
                const distance = calculateDistance(coords, stationCoords);

                // Update closest station if this station is closer
                if (distance < closestDistance) {
                    closestStation = stationCoords;
                    closestDistance = distance;
                }
            }
        });

        return closestStation;
    };
    // Function to calculate the distance between two sets of coordinates (using the Haversine formula)
    const calculateDistance = (coords1, coords2) => {
        const [lat1, lon1] = coords1;
        const [lat2, lon2] = coords2;
        const earthRadius = 6371; // in kilometers

        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const distance = earthRadius * c;
        return distance;
    };
    const deg2rad = (deg) => {
        return deg * (Math.PI / 180);
    };
    const removeLayer = (map, layerId) => {
        if (map.getSource(layerId)) {
            map.removeLayer(layerId);
            map.removeSource(layerId);
        }
    };
    return (
        <div>

            <div className='sidebarStyle'>

                <h3>GiraEveryWhere</h3>
                <h6>by Miguel</h6>
                {distance !== 0 && estimatedDuration !== 0 ? (
                    <div>
                        selected distance: {distance} km in: {estimatedDuration} minutes
                    </div>
                ) : (
                    <div>
                        <h5>Double Click the Map and select your Origin and Destination</h5>
                    </div>
                )}
                {betterWalk == true ? (

                    <p>You should just walk there.</p>

                ) : <p />}

            </div>


            <div className='map-container' ref={mapContainerRef} >

            </div>
        </div>
    );
};
export default Map;