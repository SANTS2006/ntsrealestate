# Cloudinary Security Architecture

> **Implementation status (Phase 6):** implemented and verified live against a real
> Cloudinary account — see `server/src/integrations/cloudinary/` and
> `server/src/services/document.service.js`. Two deviations from the original design
> worth noting: (1) every asset uses `type: authenticated` uniformly (no "public" category
> was implemented, e.g. for an org logo — simpler and secure-by-default; can be added as an
> explicit opt-in later); (2) signed access URLs are generated via
> `cloudinary.utils.private_download_url(...)` with an `expires_at` timestamp, which is
> available on all Cloudinary plans (unlike the separate, paid "token-based authentication"
> add-on) — confirmed live that an unsigned or tampered URL is rejected with 401. (3) Which
> entity types a document can be attached to is a pluggable resolver
> (`services/documentEntityResolver.js`); only `organization` and `user` are wired up so
> far, since those are the only entities that exist before Phase 7.

## 1. Credentials

`CLOUDINARY_API_SECRET` lives only in `server/.env`, read only by
`server/src/integrations/cloudinary/client.js`. It is never sent to the client, never logged,
never included in any API response. The client (React) only ever receives a short-lived,
scoped access URL for a specific asset it has already been authorized to see.

## 2. Upload path (mandatory flow)

```
Client (multipart/form-data, small direct fields only)
  → Express: auth middleware (who) → authz middleware (org + role + resource + permission)
  → Multer memory storage (buffer, never written to disk) with fileSize + fileCount limits
  → File validation service:
      - allow-listed extension AND declared mimetype must agree
      - magic-byte sniff (file-type) must agree with both
      - reject on any mismatch
  → Upload service builds the Cloudinary folder path server-side from trusted context only
    (organizationId from the session/JWT, entityType/entityId validated against the DB —
    never taken verbatim from client-supplied folder strings)
  → cloudinary.uploader.upload_stream(...) with resource_type inferred from validated
    content category (image / raw / video) and access_mode: 'authenticated' for sensitive
    document categories
  → documents row inserted (metadata only) inside the same DB transaction as any parent
    entity update (e.g. attaching a receipt to an expense)
  → audit_logs row: document.upload
```

Client-side/unsigned Cloudinary uploads are explicitly not used for anything the application
must trust for authorization purposes (no user ever gets Cloudinary upload credentials
directly).

## 3. Folder structure

```
real-estate/organizations/{organizationId}/{entityType}/{entityId}/{uuid}-{safeFilename}
```

`organizationId` and `entityId` are UUIDs (already low-signal, not sequential), and folder
listing is not exposed to any client — assets are only ever reached by their stored
`cloudinary_public_id`, resolved server-side after authorization. This isn't relied upon as a
security boundary by itself (see §4) — it's namespacing for operational hygiene.

## 4. Access control for sensitive documents

- Documents whose `entity_type` is sensitive (leases, tenant ID, ownership docs, financial
  receipts, inspection reports) are uploaded with Cloudinary `type: 'authenticated'`, which
  makes the raw delivery URL non-functional without a signature — even a leaked/guessed URL
  is inert.
- Download flow:

```
GET /api/v1/documents/:id/access-url
  → authenticate → authorize (org match, role/permission, ownership/assignment,
    resource-specific rule, e.g. a tenant may only fetch documents on their own lease)
  → look up documents row by id AND organization_id (404 if mismatched — see IDOR note below)
  → cloudinary.utils.private_download_url(...) or a signed, time-boxed authenticated URL
    (expires in minutes, single asset, not a directory listing)
  → audit_logs row: document.access
  → return { url, expiresAt } — never the permanent asset reference
```

- `/document/123` → `/document/124` is defended by re-running full authorization against the
  *loaded* row's `organization_id`/`entity_id` ownership on every request — there is no path
  where the numeric/UUID id alone grants access.

## 5. Deletion & replacement

- Deleting a document row triggers `cloudinary.uploader.destroy(public_id, { resource_type })`
  in the same service transaction; if the Cloudinary call fails, the DB row is marked
  `status: 'deletion_failed'` (not silently left inconsistent) and a background job
  (`server/src/jobs`) retries cleanup — never blocks the user-facing delete on Cloudinary's
  availability, and never leaves an orphan un-tracked.
- Financial-record-linked documents (receipts, signed leases) use soft-delete
  (`archived_at`) rather than immediate destruction, consistent with §53/§73 of the
  requirements — the Cloudinary asset is retained until a retention policy job purges it.

## 6. File validation limits (defaults, tunable via config)

| Category   | Max size | Allowed types                                  |
|------------|----------|--------------------------------------------------|
| Image      | 10 MB    | jpg, jpeg, png, webp                              |
| Document   | 20 MB    | pdf, docx                                         |
| Video      | 100 MB   | mp4, mov                                          |

Limits are enforced both at Multer (`limits.fileSize`) and again in the validation service
(defense in depth against a misconfigured proxy).
