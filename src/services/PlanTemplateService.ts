import { Plan } from '../models/Plan';
import { WebSocketService } from './websocket';
import { Server } from 'http';
import PlanTemplate, { IPlanTemplate } from '../models/PlanTemplate';

interface PlanTemplate {
  id: string;
  name: string;
  type: 'outdoor' | 'homeowner';
  plans: {
    price: number;
    duration?: string;
    timeUnit?: string;
    bandwidth?: number;
  }[];
}

export class PlanTemplateService {
  private static instance: PlanTemplateService;
  private wsService: WebSocketService;

  private constructor(server: Server) {
    this.wsService = WebSocketService.getInstance(server);
  }

  public static getInstance(server: Server): PlanTemplateService {
    if (!PlanTemplateService.instance) {
      PlanTemplateService.instance = new PlanTemplateService(server);
    }
    return PlanTemplateService.instance;
  }

  public async getAllPlanTemplates(): Promise<IPlanTemplate[]> {
    return PlanTemplate.find();
  }

  public async getPlanTemplateById(id: string): Promise<IPlanTemplate | null> {
    return PlanTemplate.findById(id);
  }

  public async createPlanTemplate(data: Partial<IPlanTemplate>): Promise<IPlanTemplate> {
    const newTemplate = new PlanTemplate(data);
    await newTemplate.save();
    return newTemplate;
  }

  public async updatePlanTemplate(id: string, data: Partial<IPlanTemplate>): Promise<IPlanTemplate | null> {
    return PlanTemplate.findByIdAndUpdate(id, data, { new: true });
  }

  public async deletePlanTemplate(id: string): Promise<boolean> {
    const result = await PlanTemplate.findByIdAndDelete(id);
    return result !== null;
  }

  // NEW METHOD: Create templates from existing plans
  public async createTemplatesFromExistingPlans(): Promise<void> {
    try {
      console.log('🔄 Creating PlanTemplate documents from existing plans...');

      // Create Outdoor Template
      const outdoorPlans = await Plan.find({ type: 'outdoor' });
      console.log('Found outdoor plans:', outdoorPlans.length);
      
      if (outdoorPlans.length > 0) {
        const outdoorTemplate = new PlanTemplate({
          name: 'Outdoor Hotspot Plan',
          type: 'outdoor',
          plans: outdoorPlans.map(plan => ({
            price: plan.price,
            bandwidth: plan.bandwidthLimit,
            duration: plan.timeLimit ? Math.floor(plan.timeLimit / 86400).toString() : '30',
            timeUnit: 'days'
          }))
        });
        await outdoorTemplate.save();
        console.log('✅ Created outdoor template with', outdoorPlans.length, 'plans');
      }

      // Create Homeowner Template  
      const homeownerPlans = await Plan.find({ type: 'homeowner' });
      console.log('Found homeowner plans:', homeownerPlans.length);
      
      if (homeownerPlans.length > 0) {
        const homeownerTemplate = new PlanTemplate({
          name: 'Homeowner Monthly Plan',
          type: 'homeowner', 
          plans: homeownerPlans.map(plan => ({
            price: plan.price,
            bandwidth: plan.bandwidthLimit,
            duration: '30',
            timeUnit: 'days'
          }))
        });
        await homeownerTemplate.save();
        console.log('✅ Created homeowner template with', homeownerPlans.length, 'plans');
      }

      // Verify
      const allTemplates = await PlanTemplate.find();
      console.log('📋 Total PlanTemplate documents:', allTemplates.length);
      
    } catch (error) {
      console.error('Error creating templates from plans:', error);
      throw error; // Re-throw to handle in the route
    }
  }

  private convertDurationToSeconds(duration: string, unit: string): number {
    const value = parseInt(duration);
    switch (unit.toLowerCase()) {
      case 'mins':
        return value * 60;
      case 'hrs':
      case 'hours':
        return value * 3600;
      case 'days':
        return value * 24 * 3600;
      case 'month':
        return value * 30 * 24 * 3600;
      default:
        return 0;
    }
  }

  private formatDuration(seconds: number): string {
    if (seconds >= 2592000) { // month
      const months = Math.floor(seconds / 2592000);
      return `${months} ${months === 1 ? 'Month' : 'Months'} Access`;
    } else if (seconds >= 604800) { // week
      const weeks = Math.floor(seconds / 604800);
      return `${weeks} ${weeks === 1 ? 'Week' : 'Weeks'} Access`;
    } else if (seconds >= 86400) { // day
      const days = Math.floor(seconds / 86400);
      return `${days} ${days === 1 ? 'Day' : 'Days'} Access`;
    } else if (seconds >= 3600) { // hour
      const hours = Math.floor(seconds / 3600);
      return `${hours} ${hours === 1 ? 'Hour' : 'Hours'} Access`;
    } else {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} ${minutes === 1 ? 'Minute' : 'Minutes'} Access`;
    }
  }

  public async applyTemplate(templateId: string): Promise<boolean> {
    try {
      console.log('🔍 === DEBUG TEMPLATE SEARCH ===');
      console.log('Searching for template with:', templateId);
      console.log('Template ID type:', typeof templateId);
      
      // List ALL templates with all fields
      const allTemplates = await PlanTemplate.find().lean();
      console.log('📋 ALL TEMPLATES IN DATABASE:');
      allTemplates.forEach((template, index) => {
        console.log(`Template ${index + 1}:`);
        console.log('  _id:', template._id);
        console.log('  type:', template.type);
        console.log('  name:', template.name);
        console.log('  ---');
      });

      // FIX: Search by type instead of _id
      const template = await PlanTemplate.findOne({ type: templateId });
      console.log('🔎 Search result by type:', template);
      
      if (!template) {
        console.log('❌ TEMPLATE NOT FOUND!');
        console.log('Available types:', allTemplates.map(t => t.type));
        console.log('Requested type:', templateId);
        throw new Error('Template not found');
      }

      console.log('✅ Template found:', template.name);
      console.log('=== END DEBUG ===');

      // Delete existing plans of the same type
      await Plan.deleteMany({ type: template.type });

      // Create new plans from template
      const plans = template.plans.map(plan => ({
        name: plan.bandwidth 
          ? `${plan.bandwidth}Mbps Monthly Plan`
          : `${plan.duration} ${plan.timeUnit} Plan`,
        type: template.type,
        bandwidthLimit: plan.bandwidth,
        timeLimit: plan.duration && plan.timeUnit 
          ? this.convertDurationToSeconds(plan.duration, plan.timeUnit)
          : undefined,
        price: plan.price,
        activeUsers: 0,
        isDefault: false
      }));

      const createdPlans = await Plan.insertMany(plans);

      // Set first plan as default if no default exists
      const defaultPlan = await Plan.findOne({ isDefault: true });
      if (!defaultPlan) {
        const firstPlan = await Plan.findOne({ type: template.type });
        if (firstPlan) {
          firstPlan.isDefault = true;
          await firstPlan.save();
        }
      }

      // Create or update plan page
      const { PlanPage } = await import('../models');
      
      const pageTitle = template.type === 'outdoor' 
        ? 'Outdoor Hotspot Plans'
        : 'Home Internet Plans';

      const pageDescription = template.type === 'outdoor'
        ? 'Connect anywhere with our flexible outdoor hotspot plans'
        : 'High-speed home internet plans for your family';

      const slug = template.type;
      const planPageData = {
        title: pageTitle,
        description: pageDescription,
        type: template.type,
        slug,
        isActive: true,
        plans: createdPlans.map(plan => ({
          id: plan._id.toString(),
          name: plan.name,
          price: plan.price,
          bandwidthLimit: plan.bandwidthLimit,
          timeLimit: plan.timeLimit,
          description: plan.bandwidthLimit 
            ? `Up to ${plan.bandwidthLimit}Mbps`
            : this.formatDuration(plan.timeLimit || 0)
        })),
        customStyles: {
          primaryColor: template.type === 'outdoor' ? '#0ea5e9' : '#10b981',
          backgroundColor: template.type === 'outdoor' ? '#f0f9ff' : '#ecfdf5',
        }
      };

      await PlanPage.findOneAndUpdate(
        { type: template.type },
        planPageData,
        { upsert: true, new: true }
      );

      return true;
    } catch (error) {
      console.error('Error applying plan template:', error);
      return false;
    }
  }

  public async createCustomPlan(planData: {
    name: string;
    price: number;
    bandwidthLimit?: number;
    timeLimit?: number;
    type: 'custom';
  }): Promise<boolean> {
    try {
      const plan = new Plan({
        ...planData,
        activeUsers: 0,
        isDefault: false
      });

      await plan.save();

      // If this is the first plan, set it as default
      const defaultPlan = await Plan.findOne({ isDefault: true });
      if (!defaultPlan) {
        plan.isDefault = true;
        await plan.save();
      }

      // Notify clients of plan updates
      this.wsService.emitPlansUpdate();
      return true;
    } catch (error) {
      console.error('Error creating custom plan:', error);
      return false;
    }
  }

  public async setDefaultPlan(planId: string): Promise<boolean> {
    try {
      // Remove default flag from all plans
      await Plan.updateMany({}, { isDefault: false });

      // Set new default plan
      await Plan.findByIdAndUpdate(planId, { isDefault: true });

      // Notify clients of plan updates
      this.wsService.emitPlansUpdate();
      return true;
    } catch (error) {
      console.error('Error setting default plan:', error);
      return false;
    }
  }
}