const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// In-memory storage for tokens and queues
const queues = new Map(); // serviceId -> queue array
const tokens = new Map(); // token -> tokenInfo

// Helper function to generate a random token
function generateToken() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper function to get current timestamp
function getCurrentTimestamp() {
  return new Date().toISOString();
}

// Endpoint to generate a new token
app.post('/generate-token', (req, res) => {
  try {
    const { serviceId, serviceName, userId } = req.body;
    
    if (!serviceId || !serviceName || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields: serviceId, serviceName, userId' 
      });
    }
    
    // Create queue for service if it doesn't exist
    if (!queues.has(serviceId)) {
      queues.set(serviceId, []);
    }
    
    // Generate unique token
    let token;
    do {
      token = generateToken();
    } while (tokens.has(token));
    
    // Get position in queue
    const queue = queues.get(serviceId);
    const position = queue.length + 1;
    
    // Estimated wait time (simplified calculation)
    const estimatedWait = position * 5; // 5 minutes per person
    
    // Store token information
    const tokenInfo = {
      token,
      serviceId,
      serviceName,
      userId,
      position,
      estimatedWait,
      timestamp: getCurrentTimestamp(),
      status: 'waiting'
    };
    
    tokens.set(token, tokenInfo);
    queue.push(tokenInfo);
    
    // Return token information
    res.json({
      token,
      position,
      estimatedWait,
      serviceName,
      timestamp: tokenInfo.timestamp
    });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to get token status
app.get('/token/:token', (req, res) => {
  try {
    const { token } = req.params;
    
    if (!tokens.has(token)) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    const tokenInfo = tokens.get(token);
    res.json(tokenInfo);
  } catch (error) {
    console.error('Error fetching token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to get queue status for a service
app.get('/queue/:serviceId', (req, res) => {
  try {
    const { serviceId } = req.params;
    
    if (!queues.has(serviceId)) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const queue = queues.get(serviceId);
    res.json({
      serviceId,
      queueLength: queue.length,
      tokens: queue.map(token => ({
        token: token.token,
        position: token.position,
        estimatedWait: token.estimatedWait,
        timestamp: token.timestamp
      }))
    });
  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to call next token (for staff)
app.post('/call-next/:serviceId', (req, res) => {
  try {
    const { serviceId } = req.params;
    
    if (!queues.has(serviceId)) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const queue = queues.get(serviceId);
    
    if (queue.length === 0) {
      return res.status(404).json({ error: 'No tokens in queue' });
    }
    
    // Get the first token in queue
    const currentToken = queue.shift();
    
    // Update token status
    currentToken.status = 'serving';
    tokens.set(currentToken.token, currentToken);
    
    // Update positions for remaining tokens
    queue.forEach((token, index) => {
      token.position = index + 1;
      token.estimatedWait = token.position * 5;
      tokens.set(token.token, token);
    });
    
    res.json({
      calledToken: currentToken.token,
      remainingQueueLength: queue.length
    });
  } catch (error) {
    console.error('Error calling next token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to cancel a token
app.post('/cancel-token/:token', (req, res) => {
  try {
    const { token } = req.params;
    
    if (!tokens.has(token)) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    const tokenInfo = tokens.get(token);
    const queue = queues.get(tokenInfo.serviceId);
    
    // Remove token from queue
    const index = queue.findIndex(t => t.token === token);
    if (index !== -1) {
      queue.splice(index, 1);
      
      // Update positions for remaining tokens
      for (let i = index; i < queue.length; i++) {
        queue[i].position = i + 1;
        queue[i].estimatedWait = queue[i].position * 5;
        tokens.set(queue[i].token, queue[i]);
      }
    }
    
    // Remove token from tokens map
    tokens.delete(token);
    
    res.json({ message: 'Token cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: getCurrentTimestamp() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Queue Management Server running on port ${PORT}`);
});

module.exports = app;