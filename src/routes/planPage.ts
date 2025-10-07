import { Router } from 'express';
import { getPage, listPages, togglePageStatus, updatePageStyles } from '../controllers/PlanPageController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/:type', getPage);

// Protected routes (admin only)
router.get('/', authenticateToken, listPages);
router.put('/:type/toggle', authenticateToken, togglePageStatus);
router.put('/:type/styles', authenticateToken, updatePageStyles);

export default router;