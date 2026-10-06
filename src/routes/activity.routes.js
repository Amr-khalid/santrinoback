import express from 'express';
import { ACTIVITIES } from '../utils/activities.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: ACTIVITIES,
  });
});

export default router;
