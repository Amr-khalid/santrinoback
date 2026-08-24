import express from 'express';
import {
  getStats,
  getUsers,
  createAdmin,
  updateUserRole,
  resetUserPassword,
  deleteUser,
  impersonateUser,
} from '../controllers/superadmin.controller.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roleGuard.js';

const router = express.Router();

// All routes here strictly require SuperAdmin authentication
router.use(protect, authorize('superadmin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.post('/users', createAdmin);
router.put('/users/:id/role', updateUserRole);
router.put('/users/:id/password', resetUserPassword);
router.delete('/users/:id', deleteUser);
router.post('/impersonate/:id', impersonateUser);

export default router;

