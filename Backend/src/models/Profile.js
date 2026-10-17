// Phase 2: Store member details separately from the login email in User.
import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'], required: true },
  countryCode: { type: String, required: true, trim: true, maxlength: 8 },
  mobile: { type: String, required: true, trim: true, maxlength: 20 },
  dob: { type: Date, required: true },
  interestArea: { type: String, required: true, trim: true, maxlength: 100 },
  agreePromo: { type: Boolean, default: false },
  photoUrl: { type: String, default: '' },
}, { timestamps: true });

const Profile = mongoose.models.Profile || mongoose.model('Profile', profileSchema);

export default Profile;
