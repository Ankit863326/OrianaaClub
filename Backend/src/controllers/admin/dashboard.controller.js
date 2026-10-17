// Phase 5a: Return admin dashboard totals and time-series summaries.
import * as adminService from '../../services/admin.service.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const getDashboard = asyncHandler(async (request, response) => {
  const data = await adminService.dashboardSummary();
  response.json({ success: true, data, message: 'Admin dashboard loaded.' });
});
