const http = require('http');

// Test the server endpoints
async function testServer() {
  const baseUrl = 'http://localhost:3000';
  
  try {
    // Test health endpoint
    console.log('Testing health endpoint...');
    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthData = await healthResponse.json();
    console.log('Health check:', healthData);
    
    // Test token generation
    console.log('\nTesting token generation...');
    const tokenResponse = await fetch(`${baseUrl}/generate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceId: 'test-service',
        serviceName: 'Test Service',
        userId: 'user123'
      })
    });
    
    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      console.log('Token generated:', tokenData);
      
      // Test token status
      console.log('\nTesting token status...');
      const tokenStatusResponse = await fetch(`${baseUrl}/token/${tokenData.token}`);
      const tokenStatusData = await tokenStatusResponse.json();
      console.log('Token status:', tokenStatusData);
      
      // Test queue status
      console.log('\nTesting queue status...');
      const queueResponse = await fetch(`${baseUrl}/queue/test-service`);
      const queueData = await queueResponse.json();
      console.log('Queue status:', queueData);
    } else {
      console.log('Token generation failed:', tokenResponse.status, await tokenResponse.text());
    }
  } catch (error) {
    console.error('Error testing server:', error.message);
  }
}

// Run the test
testServer();