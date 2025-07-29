import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import session from 'express-session';
import SequelizeStore from 'connect-session-sequelize';
import { sequelize, testConnection } from './config/database.js';
import User from './models/User.js';
import Session from './models/Session.js';
import AuditLog from './models/AuditLog.js';
import { setupAssociations } from './models/associations.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5003;

// Initialize database and models
const initDatabase = async () => {
  try {
    // Test database connection first
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to the database');
    }
    
    // Set up all model associations
    setupAssociations();
    
    // Sync all models with the database
    console.log('Synchronizing database models...');
    await sequelize.sync({ force: false }); // Changed to false to preserve data
    console.log('Database & tables synchronized!');
    
    // Create admin user if not exists
    const [adminUser, created] = await User.findOrCreate({
      where: { username: 'trauma admin' },
      defaults: {
        username: 'trauma admin',
        password: 'JHiidj12££',
        email: 'admin@trauma.network',
        isAdmin: true
      }
    });
    
    if (created) {
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }
    
    return true;
  } catch (error) {
    console.error('Unable to initialize database:', error);
    process.exit(1);
  }
};

// Initialize the database
initDatabase();

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:5003', // Add the server's own origin
  'http://127.0.0.1:5003'  // Also allow localhost with IP
].filter(Boolean); // Remove any undefined values

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified origin: ${origin}`;
      console.warn(msg);
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// Apply CORS with options
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));
app.use(express.json());

// Session configuration
const sessionStore = new (SequelizeStore(session.Store))({
  db: sequelize,
  table: 'sessions',
  checkExpirationInterval: 15 * 60 * 1000, // Clean up expired sessions every 15 minutes
  expiration: 7 * 24 * 60 * 60 * 1000, // Session expires after 7 days
});

// Configure session with secure settings
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    domain: process.env.NODE_ENV === 'production' ? '.trauma.network' : undefined
  },
  name: 'trauma.sid' // Custom session cookie name
};

// In development, we need to set sameSite to 'none' and secure to true for cross-origin
if (process.env.NODE_ENV !== 'production') {
  sessionConfig.cookie.sameSite = 'lax';
  sessionConfig.cookie.secure = false;
}

app.use(session(sessionConfig));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Define static files path
const staticPath = path.join(__dirname, '../build');

// Serve static files from the build directory
app.use(express.static(staticPath));

// API Routes - Mount API routes before the catch-all route
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'connected'
  });
});

// Admin panel route - must come before the catch-all route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(staticPath, 'admin.html'));
});

// Handle React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Utility function to run shell commands safely
const runCommand = async (command) => {
    try {
        const { stdout, stderr } = await execPromise(command);
        return { success: true, output: stdout, error: stderr };
    } catch (error) {
        return { 
            success: false, 
            error: error.message,
            stdout: error.stdout,
            stderr: error.stderr
        };
    }
};

// Get local network information
const getLocalNetworkInfo = () => {
    const nets = networkInterfaces();
    const results = {};

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            if (net.family === 'IPv4' && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push({
                    address: net.address,
                    netmask: net.netmask,
                    mac: net.mac,
                    internal: net.internal
                });
            }
        }
    }
    return results;
};

// API Routes

// Get public IP and geolocation
app.get('/api/ip-info', async (req, res) => {
    try {
        // Get public IP using ipify API
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const { ip } = await ipResponse.json();
        
        // Get geolocation data
        const geo = geoip.lookup(ip);
        
        res.json({
            ip,
            geo: geo || { error: 'Location data not available' },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting IP info:', error);
        res.status(500).json({ 
            error: 'Failed to get IP information',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get network interfaces
app.get('/api/network-interfaces', (req, res) => {
    try {
        const interfaces = getLocalNetworkInfo();
        res.json({
            success: true,
            interfaces,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting network interfaces:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to get network interfaces',
            details: error.message 
        });
    }
});

// Ping a host
app.get('/api/ping/:host', async (req, res) => {
    const { host } = req.params;
    const count = req.query.count || 4;
    
    try {
        const command = process.platform === 'win32' 
            ? `ping -n ${count} ${host}`
            : `ping -c ${count} ${host}`;
            
        const result = await runCommand(command);
        
        if (result.success) {
            res.json({
                success: true,
                host,
                output: result.output,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(400).json({
                success: false,
                host,
                error: 'Ping failed',
                details: result.stderr || 'Unknown error',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error(`Error pinging ${host}:`, error);
        res.status(500).json({
            success: false,
            host,
            error: 'Error executing ping command',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get WHOIS information
app.get('/api/whois/:domain', async (req, res) => {
    try {
        const { domain } = req.params;
        const lookup = promisify(whois.lookup);
        const result = await lookup(domain);
        res.json({ 
            domain,
            whois: result
        });
    } catch (error) {
        console.error('WHOIS lookup error:', error);
        res.status(500).json({ 
            error: 'Failed to perform WHOIS lookup',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// DNS lookup
app.get('/api/dns/:hostname', async (req, res) => {
    const { hostname } = req.params;
    const type = req.query.type || 'A';
    
    try {
        const addresses = await dns.resolve(hostname, type);
        res.json({
            success: true,
            hostname,
            type,
            addresses,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(`Error resolving ${hostname}:`, error);
        res.status(500).json({
            success: false,
            hostname,
            type,
            error: 'DNS resolution failed',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        timestamp: new Date().toISOString()
    });
});

// Serve React app for any other route (client-side routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// 404 handler (this will only be reached if no route matches and the file doesn't exist)
app.use((req, res) => {
    // If it's an API request, return JSON
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: 'Endpoint not found',
            timestamp: new Date().toISOString()
        });
    }
    
    // For HTML requests, serve the main index.html and let the client handle 404s
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    
    // Log network interfaces for easier development
    if (process.env.NODE_ENV !== 'production') {
        console.log('\nAvailable network interfaces:');
        const interfaces = getLocalNetworkInfo();
        console.log(JSON.stringify(interfaces, null, 2));
    }
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
