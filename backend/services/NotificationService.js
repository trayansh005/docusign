import nodemailer from "nodemailer";
import "dotenv/config";

/**
 * Send email notification to document recipients
 */
export const sendDocumentNotification = async ({
	recipientEmail,
	recipientName,
	senderName,
	documentName,
	subject,
	body,
	documentUrl,
}) => {
	try {
		// Skip if no email configured or no recipient email
		if (!recipientEmail || !process.env.EMAIL_USER) {
			console.log("Email not configured or no recipient email, skipping notification");
			return { success: false, message: "Email not configured" };
		}

		// Create transporter
		const transporter = nodemailer.createTransport({
			service: process.env.EMAIL_SERVICE || "gmail",
			auth: {
				user: process.env.EMAIL_USER,
				pass: process.env.EMAIL_PASSWORD,
			},
		});

		// Email content
		const emailSubject =
			subject || `${senderName} has sent you a document to sign: ${documentName}`;
		const emailBody = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
        .message-box { background: white; padding: 20px; border-left: 4px solid #3b82f6; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📝 Document Signature Request</h1>
        </div>
        <div class="content">
            <p>Hi ${recipientName},</p>
            
            <p><strong>${senderName}</strong> has sent you a document that requires your signature.</p>
            
            <p><strong>Document:</strong> ${documentName}</p>
            
            ${
							body
								? `
                <div class="message-box">
                    <p><strong>Message from sender:</strong></p>
                    <p>${body.replace(/\n/g, "<br>")}</p>
                </div>
            `
								: ""
						}
            
            <p>Please review and sign the document by clicking the button below:</p>
            
            <div style="text-align: center;">
                <a href="${documentUrl}" class="button">View & Sign Document</a>
            </div>
            
            <p style="margin-top: 30px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3b82f6;">${documentUrl}</p>
            
            <div class="footer">
                <p>This is an automated message from the Document Signing System.</p>
                <p>Please do not reply to this email.</p>
            </div>
        </div>
    </div>
</body>
</html>
        `;

		// Send email
		const info = await transporter.sendMail({
			from: `"Document Signing" <${process.env.EMAIL_USER}>`,
			to: recipientEmail,
			subject: emailSubject,
			html: emailBody,
		});

		console.log(`Notification email sent to ${recipientEmail}: ${info.messageId}`);
		return { success: true, messageId: info.messageId };
	} catch (error) {
		console.error("Error sending notification email:", error);
		return { success: false, message: error.message };
	}
};

/**
 * Notify all recipients of a document
 */
export const notifyAllRecipients = async ({
	template,
	senderName,
	appBaseUrl = "http://localhost:3000",
}) => {
	if (!template.recipients || template.recipients.length === 0) {
		console.log("No recipients to notify");
		return { success: true, notified: 0 };
	}

	const results = [];
	for (const recipient of template.recipients) {
		if (!recipient.email) {
			console.log(`Skipping recipient ${recipient.name} - no email`);
			continue;
		}

		// Generate document URL - use the fomiqsign dashboard
		const documentUrl = `${appBaseUrl}/fomiqsign/dashboard?templateId=${template._id}`;

		const result = await sendDocumentNotification({
			recipientEmail: recipient.email,
			recipientName: recipient.name,
			senderName: senderName,
			documentName: template.name,
			subject: template.message?.subject,
			body: template.message?.body,
			documentUrl: documentUrl,
		});

		results.push({
			recipient: recipient.name,
			email: recipient.email,
			...result,
		});
	}

	const successCount = results.filter((r) => r.success).length;
	console.log(`Notified ${successCount} out of ${results.length} recipients`);

	return {
		success: true,
		notified: successCount,
		failed: results.length - successCount,
		results: results,
	};
};
