export const emailUpdationTemplate = (link) => {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8" />
    <title>Email Updation Request</title>
    <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: auto; padding: 20px; }
        .btn {
        display: inline-block;
        padding: 12px 20px;
        background-color: #4CAF50;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        }
        .footer { font-size: 12px; color: #777; margin-top: 30px; }
    </style>
    </head>
    <body>
    <div class="container">
        <h2>Email Updation Request</h2>
        <p>Hello,</p>
        <p>You recently requested to update your email for your Yovo account. Click the button below to update it:</p>
        <p><a class="btn" href="${link}" target="_blank">Update Email</a></p>
        <p>Or, enter the following link in your browser:</p>
        <p><a href="${link}" target="_blank">${link}</a></p>
        <p>Your link will be valid for 15 minutes. If you didn't request email update, please ignore this email.</p>
        <p>Do not share this email or link with anyone for your account safety.</p>
        <div class="footer">
            <p>Best regards,</p>
            <p>Yovo</p>
        </div>
    </div>
    </body>
    </html>`
}

export const passwordResetTemplate = (link) => {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8" />
    <title>Reset Your Password</title>
    <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: auto; padding: 20px; }
        .btn {
        display: inline-block;
        padding: 12px 20px;
        background-color: #4CAF50;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        }
        .footer { font-size: 12px; color: #777; margin-top: 30px; }
    </style>
    </head>
    <body>
    <div class="container">
        <h2>Password Reset Request</h2>
        <p>Hello,</p>
        <p>You recently requested to reset your password for your Yovo account. Click the button below to reset it:</p>
        <p><a class="btn" href="${link}" target="_blank">Reset Password</a></p>
        <p>Or, enter the following link in your browser:</p>
        <p><a href="${link}" target="_blank">${link}</a></p>
        <p>Your link will be valid for 15 minutes. If you didn't request a password reset, please ignore this email.</p>
        <p>Do not share this email or link with anyone for your account safety.</p>
        <div class="footer">
            <p>Best regards,</p>
            <p>Yovo</p>
        </div>
    </div>
    </body>
    </html>`
}

export const accountDeletionTemplate = (otp) => {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8" />
    <title>Delete Your Account</title>
    <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: auto; padding: 20px; }
        .footer { font-size: 12px; color: #777; margin-top: 30px; }
        .bigFont { font-size: 22px }
    </style>
    </head>
    <body>
    <div class="container">
        <h2>Account Deletion Request</h2>
        <p>Hello,</p>
        <p>You recently requested to delete your account permanently. By proceeding with this action you will lose all your progress.</p>
        <p>Your One-Time-Password is: </p>
        <p class="bigFont">${otp}</p>
        <p>This will only valid upto 15 minutes.</p>
        <p>Do not share this OTP with anyone for your account safety.</p>
        <p>If you didn’t request an account deletion, you can safely ignore this email.</p>
        <div class="footer">
            <p>We respects your decision and we are sorry to see you go.</p>
            <p>Best regards,</p>
            <p>Yovo</p>
        </div>
    </div>
    </body>
    </html>`
}

export const feedbackFormTemplate = (name, email, category, subject, message) => {
    return `
    <!doctype html>
    <html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>
        /* Simple, email-safe styles */
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; background:#f4f6f8; margin:0; padding:24px; }
        .container { max-width:680px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 6px 18px rgba(18,38,63,0.08); }
        .header { background:#0f1724; color:#fff; padding:18px 24px; }
        .title { font-size:18px; margin:0; line-height:1.2; }
        .subtitle { font-size:13px; opacity:0.85; margin-top:6px; }
        .body { padding:22px; color:#0b1220; font-size:15px; line-height:1.45; }
        .row { display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
        .label { min-width:120px; font-weight:600; color:#334155; }
        .value { flex:1; word-break:break-word; }
        .message-box { background:#f8fafc; padding:12px; border-radius:6px; border:1px solid #e6eef6; white-space:pre-wrap; }
        .meta { font-size:12px; color:#94a3b8; }
        @media (max-width:520px) {
            .label { min-width:100px; }
        }
        </style>
    </head>
    <body>
        <div class="container" role="article" aria-label="User feedback">
        <div class="header">
            <p class="title">New user feedback received</p>
            <p class="subtitle">A user submitted the feedback form on your site &lt;Yovo&gt;</p>
        </div>

        <div class="body">
            <div class="row">
            <div class="label">Name</div>
            <div class="value">${name}</div>
            </div>

            <div class="row">
            <div class="label">Email</div>
            <div class="value"><a href="mailto:${email}">${email}</a></div>
            </div>

            <div class="row">
            <div class="label">Category</div>
            <div class="value">${category}</div>
            </div>

            <div class="row">
            <div class="label">Subject</div>
            <div class="value">${subject}</div>
            </div>

            <div style="margin-top:12px;">
            <div class="label" style="margin-bottom:8px; font-weight:700;">Message</div>
            <div class="message-box">${message || "<i>No message provided</i>"}</div>
            </div>

            <div style="margin-top:18px;" class="meta">
            <div>Received on: ${new Date().toLocaleString()}</div>
            </div>
        </div>
        </div>
    </body>
    </html>
  `
}

