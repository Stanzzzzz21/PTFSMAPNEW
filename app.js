/**
 * PTFS Radar Master Engine
 */

// 1. Setup the map with your own image as the background
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -6, maxZoom: 2, zoom: -4,
    center: [0, 0]
});

// Replace 'map-background.png' with the exact filename of your image
const imageUrl = 'map-background.png'; 
const imageBounds = [[-60000, -60000], [60000, 60000]]; 
L.imageOverlay(imageUrl, imageBounds).addTo(map);

const planesGroup = L.layerGroup().addTo(map);

async function updateRadar() {
    try {
        // Fetch from YOUR new proxy endpoint
        const res = await fetch('/api/proxy');
        const planes = await res.json();

        planesGroup.clearLayers();

        Object.entries(planes).forEach(([callsign, data]) => {
            if (!data.position) return;

            // Coordinate conversion (Adjust the divisor '3.1' if planes appear offset)
            const x = data.position.x / 3.1;
            const y = -(data.position.y / 3.1);

            // Custom icon using your uploaded PNG
            const icon = L.divIcon({
                html: `<img src="flight_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.png" style="transform: rotate(${data.heading}deg); width: 24px;">`,
                className: '',
                iconSize: [24, 24]
            });

            L.marker([y, x], { icon }).addTo(planesGroup)
             .bindTooltip(`${callsign}<br>${data.altitude}FT`, { permanent: true, direction: 'right' });
        });
    } catch (e) {
        console.error("Radar sync error:", e);
    }
}

setInterval(updateRadar, 3000);
updateRadar();
