/**
 * PTFS Tactical Radar Layout Engine - Direct Feed Edition
 * No Backend Required
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

// --- COMPLETE PTFS / ATC24 MAP AIRFIELD DATA ---
const AIRPORTS = {
    "IRFD": { name: "Greater Rockford", x: -24500, y: 18000 },
    "IPPH": { name: "Perth International", x: 22000, y: -14500 },
    "IACY": { name: "Tokyo International", x: -32000, y: -28000 },
    "ISAU": { name: "Sauthemptona", x: -10906, y: -23349 },
    "ILCA": { name: "Larnaca Airport", x: 14000, y: 25000 },
    "IKFK": { name: "Keflavik Airport", x: -5000, y: -5000 },
    "IIZL": { name: "Izolirani Airport", x: 35000, y: 5000 },
    "IPPH_CG": { name: "Paphos Airport", x: 18500, y: -8000 },
    "IMCC": { name: "McConnell AFB", x: -15000, y: 5000 },
    "SABA": { name: "Saba Airstrip", x: 8000, y: -22000 },
    "ISAB": { name: "Saint Barthélemy", x: 6200, y: -9100 },
    "ILUK": { name: "Lukla Airstrip", x: -28000, y: 12000 },
    "IBAR": { name: "Barra Beach", x: -18000, y: -18000 },
    "IMEL": { name: "Mellor Airfield", x: 2000, y: 32000 },
    "IPIN": { name: "Pingeyri Strip", x: -12000, y: -34000 },
    "RDBA": { name: "Road Base", x: -2000, y: 19000 },
    "AFGY": { name: "Airbase Garry", x: -41000, y: 2000 },
    "BLTC": { name: "Boltic Airfield", x: 42000, y: -31000 },
    "R97A": { name: "HMS Queen Elizabeth", x: -10000, y: 40000 },
    "CVN78": { name: "USS Gerald R. Ford", x: 28000, y: -40000 }
};

function drawRadarGrid() {
    gridGroup.clearLayers();
    const gridSpacing = 2000;
    const gridRange = 50000;

    // Tactical Radar Rings
    L.circle([0, 0], { radius: 20000, color: '#1e293b', weight: 1, fill: false }).addTo(gridGroup);
    L.circle([0, 0], { radius: 10000, color: '#1e293b', weight: 1, fill: false }).addTo(gridGroup);

    for (let x = -gridRange; x <= gridRange; x += gridSpacing) {
        L.polyline([[ -gridRange, x ], [ gridRange, x ]], { color: '#1e293b', weight: 0.5, opacity: 0.25 }).addTo(gridGroup);
    }
    for (let y = -gridRange; y <= gridRange; y += gridSpacing) {
        L.polyline([[ y, -gridRange ], [ y, gridRange ]], { color: '#1e293b', weight: 0.5, opacity: 0.25 }).addTo(gridGroup);
    }
}
drawRadarGrid();

// Render Airfields directly from local array lookup metrics
function loadAirports() {
    if (airportsLoaded) return;
    for (const [icao, coord] of Object.entries(AIRPORTS)) {
        L.rectangle([[coord.y - 400, coord.x - 400], [coord.y + 400, coord.x + 400]], {
            color: '#38bdf8',
            fillColor: '#0f172a',
            fillOpacity: 0.6,
            weight: 2,
            dashArray: '4, 4'
        }).addTo(airportsGroup);

        L.marker([coord.y, coord.x], { opacity: 0 })
          .bindTooltip(`✈️ ${icao} [${coord.name}]`, { 
              permanent: true, 
              direction: 'center', 
              className: 'airport-overlay-label' 
          }).addTo(airportsGroup);
    }
    airportsLoaded = true;
}
loadAirports();

async function refreshRadarDisplay() {
    try {
        // CONNECTING DIRECTLY: Bypassing the broken Vercel serverless folder pathing limits entirely
        const response = await fetch(`https://24data.ptfs.app/api/map-state?t=${Date.now()}`);
        
        if (!response.ok) return;
        const rawData = await response.json();
        
        // Grab the tracking dictionary variables securely
        const liveAircraft = rawData.planes || rawData.d || {};

        planesGroup.clearLayers();
        pathsGroup.clearLayers();

        Object.entries(liveAircraft).forEach(([callsign, data]) => {
            if (!data || !data.position) return;

            // Handle map layout positions
            const currentX = data.position.x;
            const currentY = data.position.y;
            const position = [currentY, currentX];
            
            const headingAngle = parseInt(data.heading) || 0;
            const activeThemeColor = data.isEmergencyOccuring || data.emergency ? '#ef4444' : '#2dd4bf';

            // Spatial Closest Airfield Vector Calculation
            let closestAirport = "None";
            let minDistance = Infinity;

            for (const [icao, coord] of Object.entries(AIRPORTS)) {
                const dx = currentX - coord.x;
                const dy = currentY - coord.y;
                const dist = Math.sqrt(dx * dx + dy * dy); 
                if (dist < minDistance) {
                    minDistance = dist;
                    closestAirport = icao;
                }
            }

            const hudTagTemplate = `
                <div class="atc-data-tag ${data.isEmergencyOccuring || data.emergency ? 'emergency-mode' : ''}">
                    <b style="color:${activeThemeColor}; font-size:12px;">${callsign || 'N/A'}</b><br>
                    <span style="color:#64748b;">ACFT:</span> <span style="color:#f8fafc;">${data.aircraftType || data.aircraft || 'UNK'}</span><br>
                    <span style="color:#64748b;">ALT:</span> <b style="color:#f1f5f9;">${data.altitude || 0} FT</b><br>
                    <span style="color:#64748b;">GSPD:</span> <b style="color:#f1f5f9;">${data.groundSpeed ? Math.round(data.groundSpeed) : 0} KT</b><br>
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

            // Vector intercept trace tool interaction trigger logic
            liveMarker.on('dblclick', (event) => {
                L.DomEvent.stopPropagation(event);
                headingVectorGroup.clearLayers();

                const angularRadians = (headingAngle - 90) * (Math.PI / 180);
                const vectorExtensionLength = 8000; 
                
                const targetX = currentX + Math.cos(angularRadians) * vectorExtensionLength;
                const targetY = currentY - Math.sin(angularRadians) * vectorExtensionLength;

                const interceptVectorTrack = L.polyline([position, [targetY, targetX]], {
                    color: '#e11d48',
                    weight: 2,
                    dashArray: '5, 8',
                    opacity: 0.9
                }).addTo(headingVectorGroup);

                interceptVectorTrack.bindPopup(`
                    <div style="padding: 4px; font-family: monospace;">
                        <b style="color:#e11d48; font-size:12px;">ATC INTERCEPT INTERFACING</b><br><br>
                        ID: <b style="color:#fff;">${callsign || 'UNKNOWN'}</b><br>
                        TYPE: <b style="color:#94a3b8;">${data.aircraftType || data.aircraft || 'N/A'}</b><br>
                        COMMANDED HEADING: <b style="color:#2dd4bf; font-size:13px;">${String(headingAngle).padStart(3, '0')}°</b>
                    </div>
                `).openOn(map);
            });

            planesGroup.addLayer(liveMarker);

            // Connect track vectors safely onto the dynamic map panel layers
            if (closestAirport !== "None" && AIRPORTS[closestAirport]) {
                const fieldDest = AIRPORTS[closestAirport];
                const routePathLine = L.polyline([position, [fieldDest.y, fieldDest.x]], {
                    color: activeThemeColor,
                    weight: 1,
                    dashArray: '1, 5',
                    opacity: 0.25
                });
                pathsGroup.addLayer(routePathLine);
            }
        });
    } catch (err) {
        console.log("Awaiting tracking sync update stream frame...", err);
    }
}

setInterval(refreshRadarDisplay, 2000);
refreshRadarDisplay();
