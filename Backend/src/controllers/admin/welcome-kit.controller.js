import { recordRequestAction } from '../../services/audit.service.js';
import {
  dispatchWelcomeKit,
  listWelcomeKits,
  markWelcomeKitNotHome,
  verifyWelcomeKitDelivery,
} from '../../services/welcome-kit.service.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const list = asyncHandler(async (request, response) => {
  const data = await listWelcomeKits(request.validated.query);
  response.json({ success: true, data, message: 'Welcome kits loaded.' });
});

export const dispatch = asyncHandler(async (request, response) => {
  const kit = await dispatchWelcomeKit(request.validated.params.id, request.validated.body.staff);
  await recordRequestAction(request, {
    action: 'welcome_kit.dispatch',
    entityType: 'welcome_kit',
    entityId: kit._id,
    summary: `Dispatched welcome kit to ${kit.assignedStaff}.`,
    after: { status: kit.status, assignedStaff: kit.assignedStaff },
  });
  response.json({ success: true, data: kit, message: 'Welcome kit dispatched.' });
});

export const notHome = asyncHandler(async (request, response) => {
  const kit = await markWelcomeKitNotHome(request.validated.params.id, request.validated.body.note);
  await recordRequestAction(request, {
    action: 'welcome_kit.not_home',
    entityType: 'welcome_kit',
    entityId: kit._id,
    summary: 'Member was not home for welcome kit delivery.',
    after: { status: kit.status, notHomeNote: kit.notHomeNote },
  });
  response.json({ success: true, data: kit, message: 'Welcome kit marked not home.' });
});

export const deliver = asyncHandler(async (request, response) => {
  const kit = await verifyWelcomeKitDelivery(
    request.validated.params.id,
    request.validated.body.code,
    request.user._id,
  );
  await recordRequestAction(request, {
    action: 'welcome_kit.deliver',
    entityType: 'welcome_kit',
    entityId: kit._id,
    summary: 'Verified delivery of a welcome kit.',
    after: { status: kit.status, deliveredAt: kit.deliveredAt },
  });
  response.json({ success: true, data: kit, message: 'Welcome kit marked delivered.' });
});
