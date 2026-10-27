import { z } from 'zod';

function isFutureDate(value) {
  const date = new Date(value);
  const today = new Date();
  date.setUTCHours(0, 0, 0, 0);
  today.setUTCHours(0, 0, 0, 0);
  return date > today;
}

export const optionalAnniversaryDateSchema = z.preprocess(
  (value) => value === '' || value === null ? undefined : value,
  z.coerce.date().optional().refine(
    (value) => value === undefined || !isFutureDate(value),
    'Anniversary date cannot be in the future.',
  ),
);

export function validateFamilyAnniversary(member, context) {
  const anniversaryDate = member.anniversaryDate;
  if (!anniversaryDate) return;

  const relation = String(member.relation || member.relationship || member.memberType || '')
    .trim().toLowerCase();
  if (!['spouse', 'wife', 'husband', 'father', 'mother'].includes(relation)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['anniversaryDate'],
      message: 'Anniversary date is only available for a spouse or parent.',
    });
  }

  const dateOfBirth = member.dateOfBirth || member.dob;
  if (!dateOfBirth) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dateOfBirth'],
      message: 'Date of birth is required when an anniversary date is provided.',
    });
  } else if (new Date(anniversaryDate).setUTCHours(0, 0, 0, 0)
    <= new Date(dateOfBirth).setUTCHours(0, 0, 0, 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['anniversaryDate'],
      message: 'Anniversary date must be after the family member’s date of birth.',
    });
  }
}
