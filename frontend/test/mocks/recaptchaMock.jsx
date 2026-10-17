import React from 'react';

// This fake checkbox-like button keeps captcha-dependent forms fully offline.
export default function ReCAPTCHAMock({ sitekey, onChange }) {
  return (
    <button type="button" aria-label={`Verify captcha (${sitekey})`} onClick={() => onChange('jest-captcha-token')}>
      Verify test captcha
    </button>
  );
}
