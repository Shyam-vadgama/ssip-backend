// Script to generate a single QR code for a service
const qrcode = require('qrcode-terminal');

// Get service information from command line arguments
const serviceId = process.argv[2] || 'service1';
const serviceName = process.argv[3] || 'Default Service';

// Create QR data
const qrData = JSON.stringify({
  serviceId: serviceId,
  serviceName: serviceName
});

console.log(`\nQR Code for ${serviceName} (${serviceId}):`);
qrcode.generate(qrData, { small: true });

console.log('\nQR Data (JSON):');
console.log(qrData);