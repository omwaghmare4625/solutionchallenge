const express = require('express');

const authService = require('./service');
const { requireAuth } = require('./middleware');

const router = express.Router();

function readBody(body, fields) {
  const missing = fields.filter((field) => !body[field]);
  if (missing.length > 0) {
    const error = new Error(`Missing required fields: ${missing.join(', ')}`);
    error.statusCode = 422;
    error.code = 'validation_error';
    throw error;
  }
}

router.post('/register', async (req, res, next) => {
  try {
    readBody(req.body, ['email', 'password', 'role', 'ngo_id']);
    const user = await authService.createUserProfile({
      email: req.body.email,
      password: req.body.password,
      role: req.body.role,
      ngoId: req.body.ngo_id,
      locale: req.body.locale || 'en-IN'
    });
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    let user;
    if (req.body.id_token) {
      user = await authService.loginWithIdToken(req.body.id_token);
    } else {
      readBody(req.body, ['email', 'password']);
      user = await authService.loginWithPassword({
        email: req.body.email,
        password: req.body.password
      });
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth(), async (req, res) => {
  res.json(req.user);
});

module.exports = router;
