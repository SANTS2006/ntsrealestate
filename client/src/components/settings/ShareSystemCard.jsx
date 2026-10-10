import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Download, Share2, Mail, MessageCircle, Send, Link2, Smartphone, Code2 } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { useBranding } from '../../contexts/BrandingContext.jsx';

function download(filename, href) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function CopyField({ label, value, multiline = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked — the text stays selectable for a manual copy.
    }
  };
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div className="mt-1.5 flex items-start gap-2">
        {multiline ? (
          <textarea readOnly value={value} rows={3} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 resize-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
        ) : (
          <input readOnly value={value} onFocus={(e) => e.target.select()} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
        )}
        <Button variant="secondary" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

// The company's own link into its real estate system, ready to put on a
// website or share: the link itself, a QR code (download as PNG or SVG), an
// embeddable button, and one-tap sharing to the social platforms.
export function ShareSystemCard() {
  const { branding } = useBranding();
  const slug = branding.slug;
  const name = branding.name;
  const link = slug ? `${window.location.origin}/${slug}/login` : '';
  const [qrPng, setQrPng] = useState(null);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!link) return;
    QRCode.toDataURL(link, { width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQrPng)
      .catch(() => setQrPng(null));
  }, [link]);

  const downloadSvg = async () => {
    const svg = await QRCode.toString(link, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    download(`${slug}-qr.svg`, url);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const message = `Access ${name}'s property management portal: ${link}`;
  const enc = encodeURIComponent;
  const targets = useMemo(() => [
    { label: 'WhatsApp', icon: MessageCircle, href: `https://wa.me/?text=${enc(message)}` },
    { label: 'Facebook', icon: Share2, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}` },
    { label: 'X (Twitter)', icon: Share2, href: `https://twitter.com/intent/tweet?text=${enc(`Access ${name}'s portal`)}&url=${enc(link)}` },
    { label: 'LinkedIn', icon: Share2, href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(link)}` },
    { label: 'Telegram', icon: Send, href: `https://t.me/share/url?url=${enc(link)}&text=${enc(`Access ${name}'s portal`)}` },
    { label: 'Messenger', icon: MessageCircle, href: `https://www.facebook.com/dialog/send?link=${enc(link)}&redirect_uri=${enc(link)}` },
    { label: 'Reddit', icon: Share2, href: `https://www.reddit.com/submit?url=${enc(link)}&title=${enc(`${name} portal`)}` },
    { label: 'Pinterest', icon: Share2, href: `https://pinterest.com/pin/create/button/?url=${enc(link)}&description=${enc(`${name} portal`)}` },
    { label: 'Email', icon: Mail, href: `mailto:?subject=${enc(`${name} portal`)}&body=${enc(message)}` },
    { label: 'SMS', icon: Smartphone, href: `sms:?&body=${enc(message)}` },
  ], [link, message, name]);

  const buttonSnippet = `<a href="${link}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;border-radius:8px;font-family:sans-serif;font-weight:600;text-decoration:none">Sign in to ${name}</a>`;
  const linkSnippet = `<a href="${link}">${name} portal</a>`;

  if (!slug) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Your system link</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Where your tenants, owners and agents sign in to {name}.</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-5">
          <CopyField label="Link" value={link} />
          <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700">
            {qrPng ? <img src={qrPng} alt={`QR code that opens ${link}`} width={220} height={220} className="h-[220px] w-[220px]" /> : <div className="h-[220px] w-[220px] animate-pulse rounded bg-slate-100" />}
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" size="sm" disabled={!qrPng} onClick={() => download(`${slug}-qr.png`, qrPng)}><Download size={14} aria-hidden="true" />PNG</Button>
              <Button variant="secondary" size="sm" onClick={downloadSvg}><Download size={14} aria-hidden="true" />SVG</Button>
            </div>
            <p className="text-center text-xs text-slate-500">Print it, or add it to your website, brochures and signage.</p>
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Share2 size={15} aria-hidden="true" />Share</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {canNativeShare && (
                <Button onClick={() => navigator.share({ title: name, text: message, url: link }).catch(() => {})}>
                  <Share2 size={15} aria-hidden="true" />Share…
                </Button>
              )}
              {targets.map((t) => (
                <a key={t.label} href={t.href} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                  <t.icon size={14} aria-hidden="true" />{t.label}
                </a>
              ))}
            </div>
            <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Link2 size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              For Instagram, TikTok, Snapchat and similar apps, copy the link above (or use Share… on your phone) and paste it into your bio or a message.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><Code2 size={15} aria-hidden="true" />Add it to your website</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Paste into your site&apos;s HTML so visitors can open your system.</p>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <CopyField label="Sign-in button" value={buttonSnippet} multiline />
            <CopyField label="Plain link" value={linkSnippet} multiline />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
