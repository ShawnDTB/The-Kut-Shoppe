const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const logo = '/media/a2e8fdecb672406ba74a28a19b4063-the-kut-shoppe-llc-logo-5175fdd512c54b42b4da939b84353a-booksy.webp';

/** Email-safe tables and inline styles; plain text remains the delivery fallback. */
export function brandedAccountEmail(origin: string, subject: string, text: string, code?: string) {
  const base = new URL(origin);
  if (!['https:', 'http:'].includes(base.protocol)) throw new Error('Unsupported email origin');
  const accountUrl = escapeHtml(new URL('/account', base).href);
  const logoUrl = escapeHtml(new URL(logo, base).href);
  const title = escapeHtml(subject);
  const safeCode = code && /^\d{8}$/.test(code) ? code : undefined;
  // The plain-text alternative keeps its exact code and security guidance.
  const body = escapeHtml(safeCode ? text.replace(`code is ${safeCode}`, 'code is shown above')
    .replace(`${base.origin}/account?view=security`, 'the account security page you already have open')
    .replace(`${base.origin}/account`, 'the account page you already have open') : text);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#eeeae2;color:#24221f;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${title}. ${safeCode ? 'Your one-time code expires in 10 minutes.' : 'A secure update from The Kut Shoppe.'}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eeeae2;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;border:1px solid #d6cfbf;background:#fffdf8;">
<tr><td align="center" style="padding:28px 24px 22px;background:#111111;border-bottom:4px solid #bdab79;">
<img src="${logoUrl}" width="100" height="100" alt="The Kut Shoppe logo" style="display:block;margin:0 auto 14px;border:0;">
<p style="margin:0;color:#fffdf8;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:1.2;">The Kut Shoppe</p>
<p style="margin:10px 0 0;color:#d4c69e;font-size:11px;line-height:1.5;letter-spacing:2px;text-transform:uppercase;">Your neighborhood shop. Your account.</p></td></tr>
<tr><td style="padding:32px 28px;"><h1 style="margin:0 0 22px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;color:#171715;">${title}</h1>
${safeCode ? `<p style="margin:0 0 10px;font-size:13px;color:#555047;">YOUR ONE-TIME CODE</p><div style="padding:20px 12px;margin:0 0 22px;background:#f1ede3;border:1px solid #d6cfbf;text-align:center;font-family:Consolas,'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:5px;color:#171715;">${safeCode}</div>` : ''}
<p style="margin:0 0 26px;font-size:16px;line-height:1.7;overflow-wrap:anywhere;">${body}</p>
${safeCode ? '' : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#171715" style="border-radius:3px;"><a href="${accountUrl}" style="display:inline-block;padding:15px 22px;border:1px solid #171715;color:#fffdf8;font-size:15px;font-weight:bold;text-decoration:none;">Open your account &rarr;</a></td></tr></table>`}
<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#625d53;">For your security, we will never ask you to share a sign-in code or password by phone or message.</p></td></tr>
<tr><td style="padding:22px 28px;border-top:1px solid #ded7c8;font-size:12px;line-height:1.8;color:#625d53;"><strong style="color:#24221f;">The Kut Shoppe LLC</strong><br>518 Main St. &middot; Stroudsburg, PA 18360<br><a href="tel:+15704215887" style="color:#51472d;">570-421-5887</a> &nbsp;&middot;&nbsp; <a href="${escapeHtml(base.origin)}/privacy" style="color:#51472d;">Privacy</a><br>This is an automated account email. Need help? Call the shop.</td></tr>
</table></td></tr></table></body></html>`;
}
