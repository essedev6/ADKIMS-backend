import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { planTemplateService } from '../app'; // Import the initialized instance
import PlanTemplate from '../models/PlanTemplate'; // Import the PlanTemplate model

const router = Router();

// GET all plan templates
router.get('/', authenticateToken, async (req, res) => {
  try {
    const templates = await planTemplateService.getAllPlanTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching plan templates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET a single plan template by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const template = await planTemplateService.getPlanTemplateById(id);
    if (template) {
      res.json(template);
    } else {
      res.status(404).json({ error: 'Plan template not found' });
    }
  } catch (error) {
    console.error('Error fetching plan template by ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST create a new plan template
router.post('/', authenticateToken, async (req, res) => {
  try {
    const newTemplate = await planTemplateService.createPlanTemplate(req.body);
    res.status(201).json(newTemplate);
  } catch (error) {
    console.error('Error creating plan template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update an existing plan template
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedTemplate = await planTemplateService.updatePlanTemplate(id, req.body);
    if (updatedTemplate) {
      res.json(updatedTemplate);
    } else {
      res.status(404).json({ error: 'Plan template not found' });
    }
  } catch (error) {
    console.error('Error updating plan template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE a plan template
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await planTemplateService.deletePlanTemplate(id);
    if (deleted) {
      res.status(204).send(); // No content for successful deletion
    } else {
      res.status(404).json({ error: 'Plan template not found' });
    }
  } catch (error) {
    console.error('Error deleting plan template:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

// Create templates from existing plans
router.post('/create-from-plans', async (req, res) => {
  try {
    console.log('🔄 Creating templates from existing plans...');
    
    // Use the imported instance
    await planTemplateService.createTemplatesFromExistingPlans();
    
    const templates = await PlanTemplate.find();
    
    console.log('✅ Templates created successfully');
    res.json({
      success: true,
      message: 'Templates created from existing plans',
      templates: templates.map(t => ({
        type: t.type,
        name: t.name,
        planCount: t.plans.length
      }))
    });
  } catch (error) {
    console.error('❌ Error creating templates from plans:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
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