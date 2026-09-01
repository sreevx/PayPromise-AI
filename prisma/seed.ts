import { PrismaClient } from '@prisma/client';
import { analyzeInvoice, formatAnalysisForStorage, formatAIActionForStorage } from '../src/lib/engine';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding PayPromise AI demo data...\n');

  // Clean existing data
  await prisma.aIAction.deleteMany();
  await prisma.recoveryAnalysis.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.paymentLink.deleteMany();
  await prisma.recoveryMessage.deleteMany();
  await prisma.promiseToPay.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.revenueMetrics.deleteMany();

  // --- Customers (with natural risk distribution) ---
  const customers = await Promise.all([
    // 0: LOW RISK: Reliable customers
    prisma.customer.create({
      data: {
        name: 'Neha Gupta', email: 'neha@precision.in', company: 'Precision Manufacturing',
        phone: '+91 32109 87654', gstNumber: '07GGGCT3344L1Z9', address: 'Udyog Vihar, Gurugram, Haryana',
        riskScore: 0.15, avgDaysToPay: 10, totalPaid: 3500000, totalDue: 0, paymentCount: 48, latePayments: 1,
      },
    }),
    // 1: LOW RISK
    prisma.customer.create({
      data: {
        name: 'Vikram Singh', email: 'vikram@blueocean.in', company: 'BlueOcean Logistics',
        phone: '+91 65432 10987', gstNumber: '09DDDCT3456I1Z1', address: 'Noida Sector 62, Uttar Pradesh',
        riskScore: 0.22, avgDaysToPay: 12, totalPaid: 2100000, totalDue: 95000, paymentCount: 35, latePayments: 2,
      },
    }),
    // 2: MEDIUM RISK
    prisma.customer.create({
      data: {
        name: 'Rajesh Patel', email: 'rajesh@greenleaf.co.in', company: 'GreenLeaf Organics',
        phone: '+91 87654 32109', gstNumber: '24BBBCT5678G1Z2', address: 'SG Highway, Ahmedabad, Gujarat',
        riskScore: 0.48, avgDaysToPay: 22, totalPaid: 1200000, totalDue: 180000, paymentCount: 20, latePayments: 6,
      },
    }),
    // 3: MEDIUM RISK
    prisma.customer.create({
      data: {
        name: 'Sanjay Kulkarni', email: 'sanjay@quantum.in', company: 'Quantum Analytics',
        phone: '+91 21098 76543', gstNumber: '27HHHCT5566M1Z3', address: 'Pune Hinjewadi, Maharashtra',
        riskScore: 0.55, avgDaysToPay: 28, totalPaid: 920000, totalDue: 380000, paymentCount: 14, latePayments: 6,
      },
    }),
    // 4: MEDIUM RISK
    prisma.customer.create({
      data: {
        name: 'Priya Sharma', email: 'priya.sharma@techvista.in', company: 'TechVista Solutions Pvt Ltd',
        phone: '+91 98765 43210', gstNumber: '27AABCT1234F1Z5', address: 'Andheri East, Mumbai, Maharashtra',
        riskScore: 0.62, avgDaysToPay: 30, totalPaid: 850000, totalDue: 320000, paymentCount: 12, latePayments: 5,
      },
    }),
    // 5: MEDIUM RISK
    prisma.customer.create({
      data: {
        name: 'Meera Joshi', email: 'meera@skyline.co.in', company: 'Skyline Interiors',
        phone: '+91 54321 09876', gstNumber: '06EEECT7890J1Z4', address: 'Koramangala, Bengaluru, Karnataka',
        riskScore: 0.68, avgDaysToPay: 25, totalPaid: 780000, totalDue: 245000, paymentCount: 15, latePayments: 6,
      },
    }),
    // 6: HIGH RISK
    prisma.customer.create({
      data: {
        name: 'Ananya Reddy', email: 'ananya@codecraft.in', company: 'CodeCraft Technologies',
        phone: '+91 76543 21098', gstNumber: '36CCCCT9012H1Z8', address: 'HITEC City, Hyderabad, Telangana',
        riskScore: 0.92, avgDaysToPay: 55, totalPaid: 200000, totalDue: 600000, paymentCount: 10, latePayments: 9,
      },
    }),
    // 7: HIGH RISK
    prisma.customer.create({
      data: {
        name: 'Arjun Mehta', email: 'arjun@freshbrew.in', company: 'FreshBrew Beverages',
        phone: '+91 43210 98765', gstNumber: '29FFFCT1122K1Z7', address: 'Indiranagar, Bengaluru, Karnataka',
        riskScore: 0.95, avgDaysToPay: 70, totalPaid: 150000, totalDue: 750000, paymentCount: 8, latePayments: 7,
      },
    }),
    // 8: EXTREME HIGH RISK
    prisma.customer.create({
      data: {
        name: 'Deepak Verma', email: 'deepak@stalledtech.in', company: 'StalledTech Solutions',
        phone: '+91 11223 34455', gstNumber: '07ZZZCT9999Z1Z0', address: 'Sector 5, Noida, UP',
        riskScore: 0.97, avgDaysToPay: 80, totalPaid: 50000, totalDue: 850000, paymentCount: 5, latePayments: 5,
      },
    }),
    // 9: HERO SCENARIO - MEDIUM-HIGH RISK
    // Rahul Mehta, Nexus Digital Solutions — good history with occasional late payments
    // ₹1,50,000 overdue, 35 days, one prior recovery attempt
    prisma.customer.create({
      data: {
        name: 'Rahul Mehta', email: 'rahul@nexusdigital.in', company: 'Nexus Digital Solutions',
        phone: '+91 98123 45678', gstNumber: '24HMHCT7890A1Z2', address: 'BKC, Mumbai, Maharashtra',
        riskScore: 0.58, avgDaysToPay: 32, totalPaid: 1850000, totalDue: 150000, paymentCount: 22, latePayments: 9,
      },
    }),
  ]);

  console.log(`✅ Created ${customers.length} customers`);

  // --- Invoices ---
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const invoiceData = [
    // HIGH RISK overdue invoices
    { customerIdx: 6, num: 'INV-2024-002', amount: 275000, desc: 'Full-Stack Development Sprint', daysIssued: 100, daysDue: 70, status: 'overdue', recovery: 'escalated', followUps: 6, escalation: 2 },
    { customerIdx: 7, num: 'INV-2024-004', amount: 340000, desc: 'Beverage Distribution Software', daysIssued: 130, daysDue: 100, status: 'overdue', recovery: 'escalated', followUps: 9, escalation: 3 },
    { customerIdx: 6, num: 'INV-2024-005', amount: 180000, desc: 'Mobile App Development Phase 2', daysIssued: 70, daysDue: 40, status: 'overdue', recovery: 'follow_up', followUps: 4, escalation: 0 },
    { customerIdx: 7, num: 'INV-2024-009', amount: 185000, desc: 'Supply Chain Analytics Dashboard', daysIssued: 85, daysDue: 55, status: 'overdue', recovery: 'follow_up', followUps: 5, escalation: 1 },
    { customerIdx: 7, num: 'INV-2024-015', amount: 155000, desc: 'Beverage Inventory System', daysIssued: 50, daysDue: 20, status: 'overdue', recovery: 'message_sent', followUps: 2, escalation: 0 },
    // MEDIUM RISK overdue invoices
    { customerIdx: 2, num: 'INV-2024-001', amount: 125000, desc: 'Organic Supply Management Q3', daysIssued: 55, daysDue: 25, status: 'overdue', recovery: 'follow_up', followUps: 3, escalation: 0 },
    { customerIdx: 3, num: 'INV-2024-006', amount: 145000, desc: 'Data Analytics Pipeline Setup', daysIssued: 45, daysDue: 15, status: 'overdue', recovery: 'message_sent', followUps: 2, escalation: 0 },
    { customerIdx: 4, num: 'INV-2024-008', amount: 195000, desc: 'Cloud Infrastructure Services', daysIssued: 35, daysDue: 5, status: 'overdue', recovery: 'ai_analyzing', followUps: 1, escalation: 0 },
    { customerIdx: 5, num: 'INV-2024-011', amount: 245000, desc: 'Interior Design Platform Annual', daysIssued: 50, daysDue: 20, status: 'overdue', recovery: 'follow_up', followUps: 3, escalation: 0 },
    { customerIdx: 5, num: 'INV-2024-013', amount: 89000, desc: 'AR Visualization Module', daysIssued: 38, daysDue: 8, status: 'overdue', recovery: 'promise_to_pay', followUps: 1, escalation: 0 },
    // EXTREME HIGH RISK
    { customerIdx: 8, num: 'INV-2024-021', amount: 450000, desc: 'Enterprise Software Migration', daysIssued: 150, daysDue: 120, status: 'overdue', recovery: 'escalated', followUps: 10, escalation: 3 },
    { customerIdx: 8, num: 'INV-2024-022', amount: 250000, desc: 'Legacy System Integration', daysIssued: 110, daysDue: 80, status: 'overdue', recovery: 'escalated', followUps: 7, escalation: 2 },
    { customerIdx: 8, num: 'INV-2024-023', amount: 150000, desc: 'Cloud Migration Phase 1', daysIssued: 60, daysDue: 30, status: 'overdue', recovery: 'follow_up', followUps: 4, escalation: 1 },
    // ★ HERO SCENARIO: Rahul Mehta, ₹1,50,000, 42 days overdue, 1 prior attempt
    { customerIdx: 9, num: 'INV-2024-H01', amount: 150000, desc: 'E-Commerce Platform Redesign — Phase 2', daysIssued: 72, daysDue: 42, status: 'overdue', recovery: 'message_sent', followUps: 1, escalation: 0 },
    // LOW RISK overdue
    { customerIdx: 4, num: 'INV-2024-010', amount: 110000, desc: 'ML Model Training Infrastructure', daysIssued: 20, daysDue: 0, status: 'overdue', recovery: 'none', followUps: 0, escalation: 0 },
    { customerIdx: 1, num: 'INV-2024-014', amount: 95000, desc: 'Logistics Platform License', daysIssued: 15, daysDue: 0, status: 'overdue', recovery: 'none', followUps: 0, escalation: 0 },
    // PENDING
    { customerIdx: 1, num: 'INV-2024-016', amount: 220000, desc: 'Fleet Management Integration', daysIssued: 8, daysDue: -22, status: 'pending', recovery: 'none', followUps: 0, escalation: 0 },
    { customerIdx: 0, num: 'INV-2024-017', amount: 150000, desc: 'Quality Control System', daysIssued: 5, daysDue: -25, status: 'pending', recovery: 'none', followUps: 0, escalation: 0 },
    // PAID
    { customerIdx: 0, num: 'INV-2024-018', amount: 450000, desc: 'ERP Module Development', daysIssued: 60, daysDue: 30, status: 'paid', recovery: 'recovered', followUps: 1, escalation: 0 },
    { customerIdx: 1, num: 'INV-2024-019', amount: 200000, desc: 'Route Optimization Engine', daysIssued: 45, daysDue: 15, status: 'paid', recovery: 'recovered', followUps: 2, escalation: 0 },
    { customerIdx: 1, num: 'INV-2024-020', amount: 150000, desc: 'E-Commerce Integration', daysIssued: 40, daysDue: 10, status: 'paid', recovery: 'recovered', followUps: 1, escalation: 0 },
  ];

  const invoices = [];
  for (const inv of invoiceData) {
    // Fix: dueAt should be in the past for overdue invoices
    // daysDue represents the credit period BEFORE overdue, so dueAt = now - daysDue
    const issuedAt = new Date(now.getTime() - inv.daysIssued * day);
    const creditPeriod = 30; // Standard 30-day credit period
    const overdueDays = inv.status === 'overdue' ? Math.abs(inv.daysDue) : 0;
    const dueAt = inv.status === 'overdue'
      ? new Date(now.getTime() - overdueDays * day) // Actually overdue
      : inv.status === 'pending'
      ? new Date(now.getTime() + Math.abs(inv.daysDue) * day) // Due in future
      : new Date(now.getTime() - (inv.daysIssued - creditPeriod) * day); // Paid: due was in past
    const paidAt = inv.status === 'paid' ? new Date(dueAt.getTime() + 2 * day) : null;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: inv.num, customerId: customers[inv.customerIdx].id, amount: inv.amount,
        description: inv.desc, issuedAt, dueAt, paidAt, status: inv.status,
        recoveryStatus: inv.recovery, followUpCount: inv.followUps, escalationLevel: inv.escalation,
        lastFollowUpAt: inv.followUps > 0 ? new Date(now.getTime() - Math.max(inv.followUps * 4, 5) * day) : null,
      },
    });
    invoices.push({ ...invoice, customerIdx: inv.customerIdx });
  }

  console.log(`✅ Created ${invoices.length} invoices`);

  // --- Promise to Pay ---
  const ptpData = [
    { invoiceIdx: 9, customerIdx: 5, amount: 89000, daysPromised: 2, daysDue: 5, status: 'active', notes: 'Meera confirmed payment will be made via UPI this week.' },
    { invoiceIdx: 17, customerIdx: 0, amount: 450000, daysPromised: 10, daysDue: -5, status: 'fulfilled', notes: 'Payment received as promised.' },
    { invoiceIdx: 18, customerIdx: 1, amount: 200000, daysPromised: 5, daysDue: -2, status: 'fulfilled', notes: 'Paid on time.' },
    { invoiceIdx: 10, customerIdx: 8, amount: 450000, daysPromised: 30, daysDue: -10, status: 'broken', notes: 'Customer promised payment 30 days ago. Never paid.' },
    { invoiceIdx: 11, customerIdx: 8, amount: 250000, daysPromised: 20, daysDue: -5, status: 'broken', notes: 'Second broken promise.' },
  ];

  for (const ptp of ptpData) {
    await prisma.promiseToPay.create({
      data: {
        invoiceId: invoices[ptp.invoiceIdx].id, customerId: customers[ptp.customerIdx].id,
        amount: ptp.amount, promisedAt: new Date(now.getTime() - ptp.daysPromised * day),
        dueDate: new Date(now.getTime() + ptp.daysDue * day), status: ptp.status, notes: ptp.notes,
      },
    });
  }

  console.log(`✅ Created ${ptpData.length} Promise-to-Pay commitments`);

  // --- Recovery Messages ---
  const messageData = [
    { invoiceIdx: 5, channel: 'email', tone: 'firm', subject: 'Payment Reminder: INV-2024-001', content: 'Dear Rajesh,\n\nThis is a reminder that invoice INV-2024-001 for ₹1,25,000 is 25 days overdue. We value our partnership.\n\nBest regards,\nPayPromise AI' },
    { invoiceIdx: 7, channel: 'email', tone: 'friendly', subject: 'Payment Reminder - INV-2024-008', content: 'Dear Priya,\n\nJust a gentle reminder about invoice INV-2024-008 for ₹1,95,000. It\'s only 5 days past due.\n\nThanks!\nPayPromise AI' },
    { invoiceIdx: 2, channel: 'email', tone: 'urgent', subject: 'Urgent: Invoice INV-2024-005 Overdue', content: 'Dear Ananya,\n\nInvoice INV-2024-005 for ₹1,80,000 is now 35 days overdue. Immediate attention required.\n\nRegards,\nPayPromise Recovery' },
    { invoiceIdx: 3, channel: 'email', tone: 'legal', subject: 'Final Notice: INV-2024-009', content: 'Dear Arjun,\n\nDespite multiple follow-ups, invoice INV-2024-009 for ₹1,85,000 remains unpaid for 45 days.\n\nSincerely,\nPayPromise Legal' },
    { invoiceIdx: 9, channel: 'whatsapp', tone: 'friendly', subject: null, content: 'Hi Meera! 🙋 Your promise to pay for INV-2024-013 (₹89,000) is noted. We\'ll check back next week. 👍' },
    { invoiceIdx: 0, channel: 'email', tone: 'legal', subject: 'Legal Notice: INV-2024-002', content: 'Dear Ananya,\n\nInvoice INV-2024-002 for ₹2,75,000 is 60 days overdue. Final notice.\n\nRegards,\nPayPromise Collections' },
    { invoiceIdx: 1, channel: 'email', tone: 'legal', subject: 'Escalation Notice: INV-2024-004', content: 'Dear Arjun,\n\nInvoice INV-2024-004 for ₹3,40,000 is 90 days overdue. Escalated to legal.\n\nSincerely,\nPayPromise Legal' },
    { invoiceIdx: 4, channel: 'email', tone: 'firm', subject: 'Payment Reminder - INV-2024-015', content: 'Dear Arjun,\n\nInvoice INV-2024-015 for ₹1,55,000 is 10 days overdue. Please arrange payment.\n\nRegards,\nPayPromise AI' },
    { invoiceIdx: 6, channel: 'email', tone: 'firm', subject: 'Follow-up: INV-2024-006', content: 'Dear Sanjay,\n\nFollowing up on invoice INV-2024-006 for ₹1,45,000. 15 days overdue.\n\nRegards,\nPayPromise AI' },
    { invoiceIdx: 8, channel: 'sms', tone: 'firm', subject: null, content: 'PayPromise: Invoice INV-2024-011 (₹2,45,000) is 20 days overdue. Please arrange payment.' },
    // Hero scenario message
    { invoiceIdx: 13, channel: 'email', tone: 'friendly', subject: 'Friendly Reminder: INV-2024-H01', content: 'Dear Rahul,\n\nI hope you\'re doing well. I wanted to follow up on invoice INV-2024-H01 for ₹1,50,000 regarding the E-Commerce Platform Redesign.\n\nWe value our partnership with Nexus Digital Solutions and understand that things get busy. Could you let us know when we can expect payment?\n\nBest regards,\nPayPromise AI Recovery System', sentAtOffset: 5 },
  ];

  for (const msg of messageData) {
    const sentAtOffset = (msg as any).sentAtOffset || 0;
    await prisma.recoveryMessage.create({
      data: {
        invoiceId: invoices[msg.invoiceIdx].id, channel: msg.channel, subject: msg.subject,
        content: msg.content, tone: msg.tone, aiGenerated: true,
        sentAt: sentAtOffset > 0 ? new Date(now.getTime() - sentAtOffset * day) : undefined,
      },
    });
  }

  console.log(`✅ Created ${messageData.length} recovery messages`);

  // ============================================================
  // Run the Recovery Engine on ALL invoices
  // ============================================================
  console.log('\n🤖 Running Recovery Engine on all invoices...');

  let analysisCount = 0;

  for (const inv of invoices) {
    const invCommitments = await prisma.promiseToPay.findMany({ where: { invoiceId: inv.id } });
    const invMessages = await prisma.recoveryMessage.findMany({ where: { invoiceId: inv.id } });

    const invoiceData = {
      id: inv.id, invoiceNumber: inv.invoiceNumber, amount: inv.amount,
      currency: inv.currency, issuedAt: inv.issuedAt, dueAt: inv.dueAt,
      paidAt: inv.paidAt, status: inv.status, recoveryStatus: inv.recoveryStatus,
      followUpCount: inv.followUpCount, escalationLevel: inv.escalationLevel,
      lastFollowUpAt: inv.lastFollowUpAt,
    };

    const customerRecord = customers[inv.customerIdx];
    const customerData = {
      id: customerRecord.id, name: customerRecord.name, company: customerRecord.company,
      email: customerRecord.email, riskScore: customerRecord.riskScore,
      avgDaysToPay: customerRecord.avgDaysToPay, totalPaid: customerRecord.totalPaid,
      totalDue: customerRecord.totalDue, paymentCount: customerRecord.paymentCount,
      latePayments: customerRecord.latePayments,
    };

    const commitmentData = invCommitments.map(c => ({
      id: c.id, amount: c.amount, promisedAt: c.promisedAt, dueDate: c.dueDate, status: c.status,
    }));
    const messageDataMapped = invMessages.map(m => ({
      id: m.id, channel: m.channel, tone: m.tone, sentAt: m.sentAt,
    }));

    const result = await analyzeInvoice(invoiceData, customerData, commitmentData, messageDataMapped);
    const storageData = formatAnalysisForStorage(result);

    await prisma.recoveryAnalysis.create({
      data: {
        invoiceId: inv.id, recoveryProbability: storageData.recoveryProbability,
        riskLevel: storageData.riskLevel, recommendedAction: storageData.recommendedAction,
        reasoning: storageData.reasoning, followUpDays: storageData.followUpDays,
        confidence: storageData.confidence, factors: storageData.factors,
      },
    });

    const actionData = formatAIActionForStorage(result, inv.id, 'analyze');
    await prisma.aIAction.create({
      data: {
        invoiceId: inv.id, action: actionData.action, reason: actionData.reason,
        confidence: actionData.confidence, policyDecision: actionData.policyDecision,
        policyReason: actionData.policyReason, result: actionData.result, actor: 'engine',
      },
    });

    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        recoveryProbability: storageData.recoveryProbability,
        recommendedAction: `${storageData.recommendedAction}: ${result.strategy.reason}`,
      },
    });

    analysisCount++;
    const heroTag = inv.invoiceNumber === 'INV-2024-H01' ? ' ★ HERO' : '';
    console.log(`  ✓ ${inv.invoiceNumber}: ${(storageData.recoveryProbability * 100).toFixed(0)}% (${storageData.riskLevel}) → ${storageData.recommendedAction}${heroTag}`);
  }

  console.log(`✅ Created ${analysisCount} recovery analyses`);

  // --- Revenue Metrics ---
  const allInvoices = await prisma.invoice.findMany();
  const totalRevenue = allInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const revenueAtRisk = allInvoices.filter(i => i.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0);
  const revenueRecovered = allInvoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);

  await prisma.revenueMetrics.create({
    data: {
      totalRevenue, revenueAtRisk, revenueRecovered,
      totalInvoices: allInvoices.length,
      overdueInvoices: allInvoices.filter(i => i.status === 'overdue').length,
      recoveredInvoices: allInvoices.filter(i => i.status === 'paid').length,
      avgRecoveryDays: 18.5, aiRecoveryRate: 0.73,
    },
  });

  console.log(`✅ Created revenue metrics`);
  console.log(`\n🎉 PayPromise AI seeded successfully!`);
  console.log(`   Total Revenue: ₹${totalRevenue.toLocaleString('en-IN')}`);
  console.log(`   Revenue at Risk: ₹${revenueAtRisk.toLocaleString('en-IN')}`);
  console.log(`   Revenue Recovered: ₹${revenueRecovered.toLocaleString('en-IN')}`);
  console.log(`   ★ Hero Scenario: INV-2024-H01 (Rahul Mehta, Nexus Digital)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
