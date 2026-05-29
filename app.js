// Initialize Map
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -6, maxZoom: 2, zoom: -4,
    center: [0, 0]
});

// 1. Add background map image
// Ensure your image is named 'map-background.png' in the root folder
const imageUrl = 'map-background.png';
const imageBounds = [[-60000, -60000], [60000, 60000]];
L.imageOverlay(imageUrl, imageBounds).addTo(map);

// 2. Create a high-priority pane for planes so they don't hide behind the map
map.createPane('planePane');
map.getPane('planePane').style.zIndex = 650;

const planesGroup = L.layerGroup().addTo(map);

async function updateRadar() {
    try {
        const res = await fetch('/api/proxy');
        const planes = await res.json();

        planesGroup.clearLayers();

        // PTFS data is an object, so we use Object.entries
        Object.entries(planes).forEach(([callsign, data]) => {
            if (!data.position) return;

            // Coordinate system matching
            // If the planes are way off, adjust the multiplier (e.g., 1.0, 2.0)
            const x = data.position.x;
            const y = -data.position.y;

            // Create icon
            const icon = L.divIcon({
                html: `<img src="flight_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.png" 
                       style="transform: rotate(${data.heading}deg); width: 24px; filter: invert(100%);">`,
                className: '',
                iconSize: [24, 24]
            });

            // Add to the high-priority planePane
            L.marker([y, x], { icon: icon, pane: 'planePane' })
             .addTo(planesGroup)
             .bindTooltip(`${callsign}<br>${data.altitude}FT`, { 
                 permanent: true, 
                 direction: 'right',
                 className: 'plane-label' 
             });
        });
    } catch (e) {
        console.error("Radar sync error:", e);
    }
}

// Poll every 3 seconds
setInterval(updateRadar, 3000);
updateRadar();
