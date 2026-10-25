import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from '../utils/logger.js';

export const currentTermsVersion = 'v1';
export const termsEffectiveFrom = '2026-10-20';
export const termsLanguages = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
  { code: 'gu', label: 'ગુજરાતી' },
];
export const termsKeyPoints = [
  'This is a long-term lifestyle membership for curated experiences in resorts, wellness, vegetarian dining, entertainment and events.',
  'This is not a sale of property and not an investment product.',
  'Points are notional points, redeemed as set out in the points system section of the agreement.',
  'Membership payments are non-refundable, subject to the agreement and applicable law.',
  'The AMC is the annual maintenance charge payable for your membership, as described in the agreement.',
];
const backendDirectory = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
export const termsDirectory = path.resolve(
  process.env.TERMS_DIR?.trim() || path.join(backendDirectory, 'terms'),
);

let currentManifest;

export async function buildTermsManifest(directory = termsDirectory) {
  const versionDirectory = path.resolve(directory, currentTermsVersion);
  let fileNames = [];
  try {
    fileNames = await readdir(versionDirectory);
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
  }

  const availableFiles = new Set(fileNames);
  const languages = [];
  const missingFiles = [];

  for (const { code, label } of termsLanguages) {
    const htmlFile = `${code}.html`;
    const pdfFile = `${code}.pdf`;
    const hasHtml = availableFiles.has(htmlFile);
    const hasPdf = availableFiles.has(pdfFile);

    if (!hasHtml) missingFiles.push(htmlFile);
    if (!hasPdf) missingFiles.push(pdfFile);
    if (!hasHtml && !hasPdf) continue;

    const [html, pdf] = await Promise.all([
      hasHtml ? readFile(path.join(versionDirectory, htmlFile)) : null,
      hasPdf ? readFile(path.join(versionDirectory, pdfFile)) : null,
    ]);
    const htmlSha256 = html ? createHash('sha256').update(html).digest('hex') : null;
    const pdfSha256 = pdf ? createHash('sha256').update(pdf).digest('hex') : null;

    if (html) {
      const sectionIds = [...html.toString('utf8').matchAll(/<h[1-6]\b[^>]*\bid=["']s(\d{1,2})["'][^>]*>/gi)]
        .map((match) => Number(match[1]));
      if (sectionIds.length !== 21 || sectionIds.some((id, index) => id !== index + 1)) {
        throw new Error(`Membership terms HTML for "${code}" must contain section ids s1 through s21 in order.`);
      }
    }

    languages.push({
      code,
      label,
      pdfUrl: hasPdf ? `/terms/${currentTermsVersion}/${pdfFile}` : null,
      htmlUrl: hasHtml ? `/terms/${currentTermsVersion}/${htmlFile}` : null,
      sha256: htmlSha256 || pdfSha256,
      pdfSha256,
    });
  }

  if (missingFiles.length) {
    logger.warn(`Membership terms directory "${versionDirectory}" is missing files: ${missingFiles.join(', ')}.`);
  }

  return {
    version: currentTermsVersion,
    effectiveFrom: termsEffectiveFrom,
    languages,
    keyPoints: [...termsKeyPoints],
  };
}

export async function initializeTermsManifest(directory = termsDirectory) {
  currentManifest = await buildTermsManifest(directory);
  return currentManifest;
}

export async function getCurrentTermsManifest(directory) {
  if (directory === undefined && currentManifest) return currentManifest;
  const targetDirectory = directory || termsDirectory;
  currentManifest = await buildTermsManifest(targetDirectory);
  return currentManifest;
}
