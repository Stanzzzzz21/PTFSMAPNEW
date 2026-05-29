// api/proxy.js
const WebSocket = require('ws');

let cachedData = {};
const ws = new WebSocket('wss://24data.ptfs.app/wss', {
    headers: { 'Origin': '' } // Crucial: Origin must be empty
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.t === 'ACFT_DATA') {
        cachedData = msg.d;
    }
});

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(cachedData);
}
