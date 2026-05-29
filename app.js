/**
 * PTFS Tactical Radar Layout Engine - Stable Build
 * Full Error-Resilient Edition
 */

// 1. Initialize Flat X/Y Tracking Canvas
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -4,
    maxZoom: 2,
    zoom: -2,
    center: [0, 0],
    attributionControl: false
});

// 2. Setup Isolated Rendering Layers
const gridGroup = L.layerGroup().addTo(map);
const airportsGroup = L.layerGroup().addTo(map);
const pathsGroup = L.layerGroup().addTo(map);
const headingVectorGroup = L.layerGroup().addTo(map);
const planesGroup = L.layerGroup().addTo(map);

let airportsLoaded = false;

// 3. Render Permanent Tactical Background Grid Matrix
function drawRadarGrid() {
    gridGroup.clearLayers();
    const gridSpacing = 500;
    const gridRange = 10000;

    for (let x = -gridRange; x <= gridRange; x += gridSpacing) {
        L.polyline([[ -gridRange, x ], [ gridRange, x ]], {
            color: '#1e293b',
            weight: 0.5,
            opacity: 0.4
        }).addTo(gridGroup);
    }
    for (let y = -gridRange; y <= gridRange; y += gridSpacing) {
        L.polyline([[ y, -gridRange ], [ y, gridRange ]], {
            color: '#1e293b',
            weight: 0.5,
            opacity: 0.4
        }).addTo(gridGroup);
    }
}
drawRadarGrid();

// Helper: Safely normalize tracking heading metrics
function getAircraftHeading(plane) {
    if (plane && plane.heading !== undefined) {
        return parseInt(plane.heading) || 0;
    }
    return 0;
}

// 4. Main Data Pipeline Core Logic Loop
async function refreshRadarDisplay() {
    try {
        // Fetch with a direct cache-busting timestamp to stop browsers from caching 404/CORS states
        const targetUrl = `https://ptfs-backend.onrender.com/api/map-state?t=${Date.now()}`;
        const response = await fetch(targetUrl);
        
        // If server responds with 404 or fails, stop processing before JSON crashes script
        if (!response.ok) {
            console.warn(`Backend pipeline status: ${response.status} - Waiting for data...`);
            return;
        }

        const data = await response.json();
        
        // Safety Guard: Verify incoming payload object structure exists
        if (!data) return;

        // Safely wipe dynamic aircraft entries each frame step
        planesGroup.clearLayers();
        pathsGroup.clearLayers();

        // 5. Parse Static Airfield Geometry Markers
        if (!airportsLoaded && data.airports) {
            try {
                for (const [icao, coord] of Object.entries(data.airports)) {
                    if (!coord || coord.x === undefined || coord.y === undefined) continue;

                    L.rectangle([[coord.y - 140, coord.x - 140], [coord.y + 140, coord.x + 140]], {
                        color: '#38bdf8',
                        fillColor: '#0f172a',
                        fillOpacity: 0.75,
                        weight: 2,
                        dashArray: '4, 4'
                    }).addTo(airportsGroup);

                    L.marker([coord.y, coord.x], { opacity: 0 })
                      .bindTooltip(`✈️ ${icao} [${coord.name || 'UNKN'}]`, { 
                          permanent: true, 
                          direction: 'center', 
                          className: 'airport-overlay-label' 
                      }).addTo(airportsGroup);
                }
                airportsLoaded = true;
            } catch (airportErr) {
                console.error("Airport render skipped:", airportErr);
            }
        }

        // 6. Map Dynamic Target Matrix Updates
        if (data.planes && Array.isArray(data.planes)) {
            data.planes.forEach(plane => {
                // Safeguard against missing array item parameters
                if (!plane || plane.x === undefined || plane.y === undefined) return;

                const position = [plane.y, plane.x];
                const activeThemeColor = plane.emergency ? '#ef4444' : '#2dd4bf';
                const headingAngle = getAircraftHeading(plane);

                const hudTagTemplate = `
                    <div class="atc-data-tag ${plane.emergency ? 'emergency-mode' : ''}">
                        <b style="color:${activeThemeColor}; font-size:12px;">${plane.callsign || 'N/A'}</b><br>
                        <span style="color:#64748b;">ACFT:</span> <span style="color:#f8fafc;">${plane.aircraft || 'UNK'}</span><br>
                        <span style="color:#64748b;">ALT:</span> <b style="color:#f1f5f9;">${plane.altitude || 0} FT</b><br>
                        <span style="color:#64748b;">GSPD:</span> <b style="color:#f1f5f9;">${plane.groundSpeed || 0} KT</b><br>
                        <span style="color:#64748b;">TRK:</span> <b style="color:#38bdf8;">${String(headingAngle).padStart(3, '0')}°</b>
                    </div>
                `;

                const planeSvgIcon = L.divIcon({
                    html: `
                        <div class="plane-icon-wrapper" style="transform: rotate(${headingAngle}deg);">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" 
                                      fill="${activeThemeColor}" stroke="#0b0f19" stroke-width="1.2"/>
                            </svg>
                        </div>`,
                    className: '',
                    iconSize: [26, 26],
                    iconAnchor: [12, 12]
                });

                const liveMarker = L.marker(position, { icon: planeSvgIcon });
                
                liveMarker.bindTooltip(hudTagTemplate, {
                    permanent: true,
                    direction: 'right',
                    offset: [16, 0],
                    className: 'leaflet-transparent-tooltip'
                });

                // Double Click Tactical ATC Vector Routing Callout
                liveMarker.on('dblclick', (event) => {
                    L.DomEvent.stopPropagation(event);
                    headingVectorGroup.clearLayers();

                    const angularRadians = (headingAngle - 90) * (Math.PI / 180);
                    const vectorExtensionLength = 3000; 
                    
                    const targetX = plane.x + Math.cos(angularRadians) * vectorExtensionLength;
                    const targetY = plane.y - Math.sin(angularRadians) * vectorExtensionLength;

                    const interceptVectorTrack = L.polyline([position, [targetY, targetX]], {
                        color: '#e11d48',
                        weight: 2,
                        dashArray: '5, 8',
                        opacity: 0.9
                    }).addTo(headingVectorGroup);

                    interceptVectorTrack.bindPopup(`
                        <div style="padding: 4px; font-family: monospace;">
                            <b style="color:#e11d48; font-size:12px;">ATC INTERCEPT INTERFACING</b><br><br>
                            ID: <b style="color:#fff;">${plane.callsign || 'UNKNOWN'}</b><br>
                            TYPE: <b style="color:#94a3b8;">${plane.aircraft || 'N/A'}</b><br>
                            COMMANDED COMPASS HEADING: <b style="color:#2dd4bf; font-size:13px;">${String(headingAngle).padStart(3, '0')}°</b>
                        </div>
                    `).openOn(map);
                });

                planesGroup.addLayer(liveMarker);

                // Draw dashed guiding strings to target fields
                if (plane.closestAirport && plane.closestAirport !== "None" && data.airports && data.airports[plane.closestAirport]) {
                    const fieldDest = data.airports[plane.closestAirport];
                    if (fieldDest.x !== undefined && fieldDest.y !== undefined) {
                        const routePathLine = L.polyline([position, [fieldDest.y, fieldDest.x]], {
                            color: activeThemeColor,
                            weight: 1,
                            dashArray: '1, 5',
                            opacity: 0.3
                        });
                        pathsGroup.addLayer(routePathLine);
                    }
                }
            });
        }
    } catch (err) {
        // Silently handles connection network drops without stopping layout loops
        console.warn("Connection sync state waiting for backend pipeline...");
    }
}

// 7. Global Polling Loop Configuration
setInterval(refreshRadarDisplay, 1000);
refreshRadarDisplay();
