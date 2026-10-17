// Phase 5b: Manage posts, events, and enquiry follow-ups with audit records.
import Post from '../../models/Post.js';
import Event from '../../models/Event.js';
import Enquiry from '../../models/Enquiry.js';
import * as contentService from '../../services/content-admin.service.js';
import { recordRequestAction } from '../../services/audit.service.js';
import asyncHandler from '../../utils/asyncHandler.js';

function modelFor(type) {
  return type === 'post' ? Post : Event;
}

export const list = (type) => asyncHandler(async (request, response) => {
  const data = type === 'post'
    ? await contentService.listPosts(request.validated.query)
    : await contentService.listEvents(request.validated.query);
  response.json({ success: true, data, message: `${type === 'post' ? 'Posts' : 'Events'} loaded.` });
});

export const create = (type) => asyncHandler(async (request, response) => {
  const record = await contentService.saveContent(modelFor(type), request.validated.body, request.file);
  await recordRequestAction(request, {
    action: `${type}.create`, entityType: type, entityId: record._id,
    summary: `Created ${type} "${record.title}" with status ${record.status}.`,
  });
  response.status(201).json({ success: true, data: record, message: `${type === 'post' ? 'Post' : 'Event'} created.` });
});

export const update = (type) => asyncHandler(async (request, response) => {
  const record = await contentService.saveContent(modelFor(type), request.validated.body, request.file, request.validated.params.id);
  await recordRequestAction(request, {
    action: `${type}.update`, entityType: type, entityId: record._id,
    summary: `Updated ${type} "${record.title}"; fields: ${Object.keys(request.validated.body).join(', ')}${request.file ? ', image' : ''}.`,
  });
  response.json({ success: true, data: record, message: `${type === 'post' ? 'Post' : 'Event'} updated.` });
});

export const remove = (type) => asyncHandler(async (request, response) => {
  const record = await contentService.deleteContent(modelFor(type), request.validated.params.id);
  await recordRequestAction(request, {
    action: `${type}.delete`, entityType: type, entityId: record._id,
    summary: `Deleted ${type} "${record.title}".`,
  });
  response.json({ success: true, data: null, message: `${type === 'post' ? 'Post' : 'Event'} deleted.` });
});

export const enquiries = asyncHandler(async (request, response) => {
  const data = await contentService.listEnquiries(request.validated.query);
  response.json({ success: true, data, message: 'Enquiries loaded.' });
});

export const updateEnquiryStatus = asyncHandler(async (request, response) => {
  const enquiry = await contentService.updateEnquiryStatus(request.validated.params.id, request.validated.body.status);
  await recordRequestAction(request, {
    action: 'enquiry.status', entityType: 'enquiry', entityId: enquiry._id,
    summary: `Enquiry status changed to ${enquiry.status}.`,
  });
  response.json({ success: true, data: enquiry, message: 'Enquiry status updated.' });
});

export const addEnquiryNote = asyncHandler(async (request, response) => {
  const enquiry = await contentService.addEnquiryNote(request.validated.params.id, request.user._id, request.validated.body.note);
  await recordRequestAction(request, {
    action: 'enquiry.note', entityType: 'enquiry', entityId: enquiry._id,
    summary: 'Added an internal enquiry note.',
  });
  response.status(201).json({ success: true, data: enquiry, message: 'Internal note added.' });
});

export const enquiryStatusSummary = asyncHandler(async (request, response) => {
  const items = await Enquiry.aggregate([{ $group: { _id: '$status', total: { $sum: 1 } } }]);
  response.json({ success: true, data: Object.fromEntries(items.map(({ _id, total }) => [_id, total])), message: 'Enquiry totals loaded.' });
});
