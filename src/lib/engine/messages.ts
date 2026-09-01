// PayPromise AI Recovery Engine - Message Generator
// Generates personalized, professional recovery messages for each channel.

import type {
  InvoiceData,
  CustomerData,
  StrategyResult,
  GeneratedMessage,
} from './types';

// ── Public API ──────────────────────────────────────────────

export function generateRecoveryMessages(
  invoice: InvoiceData,
  customer: CustomerData,
  strategy: StrategyResult,
): GeneratedMessage[] {
  const messages: GeneratedMessage[] = [];

  // Generate messages based on the suggested channel
  // Always generate email as primary, plus the suggested channel
  const channels = new Set<string>(['email', strategy.suggestedChannel]);

  for (const channel of channels) {
    if (channel === 'email') {
      messages.push(generateEmailMessage(invoice, customer, strategy));
    } else if (channel === 'sms') {
      messages.push(generateSmsMessage(invoice, customer, strategy));
    } else if (channel === 'whatsapp') {
      messages.push(generateWhatsappMessage(invoice, customer, strategy));
    }
  }

  return messages;
}

// ── Email Message ───────────────────────────────────────────

function generateEmailMessage(
  invoice: InvoiceData,
  customer: CustomerData,
  strategy: StrategyResult,
): GeneratedMessage {
  const amount = formatAmount(invoice.amount);
  const subject = buildEmailSubject(invoice, strategy);
  const body = buildEmailBody(invoice, customer, strategy);

  return {
    channel: 'email',
    subject,
    content: body,
    tone: strategy.suggestedTone,
  };
}

function buildEmailSubject(invoice: InvoiceData, strategy: StrategyResult): string {
  switch (strategy.action) {
    case 'SEND_REMINDER':
      return `Payment Reminder: Invoice ${invoice.invoiceNumber}`;
    case 'REQUEST_PROMISE':
      return `Action Required: Invoice ${invoice.invoiceNumber} — ${formatAmount(invoice.amount)}`;
    case 'CREATE_PAYMENT_LINK':
      return `Pay Now: Invoice ${invoice.invoiceNumber} — ${formatAmount(invoice.amount)}`;
    case 'FOLLOW_UP':
      return `Following Up: Invoice ${invoice.invoiceNumber}`;
    case 'ESCALATE':
      return `Urgent: Outstanding Payment — Invoice ${invoice.invoiceNumber}`;
    default:
      return `Invoice ${invoice.invoiceNumber} — Payment Update`;
  }
}

function buildEmailBody(
  invoice: InvoiceData,
  customer: CustomerData,
  strategy: StrategyResult,
): string {
  const amount = formatAmount(invoice.amount);
  const greeting = `Dear ${customer.name},`;
  const companyLine = `We hope this message finds you well. This concerns invoice ${invoice.invoiceNumber} for ${customer.company}.`;

  switch (strategy.suggestedTone) {
    case 'friendly':
      return `${greeting}

${companyLine}

Our records show that a payment of ${amount} is currently overdue. We understand that things can get busy, and we wanted to gently bring this to your attention.

If you've already arranged for payment, please disregard this message. Otherwise, we'd appreciate it if you could process the payment at your earliest convenience.

If you have any questions or need to discuss a payment arrangement, please don't hesitate to reach out.

Best regards,
PayPromise AI Recovery System`;

    case 'firm':
      return `${greeting}

${companyLine}

We are writing to follow up on the outstanding payment of ${amount} for invoice ${invoice.invoiceNumber}. This invoice is now past its due date.

We value our business relationship and would like to resolve this promptly. Please arrange for payment or contact us to discuss a payment plan.

Timely payment will help us maintain our positive working relationship.

Regards,
PayPromise Collections`;

    case 'urgent':
      return `${greeting}

${companyLine}

This is an urgent notice regarding the outstanding payment of ${amount} for invoice ${invoice.invoiceNumber}. Despite previous communications, this payment remains unresolved.

Immediate attention is required. Please process the payment within the next 3 business days to avoid further escalation of this matter.

We strongly encourage you to resolve this at the earliest to prevent any disruption to our services.

Urgently,
PayPromise Recovery Team`;

    case 'legal':
      return `${greeting}

${companyLine}

This letter serves as formal notice regarding the unpaid invoice ${invoice.invoiceNumber} for the amount of ${amount}.

Despite multiple attempts to resolve this matter amicably, the payment remains outstanding. We are now compelled to escalate this matter through formal channels.

Immediate payment or a written payment plan is required within 7 business days to prevent further legal action.

Sincerely,
PayPromise Legal Department`;

    default:
      return `${greeting}\n\n${companyLine}\n\nPlease process the payment of ${amount} at your earliest convenience.\n\nRegards,\nPayPromise AI`;
  }
}

// ── SMS Message ─────────────────────────────────────────────

function generateSmsMessage(
  invoice: InvoiceData,
  customer: CustomerData,
  strategy: StrategyResult,
): GeneratedMessage {
  const amount = formatAmount(invoice.amount);

  let content: string;

  switch (strategy.suggestedTone) {
    case 'friendly':
      content = `Hi ${customer.name.split(' ')[0]}! Quick reminder: Invoice ${invoice.invoiceNumber} for ${amount} is overdue. Please arrange payment. Questions? Reply to this message.`;
      break;
    case 'firm':
      content = `PayPromise: Invoice ${invoice.invoiceNumber} for ${amount} is overdue. Please process payment immediately. Contact us if you need assistance.`;
      break;
    case 'urgent':
      content = `URGENT: Invoice ${invoice.invoiceNumber} for ${amount} is significantly overdue. Immediate payment required to avoid escalation. Pay now or contact us.`;
      break;
    default:
      content = `PayPromise: Invoice ${invoice.invoiceNumber} for ${amount} requires attention. Please arrange payment.`;
  }

  return {
    channel: 'sms',
    subject: null,
    content,
    tone: strategy.suggestedTone,
  };
}

// ── WhatsApp Message ────────────────────────────────────────

function generateWhatsappMessage(
  invoice: InvoiceData,
  customer: CustomerData,
  strategy: StrategyResult,
): GeneratedMessage {
  const amount = formatAmount(invoice.amount);
  const firstName = customer.name.split(' ')[0];

  let content: string;

  switch (strategy.suggestedTone) {
    case 'friendly':
      content = `Hi ${firstName} 👋\n\nJust a quick reminder about invoice ${invoice.invoiceNumber} for ${amount}. We understand things get busy!\n\nCould you please check and arrange the payment when you get a chance? Let us know if you need any help. 😊`;
      break;
    case 'firm':
      content = `Hi ${firstName},\n\nFollowing up on invoice ${invoice.invoiceNumber} for ${amount}. This payment is now overdue.\n\nPlease arrange payment at your earliest convenience. Let us know if you'd like to discuss a payment plan.`;
      break;
    case 'urgent':
      content = `Hi ${firstName}, this is an urgent follow-up regarding invoice ${invoice.invoiceNumber} for ${amount}.\n\nThis payment is significantly overdue and requires immediate attention. Please process the payment or contact us urgently to discuss next steps.`;
      break;
    default:
      content = `Hi ${firstName}, a reminder about invoice ${invoice.invoiceNumber} for ${amount}. Please arrange payment when possible.`;
  }

  return {
    channel: 'whatsapp',
    subject: null,
    content,
    tone: strategy.suggestedTone,
  };
}

// ── Helpers ─────────────────────────────────────────────────

function formatAmount(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
