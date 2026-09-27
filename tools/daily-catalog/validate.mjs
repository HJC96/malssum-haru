#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const booksFile = resolve(here, '../../web/src/i18n/books.ts');
const defaultManifest = resolve(here, 'approved-pool.json');

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

function isIsoTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
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

/** Validate shape and recorded provenance. This does not verify copyright, source accuracy, or reviewer identity. */
export function validateCatalog(manifest, books = readBibleBooks()) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['manifest must be an object'];
  }
  if (manifest.schemaVersion !== '1') errors.push('schemaVersion must be "1"');
  requireText(manifest.poolVersion, 'poolVersion', errors);
  requireText(manifest.translationId, 'translationId', errors);
  if (manifest.textLanguage !== 'ko') errors.push('textLanguage must be "ko" for the current Korean-only product');
  if (!Array.isArray(manifest.candidates) || manifest.candidates.length === 0) {
    errors.push('candidates must contain at least one approved candidate');
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

    const { candidateId, testament, reference, text, textSha256: digest, source, rightsReview, explanation } = candidate;
    if (testament !== 'OT' && testament !== 'NT') errors.push(`${path}.testament must be OT or NT`);
    else testamentCounts[testament] += 1;
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)) {
      errors.push(`${path}.reference must be an object`);
    } else {
      const { bookId, chapter, verse } = reference;
      if (typeof bookId !== 'string' || !books.has(bookId)) errors.push(`${path}.reference.bookId is not in the supported Bible catalog`);
      else if (testament && books.get(bookId) !== testament) errors.push(`${path}.reference.bookId belongs to the wrong testament`);
      if (!Number.isSafeInteger(chapter) || chapter < 1 || !Number.isSafeInteger(verse) || verse < 1) {
        errors.push(`${path}.reference must identify one positive chapter and verse`);
      }
      if (typeof bookId === 'string' && Number.isSafeInteger(chapter) && Number.isSafeInteger(verse)) {
        const referenceKey = `${manifest.translationId}:${bookId}:${chapter}:${verse}`;
        if (references.has(referenceKey)) errors.push(`${path} duplicates reference ${referenceKey}`);
        references.add(referenceKey);
        const expectedId = `${testament}:${bookId}:${chapter}:${verse}`;
        if (candidateId !== expectedId) errors.push(`${path}.candidateId must be ${expectedId}`);
      }
    }

    requireText(candidateId, `${path}.candidateId`, errors);
    if (candidateIds.has(candidateId)) errors.push(`${path}.candidateId duplicates ${candidateId}`);
    candidateIds.add(candidateId);
    requireText(text, `${path}.text`, errors);
    if (typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) {
      errors.push(`${path}.textSha256 must be a lowercase SHA-256 hex digest`);
    } else if (typeof text === 'string' && sha256(text) !== digest) {
      errors.push(`${path}.textSha256 does not match the exact UTF-8 text`);
    }

    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      errors.push(`${path}.source must record provenance`);
    } else {
      requireText(source.name, `${path}.source.name`, errors);
      validateHttpUrl(source.url, `${path}.source.url`, errors);
      if (!isIsoTimestamp(source.accessedAt)) errors.push(`${path}.source.accessedAt must be an ISO UTC timestamp`);
    }

    if (!rightsReview || typeof rightsReview !== 'object' || Array.isArray(rightsReview)) {
      errors.push(`${path}.rightsReview must record a human rights review`);
    } else {
      if (rightsReview.status !== 'approved') errors.push(`${path}.rightsReview.status must be approved before inclusion in this pool`);
      requireText(rightsReview.basis, `${path}.rightsReview.basis`, errors);
      requireText(rightsReview.reviewer, `${path}.rightsReview.reviewer`, errors);
      if (!isIsoTimestamp(rightsReview.reviewedAt)) errors.push(`${path}.rightsReview.reviewedAt must be an ISO UTC timestamp`);
      validateHttpUrl(rightsReview.evidenceUrl, `${path}.rightsReview.evidenceUrl`, errors);
    }

    if (!explanation || typeof explanation !== 'object' || Array.isArray(explanation)) {
      errors.push(`${path}.explanation must record an approved explanation`);
    } else {
      requireText(explanation.text, `${path}.explanation.text`, errors);
      if (explanation.language !== 'ko') errors.push(`${path}.explanation.language must be ko`);
      if (explanation.status !== 'approved') errors.push(`${path}.explanation.status must be approved`);
      requireText(explanation.reviewer, `${path}.explanation.reviewer`, errors);
      if (!isIsoTimestamp(explanation.reviewedAt)) errors.push(`${path}.explanation.reviewedAt must be an ISO UTC timestamp`);
    }
  });

  if (testamentCounts.OT === 0) errors.push('candidate pool must include at least one OT candidate');
  if (testamentCounts.NT === 0) errors.push('candidate pool must include at least one NT candidate');
  return errors;
}

function main() {
  const manifestPath = resolve(process.argv[2] ?? defaultManifest);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    console.error(`Cannot read JSON manifest ${manifestPath}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const errors = validateCatalog(manifest);
  if (errors.length > 0) {
    console.error(`Catalog validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Catalog structure valid: ${manifest.poolVersion} (${manifest.candidates.length} candidates).`);
  console.log('Reminder: structural validation does not verify verse accuracy, license status, source reliability, or reviewer identity.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
