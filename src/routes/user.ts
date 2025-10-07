import { Router, Request, Response } from 'express';
import UserService from '../services/UserService';
import { authenticateToken } from '../middleware/auth'; // Assuming you have an auth middleware

const router = Router();
const userService = UserService.getInstance();

// Get all users
router.get('/', async (req: Request, res: Response) => {
  try {
    const { page, limit, search, status } = req.query;
    const users = await userService.getAllUsers(
      Number(page) || 1,
      Number(limit) || 10,
      search as string,
      status as 'active' | 'inactive' | 'suspended' | 'all'
    );
    res.status(200).json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.status(200).json({ success: true, data: user });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Create new user
router.post('/', async (req: Request, res: Response) => {
  try {
    const newUser = await userService.createUser(req.body);
    res.status(201).json({ success: true, data: newUser });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update user
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const updatedUser = await userService.updateUser(req.params.id, req.body);
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete user
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await userService.deleteUser(req.params.id);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Toggle user status
router.patch('/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status provided' });
    }
    const updatedUser = await userService.toggleUserStatus(req.params.id, status);
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get user payment history
router.get('/:id/payments', async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;
    const payments = await userService.getUserPaymentHistory(req.params.id, Number(page) || 1, Number(limit) || 10);
    res.status(200).json({ success: true, data: payments });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Get user session history
router.get('/:id/sessions', async (req: Request, res: Response) => {
  try {
    const { page, limit } = req.query;
    const sessions = await userService.getUserSessionHistory(req.params.id, Number(page) || 1, Number(limit) || 10);
    res.status(200).json({ success: true, data: sessions });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

export default router;