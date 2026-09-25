import type { Config } from "../config";

export type Mail = { to: string; subject: string; text: string; html: string };
export type Mailer = { send(mail: Mail): Promise<void> };

export function createMailer(config: Config, log: (msg: string) => void): Mailer {
  if (config.MAIL_PROVIDER === "resend") {
    return {
      async send(mail) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: config.MAIL_FROM, ...mail }),
        });
        if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
      },
    };
  }
  return {
    async send(mail) {
      log(`[mail] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    },
  };
}

/** Collects mail in memory; used by tests. */
export function createMemoryMailer() {
  const sent: Mail[] = [];
  return {
    sent,
    async send(mail: Mail) {
      sent.push(mail);
    },
  };
}

const wrap = (
  body: string,
) => `<!doctype html><html><body style="margin:0;background:#F7F4FF;font-family:Figtree,Helvetica,Arial,sans-serif;color:#16131F">
<div style="max-width:440px;margin:0 auto;padding:32px 20px">
<div style="font-weight:800;font-size:24px;letter-spacing:-0.5px;margin-bottom:20px">quad</div>
<div style="background:#fff;border:2px solid #16131F;border-radius:20px;box-shadow:4px 4px 0 #16131F;padding:24px">${body}</div>
<p style="font-size:12px;color:#5E5873;margin-top:20px">You got this email because someone entered this address on Quad. If it wasn't you, ignore it.</p>
</div></body></html>`;

export function otpMail(to: string, code: string, ttlMinutes: number): Mail {
  return {
    to,
    subject: `${code} is your Quad code`,
    text: `Your Quad code is ${code}. It expires in ${ttlMinutes} minutes. Don't share it with anyone.`,
    html: wrap(`<p style="margin:0 0 12px;font-size:16px">Here's your code:</p>
<div style="font-family:'IBM Plex Mono',Menlo,monospace;font-size:34px;font-weight:600;letter-spacing:8px;background:#D4FF3A;border:2px solid #16131F;border-radius:14px;padding:12px 16px;text-align:center">${code}</div>
<p style="margin:16px 0 0;font-size:14px;color:#5E5873">It expires in ${ttlMinutes} minutes. Don't share it with anyone, not even us.</p>`),
  };
}

export function domainApprovedMail(to: string, universityName: string, appOrigin: string): Mail {
  return {
    to,
    subject: `${universityName} is on Quad now`,
    text: `Good news: ${universityName} is on Quad now. Sign in with this email at ${appOrigin}/join`,
    html: wrap(`<p style="margin:0 0 12px;font-size:18px;font-weight:700">${escapeHtml(universityName)} is on Quad now 🎉</p>
<p style="margin:0 0 16px;font-size:15px">You can sign in with this email.</p>
<a href="${appOrigin}/join" style="display:inline-block;background:#6A45FF;color:#fff;text-decoration:none;font-weight:600;border:2px solid #16131F;border-radius:14px;padding:12px 18px">Get in →</a>`),
  };
}

export function domainRejectedMail(to: string, note: string): Mail {
  return {
    to,
    subject: "About your Quad university request",
    text: `We couldn't add your university to Quad yet. ${note}`,
    html: wrap(`<p style="margin:0 0 12px;font-size:16px">We couldn't add your university to Quad yet.</p>
<p style="margin:0;font-size:15px;color:#5E5873">${escapeHtml(note)}</p>`),
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
