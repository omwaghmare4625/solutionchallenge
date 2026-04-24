const express = require('express');

const { requireAuth } = require('../auth/middleware');
const { getReports, approve, reject } = require('./service');

const router = express.Router();

router.use(requireAuth(['admin']));

router.get('/admin/reports', getReports);
router.post('/admin/reports/:id/approve', approve);
router.post('/admin/reports/:id/reject', reject);

module.exports = router;
