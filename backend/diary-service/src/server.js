// In your REST API server
const axios = require('axios');
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const pool = require('./db/connection');

// Routes
const friendsRoutes = require('./routes/friends');
const notificationsRoutes = require('./routes/notifications');
const entriesRoutes = require('./routes/entries');
const collaboratorsRoutes = require('./routes/collaborators');
const usersRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/friends', friendsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/collaborators', collaboratorsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 REST API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

const WS_SERVER_URL = 'http://realtime-service:8003';

// Service to trigger WebSocket events
class WebSocketService {
  // Notify user of new notification
  static async sendNotification(userId, notification) {
    try {
      await axios.post(`${WS_SERVER_URL}/trigger/notification`, {
        userId,
        notification
      });
    } catch (error) {
      console.error('Failed to trigger notification:', error);
    }
  }

  // Notify friend came online (handled automatically by WebSocket server)
  
  // Notify of collaboration invite
  static async sendCollabInvite(userId, invite) {
    // This creates a notification which WebSocket server will send
    await this.sendNotification(userId, {
      type: 'collaboration_invite',
      title: 'Collaboration Invite',
      message: `${invite.inviterName} invited you to collaborate`,
      data: invite
    });
  }
}