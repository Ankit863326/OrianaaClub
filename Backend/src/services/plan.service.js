// Phase 2: Read the active plans in the order selected by the club.
import Plan from '../models/Plan.js';
import ApiError from '../utils/ApiError.js';

export async function listActivePlans() {
  return Plan.find({ isActive: true }).sort({ displayOrder: 1, sortOrder: 1, name: 1, title: 1 }).lean();
}

export async function findActivePlan(slug) {
  const plan = await Plan.findOne({ slug, isActive: true }).lean();
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  return plan;
}
