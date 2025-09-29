// Simple test script
const http = require('http');

async function testEndpoint() {
  try {
    // Test health endpoint
    const healthResponse = await fetch('http://localhost:3000/health');
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);
    
    // Test token generation
    const tokenResponse = await fetch('http://localhost:3000/generate-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceId: '1',
        serviceName: 'Test Service',
        userId: 'user123'
      })
    });
    
    console.log('Token response status:', tokenResponse.status);
    const tokenData = await tokenResponse.json();
    console.log('Token data:', tokenData);
  } catch (error) {
    console.error('Test error:', error);
  }
}

testEndpoint();