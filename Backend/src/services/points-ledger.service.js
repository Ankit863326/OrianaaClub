import mongoose from 'mongoose';
import PointsLedger from '../models/PointsLedger.js';
import { DEFAULT_FAMILY_MEMBERSHIP_CONFIG, getSettings } from '../models/Setting.js';
import ApiError from '../utils/ApiError.js';

function requireTransactionSession(session) {
  if (!session || typeof session.withTransaction !== 'function' || !session.inTransaction()) {
    throw new TypeError('Points must be credited inside an active MongoDB transaction.');
  }
}

function isNominee(member) {
  return ['nominee', 'nominee_gm', 'nominee_hr'].includes(member.memberType);
}

function roundedProduct(amount, multiplier) {
  if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isFinite(multiplier) || multiplier < 0) {
    throw new TypeError('Points basis and multiplier must be non-negative valid numbers.');
  }
  const [coefficient, exponentText = '0'] = String(multiplier).toLowerCase().split('e');
  const exponent = Number(exponentText);
  const [whole, fraction = ''] = coefficient.split('.');
  let numerator = BigInt(`${whole}${fraction}`);
  let denominator = 10n ** BigInt(fraction.length);
  if (exponent > 0) numerator *= 10n ** BigInt(exponent);
  if (exponent < 0) denominator *= 10n ** BigInt(-exponent);
  const rounded = (BigInt(amount) * numerator * 2n + denominator) / (denominator * 2n);
  const points = Number(rounded);
  if (!Number.isSafeInteger(points)) throw new RangeError('Points exceed the supported integer range.');
  return points;
}

export async function creditPoints(session, member, approvalSeq) {
  requireTransactionSession(session);
  if (!member?._id) throw new TypeError('A persisted member is required to credit points.');
  if (isNominee(member)) return null;
  if (!Number.isSafeInteger(approvalSeq) || approvalSeq < 1) {
    throw new TypeError('A valid approval sequence is required to credit points.');
  }

  const settings = await getSettings({ forceRefresh: true });
  const config = settings.familyMembership || DEFAULT_FAMILY_MEMBERSHIP_CONFIG;
  const pointsBasis = config.pointsOnBase ? member.baseAmount : member.totalPaid;
  const phase = approvalSeq <= config.earlyBirdLimit ? 'early_bird' : 'default';
  const multiplier = phase === 'early_bird'
    ? config.multipliers.earlyBird
    : config.multipliers.default;
  const points = roundedProduct(pointsBasis, multiplier);
  const creditedAt = new Date();
  const expiresAt = new Date(creditedAt);
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + config.pointExpiryYears);

  const [entry] = await PointsLedger.create([{
    memberId: member._id,
    pointsBasis,
    multiplier,
    phase,
    approvalSeq,
    points,
    creditedAt,
    expiresAt,
    status: 'active',
  }], { session });
  return entry.toObject();
}

export async function getBalance(memberId) {
  const normalizedMemberId = memberId instanceof mongoose.Types.ObjectId
    ? memberId
    : new mongoose.Types.ObjectId(memberId);
  const [result] = await PointsLedger.aggregate([
    { $match: { memberId: normalizedMemberId, status: 'active' } },
    { $group: { _id: null, points: { $sum: '$points' } } },
  ]);
  const balance = result?.points || 0;
  if (!Number.isSafeInteger(balance)) throw new RangeError('Points balance exceeds the supported integer range.');
  return balance;
}

export function toMemberSafeLedgerEntry(entry) {
  const value = typeof entry?.toObject === 'function' ? entry.toObject() : { ...entry };
  const memberSafeEntry = { ...value };
  delete memberSafeEntry.expiresAt;
  return memberSafeEntry;
}

export async function getMemberSafeLedger(memberId) {
  const entries = await PointsLedger.find({ memberId })
    .select('-expiresAt')
    .sort({ creditedAt: -1, _id: -1 })
    .lean();
  return entries.map(toMemberSafeLedgerEntry);
}
