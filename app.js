/**
 * PTFS Tactical Radar Layout Engine - Complete Map Matching Edition
 * Perfectly aligned with your island layouts and custom plane icons
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
const shapesGroup = L.layerGroup().addTo(map); 
const airportsGroup = L.layerGroup().addTo(map);
const pathsGroup = L.layerGroup().addTo(map);
const planesGroup = L.layerGroup().addTo(map);

// --- TACTICAL RADAR GRID BACKGROUND ---
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

// --- AIRPORT DATA CONFIGURATION MATRIX ---
const AIRPORTS = {
    "IRFD": { name: "Greater Rockford", x: -4400, y: -8000 },
    "IPPH": { name: "Perth International", x: 8000, y: 8100 },
    "IACY": { name: "Tokyo International", x: -2100, y: 15000 },
    "ISAU": { name: "Sauthemptona", x: -11000, y: -11200 },
    "ILCA": { name: "Larnaca Airport", x: 9200, y: -16000 },
    "IKFK": { name: "Keflavik Airport", x: -11100, y: 2200 },
    "IIZL": { name: "Izolirani Airport", x: 13200, y: 1100 },
    "IPPH_CG": { name: "Paphos Airport", x: 7400, y: 5200 },
    "IMCC": { name: "McConnell AFB", x: -4000, y: 4800 },
    "SABA": { name: "Saba Airstrip", x: 3000, y: -9000 },
    "ISAB": { name: "Saint Barthélemy", x: 2800, y: 1400 },
    "ILUK": { name: "Lukla Airstrip", x: -8500, y: 11000 },
    "IBAR": { name: "Barra Beach", x: -6200, y: -5000 },
    "IMEL": { name: "Mellor Airfield", x: 1200, y: 11200 },
    "IPIN": { name: "Pingeyri Strip", x: -5000, y: -12000 },
    "RDBA": { name: "Road Base", x: -1100, y: 7200 },
    "AFGY": { name: "Airbase Garry", x: -14000, y: 1500 },
    "BLTC": { name: "Boltic Airfield", x: 15100, y: -11000 },
    "R97A": { name: "HMS Queen Elizabeth", x: -1000, y: -4500 },
    "CVN78": { name: "USS Gerald R. Ford", x: 9200, y: -4000 }
};

// Render Airports matching your layout colors
function loadAirports() {
    airportsGroup.clearLayers();
    for (const [icao, coord] of Object.entries(AIRPORTS)) {
        L.marker([coord.y, coord.x], { opacity: 0 })
          .bindTooltip(`<span style="color:#eab308; font-weight:bold; font-family:'Oswald', sans-serif; font-size:14px; text-shadow: 1px 1px 2px black;">${coord.name}</span>`, { 
              permanent: true, 
              direction: 'center', 
              className: 'airport-overlay-label'
          }).addTo(airportsGroup);
    }
}
loadAirports();

// --- LIVE FLIGHT DATA LOOP WITH CUSTOM PLANE ICONS ---
async function refreshRadarDisplay() {
    try {
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

            // Scale positioning from raw feed down to your map grid size
            const currentX = data.position.x / 3.1;
            const currentY = data.position.y / 3.1;
            const position = [currentY, currentX];
            
            const headingAngle = parseInt(data.heading) || 0;
            const isEmergency = data.isEmergencyOccuring || data.emergency || false;
            const activeThemeColor = isEmergency ? '#ef4444' : '#ffffff';

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

            // Data tags built precisely like your dark radar screen layout
            const hudTagTemplate = `
                <div class="atc-data-tag" style="font-family: monospace; line-height: 1.1; background: transparent; color: #a1a1aa; font-size: 11px;">
                    <b style="color: ${isEmergency ? '#ef4444' : '#eab308'}; font-size: 12px;">${callsign}</b> <span>${data.aircraftType || data.aircraft || 'UNK'}</span><br>
                    <span>${String(Math.round((data.altitude || 0) / 100)).padStart(3, '0')}</span><br>
                    <span>RMK [NO FPL]</span>
                </div>
            `;

            // Uses your exact custom uploaded plane icon image path
            const planeIcon = L.divIcon({
                html: `
                    <div class="plane-icon-wrapper" style="transform: rotate(${headingAngle}deg);">
                        <img src="flight_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.png" 
                             style="width: 24px; height: 24px; filter: invert(100%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(100%) contrast(100%);" />
                    </div>`,
                className: '',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const liveMarker = L.marker(position, { icon: planeIcon });
            
            liveMarker.bindTooltip(hudTagTemplate, {
                permanent: true,
                direction: 'bottom',
                offset: [0, 15],
                className: 'leaflet-transparent-tooltip'
            });

            planesGroup.addLayer(liveMarker);

            if (closestAirport !== "None" && AIRPORTS[closestAirport]) {
                const fieldDest = AIRPORTS[closestAirport];
                const routePathLine = L.polyline([position, [fieldDest.y, fieldDest.x]], {
                    color: '#475569',
                    weight: 1,
                    dashArray: '4, 4',
                    opacity: 0.3
                });
                pathsGroup.addLayer(routePathLine);
            }
        });
    } catch (err) {
        console.warn("Sync pipeline loop waiting...", err);
    }
}

setInterval(refreshRadarDisplay, 2000);
refreshRadarDisplay();
