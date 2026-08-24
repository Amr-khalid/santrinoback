import express from 'express';
import {
  getStats,
  getBookings,
  updateBookingStatus,
  createManualBooking,
  getPricingRules,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  updateDefaultPrices,
  getCustomers,
  getCustomerBookings,
} from '../controllers/dashboard.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roleGuard.js';

const router = express.Router();

// All dashboard routes are protected for owner and admin
router.use(protect);
router.use(authorize('owner', 'admin'));

router.get('/stats', getStats);
router.get('/bookings', getBookings);
router.post('/bookings/manual', createManualBooking);
router.patch('/bookings/:id', updateBookingStatus);

router.get('/customers', getCustomers);
router.get('/customers/:id/bookings', getCustomerBookings);

router.get('/pricing', getPricingRules);
router.put('/pricing/defaults', updateDefaultPrices);
router.post('/pricing', createPricingRule);
router.put('/pricing/:id', updatePricingRule);
router.delete('/pricing/:id', deletePricingRule);

export default router;

