import express from 'express';
import {
  getAvailableSlots,
  makeBooking,
  getMyBookings,
  cancelBooking,
  getBookingById,
  getBookingByToken,
  confirmBooking,
} from '../controllers/booking.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/available', getAvailableSlots);
router.post('/', makeBooking);
router.get('/my', protect, getMyBookings);
router.get('/confirm/:token', getBookingByToken);
router.post('/confirm/:token', confirmBooking);
router.get('/:id', getBookingById);
router.patch('/:id/cancel', protect, cancelBooking);

export default router;
