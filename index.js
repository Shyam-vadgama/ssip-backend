const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection configuration
async function createDatabaseConnection() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'caboose.proxy.rlwy.net',
      port: process.env.DB_PORT || 50200,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'qZfQILPCSaOTJVgSCQFsLaxDqosKrVPt',
      database: process.env.DB_NAME || 'railway'
    });
    
    console.log('Database connected successfully');
    return connection;
  } catch (error) {
    console.error('Error connecting to database:', error);
    process.exit(1);
  }
}

// Create database connection
let db;
createDatabaseConnection().then(connection => {
  db = connection;
  
  // Create tables if they don't exist
  initializeDatabase();
});

// Initialize database tables
async function initializeDatabase() {
  try {
    // Create tokens table with correct schema matching existing data
    await db.execute(`
      CREATE TABLE IF NOT EXISTS tokens (
        token VARCHAR(10) PRIMARY KEY,
        service_id VARCHAR(50) NOT NULL,
        service_name VARCHAR(100) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        position INT NOT NULL,
        estimated_wait INT NOT NULL,
        timestamp DATETIME NOT NULL,
        status ENUM('waiting', 'serving', 'completed', 'cancelled') DEFAULT 'waiting'
      )
    `);
    
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Helper function to generate a random token
function generateToken() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper function to get current timestamp in MySQL DATETIME format
function getCurrentTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Endpoint to generate a new token
app.post('/generate-token', async (req, res) => {
  try {
    const { serviceId, serviceName, userId } = req.body;
    
    if (!serviceId || !serviceName || !userId) {
      return res.status(400).json({ 
        error: 'Missing required fields: serviceId, serviceName, userId' 
      });
    }
    
    // Generate unique token
    let token;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 100; // Increase attempts
    
    while (!isUnique && attempts < maxAttempts) {
      token = generateToken();
      try {
        const [rows] = await db.execute(
          'SELECT token FROM tokens WHERE token = ?',
          [token]
        );
        isUnique = rows.length === 0;
      } catch (error) {
        console.error('Error checking token uniqueness:', error);
        break;
      }
      attempts++;
    }
    
    if (!isUnique) {
      return res.status(500).json({ error: 'Unable to generate unique token after ' + maxAttempts + ' attempts' });
    }
    
    // Get position in queue
    const [queueRows] = await db.execute(
      'SELECT COUNT(*) as count FROM tokens WHERE service_id = ? AND status = ?',
      [serviceId, 'waiting']
    );
    const position = queueRows[0].count + 1;
    
    // Estimated wait time (simplified calculation)
    const estimatedWait = position * 5; // 5 minutes per person
    
    // Insert token information
    const timestamp = getCurrentTimestamp();
    await db.execute(
      'INSERT INTO tokens (token, service_id, service_name, user_id, position, estimated_wait, timestamp, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [token, serviceId, serviceName, userId, position, estimatedWait, timestamp, 'waiting']
    );
    
    // Return token information
    res.json({
      token,
      position,
      estimatedWait,
      serviceName,
      timestamp
    });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to get token status
app.get('/token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const [rows] = await db.execute(
      'SELECT * FROM tokens WHERE token = ?',
      [token]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to get user history
app.get('/tokens/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const [rows] = await db.execute(
      'SELECT token, service_name, position, timestamp, status FROM tokens WHERE user_id = ? ORDER BY timestamp DESC',
      [userId]
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error fetching user history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to get queue status for a service
app.get('/queue/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    
    // Check if service exists
    const [serviceRows] = await db.execute(
      'SELECT id FROM services WHERE id = ?',
      [serviceId]
    );
    
    if (serviceRows.length === 0) {
      // Also check by name if not found by ID
      const [serviceRowsByName] = await db.execute(
        'SELECT id FROM services WHERE name = ?',
        [serviceId]
      );
      
      if (serviceRowsByName.length === 0) {
        return res.status(404).json({ error: 'Service not found' });
      }
    }
    
    // Get tokens in queue
    const [tokenRows] = await db.execute(
      'SELECT token, position, estimated_wait, timestamp FROM tokens WHERE service_id = ? AND status = ? ORDER BY position',
      [serviceId, 'waiting']
    );
    
    res.json({
      serviceId,
      queueLength: tokenRows.length,
      tokens: tokenRows
    });
  } catch (error) {
    console.error('Error fetching queue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to call next token (for staff)
app.post('/call-next/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;
    
    // Check if service exists
    const [serviceRows] = await db.execute(
      'SELECT id FROM services WHERE id = ?',
      [serviceId]
    );
    
    if (serviceRows.length === 0) {
      // Also check by name if not found by ID
      const [serviceRowsByName] = await db.execute(
        'SELECT id FROM services WHERE name = ?',
        [serviceId]
      );
      
      if (serviceRowsByName.length === 0) {
        return res.status(404).json({ error: 'Service not found' });
      }
    }
    
    // Get the first token in queue
    const [tokenRows] = await db.execute(
      'SELECT * FROM tokens WHERE service_id = ? AND status = ? ORDER BY position LIMIT 1',
      [serviceId, 'waiting']
    );
    
    if (tokenRows.length === 0) {
      return res.status(404).json({ error: 'No tokens in queue' });
    }
    
    const currentToken = tokenRows[0];
    
    // Update token status
    await db.execute(
      'UPDATE tokens SET status = ? WHERE token = ?',
      ['serving', currentToken.token]
    );
    
    // Update positions for remaining tokens
    await db.execute(
      'UPDATE tokens SET position = position - 1, estimated_wait = (position - 1) * 5 WHERE service_id = ? AND status = ? AND position > ?',
      [serviceId, 'waiting', currentToken.position]
    );
    
    res.json({
      calledToken: currentToken.token,
      remainingQueueLength: (await db.execute(
        'SELECT COUNT(*) as count FROM tokens WHERE service_id = ? AND status = ?',
        [serviceId, 'waiting']
      ))[0][0].count
    });
  } catch (error) {
    console.error('Error calling next token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to cancel a token
app.post('/cancel-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Get token info
    const [tokenRows] = await db.execute(
      'SELECT * FROM tokens WHERE token = ?',
      [token]
    );
    
    if (tokenRows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    const tokenInfo = tokenRows[0];
    
    // Update token status
    await db.execute(
      'UPDATE tokens SET status = ? WHERE token = ?',
      ['cancelled', token]
    );
    
    // Update positions for remaining tokens
    await db.execute(
      'UPDATE tokens SET position = position - 1, estimated_wait = (position - 1) * 5 WHERE service_id = ? AND status = ? AND position > ?',
      [tokenInfo.service_id, 'waiting', tokenInfo.position]
    );
    
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