import mongoose from 'mongoose';

const welcomeKitSchema = new mongoose.Schema({
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'dispatched', 'not_home', 'delivered'],
    default: 'pending',
  },
  codeHash: { type: String, required: true, select: false },
  codeAttempts: { type: Number, default: 0, min: 0 },
  assignedStaff: { type: String, trim: true, default: '' },
  dueAt: { type: Date, required: true },
  dispatchedAt: { type: Date, default: null },
  deliveredAt: { type: Date, default: null },
  deliveredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  notHomeNote: { type: String, trim: true, default: '' },
}, { timestamps: true });

welcomeKitSchema.index({ status: 1, dueAt: 1 });

const WelcomeKit = mongoose.models.WelcomeKit || mongoose.model('WelcomeKit', welcomeKitSchema);

export default WelcomeKit;
