const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const DashboardController = require('../controllers/dashboardController');

router.use(authenticateToken);

router.get('/', DashboardController.getDashboard);

module.exports = router;