import { Request, Response } from 'express';
import { PlanPage } from '../models/PlanPage';

export const getPage = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const page = await PlanPage.findOne({ type, isActive: true });
    
    if (!page) {
      return res.status(404).json({ message: 'Plan page not found' });
    }

    return res.json(page);
  } catch (error) {
    console.error('Error fetching plan page:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const listPages = async (req: Request, res: Response) => {
  try {
    const pages = await PlanPage.find({ isActive: true });
    return res.json(pages);
  } catch (error) {
    console.error('Error listing plan pages:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const togglePageStatus = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const page = await PlanPage.findOne({ type });
    
    if (!page) {
      return res.status(404).json({ message: 'Plan page not found' });
    }

    page.isActive = !page.isActive;
    await page.save();

    return res.json(page);
  } catch (error) {
    console.error('Error toggling plan page status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updatePageStyles = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { customStyles } = req.body;

    const page = await PlanPage.findOneAndUpdate(
      { type },
      { $set: { customStyles } },
      { new: true }
    );
    
    if (!page) {
      return res.status(404).json({ message: 'Plan page not found' });
    }

    return res.json(page);
  } catch (error) {
    console.error('Error updating plan page styles:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};