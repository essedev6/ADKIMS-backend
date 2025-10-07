import express from 'express';
import { PlanPage } from '../models';

const router = express.Router();

router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const planPage = await PlanPage.findOne({ type: type.toLowerCase() });
    
    if (!planPage) {
      return res.status(404).json({ message: 'Plan page not found' });
    }

    res.json(planPage);
  } catch (error) {
    console.error('Error fetching plan page:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;