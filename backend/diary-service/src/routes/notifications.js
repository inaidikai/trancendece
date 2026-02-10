const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const NotificationsController = require('../controllers/notificationsController');

router.use(authenticateToken);

router.get('/', NotificationsController.getNotifications);
router.get('/unread', NotificationsController.getUnreadCount);
router.post('/:id/read', NotificationsController.markAsRead);
router.post('/read-all', NotificationsController.markAllAsRead);
router.delete('/:id', NotificationsController.deleteNotification);

module.exports = router;