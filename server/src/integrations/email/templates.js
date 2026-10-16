import { env } from '../../config/env.js';
import { appBaseUrl } from '../../utils/appUrl.js';

const dateTimeFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' });

const PLATFORM_NAME = 'NTS Real Estate System';
const DEFAULT_PRIMARY = '#002956';
const DEFAULT_SECONDARY = '#0078C8';

// Every email is sent on behalf of one real estate organization: its name,
// brand colors, contact address, and — crucially — its own slug-namespaced
// links (`/<slug>/verify-email`, `/<slug>/login`, …) are used throughout, so
// a recipient always lands on their own company's pages and never on the
// platform's. `org` is the organization record (name, slug, email,
// primaryColor, secondaryColor).
function safeColor(value, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? '') ? value : fallback;
}

export function orgUrl(org, path = '/login') {
  return `${appBaseUrl()}/${org.slug}${path}`;
}

// Shared branded shell for every transactional email — a navy header band
// (wordmark + a static pill naming the email's purpose), an eyebrow/heading/
// body, an optional details table, an optional CTA panel with a button, and
// a footer with a "need help" row + boilerplate. Every value is passed in
// pre-escaped/plain text (no HTML from user input ever reaches here) since
// none of these templates render anything other than our own copy and
// already-trusted domain data (org names, property/unit labels, dates).
function renderEmail({ org, headerLabel, eyebrow, heading, paragraphs, detailsRows, cta, disclaimer }) {
  const brandName = escapeHtml(org?.name ?? PLATFORM_NAME);
  const primary = safeColor(org?.primaryColor, DEFAULT_PRIMARY);
  const secondary = safeColor(org?.secondaryColor, DEFAULT_SECONDARY);
  const supportEmail = org?.email || env.SUPPORT_EMAIL;
  const detailsHtml = detailsRows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #E2E8F0;border-radius:8px;background:#F8FAFC;overflow:hidden;">
        ${detailsRows.map(({ label, value, valueColor }, i) => {
          const border = i === detailsRows.length - 1 ? 'none' : '1px solid #E2E8F0';
          return `
          <tr>
            <td style="padding:12px 16px;color:#64748B;font-size:11px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;border-bottom:${border};">${label}</td>
            <td style="padding:12px 16px;color:${valueColor ?? '#0F172A'};font-size:13px;font-weight:500;text-align:right;border-bottom:${border};">${value}</td>
          </tr>`;
        }).join('')}
      </table>`
    : '';

  const ctaHtml = cta
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#EAF4FB;border-radius:12px;">
        <tr><td align="center" style="padding:28px 24px;">
          <div style="width:48px;height:48px;line-height:48px;border-radius:50%;background:#FFFFFF;margin:0 auto 14px;text-align:center;">
            <span style="font-size:20px;">${cta.icon ?? '🔒'}</span>
          </div>
          <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0F172A;">${cta.heading}</p>
          <p style="margin:0 0 18px;font-size:13px;color:#64748B;">${cta.description}</p>
          <a href="${cta.href}" style="display:inline-block;background:${primary};color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:8px;">${cta.buttonText}</a>
        </td></tr>
      </table>`
    : '';

  const disclaimerHtml = disclaimer
    ? `<p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">${disclaimer}</p>`
    : '';

  const supportHtml = supportEmail
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;padding-top:20px;border-top:1px solid #E2E8F0;">
        <tr>
          <td style="vertical-align:middle;">
            <p style="margin:0;font-size:13px;font-weight:600;color:#334155;">Need help?</p>
            <p style="margin:2px 0 0;font-size:12px;color:#94A3B8;">Contact the ${brandName} team.</p>
          </td>
          <td align="right" style="vertical-align:middle;">
            <a href="mailto:${supportEmail}" style="display:inline-block;border:1px solid #CBD5E1;color:#334155;font-size:11px;font-weight:700;letter-spacing:0.4px;text-decoration:none;padding:8px 16px;border-radius:999px;">SUPPORT</a>
          </td>
        </tr>
      </table>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:${primary};padding:22px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <p style="margin:0;font-size:17px;font-weight:700;color:#FFFFFF;">${brandName}</p>
                      <p style="margin:2px 0 0;font-size:9px;font-weight:600;letter-spacing:1.5px;color:#FFFFFF;opacity:0.7;text-transform:uppercase;">Property Management</p>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="display:inline-block;border:1px solid rgba(255,255,255,0.35);color:#FFFFFF;font-size:10px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;padding:6px 12px;border-radius:999px;">${headerLabel}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${secondary};">${eyebrow}</p>
                <h1 style="margin:0 0 14px;font-size:22px;font-weight:700;color:#0F172A;">${heading}</h1>
                <p style="margin:0 0 4px;font-size:14px;color:#475569;">Hello,</p>
                ${paragraphs.map((p) => `<p style="margin:6px 0;font-size:14px;line-height:1.6;color:#475569;">${p}</p>`).join('')}
                ${detailsHtml}
                ${ctaHtml}
                ${disclaimerHtml}
                ${supportHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;">
                <p style="margin:0;font-size:11px;color:#94A3B8;text-align:center;">This is an automated email. Please do not reply to this message.</p>
                <p style="margin:4px 0 0;font-size:11px;color:#94A3B8;text-align:center;">© ${new Date().getFullYear()} ${brandName}. All rights reserved.</p>
                <p style="margin:4px 0 0;font-size:11px;color:#CBD5E1;text-align:center;font-style:italic;">Powered by ${PLATFORM_NAME}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body></html>`;
}

export function verificationEmail(token, org) {
  const url = orgUrl(org, `/verify-email?token=${token}`);
  return {
    subject: `Verify your ${org.name} account`,
    text: `Verify your email for ${org.name}: ${url} (expires in 24 hours)`,
    html: renderEmail({
      org,
      headerLabel: 'Verify Email',
      eyebrow: 'Account verification',
      heading: 'Verify your email',
      paragraphs: [`Confirm your email address to activate your ${escapeHtml(org.name)} account.`],
      detailsRows: [{ label: 'Link expires', value: '24 hours from now', valueColor: '#DC2626' }],
      cta: { icon: '✉️', heading: 'Confirm your email', description: 'One click and your account is ready to go.', href: url, buttonText: 'Verify Email' },
      disclaimer: "If you didn't create this account, you can safely ignore this email.",
    }),
  };
}

export function inviteEmail(token, { org, invitedByName, roleLabel }) {
  const url = orgUrl(org, `/set-password?token=${token}`);
  const organizationName = escapeHtml(org.name);
  const inviter = escapeHtml(invitedByName);
  return {
    subject: roleLabel ? `You've been invited to join ${org.name} as ${roleLabel}` : `You've been invited to join ${org.name}`,
    text: `${invitedByName} invited you to join ${org.name}${roleLabel ? ` as ${roleLabel}` : ''}. Set your password to activate your account: ${url} (expires in 7 days)`,
    html: renderEmail({
      org,
      headerLabel: 'Invitation',
      eyebrow: "You're invited",
      heading: `Join ${organizationName}`,
      paragraphs: [`<strong>${inviter}</strong> invited you to join <strong>${organizationName}</strong>${roleLabel ? ` as ${escapeHtml(roleLabel)}` : ''}. Click the button below, choose your password, and your account is activated.`],
      detailsRows: [
        { label: 'Organization', value: organizationName },
        ...(roleLabel ? [{ label: 'Your role', value: escapeHtml(roleLabel) }] : []),
        { label: 'Invited by', value: inviter },
        { label: 'Link expires', value: '7 days from now', valueColor: '#DC2626' },
      ],
      cta: { icon: '🔑', heading: 'Set your password', description: 'Activate your account to get started.', href: url, buttonText: 'Accept Invitation' },
      disclaimer: "If you weren't expecting this invitation, you can safely ignore this email.",
    }),
  };
}

export function inspectionScheduledEmail({ org, propertyName, unitLabel, inspectionType, inspectionDate }) {
  const formattedDate = new Date(inspectionDate).toLocaleDateString('en-US', { dateStyle: 'long' });
  const where = unitLabel ? `${propertyName} — ${unitLabel}` : propertyName;
  const typeLabel = inspectionType.replace('_', ' ');
  return {
    subject: `Upcoming inspection at ${where}`,
    text: `A ${typeLabel} inspection has been scheduled at ${where} on ${formattedDate}.`,
    html: renderEmail({
      org,
      headerLabel: 'Inspection Notice',
      eyebrow: 'Maintenance',
      heading: 'Upcoming inspection',
      paragraphs: [`A <strong>${typeLabel}</strong> inspection has been scheduled for your residence.`],
      detailsRows: [
        { label: 'Property', value: where },
        { label: 'Type', value: typeLabel },
        { label: 'Date', value: formattedDate },
      ],
      cta: { icon: '📋', heading: 'Prepare for your inspection', description: 'Please make sure the unit is accessible around this time.', href: orgUrl(org, '/login?next=/inspections'), buttonText: 'Sign in to view' },
      disclaimer: 'Contact your property manager if you have any questions or need to reschedule.',
    }),
  };
}

// Generic fallback used by notification.service.js#notify to email any
// in-app notification that doesn't already have its own richer template
// (e.g. inspection scheduling — see inspection.service.js, which sends its
// own inspectionScheduledEmail and opts out of this one via
// notify({ sendEmail: false })). Deliberately plain: it has no token/URL of
// its own, only whatever title/message the calling service already wrote
// for the in-app notification.
export function notificationEmail({ org, title, message }) {
  return {
    subject: title,
    text: message,
    html: renderEmail({
      org,
      headerLabel: 'Notification',
      eyebrow: 'Update',
      heading: title,
      paragraphs: [message],
      cta: { icon: '🔔', heading: 'View in your account', description: `Sign in to ${escapeHtml(org.name)} to see the full details.`, href: orgUrl(org, '/login?next=/notifications'), buttonText: 'View Notifications' },
    }),
  };
}

export function passwordResetEmail(token, org) {
  const url = orgUrl(org, `/reset-password?token=${token}`);
  const now = new Date();
  const expires = new Date(now.getTime() + 15 * 60 * 1000);
  return {
    subject: `Reset your ${org.name} password`,
    text: `Reset your password: ${url} (expires in 15 minutes)`,
    html: renderEmail({
      org,
      headerLabel: 'Password Reset',
      eyebrow: 'Security alert',
      heading: 'Reset your password',
      paragraphs: [`We received a request to reset the password for your ${escapeHtml(org.name)} account.`],
      detailsRows: [
        { label: 'Requested at', value: dateTimeFmt.format(now) },
        { label: 'Expires at', value: dateTimeFmt.format(expires), valueColor: '#DC2626' },
      ],
      cta: { icon: '🔒', heading: 'Secure your account', description: 'This password reset link is valid for 15 minutes only.', href: url, buttonText: 'Reset Password' },
      disclaimer: "For your security, never share this reset link with anyone. If you didn't request this, you can safely ignore this email.",
    }),
  };
}

// Sent once, immediately after a platform admin creates a new tenant
// organization — the only place a plaintext password is ever emailed in
// this app. It's a one-time system-generated bootstrap credential (see
// utils/defaultPassword.js for why it's deliberately short-lived-in-intent
// rather than policy-strength), delivered privately to the organization's
// own administrator so they can sign in and change it immediately.
export function organizationCreatedEmail({ org, adminFirstName, loginEmail, defaultPassword, loginUrl }) {
  const organizationName = escapeHtml(org.name);
  return {
    subject: `${org.name} is ready`,
    text: `Hi ${adminFirstName}, your organization "${org.name}" has been created. Sign in at ${loginUrl} with email ${loginEmail} and password ${defaultPassword}. Please change your password after signing in.`,
    html: renderEmail({
      org,
      headerLabel: 'Organization Created',
      eyebrow: `Welcome to ${organizationName}`,
      heading: `${organizationName} is ready`,
      paragraphs: [
        `Your organization, <strong>${organizationName}</strong>, has been created, and you've been set up as its administrator.`,
        'Use the credentials below to sign in for the first time — for your security, please change your password as soon as you log in.',
      ],
      detailsRows: [
        { label: 'Organization', value: organizationName },
        { label: 'Login email', value: loginEmail },
        { label: 'Temporary password', value: defaultPassword, valueColor: '#DC2626' },
      ],
      cta: { icon: '🏢', heading: 'Sign in to get started', description: 'Set up your properties, invite your team, and start managing tenants.', href: loginUrl, buttonText: 'Sign In' },
      disclaimer: "This temporary password was generated automatically and sent only to this address. If you weren't expecting this, please contact the platform administrator.",
    }),
  };
}

// renderEmail's callers above only ever pass our own copy or already-
// trusted domain data (org names, dates, property labels) — the two
// templates below are the first to interpolate raw text a member of the
// public typed into a form on the listings site, so every such value is
// escaped here first. Without this, a "message" containing e.g. `<img
// src=x onerror=...>` would render as live HTML in the recipient's inbox.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Sent to a listing's assigned agent(s) when a visitor submits the "Request
// a viewing" form on the public site (see publicInquiry.service.js).
export function listingInquiryEmail({ org, listingTitle, firstName, lastName, email, phone, message }) {
  const name = `${escapeHtml(firstName)} ${escapeHtml(lastName)}`;
  return {
    subject: `New inquiry: ${listingTitle}`,
    text: `${name} (${email}, ${phone}) is interested in ${listingTitle}:\n\n${message}`,
    html: renderEmail({
      org,
      headerLabel: 'New Inquiry',
      eyebrow: 'Listing inquiry',
      heading: listingTitle,
      paragraphs: [`<strong>${name}</strong> is interested in this listing and left the following message:`, `<em>${escapeHtml(message)}</em>`],
      detailsRows: [
        { label: 'Email', value: escapeHtml(email) },
        { label: 'Phone', value: escapeHtml(phone) },
      ],
      cta: { icon: '📩', heading: 'Reply to this lead', description: 'Reach out while the listing is still fresh on their mind.', href: `mailto:${encodeURIComponent(email)}`, buttonText: 'Reply by Email' },
    }),
  };
}

// Sent to the organization's general inbox from the public site's Contact
// page (see publicInquiry.service.js) — not tied to any specific listing.
export function generalContactEmail({ org, firstName, lastName, email, phone, message }) {
  const name = `${escapeHtml(firstName)} ${escapeHtml(lastName)}`;
  return {
    subject: `New contact form message from ${name}`,
    text: `${name} (${email}, ${phone}) sent:\n\n${message}`,
    html: renderEmail({
      org,
      headerLabel: 'Contact Form',
      eyebrow: 'Website inquiry',
      heading: 'New message from the website',
      paragraphs: [`<strong>${name}</strong> sent the following message via the public website's Contact page:`, `<em>${escapeHtml(message)}</em>`],
      detailsRows: [
        { label: 'Email', value: escapeHtml(email) },
        { label: 'Phone', value: escapeHtml(phone) },
      ],
      cta: { icon: '📩', heading: 'Reply to this message', description: 'Reach out to follow up.', href: `mailto:${encodeURIComponent(email)}`, buttonText: 'Reply by Email' },
    }),
  };
}

// ── Platform admin emails ───────────────────────────────────────────────
// Sent on behalf of the platform itself (no organization), so they carry the
// NTS Real Estate System identity and link to the platform admin console.

export function platformAdminResetEmail(token) {
  const url = `${appBaseUrl()}/platform-admin/reset-password?token=${token}`;
  const now = new Date();
  const expires = new Date(now.getTime() + 15 * 60 * 1000);
  return {
    subject: `Reset your ${PLATFORM_NAME} platform admin password`,
    text: `Reset your platform admin password: ${url} (expires in 15 minutes)`,
    html: renderEmail({
      headerLabel: 'Password Reset',
      eyebrow: 'Security alert',
      heading: 'Reset your password',
      paragraphs: [`We received a request to reset the password for your ${PLATFORM_NAME} platform admin account.`],
      detailsRows: [
        { label: 'Requested at', value: dateTimeFmt.format(now) },
        { label: 'Expires at', value: dateTimeFmt.format(expires), valueColor: '#DC2626' },
      ],
      cta: { icon: '🔒', heading: 'Secure your account', description: 'This password reset link is valid for 15 minutes only.', href: url, buttonText: 'Reset Password' },
      disclaimer: "For your security, never share this reset link with anyone. If you didn't request this, you can safely ignore this email.",
    }),
  };
}

export function platformAdminInviteEmail(token, { invitedByName }) {
  const url = `${appBaseUrl()}/platform-admin/reset-password?token=${token}`;
  const inviter = escapeHtml(invitedByName);
  return {
    subject: `You've been added as a ${PLATFORM_NAME} platform admin`,
    text: `${invitedByName} added you as a platform admin. Set your password: ${url} (expires in 7 days)`,
    html: renderEmail({
      headerLabel: 'Invitation',
      eyebrow: "You're invited",
      heading: 'Join the platform team',
      paragraphs: [`<strong>${inviter}</strong> added you as a platform administrator on ${PLATFORM_NAME}. You'll be able to create and manage the real estate companies on the platform.`],
      detailsRows: [
        { label: 'Invited by', value: inviter },
        { label: 'Link expires', value: '7 days from now', valueColor: '#DC2626' },
      ],
      cta: { icon: '🔑', heading: 'Set your password', description: 'Choose a password to activate your account.', href: url, buttonText: 'Accept Invitation' },
      disclaimer: "If you weren't expecting this invitation, you can safely ignore this email.",
    }),
  };
}

// Sent to every user when a platform admin turns maintenance mode on.
export function maintenanceEmail({ org, firstName, message, endsAt }) {
  const when = endsAt ? new Date(endsAt).toUTCString() : null;
  const note = (message || 'We are carrying out scheduled maintenance to improve the system.').trim();
  return {
    subject: `${org?.name ?? 'The system'} is under maintenance`,
    text: `Hello ${firstName ?? ''}, the system is presently under maintenance. ${note}${when ? ` Expected back: ${when}.` : ''} Thank you for your patience.`,
    html: renderEmail({
      org,
      headerLabel: 'Maintenance',
      eyebrow: 'System notice',
      heading: 'We are under maintenance',
      paragraphs: [
        `Hello ${escapeHtml(firstName ?? 'there')}, the system is presently under maintenance, so some pages may be unavailable or slow.`,
        escapeHtml(note),
        'Thank you for your patience — we will be back shortly.',
      ],
      detailsRows: when ? [{ label: 'Expected back', value: escapeHtml(when) }] : undefined,
    }),
  };
}

// Sent to the vendor a maintenance request was assigned to.
export function maintenanceAssignedVendorEmail({ org, vendor, request, propertyName, unitLabel, tenant }) {
  const rows = [
    { label: 'Request', value: escapeHtml(request.title) },
    { label: 'Priority', value: escapeHtml(request.priority) },
    { label: 'Property', value: escapeHtml(unitLabel ? `${propertyName} — ${unitLabel}` : propertyName) },
    ...(tenant ? [{ label: 'Contact', value: escapeHtml([tenant.name, tenant.phone, tenant.email].filter(Boolean).join(' · ')) }] : []),
  ];
  return {
    subject: `New maintenance job from ${org.name}: ${request.title}`,
    text: `Hello ${vendor.contactPerson || vendor.name}, a maintenance request was assigned to you at ${propertyName}: ${request.title}. ${request.description ?? ''}`,
    html: renderEmail({
      org,
      headerLabel: 'Maintenance job',
      eyebrow: 'Assigned to you',
      heading: escapeHtml(request.title),
      paragraphs: [
        `Hello ${escapeHtml(vendor.contactPerson || vendor.name)}, ${escapeHtml(org.name)} has assigned you this maintenance request.`,
        ...(request.description ? [escapeHtml(request.description)] : []),
        'Please contact the tenant to arrange a visit.',
      ],
      detailsRows: rows,
    }),
  };
}

// Sent to the tenant who reported the request, saying who will handle it.
export function maintenanceAssignedTenantEmail({ org, firstName, request, vendor }) {
  return {
    subject: `Your maintenance request is being handled: ${request.title}`,
    text: `Hello ${firstName ?? ''}, your request "${request.title}" has been assigned to ${vendor.name}${vendor.phone ? ` (${vendor.phone})` : ''}. They will contact you.`,
    html: renderEmail({
      org,
      headerLabel: 'Maintenance',
      eyebrow: 'Good news',
      heading: 'Your request has been assigned',
      paragraphs: [
        `Hello ${escapeHtml(firstName ?? 'there')}, your request <strong>${escapeHtml(request.title)}</strong> has been assigned to <strong>${escapeHtml(vendor.name)}</strong>. They will get in touch to arrange a visit.`,
      ],
      detailsRows: [
        { label: 'Handled by', value: escapeHtml(vendor.name) },
        ...(vendor.serviceType ? [{ label: 'Service', value: escapeHtml(vendor.serviceType) }] : []),
        ...(vendor.phone ? [{ label: 'Phone', value: escapeHtml(vendor.phone) }] : []),
        ...(vendor.email ? [{ label: 'Email', value: escapeHtml(vendor.email) }] : []),
      ],
    }),
  };
}
