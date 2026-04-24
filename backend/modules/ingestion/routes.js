const express = require('express');
const multer = require('multer');

const { requireAuth } = require('../auth/middleware');
const { submitReport, submitPhoto } = require('./service');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post(
  '/reports/submit',
  requireAuth(['field_worker', 'admin']),
  upload.single('photo'),
  submitReport
);

router.post(
  '/reports/submit-photo',
  requireAuth(['field_worker', 'admin']),
  upload.single('photo'),
  submitPhoto
);

module.exports = router;
