#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const booksFile = resolve(here, '../../web/src/i18n/books.ts');
const defaultManifest = resolve(here, '../../services/daily-content/src/main/resources/catalog/candidate-catalog-v1.json');

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function readBibleBooks(path = booksFile) {
  const source = readFileSync(path, 'utf8');
  const books = new Map();
  for (const match of source.matchAll(/\{\s*bookId:\s*'([A-Z0-9]{3})',\s*testament:\s*'(OT|NT)'/g)) {
    books.set(match[1], match[2]);
  }
  if (books.size !== 66) {
    throw new Error(`Expected 66 book IDs in ${path}; found ${books.size}. Update the catalog parser if the source format changed.`);
  }
  return books;
}

function requireText(value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} must be a non-empty string`);
}

function validateHttpUrl(value, label, errors) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') errors.push(`${label} must use HTTP(S)`);
  } catch {
    errors.push(`${label} must be an absolute HTTP(S) URL`);
  }
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

/** Validate shape and recorded provenance. This does not verify copyright, source accuracy, or reviewer identity. */
export function validateCatalog(manifest, books = readBibleBooks(), { requireApproved = false } = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['manifest must be an object'];
  }
  requireText(manifest.catalogVersion, 'catalogVersion', errors);
  requireText(manifest.translationId, 'translationId', errors);
  if (manifest.translationLanguage !== 'ko') errors.push('translationLanguage must be "ko" for the current Korean-only product');
  if (!Array.isArray(manifest.candidates) || manifest.candidates.length === 0) {
    errors.push('candidates must contain at least one candidate');
    return errors;
  }

  const candidateIds = new Set();
  const references = new Set();
  const testamentCounts = { OT: 0, NT: 0 };

  manifest.candidates.forEach((candidate, index) => {
    const path = `candidates[${index}]`;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      errors.push(`${path} must be an object`);
      return;
    }

    const { id, testament, reference, text, source, approval, explanation } = candidate;
    const testamentCode = testament === 'oldTestament' ? 'OT' : testament === 'newTestament' ? 'NT' : null;
    if (!testamentCode) errors.push(`${path}.testament must be oldTestament or newTestament`);
    else testamentCounts[testamentCode] += 1;
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)) {
      errors.push(`${path}.reference must be an object`);
    } else {
      const { bookId, chapter, verse } = reference;
      if (typeof bookId !== 'string' || !books.has(bookId)) errors.push(`${path}.reference.bookId is not in the supported Bible catalog`);
      else if (testamentCode && books.get(bookId) !== testamentCode) errors.push(`${path}.reference.bookId belongs to the wrong testament`);
      if (!Number.isSafeInteger(chapter) || chapter < 1 || !Number.isSafeInteger(verse) || verse < 1) {
        errors.push(`${path}.reference must identify one positive chapter and verse`);
      }
      if (typeof bookId === 'string' && Number.isSafeInteger(chapter) && Number.isSafeInteger(verse)) {
        const referenceKey = `${manifest.translationId}:${bookId}:${chapter}:${verse}`;
        if (references.has(referenceKey)) errors.push(`${path} duplicates reference ${referenceKey}`);
        references.add(referenceKey);
        const expectedId = `${testamentCode === 'OT' ? 'ot' : 'nt'}-${bookId.toLowerCase()}-${chapter}-${verse}`;
        if (id !== expectedId) {
          errors.push(`${path}.id must be ${expectedId}`);
        }
      }
    }

    requireText(id, `${path}.id`, errors);
    if (candidateIds.has(id)) errors.push(`${path}.id duplicates ${id}`);
    candidateIds.add(id);
    requireText(text, `${path}.text`, errors);
    const digest = source?.textSha256;
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) {
      errors.push(`${path}.source.textSha256 must be a lowercase SHA-256 hex digest`);
    } else if (typeof text === 'string' && sha256(text) !== digest) {
      errors.push(`${path}.source.textSha256 does not match the exact UTF-8 text`);
    }

    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      errors.push(`${path}.source must record provenance`);
    } else {
      requireText(source.name, `${path}.source.name`, errors);
      validateHttpUrl(source.url, `${path}.source.url`, errors);
    }

    const approvalStatuses = ['pending', 'approved', 'rejected'];
    if (!approval || typeof approval !== 'object' || Array.isArray(approval)) {
      errors.push(`${path}.approval must record explicit human review states`);
    } else {
      for (const key of ['textStatus', 'explanationStatus', 'rightsStatus']) {
        if (!approvalStatuses.includes(approval[key])) errors.push(`${path}.approval.${key} must be pending, approved, or rejected`);
      }
      if (requireApproved && [approval.textStatus, approval.explanationStatus, approval.rightsStatus].some((status) => status !== 'approved')) {
        errors.push(`${path}.approval must be fully approved before publication`);
      }
      const fullyApproved = [approval.textStatus, approval.explanationStatus, approval.rightsStatus].every((status) => status === 'approved');
      if (fullyApproved) {
        requireText(approval.reviewedBy, `${path}.approval.reviewedBy`, errors);
        if (!validDate(approval.reviewedAt)) errors.push(`${path}.approval.reviewedAt must be an ISO date`);
      }
      if (approval.rightsEvidenceUrl) validateHttpUrl(approval.rightsEvidenceUrl, `${path}.approval.rightsEvidenceUrl`, errors);
    }

    if (!explanation || typeof explanation !== 'object' || Array.isArray(explanation)) {
      errors.push(`${path}.explanation must record an approved explanation`);
    } else {
      requireText(explanation.text, `${path}.explanation.text`, errors);
      if (explanation.language !== 'ko') errors.push(`${path}.explanation.language must be ko`);
    }
  });

  if (testamentCounts.OT === 0) errors.push('candidate pool must include at least one OT candidate');
  if (testamentCounts.NT === 0) errors.push('candidate pool must include at least one NT candidate');
  return errors;
}

function main() {
  const requireApproved = process.argv.includes('--require-approved');
  const manifestArgument = process.argv.slice(2).find((argument) => argument !== '--require-approved');
  const manifestPath = resolve(manifestArgument ?? defaultManifest);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    console.error(`Cannot read JSON manifest ${manifestPath}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const errors = validateCatalog(manifest, readBibleBooks(), { requireApproved });
  if (errors.length > 0) {
    console.error(`Catalog validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Catalog structure valid: ${manifest.catalogVersion} (${manifest.candidates.length} candidates).`);
  console.log('Reminder: structural validation does not verify verse accuracy, license status, source reliability, or reviewer identity.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
