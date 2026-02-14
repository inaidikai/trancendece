const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const FriendsController = require('../controllers/friendsController');

// All routes require authentication
router.use(authenticateToken);

router.get('/', FriendsController.getFriends);
router.post('/request', FriendsController.sendRequest);
router.get('/requests', FriendsController.getPendingRequests);
router.delete('/request/:requestId', FriendsController.cancelRequest);
router.post('/request/:requestId/cancel', FriendsController.cancelRequest);
router.post('/accept/:requestId', FriendsController.acceptRequest);
router.post('/accept', FriendsController.acceptRequest);
router.post('/decline/:requestId', FriendsController.declineRequest);
router.post('/decline', FriendsController.declineRequest);
router.delete('/:friendId', FriendsController.removeFriend);
router.post('/remove/:friendId', FriendsController.removeFriend);

module.exports = router;
