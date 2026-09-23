# External Calc — Trusted Input Ingestion V0

Status: IMPLEMENTATION SLICE
Date: 2026-09-22

## Purpose
Create the missing trusted boundary between an authenticated store user uploading a supplier list and the existing C01 review-candidate runtime.

This layer MUST NOT interpret products, prices, colors, storage or commercial meaning. It preserves source evidence and returns server-owned immutable references.

## Flow
authenticated upload → tenant binding → validation → immutable source persistence → trusted_input_ref → existing C01 candidate runtime → Review → persisted C01.

## Accepted containers
V0 accepts a single supported source file or a .zip container. ZIP is transport only: every eligible member becomes an independently addressable immutable source while the original archive is also retained for provenance.

The browser never creates trusted_input_ref.

## ZIP safety
- reject encrypted archives in V0;
- reject absolute paths and traversal (..);
- reject symlinks and executable/script members;
- cap compressed upload size, uncompressed aggregate size, member count and per-member size;
- reject suspicious compression ratios (ZIP bomb);
- inspect actual member type/signature where applicable rather than trusting extension alone;
- unsupported members are reported explicitly and never silently interpreted;
- nested archives are rejected in V0.

## Authority
tenant_id, actor_ref, source_id, trusted_input_ref, hashes and persisted_at are server-owned.
Client supplies source bytes plus descriptive filename/content type only.
The ingestion service does not call C02-C05 and does not contain Interpreter domain rules.

## Output
A successful ingestion returns:
- ingestion_id
- original_source reference/hash
- one or more trusted_input_ref values
- accepted/rejected member manifest
- status

The next stage consumes trusted_input_ref through the existing trustedInputResolver boundary.

## Gate
PASS requires proof that:
1. tenant A cannot resolve tenant B source;
2. references are immutable/content-addressed or equivalently integrity-bound;
3. raw original is recoverable for audit;
4. valid single file succeeds;
5. valid ZIP with multiple supported members succeeds;
6. traversal, executable, nested ZIP, encrypted ZIP and ZIP-bomb fixtures fail closed;
7. no Interpreter/C01-C05 business semantics are duplicated here;
8. the existing candidate runtime consumes the produced reference without fixture substitution.
