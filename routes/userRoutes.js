const express = require('express');
const userController = require('../controllers/userController');
const auth = require('../helpers/auth');

const router = express.Router();


router.post('/register', userController.register);
router.post('/login', userController.login);

router.get('/token', userController.getAccessToken);
router.delete('/token', auth.requireLogin, userController.deleteRefreshToken);

router.get('/profile', auth.requireLogin, userController.profileSelf);
router.get('/profile/:username', userController.profile);


module.exports = router;