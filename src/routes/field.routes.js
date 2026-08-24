import express from 'express';
import { getPrimaryField, getFieldById, updateField } from '../controllers/field.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roleGuard.js';

const router = express.Router();

router.get('/primary', getPrimaryField);
router.get('/:id', getFieldById);
router.put('/:id', protect, authorize('owner', 'admin'), updateField);

export default router;
