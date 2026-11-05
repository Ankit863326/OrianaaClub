// Keep the six-step membership application synchronized with the member API.
import { Component, Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
// ESLint's core unused-vars rule does not detect the JSX member expression below.
/* eslint-disable-next-line no-unused-vars */
import { AnimatePresence, motion } from 'framer-motion';
import useAuth from '../../context/useAuth.js';
import { apiFileUrl } from '../../config/api.js';
import PlanCard from '../../components/PlanCard.jsx';
import { getPlans } from '../../lib/plansApi.js';
import { mapPlanToCard } from '../../lib/planCardData.js';
import {
  addFamilyMember,
  createMembershipRazorpayOrder,
  deleteFamilyMember,
  getMember,
  getMembershipBankDetails,
  getMembershipCheckoutQuote,
  getPaymentMembership,
  getPublicGstSettings,
  getFamilyPrices,
  getIdentityVerification,
  purchaseMembership,
  submitIdentityVerification,
  savePlan,
  saveProfile,
  updateFamilyMember,
  uploadMembershipVerificationDocument,
  verifyMembershipPayment,
} from '../../lib/memberApi.js';
import apiClient from '../../lib/apiClient.js';
import { getTermsApplication, saveTermsConsent } from '../../lib/termsApi.js';
import TermsConsentCard from '../../components/TermsConsentCard.jsx';
import {
  addMembershipDraftFamily,
  deleteMembershipDraftFamily,
  getMembershipDraftBankDetails,
  getMembershipDraftQuote,
  getMembershipDraftFamilyPrices,
  resendMembershipDraftOtp,
  requestMembershipDraftPasswordLink,
  requestMembershipHelp,
  saveMembershipDraftPlan,
  saveMembershipDraftProfile,
  startMembershipDraft,
  submitMembershipDraftIdentity,
  submitMembershipDraftPayment,
  updateMembershipDraftFamily,
  verifyMembershipDraftOtp,
  verifyMembershipDraftPayment,
} from '../../lib/membershipDraftApi.js';
import { formatPoints, formatRupees } from '../../lib/formatters.js';
import { isValidIdentityNumber } from '../../lib/identityValidation.js';
import { getMyMembership } from '../Dashboard/memberDashboardApi.js';
import './MembershipAll.css';

const emptyProfile = {
  fullName: '',
  gender: '',
  countryCode: '+91',
  mobile: '',
  dob: '',
  interestArea: '',
  agreePromo: false,
};

const emptyFamilyForm = {
  fullName: '',
  gender: 'prefer_not_to_say',
  relationship: 'Spouse',
  dob: '',
  parentSide: '',
  anniversaryDate: '',
  wantsOwnMembership: false,
  nomineeRole: '',
  designation: '',
  workEmail: '',
  phone: '',
};
const maxImageSize = 10 * 1024 * 1024;
const maxIdentityFileSize = 5 * 1024 * 1024;
const emptyIdentityFiles = { panFront: null, panBack: null, secondFront: null, secondBack: null };
const steps = ['Personal Details', 'Select Plan', 'Family Details', 'Review & Confirm', 'Payment', 'Set Password'];
const money = formatRupees;

function selectImageFile(event, setFile, setError) {
  const file = event.target.files?.[0] || null;
  if (file && file.size > maxImageSize) {
    event.target.value = '';
    setFile(null);
    setError('Image must be 10 MB or smaller.');
    return;
  }

  setError('');
  setFile(file);
}

function selectIdentityFile(event, key, setFiles, setError, setPreviewUrl) {
  const file = event.target.files?.[0] || null;
  event.target.value = '';
  if (!file) return;
  if (file && !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
    setError('That file type is not supported. Choose a JPG, PNG, or PDF.');
    return;
  }
  if (file && file.size > maxIdentityFileSize) {
    setError('That file is larger than 5 MB. Choose a smaller file.');
    return;
  }
  setError('');
  setFiles((current) => ({ ...current, [key]: file }));
  setPreviewUrl(key, file);
}

function formatIdentityFileSize(size) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function IdentityFileField({ label, file, previewUrl, onSelect, onRemove, disabled, required = false }) {
  const inputRef = useRef(null);
  return (
    <div className="jm-field jm-identity-field">
      <span className="jm-identity-field__label">{label} {required ? '(required)' : '(optional)'}</span>
      <div className={`jm-identity-upload${file ? ' is-filled' : ''}`}>
        <input
          ref={inputRef}
          className="jm-identity-upload__input"
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          aria-label={`${label} upload`}
          onChange={onSelect}
          disabled={disabled}
          required={required && !file}
          tabIndex={file ? -1 : 0}
        />
        {file ? (
          <div className="jm-identity-upload__content">
            <div className="jm-identity-upload__visual">
              {file.type === 'application/pdf' ? (
                <div className="jm-identity-upload__pdf" aria-label="PDF document">
                  <svg viewBox="0 0 32 32" aria-hidden="true">
                    <path d="M8 2.5h10l7 7v20H8z" />
                    <path d="M18 2.5v7h7M11 19h11M11 23h11" />
                  </svg>
                  <span>PDF document</span>
                </div>
              ) : (
                <img src={previewUrl} alt={`${label} preview`} />
              )}
            </div>
            <div className="jm-identity-upload__footer">
              <div className="jm-identity-upload__file-info">
                <span className="jm-identity-upload__file-name" title={file.name}>{file.name}</span>
                <span className="jm-identity-upload__file-size">{formatIdentityFileSize(file.size)}</span>
              </div>
              <div className="jm-identity-upload__actions">
                <button className="jm-btn-pill-outline" type="button" onClick={() => inputRef.current?.click()} disabled={disabled}>Replace</button>
                <button className="jm-btn-pill-outline" type="button" onClick={onRemove} disabled={disabled}>Remove</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="jm-identity-upload__empty" aria-hidden="true">
            <span className="jm-identity-upload__select">Choose a file</span>
            <span>or click here to browse</span>
          </div>
        )}
      </div>
      <span className="jm-identity-field__hint">JPG, PNG or PDF, max 5 MB</span>
    </div>
  );
}

class MembershipErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Membership flow failed to render.', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="join-membership-page">
          <section className="jm-application-card" aria-labelledby="membership-render-error">
            <p id="membership-render-error" className="jm-api-message jm-api-message--error" role="alert">
              Something went wrong while loading your membership application. You can return to the previous step and try again.
            </p>
            <button
              className="jm-btn-submit"
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onBack();
              }}
            >
              Back to previous step
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default function MembershipAll() {
  const { user, loading: authLoading, membershipResetKey = 0 } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userIdentity = user?._id || user?.id || user?.email || null;
  const [membershipCheckRetry, setMembershipCheckRetry] = useState(0);
  const [membershipCheck, setMembershipCheck] = useState({
    key: null,
    membership: null,
    error: '',
  });
  const membershipCheckKey = userIdentity ? `${userIdentity}:${membershipCheckRetry}` : null;
  const currentStep = Math.min(6, Math.max(1, Number(searchParams.get('step')) || 1));
  const handleBack = () => navigate(`/luxury-membership?step=${Math.max(1, currentStep - 1)}`);
  const isUpgradeSelection = searchParams.get('step') === '2'
    && searchParams.get('mode') === 'upgrade';

  useEffect(() => {
    if (authLoading || !user) return undefined;
    let active = true;
    getMyMembership()
      .then((membership) => {
        if (active) setMembershipCheck({ key: membershipCheckKey, membership, error: '' });
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError.status === 404) {
          setMembershipCheck({ key: membershipCheckKey, membership: null, error: '' });
        } else {
          setMembershipCheck({
            key: membershipCheckKey,
            membership: null,
            error: requestError.message || 'We could not check your membership status.',
          });
        }
      });
    return () => { active = false; };
  }, [authLoading, membershipCheckKey, user]);

  if (authLoading || (user && membershipCheck.key !== membershipCheckKey)) {
    return <main className="join-membership-page jm-loading" role="status" aria-busy="true">
      Checking your membership status…
    </main>;
  }

  if (user && membershipCheck.error) {
    return (
      <main className="join-membership-page">
        <section className="jm-application-card" aria-labelledby="membership-status-error">
          <p id="membership-status-error" className="jm-api-message jm-api-message--error" role="alert">
            {membershipCheck.error}
          </p>
          <button className="jm-btn-submit" type="button" onClick={() => setMembershipCheckRetry((count) => count + 1)}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (user && membershipCheck.membership?.status === 'active' && !isUpgradeSelection) {
    return (
      <main className="join-membership-page">
        <section className="jm-application-card" aria-labelledby="already-member-heading">
          <h1 id="already-member-heading" className="jm-plans-header__title">You’re already a member</h1>
          <p><strong>Current plan:</strong> {membershipCheck.membership.tier || 'Orianaa Club membership'}</p>
          <div className="jm-family-actions">
            <button
              className="jm-btn-submit"
              type="button"
              onClick={() => navigate('/luxury-membership?step=2&mode=upgrade')}
            >
              Upgrade plan
            </button>
            <button className="jm-btn-pill-outline" type="button" onClick={() => navigate('/dashboard')}>
              Go to dashboard
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <MembershipErrorBoundary onBack={handleBack}>
      <MembershipFlow
        key={`${userIdentity || 'guest'}:${membershipResetKey}`}
        upgradeMode={Boolean(user && membershipCheck.membership?.status === 'active' && isUpgradeSelection)}
      />
    </MembershipErrorBoundary>
  );
}

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  const existingScript = document.querySelector('script[data-razorpay-checkout]');
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error('The secure payment window could not be loaded. Please try again.'));
    };
    document.body.appendChild(script);
  });
}

function dateInputValue(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function normalizeGender(value) {
  const gender = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ['male', 'female', 'other', 'prefer_not_to_say'].includes(gender) ? gender : '';
}

function formatPlainDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
}

function applicationIdFrom(value) {
  const id = value?.applicationId || value?.userId || value?.user?._id || value?.user?.id || value?._id || value?.id;
  return typeof id === 'string' ? id : String(id || '');
}

function familyMemberType(member = {}) {
  if (member.memberType?.startsWith('nominee_')) return member.memberType;
  if (member.isNominee) return 'nominee';
  const relationship = String(member.relationship || member.relation || '').toLowerCase();
  if (['wife', 'husband', 'spouse'].includes(relationship)) return 'spouse';
  if (relationship === 'father' || relationship === 'mother') return relationship;
  if (member.type === 'child' || ['child', 'son', 'daughter'].includes(relationship)) return 'child';
  return ['spouse', 'child', 'father', 'mother'].includes(member.memberType)
    ? member.memberType : '';
}

function ageOnPurchaseDate(dateOfBirth, purchaseDate = new Date()) {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = purchaseDate.getFullYear() - birth.getFullYear();
  if (
    purchaseDate.getMonth() < birth.getMonth()
    || (purchaseDate.getMonth() === birth.getMonth() && purchaseDate.getDate() < birth.getDate())
  ) age -= 1;
  return age;
}

function priceForFamilyMember(member, prices) {
  const type = familyMemberType(member);
  if (['nominee', 'nominee_gm', 'nominee_hr'].includes(type)) return null;
  const priceType = type === 'spouse' ? 'spouse'
    : type === 'father' || type === 'mother' ? 'parent'
      : type === 'child' ? 'child' : '';
  return priceType ? prices?.prices?.[priceType] || null : null;
}

function MembershipFlow({ upgradeMode = false }) {
  const { user } = useAuth();
  const isLoggedIn = Boolean(user);
  const userIdentity = user?._id || user?.id || user?.email || null;
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState(Math.min(6, Math.max(1, Number(searchParams.get('step')) || 1)));
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [profile, setProfile] = useState({ ...emptyProfile, email: user?.email || '' });
  const [draftStarted, setDraftStarted] = useState(false);
  const [draftEmailVerified, setDraftEmailVerified] = useState(Boolean(user));
  const [otpCode, setOtpCode] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpResendSeconds, setOtpResendSeconds] = useState(0);
  const [passwordLinkEmail, setPasswordLinkEmail] = useState('');
  const [passwordLinkSent, setPasswordLinkSent] = useState(false);
  const [passwordLinkMessage, setPasswordLinkMessage] = useState('');
  const [passwordLinkRequestError, setPasswordLinkRequestError] = useState(false);
  const [passwordLinkResendSeconds, setPasswordLinkResendSeconds] = useState(0);
  const [helpRequestBusy, setHelpRequestBusy] = useState(false);
  const [helpRequestMessage, setHelpRequestMessage] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [identityVerification, setIdentityVerification] = useState(null);
  const [panNumber, setPanNumber] = useState('');
  const [secondIdType, setSecondIdType] = useState('aadhaar');
  const [secondIdNumber, setSecondIdNumber] = useState('');
  const [identityFiles, setIdentityFiles] = useState(emptyIdentityFiles);
  const [identityPreviewUrls, setIdentityPreviewUrls] = useState({});
  const identityPreviewUrlsRef = useRef({});
  const [identitySubmitting, setIdentitySubmitting] = useState(false);
  const [identityConsent, setIdentityConsent] = useState(false);
  const [membership, setMembership] = useState(null);
  const [family, setFamily] = useState([]);
  const [familyForm, setFamilyForm] = useState(emptyFamilyForm);
  const [familyPhoto, setFamilyPhoto] = useState(null);
  const [editingFamilyId, setEditingFamilyId] = useState(null);
  const [familyTab, setFamilyTab] = useState('spouse');
  const [familyPrices, setFamilyPrices] = useState(null);
  const [familyPricesLoading, setFamilyPricesLoading] = useState(false);
  const [familyPricesError, setFamilyPricesError] = useState('');
  const [familyPricesRetry, setFamilyPricesRetry] = useState(0);
  const [parentAnniversaries, setParentAnniversaries] = useState({ member: '', spouse: '' });
  const [parentSideError, setParentSideError] = useState('');
  const [loading, setLoading] = useState(true);
  const [applicationLoadError, setApplicationLoadError] = useState('');
  const [applicationLoadRetry, setApplicationLoadRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [paymentMembership, setPaymentMembership] = useState(null);
  const [paymentMembershipLoading, setPaymentMembershipLoading] = useState(false);
  const [paymentMembershipError, setPaymentMembershipError] = useState('');
  const [paymentReload, setPaymentReload] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [bankDetails, setBankDetails] = useState(null);
  const [bankDetailsLoading, setBankDetailsLoading] = useState(false);
  const [bankDetailsError, setBankDetailsError] = useState('');
  const [rtgsUtr, setRtgsUtr] = useState('');
  const [rtgsTransferDate, setRtgsTransferDate] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [termsApplicationId, setTermsApplicationId] = useState(
    user?._id || user?.id || '',
  );
  const [existingTermsConsent, setExistingTermsConsent] = useState(null);
  const [termsState, setTermsState] = useState({
    manifest: null,
    version: '',
    language: '',
    readToEnd: false,
    checked: false,
    acceptedConsent: null,
  });
  const [termsError, setTermsError] = useState('');
  const [termsHighlighted, setTermsHighlighted] = useState(false);
  const [termsNotice, setTermsNotice] = useState('');
  const termsSubmittingRef = useRef(false);
  const [verificationFile, setVerificationFile] = useState(null);
  const [verificationError, setVerificationError] = useState('');
  const [verificationUploaded, setVerificationUploaded] = useState(false);
  const [paymentUnavailable, setPaymentUnavailable] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteRetry, setQuoteRetry] = useState(0);
  const [companyDetails, setCompanyDetails] = useState({
    companyName: '',
    gstNumber: '',
    contactPerson: '',
  });
  const [offlineSubmitted, setOfflineSubmitted] = useState(false);
  const [paymentSubmittedMethod, setPaymentSubmittedMethod] = useState('');
  const [membershipGateRetry, setMembershipGateRetry] = useState(0);
  const [membershipGate, setMembershipGate] = useState({
    key: userIdentity,
    loading: Boolean(user),
    membership: null,
    error: '',
  });

  useEffect(() => () => {
    Object.values(identityPreviewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    identityPreviewUrlsRef.current = {};
  }, []);

  useEffect(() => {
    if (otpResendSeconds <= 0 && passwordLinkResendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setOtpResendSeconds((seconds) => Math.max(0, seconds - 1));
      setPasswordLinkResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpResendSeconds, passwordLinkResendSeconds]);

  const selectedPlan = useMemo(
    () => (plans ?? []).find((plan) => plan?._id === membership?.plan?._id
      || plan?.slug === membership?.plan?.slug
      || plan?._id === paymentMembership?.plan?._id
      || plan?.slug === paymentMembership?.plan?.slug
      || plan?.name === paymentMembership?.plan?.name
      || plan?.title === paymentMembership?.plan?.name)
      || membership?.plan
      || paymentMembership?.plan
      || null,
    [plans, membership, paymentMembership],
  );
  useEffect(() => {
    const planId = selectedPlan?._id || selectedPlan?.id;
    if (![3, 4].includes(step) || !planId) return undefined;
    let active = true;
    setFamilyPricesLoading(true);
    setFamilyPricesError('');
    (isLoggedIn ? getFamilyPrices(planId) : getMembershipDraftFamilyPrices(planId))
      .then((prices) => {
        if (active) setFamilyPrices(prices);
      })
      .catch((requestError) => {
        if (active) setFamilyPricesError(requestError.message || 'Family prices could not be loaded.');
      })
      .finally(() => {
        if (active) setFamilyPricesLoading(false);
      });
    return () => { active = false; };
  }, [familyPricesRetry, isLoggedIn, selectedPlan, step]);

  const paymentMembershipId = searchParams.get('membershipId');
  const requestedStep = searchParams.get('step');

  useEffect(() => {
    if (step !== 5 || paymentMethod !== 'rtgs') return undefined;
    let active = true;
    setBankDetailsLoading(true);
    setBankDetailsError('');
    (isLoggedIn ? getMembershipBankDetails() : getMembershipDraftBankDetails()).then((details) => {
      if (active) setBankDetails(details);
    }).catch((requestError) => {
      if (active) setBankDetailsError(requestError.message || 'Could not load bank transfer details.');
    }).finally(() => {
      if (active) setBankDetailsLoading(false);
    });
    return () => { active = false; };
  }, [isLoggedIn, paymentMethod, step]);

  useEffect(() => {
    let active = true;
    if (!isLoggedIn) {
      setMembershipGate({ key: null, loading: false, membership: null, error: '' });
      return () => { active = false; };
    }
    setMembershipGate({ key: userIdentity, loading: true, membership: null, error: '' });
    getMyMembership()
      .then((current) => {
        if (active) setMembershipGate({ key: userIdentity, loading: false, membership: current, error: '' });
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError.status === 404) {
          setMembershipGate({ key: userIdentity, loading: false, membership: null, error: '' });
        } else {
          setMembershipGate({
            key: userIdentity,
            loading: false,
            membership: null,
            error: requestError.message || 'We could not check your membership.',
          });
        }
      });
    return () => { active = false; };
  }, [isLoggedIn, membershipGateRetry, userIdentity]);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError('');
    try {
      const availablePlans = await getPlans();
      if (!Array.isArray(availablePlans)) throw new Error('Membership plans could not be loaded.');
      setPlans(availablePlans);
    } catch (requestError) {
      setPlansError(requestError.message || 'We could not load membership plans.');
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setApplicationLoadError('');
    let active = true;
    const loadApplication = isLoggedIn
      ? Promise.all([getMember(), getIdentityVerification()]).then(([memberData, identityData]) => ({
        memberData,
        identityData,
      }))
      : Promise.resolve({
        memberData: { profile: null, membership: null, family: [] },
        identityData: null,
      });
    loadApplication
      .then(({ memberData, identityData }) => {
        if (!active) return;
        setMembership(memberData.membership);
        setFamily((memberData.family ?? []).map((member) => ({
          ...(member ?? {}),
          _id: member?._id || member?.id,
        })));
        setIdentityVerification(identityData);
        if (isLoggedIn && memberData.profile) {
          setProfile({
            ...emptyProfile,
            ...memberData.profile,
            gender: normalizeGender(memberData.profile.gender),
            email: user?.email || '',
            dob: dateInputValue(memberData.profile.dob),
          });
          setPasswordLinkEmail(user?.email || '');
        }
      })
      .catch((requestError) => {
        if (!active) return;
        setApplicationLoadError(requestError.message || 'Could not load your application.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [applicationLoadRetry, isLoggedIn, user?.email]);

  useEffect(() => {
    const applicationId = user?._id || user?.id || '';
    setTermsApplicationId(applicationId);
    if (!isLoggedIn || !/^[a-f\d]{24}$/i.test(applicationId)) return undefined;
    let active = true;
    getTermsApplication(applicationId)
      .then((application) => {
        if (active) setExistingTermsConsent(application.termsConsent || null);
      })
      .catch((requestError) => {
        if (active) setTermsError(requestError.message || 'Agreement status could not be loaded.');
      });
    return () => { active = false; };
  }, [isLoggedIn, user?._id, user?.id]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    const membershipId = membership?._id || paymentMembershipId;
    if (step !== 6 || !isLoggedIn || !user?.onboarding || !membershipId) return undefined;
    let active = true;
    getPaymentMembership(membershipId)
      .then((details) => {
        if (!active) return;
        setPaymentMembership(details);
        if (details.payment?.method) setPaymentSubmittedMethod(details.payment.method);
      })
      .catch((requestError) => {
        if (active) setPaymentError(requestError.message || 'Could not load your payment status.');
      });
    return () => { active = false; };
  }, [isLoggedIn, membership?._id, paymentMembershipId, step, user?.onboarding]);

  useEffect(() => {
    if (user && !user.onboarding && (user.status !== 'active' || user.emailVerified === false)) {
      navigate('/login', {
        replace: true,
        state: {
          from: { pathname: location.pathname, search: location.search || '?step=4' },
          message: 'Please log in with an active member account to continue.',
        },
      });
    }
  }, [location.pathname, location.search, navigate, user]);

  useEffect(() => {
    if (step !== 5) return undefined;
    if (requestedStep !== '5') return undefined;
    if (!paymentMembershipId) {
      if (!selectedPlan) {
        navigate('/luxury-membership?step=2', { replace: true });
        return undefined;
      }
      let active = true;
      setPaymentMembershipLoading(true);
      setPaymentMembershipError('');
      const quoteRequest = isLoggedIn
        ? Promise.all([getMembershipCheckoutQuote(selectedPlan._id), getPublicGstSettings()])
          .then(([serverQuote, gstSettings]) => ({
            ...serverQuote,
            gstRate: gstSettings.rate,
            gstEnabled: gstSettings.enabled,
            gstLabel: gstSettings.label,
          }))
        : getMembershipDraftQuote(selectedPlan._id);
      quoteRequest.then((serverQuote) => {
        if (!active) return;
        setPaymentMembership({
          status: 'pending_payment',
          amount: serverQuote.total,
          planFee: serverQuote.planFee,
          gst: serverQuote.gst,
          gstRate: serverQuote.gstRate ?? serverQuote.gstPercent,
          gstEnabled: serverQuote.gstEnabled,
          gstLabel: serverQuote.gstLabel || 'GST',
          currency: serverQuote.currency,
          plan: { name: selectedPlan.name || selectedPlan.title },
        });
      }).catch((requestError) => {
        if (active) setPaymentMembershipError(requestError.message || 'Could not calculate your payment details.');
      }).finally(() => {
        if (active) setPaymentMembershipLoading(false);
      });
      return () => { active = false; };
    }

    let active = true;
    setPaymentMembershipLoading(true);
    setPaymentMembershipError('');
    getPaymentMembership(paymentMembershipId)
      .then((result) => {
        if (!active) return;
        if (result.status === 'active') {
          if (user?.onboarding) {
            setStep(6);
            setSearchParams({ step: '6' });
          }
          else navigate('/dashboard', { replace: true });
          return;
        }
        if (!['pending_payment', 'pending_verification'].includes(result.status)) {
          navigate('/luxury-membership?step=2', { replace: true });
          return;
        }
        setOfflineSubmitted(
          result.status === 'pending_verification'
          || (result.payment?.status === 'pending' && result.payment.method !== 'razorpay'),
        );
        setVerificationUploaded(Boolean(result.verificationDocumentUploaded));
        setPaymentMembership(result);
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError.status === 401) {
          navigate('/login', {
            replace: true,
            state: {
              from: { pathname: location.pathname, search: location.search },
              message: 'Please log in with your active member account to continue.',
            },
          });
          return;
        }
        if (requestError.status === 404) {
          navigate('/luxury-membership?step=2', { replace: true });
          return;
        }
        setPaymentMembershipError(requestError.message || 'Payment details could not be loaded.');
      })
      .finally(() => {
        if (active) setPaymentMembershipLoading(false);
      });
    return () => { active = false; };
  }, [isLoggedIn, location.pathname, location.search, navigate, paymentMembershipId, paymentReload, requestedStep, selectedPlan, setSearchParams, step, user?.onboarding]);

  useEffect(() => {
    if (step !== 4 || !selectedPlan?._id) return undefined;
    let active = true;
    setQuote(null);
    setQuoteError('');
    setQuoteLoading(true);
    const quoteRequest = isLoggedIn
      ? Promise.all([getMembershipCheckoutQuote(selectedPlan._id), getPublicGstSettings()])
        .then(([serverQuote, gstSettings]) => ({
          ...serverQuote,
          gstEnabled: gstSettings.enabled,
          gstPercent: gstSettings.rate,
          gstLabel: gstSettings.label,
        }))
      : getMembershipDraftQuote(selectedPlan._id);
    quoteRequest.then((serverQuote) => {
      if (!active) return;
      setQuote(serverQuote);
    }).catch((requestError) => {
      if (active) setQuoteError(requestError.message || 'Could not calculate your payment details.');
    }).finally(() => {
      if (active) setQuoteLoading(false);
    });
    return () => { active = false; };
  }, [isLoggedIn, quoteRetry, selectedPlan?._id, step]);

  function moveTo(nextStep) {
    setStep(nextStep);
    setSearchParams({ step: String(nextStep) });
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateIdentityPreviewUrl(key, file) {
    const nextUrls = { ...identityPreviewUrlsRef.current };
    if (nextUrls[key]) URL.revokeObjectURL(nextUrls[key]);
    if (file) {
      nextUrls[key] = URL.createObjectURL(file);
    } else {
      delete nextUrls[key];
    }
    identityPreviewUrlsRef.current = nextUrls;
    setIdentityPreviewUrls(nextUrls);
  }

  function clearIdentityFiles(keys) {
    const nextUrls = { ...identityPreviewUrlsRef.current };
    keys.forEach((key) => {
      if (nextUrls[key]) URL.revokeObjectURL(nextUrls[key]);
      delete nextUrls[key];
    });
    identityPreviewUrlsRef.current = nextUrls;
    setIdentityPreviewUrls(nextUrls);
    setIdentityFiles((current) => ({
      ...current,
      ...Object.fromEntries(keys.map((key) => [key, null])),
    }));
  }

  function removeIdentityFile(key) {
    clearIdentityFiles([key]);
  }

  function resetSecondIdentityFiles() {
    clearIdentityFiles(['secondFront', 'secondBack']);
  }

  async function submitDraftOtp() {
    setOtpSubmitting(true);
    setError('');
    try {
      const result = await verifyMembershipDraftOtp(otpCode);
      const verifiedApplicationId = applicationIdFrom(result);
      if (verifiedApplicationId) setTermsApplicationId(verifiedApplicationId);
      setDraftEmailVerified(Boolean(result.emailVerified));
      setOtpCode('');
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'The verification code could not be checked.');
    } finally {
      setOtpSubmitting(false);
    }
  }

  async function resendDraftOtp() {
    setOtpSubmitting(true);
    setError('');
    try {
      await resendMembershipDraftOtp();
      setOtpResendSeconds(60);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'A new verification code could not be sent.');
    } finally {
      setOtpSubmitting(false);
    }
  }

  async function submitProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!isLoggedIn && !draftStarted) {
        const fullName = profile.fullName.trim();
        const started = await startMembershipDraft({
          firstName: fullName.split(/\s+/)[0],
          email: profile.email.trim(),
          profile: { fullName },
        });
        const startedApplicationId = applicationIdFrom(started);
        if (startedApplicationId) setTermsApplicationId(startedApplicationId);
        setDraftStarted(true);
        setDraftEmailVerified(Boolean(started.emailVerified));
        setPasswordLinkEmail(profile.email.trim());
        setOtpResendSeconds(started.otpRetryAfterSeconds || (started.emailVerified ? 0 : 60));
        return;
      }
      if (!isLoggedIn && !draftEmailVerified) {
        setError('Verify your email before uploading documents or continuing.');
        return;
      }
      const needsIdentitySubmission = !identityVerification
        || ['not_submitted', 'rejected'].includes(identityVerification.status);
      if (needsIdentitySubmission) {
        const normalizedPan = panNumber.trim().toUpperCase();
        const normalizedSecondId = secondIdNumber.trim().toUpperCase().replace(/[\s-]/g, '');
        const validPan = isValidIdentityNumber('pan', normalizedPan);
        const validSecondId = isValidIdentityNumber(secondIdType, normalizedSecondId);
        if (!validPan || !validSecondId) {
          setError('Enter a valid PAN and a valid selected second ID number.');
          return;
        }
        if (!identityFiles.panFront || !identityFiles.secondFront || !identityFiles.secondBack) {
          setError('Upload the PAN front and both sides of your selected second ID.');
          return;
        }
        if (!identityConsent) {
          setError('Please consent to identity document storage before continuing.');
          return;
        }
        setIdentitySubmitting(true);
      }
      const profileValues = {
        ...profile,
        email: undefined,
        dob: profile.dob,
      };
      const saved = isLoggedIn
        ? await saveProfile(profileValues, profilePhoto)
        : await saveMembershipDraftProfile(profileValues, profilePhoto);
      const savedApplicationId = applicationIdFrom(saved);
      if (savedApplicationId) setTermsApplicationId(savedApplicationId);
      setProfile((current) => ({
        ...current,
        ...saved,
        email: user?.email || profile.email,
        dob: dateInputValue(saved.dob ?? current.dob),
      }));
      setProfilePhoto(null);
      if (needsIdentitySubmission) {
        const identityValues = {
          panNumber: panNumber.trim().toUpperCase(),
          secondIdType,
          secondIdNumber: secondIdNumber.trim(),
          consent: identityConsent,
        };
        const submitted = isLoggedIn
          ? await submitIdentityVerification(identityValues, identityFiles)
          : await submitMembershipDraftIdentity(identityValues, identityFiles);
        setIdentityVerification(submitted);
        setPanNumber('');
        setSecondIdNumber('');
        setIdentityConsent(false);
        clearIdentityFiles(Object.keys(emptyIdentityFiles));
      }
      const adminPaymentAwaitingDocuments = user?.onboarding
        && membership?.planModel === 'Plan'
        && membership.status === 'pending_verification';
      moveTo(adminPaymentAwaitingDocuments ? 6 : 2);
    } catch (requestError) {
      setError(requestError.status === 429 && requestError.retryAfterSeconds
        ? `Too many attempts. Please try again in ${Math.ceil(requestError.retryAfterSeconds / 60)} minutes.`
        : requestError.message);
    } finally {
      setSaving(false);
      setIdentitySubmitting(false);
    }
  }

  async function choosePlan(plan) {
    if (upgradeMode) return;
    setSaving(true);
    setError('');
    try {
      const saved = isLoggedIn
        ? await savePlan(plan._id)
        : await saveMembershipDraftPlan(plan._id);
      setMembership(isLoggedIn ? saved : { status: 'draft', plan: { _id: saved._id } });
      moveTo(3);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function resetFamilyForm() {
    setParentSideError('');
    setFamilyForm({
      ...emptyFamilyForm,
      relationship: familyTab === 'children' ? 'Son'
        : familyTab === 'extended' ? 'Father'
          : familyTab === 'nominees' ? 'Nominee' : 'Spouse',
    });
    setFamilyPhoto(null);
    setEditingFamilyId(null);
  }

  async function submitFamily(event) {
    event.preventDefault();
    const isParent = ['father', 'mother'].includes(familyForm.relationship.toLowerCase());
    if (familyTab === 'extended' && isParent && !familyForm.parentSide) {
      setParentSideError('Choose whether this is the member’s parent or the spouse’s parent.');
      return;
    }
    setParentSideError('');
    const isCorporate = familyPrices?.tier === 'corporate';
    const isNominee = familyTab === 'nominees' || isCorporate;
    const memberType = isNominee
      ? isCorporate && familyForm.nomineeRole === 'GM'
        ? 'nominee_gm'
        : isCorporate && familyForm.nomineeRole === 'HR'
          ? 'nominee_hr'
          : 'nominee'
      : familyTab === 'spouse'
        ? 'spouse'
        : familyTab === 'children'
          ? 'child'
          : familyForm.relationship.toLowerCase();
    const dob = familyForm.dob;
    if (!familyPrices) {
      setError('Family prices and tier limits are still loading. Please try again.');
      return;
    }
    const existingMembers = family.filter((member) => member._id !== editingFamilyId);
    const existingNominees = existingMembers.filter((member) => (
      ['nominee', 'nominee_gm', 'nominee_hr'].includes(familyMemberType(member))
    ));
    const existingRelatives = existingMembers.filter((member) => (
      !['nominee', 'nominee_gm', 'nominee_hr'].includes(familyMemberType(member))
    ));
    if (isNominee && existingNominees.length >= familyPrices.maxNominees) {
      setError(`This tier allows up to ${familyPrices.maxNominees} nominees.`);
      return;
    }
    if (isNominee && !familyPrices.nomineesEnabled) {
      setError('Nominees are not enabled for this membership tier.');
      return;
    }
    if (!isNominee && !familyPrices.familyEnabled) {
      setError('Family memberships are not enabled for this tier.');
      return;
    }
    if (!isNominee && familyTab === 'spouse'
      && existingRelatives.filter((member) => familyMemberType(member) === 'spouse').length
        >= (familyPrices.limits?.spouse ?? 0)) {
      setError(`This tier allows up to ${familyPrices.limits?.spouse ?? 0} spouse.`);
      return;
    }
    if (!isNominee && familyTab === 'extended') {
      const existingParents = existingRelatives.filter((member) => (
        ['father', 'mother'].includes(familyMemberType(member))
      ));
      const parentsLimit = Math.min(familyPrices.limits?.parents ?? 4, 4);
      if (existingParents.length >= parentsLimit) {
        setError(`This tier allows up to ${parentsLimit} parents.`);
        return;
      }
      const parentsPerSideLimit = Math.min(familyPrices.limits?.parentsPerSide ?? 2, 2);
      if (existingParents.filter((member) => member.parentSide === familyForm.parentSide).length
        >= parentsPerSideLimit) {
        setError(`A maximum of ${parentsPerSideLimit} parents is allowed on that side.`);
        return;
      }
    }
    if (!isNominee && memberType === 'child') {
      const currentChildren = existingRelatives.filter((member) => familyMemberType(member) === 'child').length;
      if (familyPrices.limits?.children !== null && currentChildren >= (familyPrices.limits?.children ?? 0)) {
        setError(`This tier allows up to ${familyPrices.limits?.children ?? 0} children.`);
        return;
      }
      const age = ageOnPurchaseDate(dob);
      if (age === null || age > (familyPrices.childMaxAge ?? 0)) {
        setError(`This child is over ${familyPrices.childMaxAge ?? 0} and needs their own membership.`);
        return;
      }
    }
    if (!isNominee && familyPricesError) {
      setError('Load family pricing before adding a family profile.');
      return;
    }
    const values = {
      fullName: familyForm.fullName.trim(),
      gender: isNominee ? 'prefer_not_to_say' : familyForm.gender,
      relationship: isNominee ? 'Nominee' : familyForm.relationship,
      memberType,
      isNominee,
      dob: isNominee ? '' : dob,
      ...(memberType === 'father' || memberType === 'mother'
        ? { parentSide: familyForm.parentSide }
        : {}),
      anniversaryDate: familyTab === 'spouse'
        ? familyForm.anniversaryDate
        : familyTab === 'extended'
          ? parentAnniversaries[familyForm.parentSide]
          : '',
      wantsOwnMembership: isNominee ? false : Boolean(familyForm.wantsOwnMembership),
      nomineeRole: isNominee ? familyForm.nomineeRole.trim() : '',
      designation: isNominee ? familyForm.designation.trim() : '',
      workEmail: isNominee ? familyForm.workEmail.trim() : '',
      phone: isNominee ? familyForm.phone.trim() : '',
    };
    if (isNominee && !values.workEmail) {
      setError('Enter the nominee’s work email address.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = editingFamilyId
        ? (isLoggedIn
          ? await updateFamilyMember(editingFamilyId, values, familyPhoto)
          : await updateMembershipDraftFamily(editingFamilyId, values, familyPhoto))
        : (isLoggedIn
          ? await addFamilyMember(values, familyPhoto)
          : await addMembershipDraftFamily(values, familyPhoto));
      const normalizedSaved = { ...saved, _id: saved._id || saved.id };
      const isParent = memberType === 'father' || memberType === 'mother';
      const parentSide = familyForm.parentSide || 'member';
      const coupleAnniversary = values.anniversaryDate || '';
      setFamily((current) => {
        const next = editingFamilyId
          ? current.map((member) => (member._id === normalizedSaved._id ? normalizedSaved : member))
          : [...current, normalizedSaved];
        return isParent
          ? next.map((member) => (
            ['father', 'mother'].includes(familyMemberType(member))
            && (member.parentSide || 'member') === parentSide
              ? { ...member, anniversaryDate: coupleAnniversary }
              : member
          ))
          : next;
      });
      resetFamilyForm();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function startFamilyEdit(member) {
    const type = familyMemberType(member);
    const tab = ['nominee', 'nominee_gm', 'nominee_hr'].includes(type)
      ? 'nominees'
      : type === 'spouse'
        ? 'spouse'
        : type === 'child'
          ? 'children'
          : 'extended';
    const existingRelationship = String(member.relationship || '').toLowerCase();
    setFamilyTab(tab);
    setParentSideError('');
    setEditingFamilyId(member._id);
    setFamilyForm({
      fullName: member.fullName,
      gender: member.gender,
      relationship: tab === 'children'
        ? ['son', 'daughter'].includes(existingRelationship)
          ? existingRelationship[0].toUpperCase() + existingRelationship.slice(1)
          : 'Son'
        : tab === 'extended'
          ? type[0].toUpperCase() + type.slice(1)
          : tab === 'spouse'
            ? 'Spouse'
            : member.relationship || 'Nominee',
      dob: dateInputValue(member.dob),
      parentSide: ['father', 'mother'].includes(type) ? member.parentSide || '' : '',
      anniversaryDate: dateInputValue(member.anniversaryDate),
      wantsOwnMembership: Boolean(member.wantsOwnMembership),
      nomineeRole: member.nomineeRole || (type === 'nominee_gm' ? 'GM' : type === 'nominee_hr' ? 'HR' : ''),
      designation: member.designation || '',
      workEmail: member.workEmail || member.email || '',
      phone: member.phone || '',
    });
    if (tab === 'extended') {
      const side = member.parentSide || 'member';
      const coupleAnniversary = family.find((item) => (
        item._id !== member._id
        && ['father', 'mother'].includes(familyMemberType(item))
        && (item.parentSide || 'member') === side
        && item.anniversaryDate
      ))?.anniversaryDate;
      setParentAnniversaries((current) => ({
        ...current,
        [side]: dateInputValue(member.anniversaryDate || coupleAnniversary),
      }));
    }
    setFamilyPhoto(null);
  }

  function selectFamilyTab(tab) {
    setFamilyTab(tab);
    setParentSideError('');
    setError('');
    setEditingFamilyId(null);
    setFamilyPhoto(null);
    setFamilyForm({
      ...emptyFamilyForm,
      relationship: tab === 'spouse' ? 'Spouse' : tab === 'children' ? 'Child' : 'Father',
    });
  }

  async function removeFamilyMember(id) {
    setSaving(true);
    setError('');
    try {
      if (isLoggedIn) await deleteFamilyMember(id);
      else await deleteMembershipDraftFamily(id);
      setFamily((current) => current.filter((member) => member._id !== id));
      if (editingFamilyId === id) resetFamilyForm();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveDraftAndReview() {
    if (!selectedPlan) {
      setError('Please choose a plan before continuing.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isLoggedIn) await savePlan(selectedPlan._id);
      else await saveMembershipDraftPlan(selectedPlan._id);
      moveTo(4);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const handleTermsStateChange = useCallback((nextState) => {
    setTermsState(nextState);
  }, []);

  function returnToTermsAfterPaymentGate() {
    setExistingTermsConsent(null);
    setTermsState((current) => ({ ...current, checked: false, acceptedConsent: null }));
    setTermsError('Please accept the current membership agreement before proceeding to payment.');
    setTermsHighlighted(true);
    setTermsNotice('');
    setPaymentError('');
    setPaymentProcessing(false);
    setStep(4);
    setSearchParams({ step: '4', ...(selectedPlan?._id ? { planId: selectedPlan._id } : {}) });
  }

  function handlePaymentError(requestError) {
    if (requestError.code === 'TERMS_NOT_ACCEPTED') {
      returnToTermsAfterPaymentGate();
      return;
    }
    setPaymentError(requestError.message || 'We could not start your payment. Please try again.');
  }

  async function confirmAndOpenPayment() {
    if (termsSubmittingRef.current || saving) return;
    if (!selectedPlan?._id) {
      setError('Please choose a membership plan before continuing.');
      return;
    }
    if (!termsApplicationId || !termsState.manifest || !termsState.checked || !termsState.readToEnd) {
      setTermsError('Read the agreement and tick the box to continue.');
      return;
    }
    termsSubmittingRef.current = true;
    setSaving(true);
    setError('');
    setTermsError('');
    try {
      const accepted = await saveTermsConsent(termsApplicationId, {
        version: termsState.version,
        language: termsState.language,
        readToEnd: true,
      });
      const savedConsent = {
        version: accepted.version,
        language: accepted.language,
        acceptedAt: accepted.acceptedAt,
      };
      setExistingTermsConsent(savedConsent);
      const acceptedDate = new Date(accepted.acceptedAt);
      const displayedDate = Number.isNaN(acceptedDate.getTime())
        ? accepted.acceptedAt
        : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(acceptedDate);
      setTermsNotice(`Consent saved: ${accepted.version} · ${accepted.language} · ${displayedDate}. Continuing to Step 5, Payment.`);
      if (isLoggedIn) await savePlan(selectedPlan._id);
      else await saveMembershipDraftPlan(selectedPlan._id);
      setSearchParams({ step: '5', planId: selectedPlan._id });
      setStep(5);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setTermsError(requestError.message || 'Your agreement could not be saved. Please try again.');
    } finally {
      termsSubmittingRef.current = false;
      setSaving(false);
    }
  }

  async function paySecurely() {
    if (!selectedPlan?._id || paymentProcessing || offlineSubmitted) return;
    let rtgsDetails;
    if (paymentMethod === 'rtgs') {
      const utr = rtgsUtr.trim();
      if (!/^[a-z\d/-]{6,50}$/i.test(utr) || !rtgsTransferDate) {
        setPaymentError('Enter a valid RTGS UTR (6–50 letters, numbers, / or -) and transfer date.');
        return;
      }
      rtgsDetails = { utr, transferDate: rtgsTransferDate };
    }
    setPaymentProcessing(true);
    setPaymentError('');
    setPaymentUnavailable(false);

    try {
      const serverPaymentMethod = ['upi', 'card', 'razorpay'].includes(paymentMethod)
        ? 'razorpay'
        : paymentMethod;
      if (!isLoggedIn) {
        const purchase = await submitMembershipDraftPayment({
          planId: selectedPlan._id,
          paymentMethod: serverPaymentMethod,
          ...(selectedPlan.requiresCompanyDetails ? { companyDetails } : {}),
          ...(rtgsDetails ? { rtgsDetails } : {}),
        });
        if (!purchase.orderId) {
          setPasswordLinkEmail(profile.email.trim());
          setPasswordLinkSent(false);
          setPaymentSubmittedMethod(purchase.paymentMethod || paymentMethod);
          setOfflineSubmitted(true);
          setPaymentMembership((current) => ({ ...current, ...purchase }));
          moveTo(6);
          return;
        }
        await loadRazorpayCheckout();
        const checkout = new window.Razorpay({
          key: purchase.keyId,
          amount: purchase.amount,
          currency: purchase.currency,
          name: 'Orianaa Club',
          description: `${paymentMembership.plan.name} membership`,
          order_id: purchase.orderId,
          method: ['upi', 'card'].includes(paymentMethod) ? { [paymentMethod]: true } : undefined,
          config: ['upi', 'card'].includes(paymentMethod) ? {
            display: {
              blocks: {
                selected: {
                  name: `Pay using ${paymentMethod.toUpperCase()}`,
                  instruments: [{ method: paymentMethod }],
                },
              },
              sequence: ['block.selected'],
              preferences: { show_default_blocks: false },
            },
          } : undefined,
          theme: { color: '#0d4a39' },
          handler: async (result) => {
            try {
              const verification = await verifyMembershipDraftPayment({
                razorpay_order_id: result.razorpay_order_id || purchase.orderId,
                razorpay_payment_id: result.razorpay_payment_id,
                razorpay_signature: result.razorpay_signature,
              });
              setPasswordLinkEmail(profile.email.trim());
              setPasswordLinkSent(false);
              setPaymentSubmittedMethod('razorpay');
              setOfflineSubmitted(false);
              setPaymentMembership((current) => ({ ...current, ...verification }));
              moveTo(6);
            } catch (requestError) {
            handlePaymentError(requestError);
            } finally {
              setPaymentProcessing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setPaymentProcessing(false);
              setPaymentError('Payment was cancelled. You can try again when ready.');
            },
          },
        });
        checkout.on('payment.failed', () => {
          setPaymentProcessing(false);
          setPaymentError('Payment failed. Please check your details and try again.');
        });
        checkout.open();
        return;
      }
      const purchase = await purchaseMembership(
        selectedPlan._id,
        serverPaymentMethod,
        selectedPlan.requiresCompanyDetails ? companyDetails : undefined,
        rtgsDetails,
      );
      if (serverPaymentMethod === 'razorpay') {
        Object.assign(purchase, await createMembershipRazorpayOrder(purchase.paymentId));
      }
      setSearchParams({ step: '5', membershipId: purchase.membershipId });
      if (!purchase.orderId) {
        setOfflineSubmitted(true);
        setPaymentMembership((current) => ({
          ...current,
          ...purchase,
          status: purchase.status,
          paymentMethod: purchase.paymentMethod,
          amount: purchase.amount,
        }));
        if (user?.onboarding) {
          setPasswordLinkEmail(user.email);
          setPasswordLinkSent(false);
          setPaymentSubmittedMethod(purchase.paymentMethod || paymentMethod);
          moveTo(6);
        }
        return;
      }
      await loadRazorpayCheckout();
      const checkout = new window.Razorpay({
        key: purchase.keyId,
        amount: purchase.amount,
        currency: purchase.currency,
        name: 'Orianaa Club',
        description: `${paymentMembership.plan.name} membership`,
        order_id: purchase.orderId,
        method: ['upi', 'card'].includes(paymentMethod) ? { [paymentMethod]: true } : undefined,
        config: ['upi', 'card'].includes(paymentMethod) ? {
          display: {
            blocks: {
              selected: {
                name: `Pay using ${paymentMethod.toUpperCase()}`,
                instruments: [{ method: paymentMethod }],
              },
            },
            sequence: ['block.selected'],
            preferences: { show_default_blocks: false },
          },
        } : undefined,
        theme: { color: '#0d4a39' },
        handler: async (result) => {
          try {
            const verification = await verifyMembershipPayment({
              razorpay_order_id: result.razorpay_order_id || purchase.orderId,
              razorpay_payment_id: result.razorpay_payment_id,
              razorpay_signature: result.razorpay_signature,
            });
            if (user?.onboarding) {
              setPaymentMembership((current) => ({ ...current, status: verification.status }));
              setPasswordLinkEmail(user.email);
              setPasswordLinkSent(false);
              setPaymentSubmittedMethod('razorpay');
              moveTo(6);
            } else if (verification.status === 'pending_verification') {
              setOfflineSubmitted(true);
              setPaymentMembership((current) => ({ ...current, status: verification.status }));
            } else {
              navigate('/dashboard', { replace: true });
            }

          } catch (requestError) {
            handlePaymentError(requestError);
          } finally {
            setPaymentProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentProcessing(false);
            setPaymentError('Payment was cancelled. You can try again when ready.');
          },
        },
      });
      checkout.on('payment.failed', () => {
        setPaymentProcessing(false);
        setPaymentError('Payment failed. Please check your details and try again.');
      });
      checkout.open();
    } catch (requestError) {
      setPaymentProcessing(false);
      if (requestError.code === 'TERMS_NOT_ACCEPTED') {
        returnToTermsAfterPaymentGate();
      } else if (requestError.status === 503) {
        setPaymentUnavailable(true);
      } else {
        handlePaymentError(requestError);
      }
    }
  }

  async function requestPasswordLink(event) {
    event.preventDefault();
    if (!passwordLinkEmail.trim() || passwordLinkResendSeconds > 0) return;
    setPaymentError('');
    setPasswordLinkMessage('');
    try {
      const response = isLoggedIn
        ? await apiClient.post('/auth/onboarding/password-link', { email: passwordLinkEmail.trim() })
        : await requestMembershipDraftPasswordLink(passwordLinkEmail.trim());
      const result = response.data || response;
      if (result.sent && result.maskedEmail) {
        setPasswordLinkSent(true);
        setPasswordLinkRequestError(false);
        setPasswordLinkMessage(`Password link sent to ${result.maskedEmail}`);
        setPasswordLinkResendSeconds(60);
        setProfile((current) => ({ ...current, email: passwordLinkEmail.trim() }));
      } else {
        setPasswordLinkSent(false);
        setPasswordLinkRequestError(false);
        setPasswordLinkMessage(result.message || response.message || 'If the address can be used, a password link will be sent.');
      }
    } catch (requestError) {
      setPasswordLinkSent(false);
      setPasswordLinkRequestError(true);
      setPasswordLinkResendSeconds(0);
      setPasswordLinkMessage(requestError.message || 'The password setup link could not be requested.');
    }
  }

  useEffect(() => {
    if (step === 6) {
      setError('');
      setTermsNotice('');
      setPaymentError('');
      setPasswordLinkMessage('');
      setPasswordLinkRequestError(false);
      setPasswordLinkSent(false);
    }
  }, [step]);

  async function requestAdminHelp() {
    if (!passwordLinkEmail.trim() || helpRequestBusy) return;
    setHelpRequestBusy(true);
    setHelpRequestMessage('');
    try {
      const response = await requestMembershipHelp(passwordLinkEmail.trim());
      setHelpRequestMessage(response.message || 'Your request has been sent to the membership team.');
    } catch (requestError) {
      setHelpRequestMessage(requestError.message || 'We could not send your help request. Please try again.');
    } finally {
      setHelpRequestBusy(false);
    }
  }

  async function submitVerificationDocument() {
    if (!verificationFile) {
      setVerificationError('Choose a verification image to upload.');
      return;
    }
    setPaymentProcessing(true);
    setVerificationError('');
    try {
      await uploadMembershipVerificationDocument(verificationFile);
      setVerificationFile(null);
      setVerificationUploaded(true);
    } catch (requestError) {
      setVerificationError(requestError.message || 'We could not upload your verification document.');
    } finally {
      setPaymentProcessing(false);
    }
  }

  if (loading) {
    return <main className="join-membership-page jm-loading" role="status" aria-busy="true">
      Loading your membership application…
    </main>;
  }
  if (applicationLoadError) {
    return <main className="join-membership-page">
      <section className="jm-application-card" aria-labelledby="membership-load-error">
        <p id="membership-load-error" className="jm-api-message jm-api-message--error" role="alert">
          {applicationLoadError}
        </p>
        <button className="jm-btn-submit" type="button" onClick={() => setApplicationLoadRetry((count) => count + 1)}>
          Try again
        </button>
        <button className="jm-btn-pill-outline" type="button" onClick={() => moveTo(Math.max(1, step - 1))}>
          Back to previous step
        </button>
      </section>
    </main>;
  }

  const membershipGateLoading = isLoggedIn
    && (membershipGate.key !== userIdentity || membershipGate.loading);
  if (membershipGateLoading) {
    return <main className="join-membership-page jm-loading">Loading your membership application…</main>;
  }
  if (isLoggedIn && membershipGate.error) {
    return <main className="join-membership-page">
      <section className="jm-application-card">
        <p className="jm-api-message jm-api-message--error" role="alert">{membershipGate.error}</p>
        <button
          className="jm-btn-submit"
          type="button"
          onClick={() => setMembershipGateRetry((count) => count + 1)}
        >Try again</button>
      </section>
    </main>;
  }

  const existingMembership = membershipGate.membership;
  const isLockedActiveMembership = existingMembership?.status === 'active'
    && existingMembership.canRenew === false;
  const isRenewableMembership = ['active', 'expired'].includes(existingMembership?.status)
    && existingMembership.canRenew === true;
  const pendingMessage = existingMembership?.status === 'pending_verification'
    ? 'Your membership is pending document verification'
    : existingMembership?.status === 'pending_payment'
      ? 'Your membership payment is pending admin confirmation'
      : '';
  const familyMembers = (family ?? []).filter(Boolean);
  const familyNominees = familyMembers.filter((member) => (
    ['nominee', 'nominee_gm', 'nominee_hr'].includes(familyMemberType(member))
  ));
  const familyRelatives = familyMembers.filter((member) => !familyNominees.includes(member));
  const spouseCount = familyRelatives.filter((member) => familyMemberType(member) === 'spouse').length;
  const parentMembers = familyRelatives.filter((member) => ['father', 'mother'].includes(familyMemberType(member)));
  const childCount = familyRelatives.filter((member) => familyMemberType(member) === 'child').length;
  const corporateTier = familyPrices?.tier === 'corporate'
    || String(selectedPlan?.slug || selectedPlan?.id || '').toLowerCase() === 'corporate';
  const nomineeLimit = familyPrices?.maxNominees ?? 0;
  const familyLimits = familyPrices?.limits;
  const parentLimit = Math.min(familyLimits?.parents ?? 4, 4);
  const parentSideLimit = Math.min(familyLimits?.parentsPerSide ?? 2, 2);
  const familyTotal = familyMembers.reduce((sum, member) => {
    const price = priceForFamilyMember(member, familyPrices);
    return sum + (price?.totalPayable ?? 0);
  }, 0);

  if (isLoggedIn && !upgradeMode && !user?.onboarding && (isLockedActiveMembership || isRenewableMembership || pendingMessage)) {
    return <main className="join-membership-page">
      <section className="jm-application-card">
        {isLockedActiveMembership
          ? <>
            <p className="jm-api-message" role="status">
              You already have an active membership. Renewal or upgrade opens when your points are fully used or expired.
            </p>
            <p><strong>Tier:</strong> {existingMembership.tier || 'Membership'}</p>
            <p><strong>Points balance:</strong> {formatPoints(existingMembership.pointsBalance || 0)}</p>
            <button className="jm-btn-submit" type="button" onClick={() => navigate('/dashboard')}>
              Go to My Dashboard
            </button>
          </>
          : <>
            <p className="jm-api-message" role="status">
              {pendingMessage || 'Your points are fully used (or expired). You can renew or upgrade your plan.'}
            </p>
            <button
              className="jm-btn-submit"
              type="button"
              onClick={() => navigate(pendingMessage ? '/dashboard' : '/dashboard?tab=Renew')}
            >
              {pendingMessage ? 'Go to My Dashboard' : 'Renew or upgrade'}
            </button>
          </>}
      </section>
    </main>;
  }

  return (
    <main className="join-membership-page">
      <div className="join-stepper-wrap">
        <div className="join-mobile-stepper" aria-label={`Step ${step} of ${steps.length}: ${steps[step - 1]}`}>
          <p className="join-mobile-stepper__count">Step {step} of {steps.length}</p>
          <h2 className="join-mobile-stepper__title">{steps[step - 1]}</h2>
          <div
            className="join-mobile-stepper__progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={step}
            aria-label="Membership application progress"
          >
            <span style={{ width: `${(step / steps.length) * 100}%` }} />
          </div>
        </div>
        <div className="join-stepper">
          {steps.map((label, index) => {
            const number = index + 1;
            return (
              <Fragment key={label}>
                <div className={`join-step-item ${step === number ? 'is-active' : ''} ${step > number ? 'is-completed' : ''}`}>
                  <button
                    type="button"
                    className="join-step-circle"
                    disabled={number >= step}
                    onClick={() => number < step && moveTo(number)}
                    aria-label={`Go to ${label}`}
                  >
                    {number}
                  </button>
                  <span className="join-step-label">{label}</span>
                </div>
                {number < steps.length && <span className={`join-step-line ${step > number ? 'is-active-line' : ''}`} />}
              </Fragment>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={step}
          className="jm-step-container"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.3 }}
        >
          <header className="jm-plans-header">
            <h1 className="jm-plans-header__title">Your Orianaa Club Membership</h1>
            <p className="jm-plans-header__desc">
              {steps[step - 1]} — your details are saved securely to your account.
            </p>
          </header>

          {error && <p className="jm-api-message jm-api-message--error" role="alert">{error}</p>}
          {termsNotice && <p className="jm-api-message" role="status">{termsNotice}</p>}

          {step === 1 && (
            <form className="jm-application-card jm-hero-form" onSubmit={submitProfile}>
              <div className="jm-application-grid">
                <label className="jm-field">Full name
                  <input className="jm-input" required minLength="2" maxLength="120" value={profile.fullName}
                    onChange={(event) => setProfile({ ...profile, fullName: event.target.value })} />
                </label>
                <label className="jm-field">Gender
                  <select className="jm-input jm-select" value={profile.gender}
                    onChange={(event) => setProfile({ ...profile, gender: event.target.value })}>
                    <option value="">Select gender</option>
                    <option value="male">Male</option><option value="female">Female</option>
                    <option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </label>
                <label className="jm-field">Account email
                  <input
                    className="jm-input"
                    type="email"
                    autoComplete="email"
                    required={!isLoggedIn}
                    value={profile.email}
                    readOnly={isLoggedIn || draftStarted}
                    onChange={(event) => {
                      setProfile({ ...profile, email: event.target.value });
                      setDraftEmailVerified(false);
                      setOtpCode('');
                    }}
                  />
                </label>
                <label className="jm-field">Country code
                  <input className="jm-input" required value={profile.countryCode}
                    onChange={(event) => setProfile({ ...profile, countryCode: event.target.value })} />
                </label>
                <label className="jm-field">Mobile number
                  <input className="jm-input" required type="tel" value={profile.mobile}
                    onChange={(event) => setProfile({ ...profile, mobile: event.target.value })} />
                </label>
                <label className="jm-field">Date of birth
                  <input className="jm-input" required type="date" value={profile.dob}
                    onChange={(event) => setProfile({ ...profile, dob: event.target.value })} />
                </label>
                <label className="jm-field">Interest area
                  <select className="jm-input jm-select" value={profile.interestArea}
                    onChange={(event) => setProfile({ ...profile, interestArea: event.target.value })}>
                    <option value="">Select an interest area</option>
                    {['Luxury Stays', 'Fine Dining', 'Wellness & Spa', 'Family Vacations', 'Celebrations']
                      .map((interest) => <option key={interest}>{interest}</option>)}
                  </select>
                </label>
                <label className="jm-field">Profile photo (JPG, PNG, or WebP; max 10 MB)
                  <input className="jm-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={(event) => selectImageFile(event, setProfilePhoto, setError)} />
                </label>
              </div>
              {!isLoggedIn && draftStarted && (
                <section className="jm-payment-alert mt-5" aria-label="Email verification">
                  {draftEmailVerified ? (
                    <p role="status">Email verified. Your identity documents can now be submitted.</p>
                  ) : (
                    <>
                      <p>Enter the 6-digit code sent to your email before uploading identity documents.</p>
                      <label className="jm-field mt-3" htmlFor="membership-email-otp">Email verification code
                        <input
                          className="jm-input"
                          id="membership-email-otp"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          maxLength="6"
                          value={otpCode}
                          onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        />
                      </label>
                      <div className="jm-family-actions mt-3">
                        <button
                          className="jm-btn-submit"
                          type="button"
                          onClick={submitDraftOtp}
                          disabled={otpSubmitting || otpCode.length !== 6}
                        >{otpSubmitting ? 'Verifying…' : 'Verify email'}</button>
                        <button
                          className="jm-btn-pill-outline"
                          type="button"
                          onClick={resendDraftOtp}
                          disabled={otpSubmitting || otpResendSeconds > 0}
                        >{otpResendSeconds > 0 ? `Resend code in ${otpResendSeconds}s` : 'Resend code'}</button>
                      </div>
                    </>
                  )}
                </section>
              )}
              <section className="jm-review-card mt-6" aria-labelledby="identity-verification-heading">
                <h2 className="jm-review-card__title" id="identity-verification-heading">Document Verification</h2>
                {!isLoggedIn && !draftEmailVerified ? (
                  <p className="jm-quote-status">Verify your email to unlock document verification.</p>
                ) : identityVerification?.status && !['not_submitted', 'rejected'].includes(identityVerification.status) ? (
                  <div className="jm-payment-alert" role="status">
                    <p>Your identity documents are already submitted.</p>
                    <p>Status: {identityVerification.status.replaceAll('_', ' ')}</p>
                    <p>PAN: {identityVerification.panMask} · {identityVerification.idType?.replaceAll('_', ' ')}: {identityVerification.idMask}</p>
                  </div>
                ) : (
                  <>
                    {identityVerification?.status === 'rejected' && <p className="jm-payment-error" role="alert">
                      Documents were rejected: {identityVerification.rejectionReason || 'Please upload corrected documents.'}
                    </p>}
                    <section className="jm-identity-block" aria-labelledby="pan-card-heading">
                      <h3 className="jm-identity-block__title" id="pan-card-heading">PAN Card</h3>
                      <div className="jm-document-verification-grid">
                        <label className="jm-field jm-identity-field">PAN number (required)
                          <input
                            className="jm-input"
                            required
                            maxLength="10"
                            autoCapitalize="characters"
                            value={panNumber}
                            onChange={(event) => setPanNumber(event.target.value.toUpperCase())}
                            placeholder="ABCDE1234F"
                          />
                        </label>
                        <IdentityFileField label="PAN card front" file={identityFiles.panFront}
                          previewUrl={identityPreviewUrls.panFront} required disabled={saving}
                          onRemove={() => removeIdentityFile('panFront')}
                          onSelect={(event) => selectIdentityFile(
                            event, 'panFront', setIdentityFiles, setError, updateIdentityPreviewUrl,
                          )} />
                        <IdentityFileField label="PAN card back" file={identityFiles.panBack}
                          previewUrl={identityPreviewUrls.panBack} disabled={saving}
                          onRemove={() => removeIdentityFile('panBack')}
                          onSelect={(event) => selectIdentityFile(
                            event, 'panBack', setIdentityFiles, setError, updateIdentityPreviewUrl,
                          )} />
                      </div>
                    </section>
                    <section className="jm-identity-block" aria-labelledby="second-id-heading">
                      <h3 className="jm-identity-block__title" id="second-id-heading">Second ID (choose any one)</h3>
                      <div className="jm-document-verification-grid">
                        <label className="jm-field jm-identity-field">Second ID type
                          <select className="jm-input jm-select" value={secondIdType} onChange={(event) => {
                            setSecondIdType(event.target.value);
                            setSecondIdNumber('');
                            resetSecondIdentityFiles();
                          }}>
                            <option value="aadhaar">Aadhaar Card</option>
                            <option value="driving_licence">Driving Licence</option>
                            <option value="passport">Passport</option>
                          </select>
                        </label>
                        <label className="jm-field jm-identity-field">Document number (required)
                          <input
                            className="jm-input"
                            required
                            maxLength="30"
                            autoCapitalize="characters"
                            inputMode={secondIdType === 'aadhaar' ? 'numeric' : 'text'}
                            value={secondIdNumber}
                            onChange={(event) => setSecondIdNumber(event.target.value.toUpperCase())}
                            placeholder={secondIdType === 'aadhaar' ? '12-digit Aadhaar number' : secondIdType === 'passport' ? 'Passport number' : 'Driving Licence number'}
                          />
                        </label>
                        <IdentityFileField label={`${secondIdType.replaceAll('_', ' ')} front`} file={identityFiles.secondFront}
                          previewUrl={identityPreviewUrls.secondFront} required disabled={saving}
                          onRemove={() => removeIdentityFile('secondFront')}
                          onSelect={(event) => selectIdentityFile(
                            event, 'secondFront', setIdentityFiles, setError, updateIdentityPreviewUrl,
                          )} />
                        <IdentityFileField label={`${secondIdType.replaceAll('_', ' ')} back`} file={identityFiles.secondBack}
                          previewUrl={identityPreviewUrls.secondBack} required disabled={saving}
                          onRemove={() => removeIdentityFile('secondBack')}
                          onSelect={(event) => selectIdentityFile(
                            event, 'secondBack', setIdentityFiles, setError, updateIdentityPreviewUrl,
                          )} />
                      </div>
                    </section>
                    <label className="jm-promo-agree mt-4">
                      <input
                        type="checkbox"
                        className="jm-checkbox"
                        required
                        checked={identityConsent}
                        onChange={(event) => setIdentityConsent(event.target.checked)}
                      />
                      <span className="jm-promo-text">I consent to Orianaa Club storing my identity documents for membership verification.</span>
                    </label>
                  </>
                )}
              </section>
              <label className="jm-promo-agree">
                <input type="checkbox" className="jm-checkbox" checked={Boolean(profile.agreePromo)}
                  onChange={(event) => setProfile({ ...profile, agreePromo: event.target.checked })} />
                <span className="jm-promo-text">I agree to receive promotional messages from Orianaa Club.</span>
              </label>
              <button className="jm-btn-submit" disabled={saving}>{saving || identitySubmitting ? 'Saving…' : 'Save & Continue'}</button>
            </form>
          )}

          {step === 2 && (
            upgradeMode && (
              <p className="jm-api-message" role="status">
                Plan comparison is available below, but upgrading an active membership is not connected to this flow yet. The existing renewal option in Dashboard is only available when your membership is eligible to renew.
              </p>
            )
          )}

          {step === 2 && (
            plansLoading ? (
              <div className="jm-plans-loading-grid" aria-label="Loading membership plans" aria-busy="true">
                {Array.from({ length: 4 }, (_, index) => (
                  <div className="jm-plan-skeleton" key={index}>
                    <span /><span /><span /><span /><span />
                  </div>
                ))}
              </div>
            ) : plansError ? (
              <div className="jm-plans-error" role="alert">
                <p>{plansError}</p>
                <div className="jm-step-nav-bar" style={{ justifyContent: 'center', gap: '16px' }}>
                  <button className="jm-btn-back" type="button" onClick={() => moveTo(1)}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    <span>Back to Personal Details</span>
                  </button>
                  <button className="jm-btn-submit" type="button" style={{ width: 'auto' }} onClick={loadPlans}>Retry</button>
                </div>
              </div>
            ) : plans.length === 0 ? (
              <div className="jm-plans-empty-wrap">
                <p className="jm-plans-empty">No active membership plans are available right now.</p>
                <div className="jm-step-nav-bar" style={{ justifyContent: 'center' }}>
                  <button className="jm-btn-back" type="button" onClick={() => moveTo(1)}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    <span>Back to Personal Details</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="jm-step-nav-bar">
                  <button
                    type="button"
                    className="jm-btn-back"
                    onClick={() => moveTo(1)}
                    aria-label="Back to Personal Details"
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    <span>Back to Personal Details</span>
                  </button>
                </div>

                <div className="mb-plans-grid">
                  {plans.map((plan, index) => (
                    <PlanCard
                      key={plan.slug}
                      plan={mapPlanToCard(plan)}
                      index={index}
                      featured={selectedPlan?.slug === plan.slug}
                      buttonLabel={upgradeMode ? 'Upgrade unavailable' : 'Select Plan'}
                      onSelect={() => choosePlan(plan)}
                      selected={selectedPlan?.slug === plan.slug}
                      disabled={saving || upgradeMode}
                    />
                  ))}
                </div>

                <div className="jm-step-nav-bar jm-step-nav-bar--bottom">
                  <button
                    type="button"
                    className="jm-btn-back"
                    onClick={() => moveTo(1)}
                    aria-label="Back to Personal Details"
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    <span>Back to Personal Details</span>
                  </button>
                </div>
              </>
            )
          )}

          {step === 3 && (
            <>
              <div className="jm-step-nav-bar jm-step-nav-bar--form">
                <button
                  type="button"
                  className="jm-btn-back"
                  onClick={() => moveTo(2)}
                  aria-label="Back to Select Plan"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  <span>Back to Select Plan</span>
                </button>
              </div>
              <div className="jm-application-card jm-hero-form jm-family-step">
              <header className="jm-family-step__header">
                <p className="jm-family-step__eyebrow">{corporateTier ? 'Corporate membership' : 'Your membership family'}</p>
                <h2>{corporateTier ? 'Add your nominees' : 'Family details'}</h2>
                <p>{corporateTier
                  ? 'Nominees are added at no extra cost. Add one General Manager (GM) and one Human Resources (HR) nominee.'
                  : `Add ${spouseCount}/${familyLimits?.spouse ?? '—'} spouse, ${familyLimits?.children === null ? 'unlimited' : `up to ${familyLimits?.children ?? '—'}`} children (${childCount} added), up to ${parentLimit} parents (${parentSideLimit} per side; ${parentMembers.length} added), and up to ${nomineeLimit} nominees. A family profile is not a membership; the person becomes a member when they pay.`}</p>
              </header>

              {familyPricesLoading && <p className="jm-quote-status" role="status">Loading family prices…</p>}
              {familyPricesError && (
                <div className="jm-family-price-error" role="alert">
                  <span>{familyPricesError}</span>
                  <button className="jm-btn-pill-outline" type="button" onClick={() => setFamilyPricesRetry((count) => count + 1)}>Retry</button>
                </div>
              )}

              {!corporateTier && (
                <div className="jm-family-tabs" role="tablist" aria-label="Family profile type">
                  {[
                    ['spouse', 'Spouse'],
                    ['children', 'Children'],
                    ['extended', 'Extended family'],
                    ['nominees', 'Nominees'],
                  ].filter(([tab]) => tab !== 'nominees'
                    || (familyPrices?.nomineesEnabled && familyPrices.maxNominees > 0))
                    .map(([tab, label]) => (
                    <button
                      key={tab}
                      className={`jm-family-tab${familyTab === tab ? ' is-active' : ''}`}
                      type="button"
                      role="tab"
                      aria-selected={familyTab === tab}
                      onClick={() => selectFamilyTab(tab)}
                    >{label}</button>
                  ))}
                </div>
              )}

              {familyTab === 'nominees' || corporateTier ? (
                <section className="jm-family-panel" aria-label="Nominee details">
                  <p className="jm-family-panel__intro">
                    {corporateTier
                      ? 'Add nominees at no extra cost. Each nominee confirms their email with a code and earns no points.'
                      : 'Add a nominee at no extra cost. Nominees confirm their email with a code and earn no points.'}
                  </p>
                  <form className="jm-application-grid jm-family-form" onSubmit={submitFamily}>
                    {corporateTier && (
                      <label className="jm-field">Nominee role
                        <select
                          className="jm-input jm-select"
                          required
                          value={familyForm.nomineeRole}
                          onChange={(event) => setFamilyForm({ ...familyForm, nomineeRole: event.target.value })}
                        >
                          <option value="">Select a role</option>
                          {['GM', 'HR'].filter((role) => !familyNominees.some((member) => (
                            member.nomineeRole === role
                            || familyMemberType(member) === `nominee_${role.toLowerCase()}`
                          )) || (editingFamilyId && family.find((member) => member._id === editingFamilyId)?.nomineeRole === role))
                            .map((role) => <option value={role} key={role}>{role}</option>)}
                        </select>
                      </label>
                    )}
                    {!corporateTier && (
                      <label className="jm-field">Role
                        <input
                          className="jm-input"
                          required
                          maxLength="80"
                          value={familyForm.nomineeRole}
                          placeholder="Friend, PA, etc."
                          onChange={(event) => setFamilyForm({ ...familyForm, nomineeRole: event.target.value })}
                        />
                      </label>
                    )}
                    <label className="jm-field">Full name
                      <input className="jm-input" required minLength="2" maxLength="120" value={familyForm.fullName}
                        onChange={(event) => setFamilyForm({ ...familyForm, fullName: event.target.value })} />
                    </label>
                    <label className="jm-field">Designation
                      <input className="jm-input" required maxLength="120" value={familyForm.designation}
                        onChange={(event) => setFamilyForm({ ...familyForm, designation: event.target.value })} />
                    </label>
                    <label className="jm-field">Work email
                      <input className="jm-input" required type="email" maxLength="254" value={familyForm.workEmail}
                        onChange={(event) => setFamilyForm({ ...familyForm, workEmail: event.target.value })} />
                    </label>
                    <label className="jm-field">Phone
                      <input className="jm-input" required type="tel" maxLength="40" value={familyForm.phone}
                        onChange={(event) => setFamilyForm({ ...familyForm, phone: event.target.value })} />
                    </label>
                    <label className="jm-field">Photo (optional; max 10 MB)
                      <input className="jm-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                        onChange={(event) => selectImageFile(event, setFamilyPhoto, setError)} />
                    </label>
                    <div className="jm-family-actions">
                      <button className="jm-btn-submit" disabled={saving
                        || !familyPrices?.nomineesEnabled
                        || familyNominees.length >= nomineeLimit && !editingFamilyId}>
                        {saving ? 'Saving…' : editingFamilyId ? 'Update nominee' : 'Add nominee'}
                      </button>
                      {editingFamilyId && <button type="button" className="jm-btn-pill-outline" onClick={resetFamilyForm}>Cancel edit</button>}
                    </div>
                  </form>
                  {!corporateTier && <p className="jm-family-limit-note">Nominees do not pay, receive a discount, or earn points.</p>}
                </section>
              ) : (
                <section className="jm-family-panel" aria-label={`${familyTab} details`}>
                  {(() => {
                    const priceType = familyTab === 'spouse' ? 'spouse' : familyTab === 'children' ? 'child' : 'parent';
                    const price = familyPrices?.prices?.[priceType];
                    return price ? (
                      <div className="jm-family-price-card" aria-label={`${priceType} price`}>
                        <span className="jm-family-discount">{price.discountPct}% discount</span>
                        <div><span>Base price</span><strong>{money(price.baseAmount)}</strong></div>
                        <div><span>GST</span><strong>{money(price.gstAmount)}</strong></div>
                        <div className="jm-family-price-card__total"><span>Total</span><strong>{money(price.totalPayable)}</strong></div>
                      </div>
                    ) : (
                      <p className="jm-quote-status" role="status">Family pricing is unavailable for this tier.</p>
                    );
                  })()}

                  <form className="jm-application-grid jm-family-form" onSubmit={submitFamily}>
                    {familyTab === 'extended' && (
                      <div className="jm-field">
                        <label htmlFor="jm-parent-side">Whose parent?</label>
                        <select
                          id="jm-parent-side"
                          className="jm-input jm-select"
                          aria-required="true"
                          aria-invalid={Boolean(parentSideError)}
                          aria-describedby={parentSideError ? 'jm-parent-side-error' : undefined}
                          value={familyForm.parentSide}
                          onChange={(event) => {
                            setFamilyForm({ ...familyForm, parentSide: event.target.value });
                            setParentSideError('');
                          }}
                        >
                          <option value="">Select a parent side</option>
                          <option value="member">Member’s parent</option>
                          <option value="spouse">Spouse’s parent</option>
                        </select>
                        {parentSideError && (
                          <span id="jm-parent-side-error" className="jm-api-message jm-api-message--error" role="alert">
                            {parentSideError}
                          </span>
                        )}
                      </div>
                    )}
                    <label className="jm-field">Full name
                      <input className="jm-input" required minLength="2" maxLength="120" value={familyForm.fullName}
                        onChange={(event) => setFamilyForm({ ...familyForm, fullName: event.target.value })} />
                    </label>
                    <label className="jm-field">Gender
                      <select className="jm-input jm-select" required value={familyForm.gender}
                        onChange={(event) => setFamilyForm({ ...familyForm, gender: event.target.value })}>
                        <option value="male">Male</option><option value="female">Female</option>
                        <option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </label>
                    <label className="jm-field">Relationship
                      <select
                        className="jm-input jm-select"
                        required
                        value={familyForm.relationship}
                        onChange={(event) => setFamilyForm({ ...familyForm, relationship: event.target.value })}
                      >
                        {(familyTab === 'spouse' ? ['Spouse']
                          : familyTab === 'children' ? ['Son', 'Daughter']
                            : ['Father', 'Mother']).map((relationship) => (
                              <option key={relationship} value={relationship}>{relationship}</option>
                            ))}
                      </select>
                    </label>
                    <label className="jm-field">Date of birth
                      <input className="jm-input" required type="date" value={familyForm.dob}
                        onChange={(event) => setFamilyForm({ ...familyForm, dob: event.target.value })} />
                    </label>
                    {familyTab === 'spouse' && (
                      <label className="jm-field">Anniversary date (optional)
                        <input className="jm-input" type="date" max={new Date().toISOString().slice(0, 10)} value={familyForm.anniversaryDate}
                          onChange={(event) => setFamilyForm({ ...familyForm, anniversaryDate: event.target.value })} />
                      </label>
                    )}
                    {familyTab === 'extended' && (
                      <label className="jm-field">Parents’ anniversary date
                        <input
                          className="jm-input"
                          type="date"
                          max={new Date().toISOString().slice(0, 10)}
                          value={parentAnniversaries[familyForm.parentSide]}
                          onChange={(event) => setParentAnniversaries((current) => ({
                            ...current,
                            [familyForm.parentSide]: event.target.value,
                          }))}
                        />
                      </label>
                    )}
                    <label className="jm-field">Photo (optional; max 10 MB)
                      <input className="jm-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                        onChange={(event) => selectImageFile(event, setFamilyPhoto, setError)} />
                    </label>
                    <label className="jm-family-switch">
                      <input
                        type="checkbox"
                        checked={Boolean(familyForm.wantsOwnMembership)}
                        onChange={(event) => setFamilyForm({ ...familyForm, wantsOwnMembership: event.target.checked })}
                      />
                      <span>Wants own membership</span>
                    </label>
                    <p className="jm-family-document-note">
                      Aadhaar and other documents are uploaded securely in the verification step, after you add this person. Payment is non-refundable if verification cannot be completed.
                    </p>
                    <div className="jm-family-actions">
                      <button className="jm-btn-submit" disabled={saving || familyPricesLoading || !familyPrices}>
                        {saving ? 'Saving…' : editingFamilyId ? 'Update family profile' : 'Add family profile'}
                      </button>
                      {editingFamilyId && <button type="button" className="jm-btn-pill-outline" onClick={resetFamilyForm}>Cancel edit</button>}
                    </div>
                  </form>
                </section>
              )}

              {error && <p className="jm-api-message jm-api-message--error" role="alert">{error}</p>}

              <section className="jm-family-list jm-family-added" aria-labelledby="jm-family-added-title">
                <div className="jm-family-added__heading">
                  <h3 id="jm-family-added-title">Added ({familyMembers.length})</h3>
                  {familyMembers.length > 0 && !corporateTier && <strong>Family profiles: {money(familyTotal)}</strong>}
                </div>
                {familyMembers.length === 0 ? (
                  <p>No family profiles or nominees added yet.</p>
                ) : familyMembers.map((member) => {
                  const type = familyMemberType(member);
                  const price = priceForFamilyMember(member, familyPrices);
                  const isNominee = ['nominee', 'nominee_gm', 'nominee_hr'].includes(type);
                  return (
                    <article className="jm-family-added-card" key={member._id}>
                      {member.photoUrl && <img className="jm-family-photo" src={apiFileUrl(member.photoUrl)} alt="" />}
                      <div className="jm-family-added-card__details">
                        <strong>{member.fullName}</strong>
                        <span>{isNominee ? `Nominee · ${member.nomineeRole || (type === 'nominee_gm' ? 'GM' : type === 'nominee_hr' ? 'HR' : '')}` : `${member.relationship}${member.parentSide ? ` · ${member.parentSide === 'member' ? 'Member’s parent' : 'Spouse’s parent'}` : ''}`}</span>
                        {isNominee ? (
                          <span>No cost · No discount · No points</span>
                        ) : (
                          <>
                            {price && <span className="jm-family-discount">{price.discountPct}% discount</span>}
                            <span>{price ? `Base ${money(price.baseAmount)} + GST ${money(price.gstAmount)} = ${money(price.totalPayable)}` : 'Price unavailable'}</span>
                            <span>Welcome kit included · Aadhaar status: {member.aadhaarStatus || 'Not added'}</span>
                          </>
                        )}
                      </div>
                      <div className="jm-family-added-card__actions">
                        <button className="jm-btn-pill-outline" type="button" onClick={() => startFamilyEdit(member)}>Edit</button>
                        <button className="jm-family-chip__delete" type="button" disabled={saving}
                          onClick={() => removeFamilyMember(member._id)} aria-label={`Delete ${member.fullName}`}>Delete</button>
                      </div>
                    </article>
                  );
                })}
              </section>

              <p className="jm-non-refundable-notice" role="note">
                Payments are non-refundable. Please review family details and required documents before continuing.
              </p>
              <div className="jm-family-actions">
                <button className="jm-btn-pill-outline" type="button" onClick={() => moveTo(2)}>Back</button>
                <button className="jm-btn-submit" type="button" onClick={saveDraftAndReview}
                  disabled={saving || familyPricesLoading || Boolean(familyPricesError)}>
                  {saving ? 'Saving…' : 'Continue to review'}
                </button>
              </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
            <div className="jm-step-nav-bar jm-step-nav-bar--form">
              <button type="button" className="jm-btn-back" onClick={() => moveTo(3)} aria-label="Back to Family Details">
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Back to Family Details</span>
              </button>
            </div>
            <div className="jm-review-layout">
              <section className="jm-review-plan" aria-label="Selected membership plan">
                <p className="jm-review-plan__eyebrow">Your selection</p>
                <PlanCard
                  plan={mapPlanToCard(selectedPlan ?? {})}
                  featured
                  visible
                  buttonLabel="Change Plan"
                  onSelect={() => moveTo(2)}
                />
                <section className="jm-review-card jm-payment-details" aria-label="Payment details">
                  <h2 className="jm-review-card__title">Payment Details</h2>
                  {quoteLoading ? (
                    <p className="jm-quote-status" role="status">Calculating your payment details…</p>
                  ) : quoteError ? (
                    <div className="jm-quote-status jm-quote-status--error" role="alert">
                      <p>{quoteError}</p>
                      <button className="jm-btn-pill-outline" type="button" onClick={() => setQuoteRetry((count) => count + 1)}>
                        Retry
                      </button>
                    </div>
                  ) : quote ? (
                    <div className="jm-fee-rows">
                      <div className="jm-fee-row">
                        <span className="jm-fee-row__label">Plan fee</span>
                        <strong>{money((quote?.planFee ?? 0) / 100)}</strong>
                      </div>
                      {quote?.gstEnabled && <div className="jm-fee-row">
                        <span className="jm-fee-row__label">{quote.gstLabel || 'GST'} ({quote.gstPercent ?? 0}%)</span>
                        <strong>{money((quote?.gst ?? 0) / 100)}</strong>
                      </div>}
                      <div className="jm-fee-row jm-fee-row--total">
                        <span className="jm-fee-row__label">Total</span>
                        <strong>{money((quote?.total ?? 0) / 100)}</strong>
                      </div>
                    </div>
                  ) : (
                    <p className="jm-quote-status" role="status">Select a plan to view payment details.</p>
                  )}
                </section>
              </section>

              <div className="jm-review-right">
                <section className="jm-review-card" aria-readonly="true">
                  <h2 className="jm-review-card__title">Personal Details</h2>
                  <dl className="jm-review-details">
                    <div><dt>Name</dt><dd>{profile.fullName || '—'}</dd></div>
                    <div><dt>Gender</dt><dd>{profile.gender ? profile.gender.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : '—'}</dd></div>
                    <div><dt>Date of Birth</dt><dd>{formatPlainDate(profile.dob)}</dd></div>
                    <div><dt>Phone</dt><dd>{profile.mobile ? `${profile.countryCode || ''} ${profile.mobile}`.trim() : '—'}</dd></div>
                  </dl>
                </section>

                <section className="jm-review-card" aria-label="Family profiles and nominees">
                  <h2 className="jm-review-card__title">Family profiles &amp; nominees</h2>
                  {familyPricesLoading && <p className="jm-quote-status" role="status">Loading family prices…</p>}
                  {familyPricesError && (
                    <div className="jm-family-price-error" role="alert">
                      <span>{familyPricesError}</span>
                      <button
                        className="jm-btn-pill-outline"
                        type="button"
                        onClick={() => setFamilyPricesRetry((count) => count + 1)}
                      >Retry</button>
                    </div>
                  )}
                  {familyMembers.length === 0 ? (
                    <p>No family profiles or nominees added.</p>
                  ) : (
                    <div className="jm-family-review-list">
                      {familyMembers.map((member) => {
                        const type = familyMemberType(member);
                        const price = priceForFamilyMember(member, familyPrices);
                        const isNominee = ['nominee', 'nominee_gm', 'nominee_hr'].includes(type);
                        return (
                          <div className="jm-family-review-item" key={member?._id || member?.id || member?.fullName}>
                            <div className="jm-family-review-item__identity">
                              <strong>{member?.fullName || 'Family member'}</strong>
                              <span>{isNominee
                                ? `Nominee${member?.nomineeRole ? ` · ${member.nomineeRole}` : type === 'nominee_gm' ? ' · GM' : type === 'nominee_hr' ? ' · HR' : ''}`
                                : `${member?.relationship || 'Family member'}${['father', 'mother'].includes(type) && member?.parentSide
                                  ? ` · ${member.parentSide === 'member' ? 'Member’s parent' : 'Spouse’s parent'}`
                                  : ''}`}</span>
                            </div>
                            {isNominee ? (
                              <span className="jm-family-review-item__free">Included</span>
                            ) : price ? (
                              <dl>
                                <div><dt>Discount</dt><dd>{price.discountPct ?? 0}%</dd></div>
                                <div><dt>Base</dt><dd>{money(price.baseAmount ?? 0)}</dd></div>
                                <div><dt>GST</dt><dd>{money(price.gstAmount ?? 0)}</dd></div>
                                <div className="jm-family-review-item__total"><dt>Total</dt><dd>{money(price.totalPayable ?? 0)}</dd></div>
                              </dl>
                            ) : <span className="jm-family-review-item__unavailable">Price unavailable</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <TermsConsentCard
                  savedLanguage={profile.language || user?.language}
                  existingConsent={existingTermsConsent}
                  highlighted={termsHighlighted}
                  error={termsError}
                  onStateChange={handleTermsStateChange}
                />
                <div className="jm-terms-confirm">
                  <p className="jm-non-refundable-notice" role="note">
                    Payments are non-refundable. Please make sure your membership and family details are correct before proceeding.
                  </p>
                  <button
                    className="jm-btn-submit jm-confirm-payment"
                    type="button"
                    onClick={confirmAndOpenPayment}
                    disabled={
                      saving
                      || quoteLoading
                      || Boolean(quoteError)
                      || !quote
                      || !termsApplicationId
                      || !termsState.manifest
                      || (!termsState.checked && !(
                        existingTermsConsent
                        && existingTermsConsent.version === termsState.manifest?.version
                      ))
                      || !termsState.readToEnd
                    }
                  >
                    {saving ? 'Saving consent…' : 'Confirm & Proceed to Payment'}
                  </button>
                  {!termsState.checked && !(
                    existingTermsConsent
                    && existingTermsConsent.version === termsState.manifest?.version
                  ) && (
                    <p className="jm-terms-confirm__hint">Read the agreement and tick the box to continue.</p>
                  )}
                </div>
                {selectedPlan?.requiresCompanyDetails && (
                  <section className="jm-review-card" aria-label="Company details">
                    <h2 className="jm-review-card__title">Company Details</h2>
                    <div className="jm-application-grid">
                      {[
                        ['Company name', 'companyName'],
                        ['GST number', 'gstNumber'],
                        ['Contact person', 'contactPerson'],
                      ].map(([label, field]) => (
                        <label className="jm-field" key={field}>{label}
                          <input
                            className="jm-input"
                            required
                            value={companyDetails[field]}
                            onChange={(event) => setCompanyDetails({
                              ...companyDetails,
                              [field]: event.target.value,
                            })}
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
            </>
          )}

          {step === 5 && (
            <>
            <div className="jm-step-nav-bar jm-step-nav-bar--form">
              <button type="button" className="jm-btn-back" onClick={() => moveTo(4)} aria-label="Back to Review and Confirm">
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Back to Review &amp; Confirm</span>
              </button>
            </div>
            <section className="jm-payment-page" aria-labelledby="jm-payment-heading">
              <h2 className="jm-payment-title" id="jm-payment-heading">Select Payment Method</h2>
              {paymentMembershipLoading ? (
                <p className="jm-quote-status" role="status">Loading your payment details…</p>
              ) : paymentMembershipError ? (
                <div className="jm-payment-alert" role="alert">
                  <p>{paymentMembershipError}</p>
                  <button className="jm-btn-pill-outline" type="button" onClick={() => setPaymentReload((value) => value + 1)}>
                    Retry
                  </button>
                </div>
              ) : paymentMembership ? (
                <>
                  <fieldset className="jm-payment-methods-grid" disabled={paymentProcessing}>
                    <legend className="sr-only">Choose a payment method</legend>
                    {[
                      { id: 'upi', label: 'UPI', icon: <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M26.8 4 12 26.1h9.5L19.2 44 36 19.7h-10L26.8 4Z" fill="currentColor" /></svg> },
                      { id: 'card', label: 'Card', icon: <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="10" width="36" height="28" rx="5" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M7 19h34M13 30h10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg> },
                      { id: 'razorpay', label: 'Razorpay', icon: <span className="jm-razorpay-mark" aria-hidden="true">R</span> },
                      { id: 'bank_transfer', label: 'Bank transfer', icon: <span aria-hidden="true">⌂</span> },
                      { id: 'cheque', label: 'Cheque', icon: <span aria-hidden="true">▤</span> },
                      { id: 'rtgs', label: 'RTGS', icon: <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 17h30m0 0-7-7m7 7-7 7M40 31H10m0 0 7-7m-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg> },
                    ].map((option) => (
                      <label className={`jm-pay-card ${paymentMethod === option.id ? 'is-selected-pay' : ''}`} key={option.id}>
                        <input
                          className="jm-payment-radio"
                          type="radio"
                          name="payment-method"
                          value={option.id}
                          checked={paymentMethod === option.id}
                          onChange={() => setPaymentMethod(option.id)}
                        />
                        <span className={`jm-pay-card__logo jm-pay-card__logo--${option.id}`}>{option.icon}</span>
                        <span className="jm-pay-card__name">{option.label}</span>
                      </label>
                    ))}
                  </fieldset>
                  <p className="jm-payment-total">
                    <span>{paymentMembership.plan.name}</span>
                  </p>
                  <div className="jm-fee-rows">
                    <div className="jm-fee-row">
                      <span className="jm-fee-row__label">Plan fee</span>
                      <strong className="jm-fee-row__val">{money(paymentMembership.planFee / 100)}</strong>
                    </div>
                    {paymentMembership.gstEnabled && <div className="jm-fee-row">
                      <span className="jm-fee-row__label">{paymentMembership.gstLabel} ({paymentMembership.gstRate}%)</span>
                      <strong className="jm-fee-row__val">{money(paymentMembership.gst / 100)}</strong>
                    </div>}
                    <div className="jm-fee-row jm-fee-row--total">
                      <span className="jm-fee-row__label">Total</span>
                      <strong className="jm-fee-row__val">{money(paymentMembership.amount / 100)}</strong>
                    </div>
                  </div>
                  {paymentMethod === 'rtgs' && (
                    <section className="jm-payment-alert" aria-label="RTGS bank transfer details">
                      <h3>Bank details</h3>
                      {bankDetailsLoading ? (
                        <p role="status">Loading bank details…</p>
                      ) : bankDetailsError ? (
                        <p role="alert">{bankDetailsError}</p>
                      ) : bankDetails ? (
                        <dl>
                          <div><dt>Account name</dt><dd>{bankDetails.accountName || '—'}</dd></div>
                          <div><dt>Account number</dt><dd>{bankDetails.accountNumber || '—'}</dd></div>
                          <div><dt>IFSC</dt><dd>{bankDetails.ifsc || '—'}</dd></div>
                          <div><dt>Bank</dt><dd>{bankDetails.bank || '—'}</dd></div>
                          <div><dt>Branch</dt><dd>{bankDetails.branch || '—'}</dd></div>
                        </dl>
                      ) : null}
                      <label className="jm-field" htmlFor="rtgs-utr">RTGS UTR / reference number
                        <input
                          className="jm-input"
                          id="rtgs-utr"
                          required
                          minLength="6"
                          maxLength="50"
                          pattern="[A-Za-z0-9/-]+"
                          value={rtgsUtr}
                          onChange={(event) => setRtgsUtr(event.target.value)}
                          disabled={paymentProcessing}
                        />
                      </label>
                      <label className="jm-field" htmlFor="rtgs-transfer-date">Transfer date
                        <input
                          className="jm-input"
                          id="rtgs-transfer-date"
                          type="date"
                          required
                          value={rtgsTransferDate}
                          onChange={(event) => setRtgsTransferDate(event.target.value)}
                          disabled={paymentProcessing}
                        />
                      </label>
                    </section>
                  )}

                  {paymentMembership.status === 'pending_verification' ? (
                    <div className="jm-payment-alert" role="status">
                      <p>Payment confirmed. Upload your eligibility proof for administrator review.</p>
                      {verificationUploaded ? (
                        <p>Your verification document has been submitted.</p>
                      ) : (
                        <div className="jm-verification-upload">
                          <label htmlFor="membership-verification-document">Verification document image</label>
                          <input
                            id="membership-verification-document"
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            onChange={(event) => selectImageFile(event, setVerificationFile, setVerificationError)}
                            disabled={paymentProcessing}
                          />
                          {verificationFile && <span>{verificationFile.name}</span>}
                          {verificationError && <p className="jm-payment-error" role="alert">{verificationError}</p>}
                          <button
                            className="jm-btn-submit"
                            type="button"
                            onClick={submitVerificationDocument}
                            disabled={paymentProcessing || !verificationFile}
                          >
                            {paymentProcessing ? 'Uploading…' : 'Upload proof'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : offlineSubmitted ? (
                    <div className="jm-payment-alert" role="status">
                      Payment method saved. Your membership will become active after an administrator confirms receipt.
                    </div>
                  ) : paymentUnavailable ? (
                    <div className="jm-payment-alert" role="status">
                      <p>Online payment is not enabled yet. Your membership is saved as pending payment.</p>
                      <button className="jm-btn-pill-outline" type="button" onClick={() => moveTo(4)}>Back to Review</button>
                    </div>
                  ) : (
                    <>
                      <p className="jm-non-refundable-notice" role="note">
                        Payments are non-refundable. Verification must be completed to unlock the family rate.
                      </p>
                      {paymentError && <p className="jm-payment-error" role="alert">{paymentError}</p>}
                      <button
                        className="jm-btn-submit jm-pay-securely"
                        type="button"
                        onClick={paySecurely}
                        disabled={paymentProcessing || paymentMembershipLoading || !paymentMembership
                          || (paymentMethod === 'rtgs' && (bankDetailsLoading || Boolean(bankDetailsError) || !bankDetails))}
                      >
                        {paymentProcessing ? 'Processing…' : ['upi', 'card', 'razorpay'].includes(paymentMethod)
                          ? 'Pay Securely'
                          : 'Submit payment method'}
                      </button>
                    </>
                  )}
                </>
              ) : null}
            </section>
            </>
          )}

          {step === 6 && (
            <>
            <div className="jm-step-nav-bar jm-step-nav-bar--form">
              <button type="button" className="jm-btn-back" onClick={() => moveTo(5)} aria-label="Back to Payment">
                <ArrowLeft size={16} aria-hidden="true" />
                <span>Back to Payment</span>
              </button>
            </div>
            <section className="jm-application-card jm-hero-form jm-password-link-card" aria-labelledby="password-link-heading">
              <header className="jm-password-link-card__header">
                <span className="jm-password-link-card__icon"><KeyRound size={22} aria-hidden="true" /></span>
                <p className="jm-family-step__eyebrow">Your membership account</p>
                <h2 id="password-link-heading">Set your password</h2>
                <p>Secure your account to manage your membership and future journeys.</p>
              </header>
              <div className="jm-password-link-card__status" role="status">
                <ShieldCheck size={20} aria-hidden="true" />
                <span>{paymentSubmittedMethod === 'razorpay'
                  ? 'Payment received. Your membership is being prepared.'
                  : 'Payment submitted and awaiting confirmation.'}</span>
              </div>
              <div className="jm-password-link-card__member">
                <span>Membership ID</span>
                <strong>{paymentMembership?.status === 'active' && (paymentMembership.memberId || paymentMembership.memberCode)
                  ? paymentMembership.memberId || paymentMembership.memberCode
                  : 'Assigned after membership approval'}</strong>
              </div>
              <form className="jm-password-link-form" onSubmit={requestPasswordLink}>
                <p className="jm-password-link-form__intro">We’ll send a secure password setup link to your email.</p>
                <label className="jm-field" htmlFor="password-link-email">
                  Email
                  <input
                    className="jm-input"
                    id="password-link-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={passwordLinkEmail}
                    onChange={(event) => {
                      setPasswordLinkEmail(event.target.value);
                      setPasswordLinkSent(false);
                      setPasswordLinkMessage('');
                      setPasswordLinkRequestError(false);
                    }}
                  />
                </label>
                {passwordLinkSent && <p className="mt-3" role="status">{passwordLinkMessage}</p>}
                {passwordLinkMessage && !passwordLinkSent && !passwordLinkRequestError
                  && <p className="mt-3 jm-password-link-message-info" role="status">{passwordLinkMessage}</p>}
                {passwordLinkMessage && !passwordLinkSent && passwordLinkRequestError
                  && <p className="mt-3 jm-payment-error" role="alert">{passwordLinkMessage}</p>}
                <p className="jm-password-link-form__note">Check your inbox and spam folder for the setup link.</p>
                <button
                  className="jm-btn-submit mt-4"
                  type="submit"
                  disabled={passwordLinkResendSeconds > 0}
                >
                  {passwordLinkResendSeconds > 0
                    ? `${passwordLinkSent ? 'Resend' : 'Send link'} in ${passwordLinkResendSeconds}s`
                    : passwordLinkSent
                      ? 'Resend'
                      : 'Send password setup link'}
                </button>
              </form>
              {paymentError && <p className="jm-payment-error mt-4" role="alert">{paymentError}</p>}
              {helpRequestMessage && <p className="mt-4" role="status">{helpRequestMessage}</p>}
              <div className="jm-password-link-card__support">
                <button
                  className="jm-btn-submit"
                  type="button"
                  onClick={requestAdminHelp}
                  disabled={helpRequestBusy || !passwordLinkEmail.trim()}
                >
                  {helpRequestBusy ? 'Sending request…' : 'Request admin help'}
                </button>
                <a href="/login" className="underline">Login</a>
                <a href="/forgot-password" className="underline">Forgot password?</a>
              </div>
            </section>
            </>
          )}
        </motion.section>
      </AnimatePresence>
    </main>
  );
}
