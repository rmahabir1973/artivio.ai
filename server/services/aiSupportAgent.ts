import OpenAI from 'openai';
import { db } from '../db';
import { supportTickets, supportMessages, users, userSubscriptions, subscriptionPlans } from '@shared/schema';
import { eq, desc, and, count } from 'drizzle-orm';
import { ServerClient } from 'postmark';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const postmarkClient = process.env.POSTMARK_SERVER_TOKEN
  ? new ServerClient(process.env.POSTMARK_SERVER_TOKEN)
  : null;

const ESCALATION_EMAIL = 'escalations@artivio.ai';
const SUPPORT_EMAIL = 'support@artivio.ai';

interface TicketAnalysis {
  category: 'billing' | 'technical' | 'account' | 'feature' | 'general' | 'urgent';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated';
  confidence: number;
  summary: string;
  suggestedResponse: string;
  shouldAutoReply: boolean;
  shouldEscalate: boolean;
  escalationReason?: string;
}

interface UserContext {
  subscriptionPlan?: string;
  credits?: number;
  memberSince?: string;
  previousTickets?: number;
  isVip?: boolean;
}

export class AISupportAgent {
  
  async getUserContext(email: string, userId?: string): Promise<UserContext> {
    try {
      let user = null;
      
      if (userId) {
        const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        user = result[0];
      } else {
        const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
        user = result[0];
      }
      
      if (!user) {
        return {};
      }
      
      const subscription = await db.select({
        plan: subscriptionPlans,
        sub: userSubscriptions
      })
        .from(userSubscriptions)
        .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
        .where(eq(userSubscriptions.userId, user.id))
        .limit(1);
      
      const ticketCount = await db.select({ count: count() })
        .from(supportTickets)
        .where(eq(supportTickets.email, email));
      
      const isVip = subscription[0]?.plan?.name === 'Business' || 
                    subscription[0]?.plan?.name === 'Professional' ||
                    (user.credits ?? 0) > 1000;
      
      return {
        subscriptionPlan: subscription[0]?.plan?.name || 'Free',
        credits: user.credits ?? 0,
        memberSince: user.createdAt?.toISOString().split('T')[0],
        previousTickets: ticketCount[0]?.count ?? 0,
        isVip,
      };
    } catch (error) {
      console.error('[AI SUPPORT] Error getting user context:', error);
      return {};
    }
  }
  
  async analyzeTicket(
    subject: string,
    message: string,
    userContext: UserContext = {}
  ): Promise<TicketAnalysis> {
    console.log('[AI SUPPORT] Analyzing ticket:', { subject, messageLength: message.length });
    
    const systemPrompt = `You are an AI support agent for Artivio AI, a platform that provides AI-powered video, image, and music generation tools. Your job is to analyze customer support requests and provide helpful, accurate responses.

PLATFORM KNOWLEDGE:
- Artivio AI offers: AI Video Generation (Veo 3.1, Runway, Kling, Sora), AI Image Generation (Seedream, Flux, Midjourney), AI Music (Suno), Voice Cloning (Fish Audio), Text-to-Speech, Video Upscaling (Topaz), and Social Media Hub
- Subscription Plans: Free Trial, Starter ($25/mo), Professional ($59/mo), Business ($129/mo)
- Credits are used for AI generations (different features cost different amounts)
- Users can buy Credit Boosts for additional credits
- Common issues: generation failures, credit questions, subscription/billing, feature requests

CUSTOMER CONTEXT:
${userContext.subscriptionPlan ? `- Plan: ${userContext.subscriptionPlan}` : '- Plan: Unknown'}
${userContext.credits !== undefined ? `- Credits: ${userContext.credits}` : ''}
${userContext.memberSince ? `- Member since: ${userContext.memberSince}` : ''}
${userContext.previousTickets !== undefined ? `- Previous tickets: ${userContext.previousTickets}` : ''}
${userContext.isVip ? '- VIP CUSTOMER - Handle with extra care!' : ''}

RESPONSE GUIDELINES:
- Be empathetic and professional
- If the issue is clear and you're confident, provide a helpful solution
- For billing issues involving refunds or disputes, escalate to human support
- For technical issues you can't diagnose remotely, offer troubleshooting steps first
- Never make promises about refunds or credits without authorization
- If the user seems very frustrated or angry, escalate

Analyze the support request and respond with a JSON object.`;

    const userPrompt = `Subject: ${subject}

Message:
${message}

Analyze this support request and respond with ONLY a valid JSON object (no markdown, no code blocks):
{
  "category": "billing" | "technical" | "account" | "feature" | "general" | "urgent",
  "priority": "low" | "medium" | "high" | "urgent",
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "confidence": 0.0-1.0,
  "summary": "Brief 1-2 sentence summary of the issue",
  "suggestedResponse": "Your helpful response to send to the customer",
  "shouldAutoReply": true/false,
  "shouldEscalate": true/false,
  "escalationReason": "Reason for escalation if needed"
}

Rules for shouldAutoReply:
- true if confidence > 0.8 AND sentiment is not "frustrated" AND category is not "billing" (unless simple billing question)
- false for complex issues, angry customers, or anything involving money

Rules for shouldEscalate:
- true for billing disputes, refund requests, angry/frustrated customers, VIP customers with issues
- true for anything you're not confident about
- false for simple questions you can answer confidently`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });
      
      const content = response.choices[0]?.message?.content || '{}';
      
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();
      
      const analysis = JSON.parse(jsonStr) as TicketAnalysis;
      
      if (userContext.isVip && analysis.sentiment === 'frustrated') {
        analysis.shouldEscalate = true;
        analysis.escalationReason = analysis.escalationReason || 'VIP customer with issue - requires immediate attention';
        analysis.priority = 'urgent';
      }
      
      console.log('[AI SUPPORT] Analysis complete:', {
        category: analysis.category,
        priority: analysis.priority,
        confidence: analysis.confidence,
        shouldAutoReply: analysis.shouldAutoReply,
        shouldEscalate: analysis.shouldEscalate
      });
      
      return analysis;
      
    } catch (error) {
      console.error('[AI SUPPORT] Error analyzing ticket:', error);
      
      return {
        category: 'general',
        priority: 'medium',
        sentiment: 'neutral',
        confidence: 0,
        summary: 'Unable to analyze ticket automatically',
        suggestedResponse: 'Thank you for contacting Artivio AI support. A team member will review your request and get back to you shortly.',
        shouldAutoReply: false,
        shouldEscalate: true,
        escalationReason: 'AI analysis failed - requires human review'
      };
    }
  }
  
  async sendAutoReply(
    ticketId: string,
    toEmail: string,
    toName: string | undefined,
    subject: string,
    response: string
  ): Promise<boolean> {
    if (!postmarkClient) {
      console.error('[AI SUPPORT] Postmark not configured - cannot send auto-reply');
      return false;
    }
    
    try {
      console.log('[AI SUPPORT] Sending auto-reply to:', toEmail);
      
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0f; color: #ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1a1a24; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff;">Artivio AI Support</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              ${toName ? `<p style="color: #ffffff; font-size: 16px; margin: 0 0 20px 0;">Hi ${toName},</p>` : ''}
              
              <div style="color: #d1d5db; font-size: 15px; line-height: 1.6;">
                ${response.split('\n').map(p => `<p style="margin: 0 0 16px 0;">${p}</p>`).join('')}
              </div>
              
              <p style="color: #d1d5db; font-size: 15px; margin: 24px 0 0 0;">
                If you have any other questions, simply reply to this email.
              </p>
              
              <p style="color: #d1d5db; font-size: 15px; margin: 24px 0 0 0;">
                Best regards,<br>
                <strong style="color: #ffffff;">Artivio AI Support Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #0a0a0f; text-align: center;">
              <p style="color: #71717a; font-size: 13px; margin: 0;">
                Ticket ID: ${ticketId}<br>
                <a href="https://artivio.ai" style="color: #9333ea; text-decoration: none;">artivio.ai</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const result = await postmarkClient.sendEmail({
        From: SUPPORT_EMAIL,
        To: toEmail,
        Subject: `Re: ${subject}`,
        HtmlBody: htmlBody,
        TextBody: `${toName ? `Hi ${toName},\n\n` : ''}${response}\n\nIf you have any other questions, simply reply to this email.\n\nBest regards,\nArtivio AI Support Team\n\nTicket ID: ${ticketId}`,
        ReplyTo: SUPPORT_EMAIL,
        MessageStream: 'outbound',
        Headers: [
          { Name: 'X-Ticket-ID', Value: ticketId }
        ]
      });
      
      console.log('[AI SUPPORT] Auto-reply sent successfully:', result.MessageID);
      
      await db.insert(supportMessages).values({
        ticketId,
        senderType: 'ai',
        senderName: 'Artivio AI Support',
        senderEmail: SUPPORT_EMAIL,
        bodyText: response,
        bodyHtml: htmlBody,
        aiGenerated: true,
        aiModel: 'gpt-4o-mini',
        postmarkMessageId: result.MessageID,
        deliveryStatus: 'sent',
        deliveredAt: new Date(),
      });
      
      return true;
      
    } catch (error) {
      console.error('[AI SUPPORT] Error sending auto-reply:', error);
      return false;
    }
  }
  
  async escalateTicket(
    ticketId: string,
    reason: string,
    originalEmail: string,
    originalName: string | undefined,
    subject: string,
    message: string,
    userContext: UserContext = {}
  ): Promise<boolean> {
    if (!postmarkClient) {
      console.error('[AI SUPPORT] Postmark not configured - cannot escalate');
      return false;
    }
    
    try {
      console.log('[AI SUPPORT] Escalating ticket to:', ESCALATION_EMAIL);
      
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #1a1a24; color: #ffffff;">
  <div style="max-width: 700px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #dc2626 0%, #f59e0b 100%); padding: 16px 24px; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 20px; color: #ffffff;">⚠️ Escalated Support Ticket</h1>
    </div>
    
    <div style="background-color: #0a0a0f; padding: 24px; border-radius: 0 0 8px 8px;">
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; color: #71717a; width: 140px;">Ticket ID:</td>
          <td style="padding: 8px 0; color: #ffffff;"><strong>${ticketId}</strong></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #71717a;">From:</td>
          <td style="padding: 8px 0; color: #ffffff;">${originalName || 'Unknown'} &lt;${originalEmail}&gt;</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #71717a;">Subject:</td>
          <td style="padding: 8px 0; color: #ffffff;">${subject}</td>
        </tr>
        ${userContext.subscriptionPlan ? `
        <tr>
          <td style="padding: 8px 0; color: #71717a;">Plan:</td>
          <td style="padding: 8px 0; color: #ffffff;">${userContext.subscriptionPlan}${userContext.isVip ? ' <span style="background: #9333ea; padding: 2px 8px; border-radius: 4px; font-size: 12px;">VIP</span>' : ''}</td>
        </tr>` : ''}
        ${userContext.credits !== undefined ? `
        <tr>
          <td style="padding: 8px 0; color: #71717a;">Credits:</td>
          <td style="padding: 8px 0; color: #ffffff;">${userContext.credits}</td>
        </tr>` : ''}
      </table>
      
      <div style="background-color: #dc2626; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">
        <strong style="color: #ffffff;">Escalation Reason:</strong>
        <p style="color: #fecaca; margin: 8px 0 0 0;">${reason}</p>
      </div>
      
      <div style="background-color: #1a1a24; padding: 16px; border-radius: 6px; border: 1px solid #27272a;">
        <strong style="color: #ffffff;">Original Message:</strong>
        <div style="color: #d1d5db; margin-top: 12px; white-space: pre-wrap;">${message}</div>
      </div>
      
      <p style="color: #71717a; font-size: 13px; margin-top: 24px;">
        Reply to this email to respond directly to the customer, or 
        <a href="https://artivio.ai/admin/support/${ticketId}" style="color: #9333ea;">view in Admin Panel</a>
      </p>
    </div>
  </div>
</body>
</html>`;

      const textBody = `ESCALATED SUPPORT TICKET

Ticket ID: ${ticketId}
From: ${originalName || 'Unknown'} <${originalEmail}>
Subject: ${subject}
${userContext.subscriptionPlan ? `Plan: ${userContext.subscriptionPlan}${userContext.isVip ? ' (VIP)' : ''}` : ''}
${userContext.credits !== undefined ? `Credits: ${userContext.credits}` : ''}

ESCALATION REASON:
${reason}

ORIGINAL MESSAGE:
${message}

---
Reply to this email to respond directly to the customer.
View in Admin Panel: https://artivio.ai/admin/support/${ticketId}`;

      const result = await postmarkClient.sendEmail({
        From: SUPPORT_EMAIL,
        To: ESCALATION_EMAIL,
        Subject: `[ESCALATED] ${subject}`,
        HtmlBody: htmlBody,
        TextBody: textBody,
        ReplyTo: originalEmail,
        MessageStream: 'outbound',
        Headers: [
          { Name: 'X-Ticket-ID', Value: ticketId },
          { Name: 'X-Original-From', Value: originalEmail }
        ]
      });
      
      console.log('[AI SUPPORT] Escalation sent successfully:', result.MessageID);
      
      await db.update(supportTickets)
        .set({
          status: 'escalated',
          escalatedAt: new Date(),
          escalatedTo: ESCALATION_EMAIL,
          escalationReason: reason,
        })
        .where(eq(supportTickets.id, ticketId));
      
      await db.insert(supportMessages).values({
        ticketId,
        senderType: 'system',
        senderName: 'System',
        bodyText: `Ticket escalated to ${ESCALATION_EMAIL}. Reason: ${reason}`,
        aiGenerated: false,
      });
      
      return true;
      
    } catch (error) {
      console.error('[AI SUPPORT] Error escalating ticket:', error);
      return false;
    }
  }
  
  async processInboundEmail(payload: PostmarkInboundPayload): Promise<{
    ticketId: string;
    action: 'auto_replied' | 'escalated' | 'created';
  }> {
    console.log('[AI SUPPORT] Processing inbound email from:', payload.From);
    
    const senderEmail = payload.From;
    const senderName = payload.FromName || undefined;
    const subject = payload.Subject || 'No Subject';
    const textBody = payload.TextBody || payload.StrippedTextReply || '';
    const htmlBody = payload.HtmlBody || undefined;
    const messageId = payload.MessageID;
    
    const existingMessage = await db.select()
      .from(supportMessages)
      .where(eq(supportMessages.postmarkMessageId, messageId))
      .limit(1);
    
    if (existingMessage.length > 0) {
      console.log('[AI SUPPORT] Duplicate message detected, skipping:', messageId);
      const ticket = await db.select()
        .from(supportTickets)
        .where(eq(supportTickets.id, existingMessage[0].ticketId))
        .limit(1);
      return { ticketId: ticket[0]?.id || existingMessage[0].ticketId, action: 'created' };
    }
    
    let existingTicket = null;
    
    const inReplyTo = payload.Headers?.find(h => h.Name === 'In-Reply-To')?.Value;
    const references = payload.Headers?.find(h => h.Name === 'References')?.Value;
    const ticketIdHeader = payload.Headers?.find(h => h.Name === 'X-Ticket-ID')?.Value;
    
    if (ticketIdHeader) {
      const result = await db.select()
        .from(supportTickets)
        .where(eq(supportTickets.id, ticketIdHeader))
        .limit(1);
      existingTicket = result[0];
    }
    
    if (!existingTicket && (inReplyTo || references)) {
      const msgIdToFind = inReplyTo || references?.split(' ')[0];
      if (msgIdToFind) {
        const msgResult = await db.select()
          .from(supportMessages)
          .where(eq(supportMessages.postmarkMessageId, msgIdToFind))
          .limit(1);
        
        if (msgResult[0]) {
          const ticketResult = await db.select()
            .from(supportTickets)
            .where(eq(supportTickets.id, msgResult[0].ticketId))
            .limit(1);
          existingTicket = ticketResult[0];
        }
      }
    }
    
    if (!existingTicket) {
      const recentTickets = await db.select()
        .from(supportTickets)
        .where(and(
          eq(supportTickets.email, senderEmail),
          eq(supportTickets.subject, subject)
        ))
        .orderBy(desc(supportTickets.createdAt))
        .limit(1);
      
      if (recentTickets[0]) {
        const hoursSinceCreated = (Date.now() - new Date(recentTickets[0].createdAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceCreated < 72) {
          existingTicket = recentTickets[0];
        }
      }
    }
    
    const userContext = await this.getUserContext(senderEmail);
    
    if (existingTicket) {
      console.log('[AI SUPPORT] Adding message to existing ticket:', existingTicket.id);
      
      await db.insert(supportMessages).values({
        ticketId: existingTicket.id,
        senderType: 'user',
        senderName,
        senderEmail,
        bodyText: textBody,
        bodyHtml: htmlBody,
        postmarkMessageId: messageId,
        inReplyTo,
      });
      
      await db.update(supportTickets)
        .set({
          status: 'open',
          lastMessageAt: new Date(),
        })
        .where(eq(supportTickets.id, existingTicket.id));
      
      const analysis = await this.analyzeTicket(subject, textBody, userContext);
      
      await db.update(supportTickets)
        .set({
          sentiment: analysis.sentiment,
          aiConfidence: analysis.confidence.toString(),
          aiSummary: analysis.summary,
          suggestedResponse: analysis.suggestedResponse,
          priority: analysis.priority,
        })
        .where(eq(supportTickets.id, existingTicket.id));
      
      if (analysis.shouldEscalate) {
        await this.escalateTicket(
          existingTicket.id,
          analysis.escalationReason || 'Follow-up message requires attention',
          senderEmail,
          senderName,
          subject,
          textBody,
          userContext
        );
        return { ticketId: existingTicket.id, action: 'escalated' };
      }
      
      if (analysis.shouldAutoReply) {
        const sent = await this.sendAutoReply(
          existingTicket.id,
          senderEmail,
          senderName,
          subject,
          analysis.suggestedResponse
        );
        return { ticketId: existingTicket.id, action: sent ? 'auto_replied' : 'created' };
      }
      
      return { ticketId: existingTicket.id, action: 'created' };
    }
    
    console.log('[AI SUPPORT] Creating new ticket');
    
    const analysis = await this.analyzeTicket(subject, textBody, userContext);
    
    const user = await db.select().from(users).where(eq(users.email, senderEmail)).limit(1);
    
    const [newTicket] = await db.insert(supportTickets).values({
      userId: user[0]?.id,
      email: senderEmail,
      name: senderName,
      subject,
      status: 'open',
      priority: analysis.priority,
      category: analysis.category,
      sentiment: analysis.sentiment,
      aiConfidence: analysis.confidence.toString(),
      aiSummary: analysis.summary,
      suggestedResponse: analysis.suggestedResponse,
      source: 'email',
      postmarkMessageId: messageId,
      userContext: userContext,
    }).returning();
    
    await db.insert(supportMessages).values({
      ticketId: newTicket.id,
      senderType: 'user',
      senderName,
      senderEmail,
      bodyText: textBody,
      bodyHtml: htmlBody,
      postmarkMessageId: messageId,
    });
    
    if (analysis.shouldEscalate) {
      await this.escalateTicket(
        newTicket.id,
        analysis.escalationReason || 'Requires human attention',
        senderEmail,
        senderName,
        subject,
        textBody,
        userContext
      );
      return { ticketId: newTicket.id, action: 'escalated' };
    }
    
    if (analysis.shouldAutoReply) {
      const sent = await this.sendAutoReply(
        newTicket.id,
        senderEmail,
        senderName,
        subject,
        analysis.suggestedResponse
      );
      return { ticketId: newTicket.id, action: sent ? 'auto_replied' : 'created' };
    }
    
    return { ticketId: newTicket.id, action: 'created' };
  }
  
  async createTicketFromApp(
    userId: string,
    email: string,
    name: string | undefined,
    subject: string,
    message: string
  ): Promise<{
    ticketId: string;
    action: 'auto_replied' | 'escalated' | 'created';
  }> {
    console.log('[AI SUPPORT] Creating ticket from app for user:', userId);
    
    const userContext = await this.getUserContext(email, userId);
    const analysis = await this.analyzeTicket(subject, message, userContext);
    
    const [newTicket] = await db.insert(supportTickets).values({
      userId,
      email,
      name,
      subject,
      status: 'open',
      priority: analysis.priority,
      category: analysis.category,
      sentiment: analysis.sentiment,
      aiConfidence: analysis.confidence.toString(),
      aiSummary: analysis.summary,
      suggestedResponse: analysis.suggestedResponse,
      source: 'app',
      userContext,
    }).returning();
    
    await db.insert(supportMessages).values({
      ticketId: newTicket.id,
      senderType: 'user',
      senderName: name,
      senderEmail: email,
      bodyText: message,
    });
    
    if (analysis.shouldEscalate) {
      await this.escalateTicket(
        newTicket.id,
        analysis.escalationReason || 'Requires human attention',
        email,
        name,
        subject,
        message,
        userContext
      );
      return { ticketId: newTicket.id, action: 'escalated' };
    }
    
    if (analysis.shouldAutoReply) {
      const sent = await this.sendAutoReply(
        newTicket.id,
        email,
        name,
        subject,
        analysis.suggestedResponse
      );
      return { ticketId: newTicket.id, action: sent ? 'auto_replied' : 'created' };
    }
    
    return { ticketId: newTicket.id, action: 'created' };
  }
}

interface PostmarkInboundPayload {
  FromName?: string;
  MessageStream?: string;
  From: string;
  FromFull?: {
    Email: string;
    Name: string;
    MailboxHash: string;
  };
  To: string;
  ToFull?: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  Cc?: string;
  CcFull?: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  Bcc?: string;
  BccFull?: Array<{
    Email: string;
    Name: string;
    MailboxHash: string;
  }>;
  Subject?: string;
  Date: string;
  MessageID: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  Tag?: string;
  Headers?: Array<{
    Name: string;
    Value: string;
  }>;
  Attachments?: Array<{
    Name: string;
    Content: string;
    ContentType: string;
    ContentLength: number;
  }>;
}

export const aiSupportAgent = new AISupportAgent();
