import express from 'express';
import {
  getFacilities,
  getFacilityById,
  getFacilityAvailability,
  createFacility,
  updateFacility,
  toggleFacilityStatus,
  deleteFacility,
} from '../controllers/facility.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roleGuard.js';

const router = express.Router();

router.get('/', getFacilities);
router.get('/:id', getFacilityById);
router.get('/:id/availability', getFacilityAvailability);

router.post('/', protect, authorize('owner', 'admin', 'superadmin'), createFacility);
router.put('/:id', protect, authorize('owner', 'admin', 'superadmin'), updateFacility);
router.patch('/:id/toggle-status', protect, authorize('owner', 'admin', 'superadmin'), toggleFacilityStatus);
router.delete('/:id', protect, authorize('owner', 'admin', 'superadmin'), deleteFacility);

export default router;
