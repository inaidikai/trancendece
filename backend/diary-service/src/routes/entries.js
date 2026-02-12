const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const EntriesController = require('../controllers/entriesController');

router.use(authenticateToken);

router.get('/', EntriesController.getEntries);
router.post('/', EntriesController.createEntry);
router.get('/:id', EntriesController.getEntry);
// WAF-safe update path for clients/proxies that block PUT verbs.
router.post('/:id/update', EntriesController.updateEntry);
router.put('/:id', EntriesController.updateEntry);
router.delete('/:id', EntriesController.deleteEntry);

module.exports = router;
