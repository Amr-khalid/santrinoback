import express from 'express';
import {
  getVenues,
  getVenueById,
  getMyVenue,
  createVenue,
  updateVenue,
} from '../controllers/venue.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roleGuard.js';

const router = express.Router();

router.get('/', getVenues);
router.get('/my', protect, authorize('owner', 'admin', 'superadmin'), getMyVenue);
router.get('/:id', getVenueById);
router.post('/', protect, authorize('owner', 'admin', 'superadmin'), createVenue);
router.put('/:id', protect, authorize('owner', 'admin', 'superadmin'), updateVenue);

export default router;
