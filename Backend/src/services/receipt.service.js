import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import Counter from '../models/Counter.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import Profile from '../models/Profile.js';
import { getSettings } from '../models/Setting.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { getMembershipMemberCode } from '../utils/memberCode.js';

const pendingReceiptMessage = 'Payment not confirmed yet';
const defaultCompanyName = 'Orianaa by Saptagiri Hospitality & Lifestyle Pvt. Ltd.';

async function ensureReceiptNumber(paymentId, userId) {
  const filter = { _id: paymentId, ...(userId ? { user: userId } : {}) };
  const existing = await Payment.findOne(filter).select('status');
  if (!existing) throw new ApiError(404, 'Payment was not found.');
  if (!['confirmed', 'paid'].includes(existing.status)) throw new ApiError(409, pendingReceiptMessage);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findOne(filter).session(session);
      if (!payment) throw new ApiError(404, 'Payment was not found.');
      if (!['confirmed', 'paid'].includes(payment.status)) throw new ApiError(409, pendingReceiptMessage);
      if (payment.receiptNumber) return;

      const confirmedAt = payment.confirmedAt || payment.verifiedAt || payment.createdAt || new Date();
      const year = confirmedAt.getUTCFullYear();
      const counter = await Counter.findOneAndUpdate(
        { name: `receipt-${year}` },
        { $inc: { value: 1 }, $setOnInsert: { name: `receipt-${year}` } },
        { new: true, upsert: true, session, setDefaultsOnInsert: true },
      );
      payment.confirmedAt ||= confirmedAt;
      payment.receiptNumber = `OC-R-${year}-${String(counter.value).padStart(6, '0')}`;
      await payment.save({ session });
    });
  } finally {
    await session.endSession();
  }
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatMoney(value) {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((Number(value) || 0) / 100);
  return `INR ${formatted}`;
}

function formatMemberId(membership) {
  return getMembershipMemberCode(membership) || '—';
}

function formatMethod(method) {
  if (String(method || '').toLowerCase() === 'rtgs') return 'RTGS';
  return String(method || '—')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function addReceiptRow(document, label, value, top) {
  document.font('Helvetica').fontSize(10).fillColor('#647067').text(label, 58, top, { width: 180 });
  document.font('Helvetica-Bold').fontSize(11).fillColor('#183c2d').text(String(value || '—'), 245, top, { width: 290 });
}

export async function createPaymentReceipt(paymentId, userId) {
  await ensureReceiptNumber(paymentId, userId);
  const filter = { _id: paymentId, status: { $in: ['confirmed', 'paid'] }, ...(userId ? { user: userId } : {}) };
  const payment = await Payment.findOne(filter)
    .select('user membership amount baseAmount gstRate gstEnabled gstLabel gstAmount totalAmount method reference utr razorpayPaymentId receiptNumber confirmedAt invoiceNumber invoiceGstin invoiceHsnSac')
    .lean();
  if (!payment) throw new ApiError(404, 'Payment was not found.');

  const [membership, profile, user, settings] = await Promise.all([
    Membership.findById(payment.membership)
      .select('memberNo memberCode legacyMemberCode memberId memberNumber termNumber previousMembership pointsGranted status plan planModel')
      .populate('plan', 'name title')
      .lean(),
    Profile.findOne({ user: payment.user }).select('fullName').lean(),
    User.findById(payment.user).select('firstName').lean(),
    getSettings(),
  ]);
  if (!membership) throw new ApiError(404, 'Membership was not found for this payment.');

  const memberName = profile?.fullName || user?.firstName || '—';
  const tier = membership.plan?.name || membership.plan?.title || '—';
  const term = membership.previousMembership || Number(membership.termNumber) > 1
    ? `Renewal / upgrade (term ${membership.termNumber})`
    : 'New membership';
  const reference = payment.reference || payment.utr || payment.razorpayPaymentId || '—';
  const issuer = settings.receiptCompanyName || defaultCompanyName;
  const gstEnabled = payment.gstEnabled ?? payment.gstAmount > 0;
  const gstin = payment.invoiceGstin || settings.receiptGstin || settings.gstin;
  const hsnSac = payment.invoiceHsnSac || settings.receiptHsnSac;
  if (gstEnabled && !hsnSac) {
    throw new ApiError(503, 'Configure the GST HSN/SAC setting before issuing this invoice.');
  }

  const document = new PDFDocument({ size: 'A4', margin: 58 });
  const pageWidth = document.page.width - 116;
  document.font('Helvetica-Bold').fontSize(18).fillColor('#183c2d').text(issuer, { width: pageWidth });
  document.moveDown(0.4);
  if (settings.receiptAddress) {
    document.font('Helvetica').fontSize(9).fillColor('#46534a').text(settings.receiptAddress, { width: pageWidth });
  }
  if (gstin) {
    document.font('Helvetica').fontSize(9).fillColor('#46534a').text(`GSTIN: ${gstin}`);
  }
  document.moveDown(1.5);
  document.font('Helvetica-Bold').fontSize(20).fillColor('#183c2d').text('PAYMENT RECEIPT');
  document.moveDown(0.5);
  document.strokeColor('#d8dfd9').moveTo(58, document.y).lineTo(document.page.width - 58, document.y).stroke();
  document.moveDown(1);
  const rowsStart = Math.max(174, document.y + 8);

  const gstRate = payment.gstRate ?? (payment.baseAmount
    ? Math.round((payment.gstAmount / payment.baseAmount) * 10000) / 100
    : 0);
  const rows = [
    ['Receipt number', payment.receiptNumber],
    ...(payment.invoiceNumber ? [['Invoice number', payment.invoiceNumber]] : []),
    ...(gstEnabled && hsnSac ? [['HSN/SAC', hsnSac]] : []),
    ['Receipt date', formatDate(payment.confirmedAt)],
    ['Member name', memberName],
    ['Member ID', formatMemberId(membership)],
    ['Plan / tier', tier],
    ['Term', term],
    ['Plan fee', formatMoney(payment.baseAmount ?? payment.amount * 100)],
    ...(gstEnabled ? [[`${payment.gstLabel || 'GST'} (${gstRate}%)`, formatMoney(payment.gstAmount)]] : []),
    ['Total', formatMoney(payment.totalAmount ?? payment.amount * 100)],
    ['Payment method', formatMethod(payment.method)],
    ['Reference / transaction ID', reference],
    ['Status', 'Paid'],
    ['Confirmed on', formatDate(payment.confirmedAt)],
    ...(membership.status === 'active' && membership.pointsGranted > 0
      ? [['Points granted', `${new Intl.NumberFormat('en-IN').format(membership.pointsGranted)} points`]]
      : []),
  ];
  rows.forEach(([label, value], index) => addReceiptRow(document, label, value, rowsStart + index * 30));

  if (settings.receiptFooterNote) {
    document.moveDown(2);
    document.font('Helvetica').fontSize(9).fillColor('#46534a')
      .text(settings.receiptFooterNote, 58, rowsStart + rows.length * 30 + 16, { width: pageWidth });
  }
  document.font('Helvetica').fontSize(9).fillColor('#46534a')
    .text('Membership payments are non-refundable, subject to the agreement and applicable law.', 58, rowsStart + rows.length * 30 + 38, { width: pageWidth });
  document.end();
  return { document, receiptNumber: payment.receiptNumber };
}

export { pendingReceiptMessage };
