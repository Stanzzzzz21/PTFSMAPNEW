// api/map-state.js
export default function handler(req, res) {
    // Enable CORS so your frontend can read it securely
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    // PLACEHOLDER DATA: Replace this object with your actual PTFS live plane scraping logic
    const flightData = {
        airports: {
            "IBIA": { name: "Inisheer Airport", x: 1200, y: 1500 },
            "LFFD": { name: "Saint-Denis Airport", x: -2000, y: -800 }
        },
        planes: [
            { callsign: "SPEEDBIRD 1", aircraft: "A320", x: 500, y: 600, altitude: 4500, groundSpeed: 180, heading: 90, emergency: false, closestAirport: "IBIA" },
            { callsign: "RESCUE 99", aircraft: "C172", x: -1200, y: -400, altitude: 1200, groundSpeed: 95, heading: 270, emergency: true, closestAirport: "LFFD" }
        ]
    };

    res.status(200).json(flightData);
}
