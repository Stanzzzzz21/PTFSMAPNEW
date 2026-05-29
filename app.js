/**
 * PTFS Tactical Radar Layout Engine - Stable Build
 * Absolute Path & Viewport Lock Edition
 */

const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -5,
    maxZoom: 3,
    zoom: -2,
    center: [0, 0],
    attributionControl: false
});

const gridGroup = L.layerGroup().addTo(map);
const airportsGroup = L.layerGroup().addTo(map);
const pathsGroup = L.layerGroup().addTo(map);
const headingVectorGroup = L.layerGroup().addTo(map);
const planesGroup = L.layerGroup().addTo(map);

let airportsLoaded = false;

// Force a visual checkpoint line so we know the map canvas is awake
function drawRadarGrid() {
    gridGroup.clearLayers();
    const gridSpacing = 500;
    const gridRange = 10000;

    // Outer radar boundary ring
    L.circle([0, 0], { radius: 5000, color: '#1e293b', weight: 1, fill: false }).addTo(gridGroup);
    L.circle([0, 0], { radius: 2500, color: '#1e293b', weight: 1, fill: false }).addTo(gridGroup);

    for (let x = -gridRange; x <= gridRange; x += gridSpacing) {
        L.polyline([[ -gridRange, x ], [ gridRange, x ]], {
            color: '#1e293b',
            weight: 0.5,
            opacity: 0.3
        }).addTo(gridGroup);
    }
    for (let y = -gridRange; y <= gridRange; y += gridSpacing) {
        L.polyline([[ y, -gridRange ], [ y, gridRange ]], {
            color: '#1e293b',
            weight: 0.5,
            opacity: 0.3
        }).addTo(gridGroup);
    }
}
drawRadarGrid();

function getAircraftHeading(plane) {
    if (plane && plane.heading !== undefined) {
        return parseInt(plane.heading) || 0;
    }
    return 0;
}

async function refreshRadarDisplay() {
    try {
        // FIXED: Uses the absolute URL to ensure Vercel routes internal fetch tokens correctly
        const targetUrl = `https://24rackadar.vercel.app/api/map-state?t=${Date.now()}`;
        const response = await fetch(targetUrl);
        
        if (!response.ok) {
            console.warn(`Backend pipeline status: ${response.status}`);
            return;
        }

        const mapData = await response.json();
        if (!mapData) return;

        planesGroup.clearLayers();
        pathsGroup.clearLayers();

        // Airports Rendering
        if (!airportsLoaded && mapData.airports) {
            for (const [icao, coord] of Object.entries(mapData.airports)) {
                if (!coord || coord.x === undefined || coord.y === undefined) continue;

                L.rectangle([[coord.y - 140, coord.x - 140], [coord.y + 140, coord.x + 140]], {
                    color: '#38bdf8',
                    fillColor: '#0f172a',
                    fillOpacity: 0.6,
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
        }

        // Planes Rendering
        if (mapData.planes && Array.isArray(mapData.planes)) {
            mapData.planes.forEach(plane => {
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

                if (plane.closestAirport && plane.closestAirport !== "None" && mapData.airports && mapData.airports[plane.closestAirport]) {
                    const fieldDest = mapData.airports[plane.closestAirport];
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
        console.warn("Connection sync state waiting for backend pipeline...", err);
    }
}

setInterval(refreshRadarDisplay, 1000);
refreshRadarDisplay();
