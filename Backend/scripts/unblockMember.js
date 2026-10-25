import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import MembershipDraft from '../src/models/MembershipDraft.js';
import Payment from '../src/models/Payment.js';
import User from '../src/models/User.js';
import { finalizePayment } from '../src/services/payment.service.js';

function readArguments(argumentsList) {
  const values = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!['--email', '--password'].includes(argument) || values[argument]) {
      throw new Error('Usage: npm run dev:unblock-member -- --email <email> --password <password>');
    }
    values[argument] = argumentsList[index + 1];
    index += 1;
  }

  const email = values['--email']?.trim().toLowerCase();
  const password = values['--password'];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Provide a valid member email with --email.');
  }
  if (
    typeof password !== 'string'
    || password.length < 8
    || !/[A-Z]/.test(password)
    || !/[a-z]/.test(password)
    || !/[0-9]/.test(password)
  ) {
    throw new Error('Password must be at least 8 characters and include uppercase, lowercase, and numeric characters.');
  }
  return { email, password };
}

async function unblockMember() {
  if (env.nodeEnv !== 'development') {
    throw new Error('This utility can only run when NODE_ENV=development.');
  }

  const { email, password } = readArguments(process.argv.slice(2));
  await connectDatabase();

  const user = await User.findOne({
    email,
    role: 'member',
    status: { $in: ['pending', 'active'] },
    deletedAt: null,
  });
  if (!user) throw new Error('No eligible member account was found for that email.');

  const payment = await Payment.findOne({
    user: user._id,
    status: { $in: ['created', 'pending', 'pending_verification', 'confirmed', 'paid'] },
  }).sort({ createdAt: -1 });
  if (!payment) throw new Error('No unpaid or paid membership payment was found for that member.');

  if (payment.status !== 'paid') await finalizePayment(payment._id);

  user.passwordHash = await bcrypt.hash(password, 12);
  user.emailVerified = true;
  user.status = 'active';
  user.activatedAt ||= new Date();
  user.activationRequiresMembershipPayment = false;
  user.lastLoginAt = new Date();
  await user.save();
  await MembershipDraft.updateMany(
    { payment: payment._id, status: 'payment_submitted' },
    { $set: { status: 'paid' } },
  );

  console.log('[dev:unblock-member] Payment is paid and member password is set.');
}

unblockMember()
  .catch((error) => {
    console.error(`[dev:unblock-member] ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
