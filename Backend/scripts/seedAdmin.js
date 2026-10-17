// Phase 3: Create or update the first administrator from Backend/.env settings.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import User from '../src/models/User.js';

async function seedAdmin() {
  if (!env.adminEmail.trim() || !env.adminFirstName.trim() || !env.adminPassword) {
    throw new Error('Set ADMIN_EMAIL, ADMIN_FIRST_NAME, and ADMIN_PASSWORD in Backend/.env before seeding the administrator.');
  }

  await connectDatabase();
  const passwordHash = await bcrypt.hash(env.adminPassword, 12);
  const email = env.adminEmail.trim().toLowerCase();
  const existing = await User.findOne({ email }).select('+passwordHash');
  if (existing && existing.role !== 'admin') {
    throw new Error('ADMIN_EMAIL belongs to a non-admin account. Choose a dedicated administrator email.');
  }

  if (existing) {
    existing.firstName = env.adminFirstName.trim();
    existing.passwordHash = passwordHash;
    existing.status = 'active';
    existing.emailVerified = true;
    existing.deletedAt = null;
    await existing.save();
  } else {
    await User.create({
      firstName: env.adminFirstName.trim(),
      email,
      passwordHash,
      role: 'admin',
      status: 'active',
      emailVerified: true,
    });
  }
  console.log('Administrator seed completed. No credential values were logged.');
}

seedAdmin()
  .catch((error) => {
    console.error(`[seed:admin] Could not seed the administrator: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
