import express from 'express';
import { register, login, getMe, googleAuth, googleCallback, updateProfile } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/google/callback', googleCallback);
router.put('/profile', protect, updateProfile);
router.get('/me', protect, getMe);

export default router;
