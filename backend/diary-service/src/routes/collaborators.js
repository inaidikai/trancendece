const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const CollaboratorsController = require('../controllers/collaboratorsController');

router.use(authenticateToken);

// Get my collaboration invites
router.get('/invites', CollaboratorsController.getMyInvites);

// Accept/decline invites
router.post('/invites/:inviteId/accept', CollaboratorsController.acceptInvite);
router.post('/invites/:inviteId/decline', CollaboratorsController.declineInvite);

module.exports = router;