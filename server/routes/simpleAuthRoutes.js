import express from 'express';
import { authenticate, verifyToken, getUserById } from '../simpleAuth.js';

const router = express.Router();

// Login route
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const result = authenticate(username, password);
    
    if (!result) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Get current user
router.get('/me', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    
    const user = getUserById(decoded.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
