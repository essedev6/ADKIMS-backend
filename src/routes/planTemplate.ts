import { Router } from 'express';
import { PlanTemplateService } from '../services/PlanTemplateService';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const planTemplateService = PlanTemplateService.getInstance();

// Apply a plan template
router.post('/apply/:templateId', authenticateToken, async (req, res) => {
  try {
    const { templateId } = req.params;
    const success = await planTemplateService.applyTemplate(templateId);
    
    if (success) {
      res.json({ message: 'Template applied successfully' });
    } else {
      res.status(400).json({ error: 'Failed to apply template' });
    }
  } catch (error) {
    console.error('Error in apply template route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a custom plan
router.post('/custom', authenticateToken, async (req, res) => {
  try {
    const planData = {
      ...req.body,
      type: 'custom'
    };
    
    const success = await planTemplateService.createCustomPlan(planData);
    
    if (success) {
      res.json({ message: 'Custom plan created successfully' });
    } else {
      res.status(400).json({ error: 'Failed to create custom plan' });
    }
  } catch (error) {
    console.error('Error in create custom plan route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set default plan
router.put('/default/:planId', authenticateToken, async (req, res) => {
  try {
    const { planId } = req.params;
    const success = await planTemplateService.setDefaultPlan(planId);
    
    if (success) {
      res.json({ message: 'Default plan updated successfully' });
    } else {
      res.status(400).json({ error: 'Failed to update default plan' });
    }
  } catch (error) {
    console.error('Error in set default plan route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;