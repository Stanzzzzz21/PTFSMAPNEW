/**
 * PTFS Tactical Radar Layout Engine - Pure ATC 24 Grid Spec
 * Client-Side Inversion Matrix & Data Normalizer
 */

const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -6,
    maxZoom: 2,
    zoom: -4, 
    center: [0, 0],
    attributionControl: false
});

const gridGroup = L.layerGroup().addTo(map);
const airportsGroup = L.layerGroup().addTo(map);
const pathsGroup = L.layerGroup().addTo(map);
const headingVectorGroup = L.layerGroup().addTo(map);
const planesGroup = L.layerGroup().addTo(map);

let airportsLoaded = false;

// Real Target Coordinates Map Table
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
    const gridSpacing = 5000;
    const gridRange = 60000;

    L.circle([0, 0], { radius: 30000, color: '#1e293b', weight: 1, fill: false }).addTo(gridGroup);
    L.circle([0, 0], { radius: 15000, color: '#1e293b', weight: 1, fill: false }).addTo(gridGroup);

    for (let x = -gridRange; x <= gridRange; x += gridSpacing) {
        L.polyline([[ -gridRange, x ], [ gridRange, x ]], { color: '#141b24', weight: 0.5 }).addTo(gridGroup);
    }
    for (let y = -gridRange; y <= gridRange; y += gridSpacing) {
        L.polyline([[ y, -gridRange ], [ y, gridRange ]], { color: '#141b24', weight: 0.5 }).addTo(gridGroup);
    }
}
drawRadarGrid();

function loadAirports() {
    if (airportsLoaded) return;
    for (const [icao, coord] of Object.entries(AIRPORTS)) {
        // FIXED: Flip the Y calculation parameter here (-coord.y) to cancel out the map inversion bug
        const latY = -coord.y;
        const lngX = coord.x;

        L.rectangle([[latY - 500, lngX - 500], [latY + 500, lngX + 500]], {
            color: '#38bdf8',
            fillColor: '#0f172a',
            fillOpacity: 0.4,
            weight: 1.5,
            dashArray: '3, 6'
        }).addTo(airportsGroup);

        L.marker([latY, lngX], { opacity: 0 })
          .bindTooltip(`<span style="color:#eab308; font-weight:bold; font-family:monospace;">${icao}</span>`, { 
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
        // FIXED: Using a public CORS proxy engine to pull the data directly without a browser origin failure
        const endpoint = 'https://24data.ptfs.app/api/map-state';
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(endpoint)}&t=${Date.now()}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) return;
        
        const wrapperData = await response.json();
        const rawData = JSON.parse(wrapperData.contents);
        
        const liveAircraft = rawData.planes || rawData.d || rawData || {};

        planesGroup.clearLayers();
        pathsGroup.clearLayers();

        Object.entries(liveAircraft).forEach(([callsign, data]) => {
            if (!data || !data.position) return;

            // FIXED: Apply the exact same Y inversion conversion to aircraft updates
            const currentX = data.position.x;
            const currentY = -data.position.y;
            const position = [currentY, currentX];
            
            const headingAngle = parseInt(data.heading) || 0;
            const isEmergency = data.isEmergencyOccuring || data.emergency || false;
            const activeThemeColor = isEmergency ? '#ef4444' : '#2dd4bf';

            let closestAirport = "None";
            let minDistance = Infinity;

            // Run alignment checks
            for (const [icao, coord] of Object.entries(AIRPORTS)) {
                const dx = currentX - coord.x;
                const dy = (-currentY) - coord.y; // Match real base values
                const dist = Math.sqrt(dx * dx + dy * dy); 
                if (dist < minDistance) {
                    minDistance = dist;
                    closestAirport = icao;
                }
            }

            const hudTagTemplate = `
                <div class="atc-data-tag" style="font-family: monospace; line-height: 1.2;">
                    <b style="color:${activeThemeColor}; font-size:12px;">${callsign}</b><br>
                    <span style="color:#a1a1aa;">${data.aircraftType || data.aircraft || 'UNK'}</span><br>
                    <span>ALT: ${(data.altitude || 0)}</span><br>
                    <span>SPD: ${data.groundSpeed ? Math.round(data.groundSpeed) : 0}</span>
                </div>
            `;

            // Plain text track target template block matching your screenshot
            const planeSvgIcon = L.divIcon({
                html: `
                    <div class="plane-icon-wrapper" style="transform: rotate(${headingAngle}deg);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" 
                                  fill="${activeThemeColor}" stroke="#000" stroke-width="1"/>
                        </svg>
                    </div>`,
                className: '',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            const liveMarker = L.marker(position, { icon: planeSvgIcon });
            
            liveMarker.bindTooltip(hudTagTemplate, {
                permanent: true,
                direction: 'right',
                offset: [10, 0],
                className: 'leaflet-transparent-tooltip'
            });

            planesGroup.addLayer(liveMarker);

            // Draw track line back to the target runway hub
            if (closestAirport !== "None" && AIRPORTS[closestAirport]) {
                const fieldDest = AIRPORTS[closestAirport];
                const routePathLine = L.polyline([position, [-fieldDest.y, fieldDest.x]], {
                    color: activeThemeColor,
                    weight: 1,
                    dashArray: '2, 6',
                    opacity: 0.2
                });
                pathsGroup.addLayer(routePathLine);
            }
        });
    } catch (err) {
        console.warn("Sync pipeline loop waiting...", err);
    }
}

setInterval(refreshRadarDisplay, 2500);
refreshRadarDisplay();
