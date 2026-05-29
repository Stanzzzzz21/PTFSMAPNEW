// api/map-state.js

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

export default async function handler(req, res) {
    // Enable clean global layout cross-origin permissions
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'application/json');

    try {
        // Drop the faulty WS stream logic. Fetch directly from the 24data REST API stream link
        const upstreamResponse = await fetch('https://24data.ptfs.app/api/map-state', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!upstreamResponse.ok) {
            throw new Error(`Upstream network replied with status: ${upstreamResponse.status}`);
        }

        const rawData = await upstreamResponse.json();
        
        // Extract the aircraft matrix safely from the incoming frame object
        const liveAircraft = rawData.planes || rawData.d || {};

        const planes = Object.entries(liveAircraft).map(([callsign, data]) => {
            if (!data || !data.position) return null;
            
            let closestAirport = "None";
            let minDistance = Infinity;

            // Compute spatial distance vectors across the tracking grid array
            for (const [icao, coord] of Object.entries(AIRPORTS)) {
                const dx = data.position.x - coord.x;
                const dy = data.position.y - coord.y;
                const dist = Math.sqrt(dx * dx + dy * dy); 
                if (dist < minDistance) {
                    minDistance = dist;
                    closestAirport = icao;
                }
            }

            return {
                callsign: callsign,
                aircraft: data.aircraftType || data.aircraft || 'UNK',
                x: data.position.x,
                y: data.position.y,
                altitude: data.altitude || 0,
                heading: data.heading || 0,
                groundSpeed: data.groundSpeed ? Math.round(data.groundSpeed) : 0,
                emergency: data.isEmergencyOccuring || data.emergency || false,
                closestAirport: closestAirport
            };
        }).filter(Boolean);

        // Send perfectly compiled, non-crashing data layout to your app.js frontend
        res.status(200).json({ airports: AIRPORTS, planes: planes });

    } catch (error) {
        // Fallback safety route matrix to keep the screen drawing even if the upstream connection drops
        res.status(200).json({ airports: AIRPORTS, planes: [], error: error.message });
    }
}
