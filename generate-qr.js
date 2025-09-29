// Script to generate sample QR codes for services
const qrcode = require('qrcode-terminal');

// Sample services
const services = [
  { id: 'service1', name: 'Customer Service' },
  { id: 'service2', name: 'Technical Support' },
  { id: 'service3', name: 'Billing Department' },
  { id: 'service4', name: 'Sales Department' }
];

// Function to generate QR code for a service
function generateQRForService(service) {
  const qrData = JSON.stringify({
    serviceId: service.id,
    serviceName: service.name
  });
  
  console.log(`\nQR Code for ${service.name}:`);
  qrcode.generate(qrData, { small: true });
  
  return qrData;
}

// Generate QR codes for all services
function generateAllQRs() {
  console.log('Generating QR codes for services...\n');
  
  for (const service of services) {
    generateQRForService(service);
  }
  
  console.log('\nAll QR codes generated successfully!');
}

// Run the script
generateAllQRs();