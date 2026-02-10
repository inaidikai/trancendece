const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const EntriesController = require('../controllers/entriesController');

router.use(authenticateToken);

router.get('/', EntriesController.getEntries);
router.post('/', EntriesController.createEntry);
router.get('/:id', EntriesController.getEntry);
router.put('/:id', EntriesController.updateEntry);
router.delete('/:id', EntriesController.deleteEntry);

module.exports = router;