const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const CollaboratorsController = require('../controllers/collaboratorsController');

router.use(authenticateToken);

// Entry collaborators
router.get('/entries/:entryId', CollaboratorsController.getCollaborators);
router.post('/entries/:entryId/invite', CollaboratorsController.inviteCollaborator);
router.delete('/entries/:entryId/users/:collaboratorId', CollaboratorsController.removeCollaborator);
router.post('/entries/:entryId/users/:collaboratorId/remove', CollaboratorsController.removeCollaborator);
router.patch('/entries/:entryId/users/:collaboratorId', CollaboratorsController.updatePermissions);

// Get my collaboration invites
router.get('/invites', CollaboratorsController.getMyInvites);

// Accept/decline invites
router.post('/invites/:inviteId/accept', CollaboratorsController.acceptInvite);
router.post('/invites/:inviteId/decline', CollaboratorsController.declineInvite);

module.exports = router;
