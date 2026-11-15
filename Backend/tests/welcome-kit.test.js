import { createHash } from 'node:crypto';
import { jest } from '@jest/globals';
import Membership from '../src/models/Membership.js';
import WelcomeKit from '../src/models/WelcomeKit.js';
import {
  addWorkingDays,
  createWelcomeKit,
  dispatchWelcomeKit,
  listWelcomeKits,
  markWelcomeKitNotHome,
  verifyWelcomeKitDelivery,
} from '../src/services/welcome-kit.service.js';
import { createAdmin, createMember, createPlan } from './helpers/factories.js';

describe('welcome kit delivery', () => {
  test('adds weekdays and stores only the kit-specific code hash', async () => {
    const friday = new Date('2026-08-07T10:00:00.000Z');
    expect(addWorkingDays(friday, 5)).toEqual(new Date('2026-08-14T10:00:00.000Z'));

    const plan = await createPlan();
    const member = await createMember({ membership: { plan: plan._id, memberType: 'primary' } });
    await Membership.updateOne(
      { _id: member.membership._id },
      { $set: { memberId: 'OC-000000000001', memberCode: 'OC-000000000001', memberNo: 'OC-000000000001' } },
    );
    const { code, kit } = await createWelcomeKit(member.membership, friday);
    const savedKit = await WelcomeKit.findById(kit._id).select('+codeHash');
    expect(savedKit.codeHash).toBe(createHash('sha256').update(`${kit._id}:${code}`).digest('hex'));
    expect(savedKit.toObject()).not.toHaveProperty('code');
    expect(savedKit.dueAt).toEqual(new Date('2026-08-14T10:00:00.000Z'));

    const list = await listWelcomeKits({ search: 'OC-000000000001' }, new Date('2026-08-13T10:00:00.000Z'));
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).not.toHaveProperty('code');
    expect(list.items[0]).not.toHaveProperty('codeHash');
    expect(list.items[0]).toMatchObject({
      member: { name: member.profile.fullName, mobile: member.profile.mobile },
      overdue: false,
    });
  });

  test('locks after five incorrect codes and resets attempts on redispatch', async () => {
    const plan = await createPlan();
    const member = await createMember({ membership: { plan: plan._id, memberType: 'primary' } });
    const admin = await createAdmin();
    const { code, kit } = await createWelcomeKit(member.membership);
    await dispatchWelcomeKit(kit._id, 'Delivery Staff');
    const wrongCode = code === '999999' ? '000000' : '999999';

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(verifyWelcomeKitDelivery(kit._id, wrongCode, admin.user._id))
        .rejects.toMatchObject({ statusCode: 400 });
    }
    await expect(verifyWelcomeKitDelivery(kit._id, wrongCode, admin.user._id))
      .rejects.toMatchObject({ statusCode: 423 });
    expect((await listWelcomeKits({ status: 'dispatched' })).items[0].locked).toBe(true);

    await markWelcomeKitNotHome(kit._id, 'Member unavailable');
    const redispatched = await dispatchWelcomeKit(kit._id, 'Second Delivery Staff');
    expect(redispatched.codeAttempts).toBe(0);
    expect(redispatched.status).toBe('dispatched');

    globalThis.__orianaMailTransport.sendMail.mockClear();
    const result = await verifyWelcomeKitDelivery(kit._id, code, admin.user._id);
    expect(result.status).toBe('delivered');
    expect(result.deliveredAt).toBeTruthy();
    expect(globalThis.__orianaMailTransport.sendMail.mock.calls[0][0].html).toContain('welcome kit');
    expect(await Membership.countDocuments({ _id: member.membership._id })).toBe(1);
    expect(await WelcomeKit.findById(kit._id).select('+codeHash')).not.toHaveProperty('code');
  });

  test('a delivered-email failure does not undo the delivery', async () => {
    const plan = await createPlan();
    const member = await createMember({ membership: { plan: plan._id, memberType: 'primary' } });
    const admin = await createAdmin();
    const { code, kit } = await createWelcomeKit(member.membership);
    await dispatchWelcomeKit(kit._id, 'Delivery Staff');
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.__orianaMailTransport.sendMail.mockRejectedValueOnce(new Error('Mail unavailable'));

    await expect(verifyWelcomeKitDelivery(kit._id, code, admin.user._id)).resolves.toMatchObject({
      status: 'delivered',
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
