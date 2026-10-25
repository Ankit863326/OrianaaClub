// Phase 5a: Record administrative changes for traceable support and compliance.
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actorType: { type: String, enum: ['admin', 'member', 'system', 'billing'], default: 'admin' },
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  action: { type: String, required: true, trim: true, maxlength: 80 },
  entityType: { type: String, required: true, trim: true, maxlength: 80, index: true },
  entityId: { type: String, required: true, trim: true, maxlength: 100, index: true },
  memberNo: { type: String, default: '', trim: true, maxlength: 40, index: true },
  summary: { type: String, required: true, trim: true, maxlength: 1000 },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  reason: { type: String, default: '', trim: true, maxlength: 1000 },
  ip: { type: String, default: '', maxlength: 100 },
}, { timestamps: { createdAt: true, updatedAt: false } });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
