import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDate, formatDateTime, getDaysOverdue, getRecoveryProbabilityColor, getRecoveryProbabilityLabel, getStatusColor, formatRecoveryStatus, getRecoveryStatusColor } from '@/lib/utils';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RecoveryActions } from './RecoveryActions';
import { RazorpayPayment } from './RazorpayPayment';

export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      messages: { orderBy: { sentAt: 'desc' } },
      commitments: { orderBy: { createdAt: 'desc' } },
      paymentLinks: { orderBy: { createdAt: 'desc' } },
      auditLogs: { orderBy: { createdAt: 'desc' } },
      analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
      aiActions: { orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!invoice) notFound();

  const daysOverdue = getDaysOverdue(invoice.dueAt);
  const probabilityLabel = getRecoveryProbabilityLabel(invoice.recoveryProbability ?? 0);
  const probabilityColor = getRecoveryProbabilityColor(invoice.recoveryProbability ?? 0);
  const latestAnalysis = invoice.analyses[0] ?? null;
  const latestAction = invoice.aiActions[0] ?? null;

  // Parse analysis factors for explainability
  let riskLevel = 'N/A';
  let reasoning = '';
  let analysisFactors: Record<string, unknown> = {};
  if (latestAnalysis) {
    riskLevel = latestAnalysis.riskLevel;
    reasoning = latestAnalysis.reasoning;
    try { analysisFactors = JSON.parse(latestAnalysis.factors || '{}'); } catch { /* ignore */ }
  }

  // Parse action result
  let actionResult: Record<string, unknown> = {};
  if (latestAction?.result) {
    try { actionResult = JSON.parse(latestAction.result); } catch { /* ignore */ }
  }

  const riskColor = riskLevel === 'HIGH' ? 'text-red-600 bg-red-50' :
    riskLevel === 'MEDIUM' ? 'text-yellow-600 bg-yellow-50' :
    riskLevel === 'LOW' ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-50';

  const isActionable = invoice.status === 'overdue';
  const activePromises = invoice.commitments.filter(c => c.status === 'active');

  // AI provider info
  const aiProvider = (analysisFactors.provider as string) || 'deterministic';
  const aiModel = analysisFactors.model as string | undefined;
  const aiFallback = analysisFactors.fallback as boolean || false;
  const isHero = invoice.invoiceNumber === 'INV-2024-H01';

  // Customer payment history stats
  const lateRate = invoice.customer.paymentCount > 0
    ? ((invoice.customer.latePayments / invoice.customer.paymentCount) * 100).toFixed(0)
    : '0';

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/invoices" className="text-sm text-blue-600 hover:text-blue-700">← Back to Invoices</Link>
        {isHero && (
          <span className="badge badge-info text-[10px]">★ Hero Demo Scenario</span>
        )}
      </div>

      {/* Invoice Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
              <span className={`badge ${getStatusColor(invoice.status)}`}>{invoice.status.replace('_', ' ')}</span>
              <span className={`badge ${getRecoveryStatusColor(invoice.recoveryStatus)}`}>
                {formatRecoveryStatus(invoice.recoveryStatus)}
              </span>
            </div>
            <p className="text-sm text-gray-500">{invoice.description}</p>
            <div className="flex items-center gap-4 mt-2">
              <Link href={`/customers/${invoice.customer.id}`} className="text-sm text-blue-600 hover:text-blue-700">
                {invoice.customer.name} • {invoice.customer.company}
              </Link>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(invoice.amount)}</p>
            <p className="text-sm text-gray-500 mt-1">
              {invoice.status === 'paid' ? `Paid ${formatDate(invoice.paidAt!)}` :
               invoice.status === 'overdue' ? `${daysOverdue} days overdue` :
               `Due ${formatDate(invoice.dueAt)}`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Issued</p>
            <p className="text-sm font-semibold text-gray-900">{formatDate(invoice.issuedAt)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Due Date</p>
            <p className="text-sm font-semibold text-gray-900">{formatDate(invoice.dueAt)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Recovery Score</p>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${(invoice.recoveryProbability ?? 0) >= 0.6 ? 'bg-green-500' : (invoice.recoveryProbability ?? 0) >= 0.3 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${(invoice.recoveryProbability ?? 0) * 100}%` }} />
              </div>
              <span className={`text-sm font-bold ${probabilityColor}`}>{((invoice.recoveryProbability ?? 0) * 100).toFixed(0)}%</span>
            </div>
            <p className="text-[10px] text-gray-500">{probabilityLabel}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Follow-ups</p>
            <p className="text-sm font-semibold text-gray-900">{invoice.followUpCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Escalation</p>
            <p className="text-sm font-semibold text-gray-900">
              {invoice.escalationLevel === 0 ? 'None' : invoice.escalationLevel === 1 ? 'AI' : invoice.escalationLevel === 2 ? 'Human' : 'Legal'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Messages</p>
            <p className="text-sm font-semibold text-gray-900">{invoice.messages.length}</p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* AI ANALYSIS + EXPLAINABILITY SECTION                       */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {latestAnalysis && (
        <div className="mb-6 space-y-4">
          {/* Main Analysis Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-lg">🤖</span>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h3 className="text-sm font-semibold text-blue-900">AI Recovery Analysis</h3>
                  <span className={`badge text-[10px] ${riskColor}`}>{riskLevel} Risk</span>
                  {latestAnalysis.confidence && (
                    <span className="text-[10px] text-blue-600">Confidence: {(latestAnalysis.confidence * 100).toFixed(0)}%</span>
                  )}
                </div>
                <p className="text-sm text-blue-800 mt-1 leading-relaxed">{reasoning}</p>
              </div>
            </div>

            {/* Provider + Policy Labels */}
            <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-blue-100">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-gray-500 uppercase">AI Reasoning:</span>
                <span className={`badge text-[10px] ${aiProvider === 'llm' && !aiFallback ? 'badge-success' : 'badge-neutral'}`}>
                  {aiProvider === 'llm' && !aiFallback ? `🤖 ${aiModel || 'LLM'}` : '⚙️ Deterministic Engine'}
                </span>
              </div>
              {aiFallback && <span className="badge badge-warning text-[10px]">⚠ Fallback Used</span>}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-gray-500 uppercase">Financial Decision:</span>
                <span className="badge badge-info text-[10px]">⚙️ Deterministic Scoring</span>
              </div>
              {latestAction && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-gray-500 uppercase">Policy:</span>
                  <span className={`badge text-[10px] ${latestAction.policyDecision === 'ALLOW' ? 'badge-success' : latestAction.policyDecision === 'BLOCK' ? 'badge-danger' : 'badge-warning'}`}>
                    {latestAction.policyDecision}
                  </span>
                </div>
              )}
            </div>

            {/* Policy Decision Detail */}
            {latestAction && (
              <div className={`mt-4 p-3 rounded-lg border ${
                latestAction.policyDecision === 'ALLOW' ? 'bg-green-50/50 border-green-200' :
                latestAction.policyDecision === 'BLOCK' ? 'bg-red-50/50 border-red-200' :
                'bg-yellow-50/50 border-yellow-200'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-700">Policy Decision:</span>
                  <span className={`badge text-[10px] ${latestAction.policyDecision === 'ALLOW' ? 'badge-success' : latestAction.policyDecision === 'BLOCK' ? 'badge-danger' : 'badge-warning'}`}>{latestAction.policyDecision}</span>
                  {typeof actionResult.action === 'string' && <span className="badge badge-info text-[10px]">{actionResult.action}</span>}
                </div>
                <p className="text-xs text-gray-600">{latestAction.policyReason || latestAction.reason}</p>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════ */}
          {/* EXPLAINABILITY: Why did PayPromise AI recommend this? */}
          {/* ═══════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">📋 Why did PayPromise AI recommend this?</h3>

            {/* Factor Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Days Overdue</p>
                <p className={`text-lg font-bold ${daysOverdue > 30 ? 'text-red-600' : daysOverdue > 14 ? 'text-yellow-600' : 'text-green-600'}`}>{daysOverdue}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Customer Risk Score</p>
                <p className={`text-lg font-bold ${invoice.customer.riskScore > 0.7 ? 'text-red-600' : invoice.customer.riskScore > 0.4 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {(invoice.customer.riskScore * 100).toFixed(0)}%
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Late Payment Rate</p>
                <p className={`text-lg font-bold ${Number(lateRate) > 50 ? 'text-red-600' : Number(lateRate) > 25 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {lateRate}%
                </p>
                <p className="text-[10px] text-gray-400">{invoice.customer.latePayments}/{invoice.customer.paymentCount} payments</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Previous Promises</p>
                <p className="text-lg font-bold text-gray-900">
                  {invoice.commitments.filter(c => c.status === 'fulfilled').length} fulfilled
                </p>
                <p className="text-[10px] text-red-500">{invoice.commitments.filter(c => c.status === 'broken').length} broken</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Recovery Attempts</p>
                <p className="text-lg font-bold text-gray-900">{invoice.followUpCount}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] font-medium text-gray-500 uppercase">Payment History</p>
                <p className="text-lg font-bold text-gray-900">{invoice.customer.paymentCount}</p>
                <p className="text-[10px] text-gray-400">total transactions</p>
              </div>
            </div>

            {/* Summary */}
            <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-800 leading-relaxed">
                <span className="font-semibold">Summary:</span>{' '}
                {String(analysisFactors.summary || `Invoice is ${daysOverdue} days overdue with ${(invoice.recoveryProbability ?? 0) * 100}% recovery probability.`)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recovery Messages */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Recovery Messages</h3>
            {invoice.messages.length === 0 ? (
              <p className="text-sm text-gray-500">No messages sent yet</p>
            ) : (
              <div className="space-y-4">
                {invoice.messages.map((msg) => (
                  <div key={msg.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{msg.channel === 'email' ? '📧' : msg.channel === 'whatsapp' ? '💬' : '📱'}</span>
                        <span className="text-xs font-medium text-gray-700 capitalize">{msg.channel}</span>
                        <span className={`badge text-[10px] ${msg.tone === 'friendly' ? 'badge-success' : msg.tone === 'firm' ? 'badge-warning' : msg.tone === 'urgent' ? 'badge-danger' : 'badge-neutral'}`}>{msg.tone}</span>
                        {msg.aiGenerated && <span className="badge badge-info text-[10px]">Engine Generated</span>}
                      </div>
                      <span className="text-xs text-gray-500">{formatDateTime(msg.sentAt)}</span>
                    </div>
                    {msg.subject && <p className="text-sm font-medium text-gray-900 mb-1">{msg.subject}</p>}
                    <p className="text-sm text-gray-600 whitespace-pre-line">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Actions Audit Trail */}
          {invoice.aiActions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">AI Action Trail</h3>
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
                <div className="space-y-4">
                  {invoice.aiActions.map((action) => {
                    let parsedResult: Record<string, unknown> = {};
                    try { parsedResult = JSON.parse(action.result || '{}'); } catch { /* ignore */ }
                    return (
                      <div key={action.id} className="flex items-start gap-4 pl-8 relative">
                        <div className={`absolute left-1.5 w-3 h-3 rounded-full bg-white border-2 -mt-0.5 ${action.policyDecision === 'ALLOW' ? 'border-green-400' : action.policyDecision === 'BLOCK' ? 'border-red-400' : 'border-yellow-400'}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{formatRecoveryStatus(action.action)}</span>
                            <span className={`badge text-[10px] ${action.policyDecision === 'ALLOW' ? 'badge-success' : action.policyDecision === 'BLOCK' ? 'badge-danger' : 'badge-warning'}`}>{action.policyDecision}</span>
                            <span className="text-xs text-gray-400">by {action.actor}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{action.reason}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(action.createdAt)}</p>
                          {Object.keys(parsedResult).length > 0 && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono text-gray-600 overflow-x-auto">
                              {Object.entries(parsedResult).map(([key, value]) => (
                                <div key={key}><span className="text-gray-400">{key}:</span> <span className="text-gray-700">{String(value)}</span></div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <RecoveryActions
            invoiceId={invoice.id} invoiceStatus={invoice.status} isActionable={isActionable}
            escalationLevel={invoice.escalationLevel} activePromises={activePromises.length} invoiceAmount={invoice.amount}
          />

          <RazorpayPayment
            invoiceId={invoice.id} invoiceAmount={invoice.amount} invoiceNumber={invoice.invoiceNumber}
            isDemo={invoice.payments[0]?.isDemo ?? true}
            existingPayment={invoice.payments[0] ? {
              id: invoice.payments[0].id, razorpayOrderId: invoice.payments[0].razorpayOrderId,
              razorpayPaymentId: invoice.payments[0].razorpayPaymentId,
              paymentLinkId: invoice.payments[0].paymentLinkId,
              paymentLinkUrl: invoice.payments[0].paymentLinkUrl,
              amount: invoice.payments[0].amount,
              status: invoice.payments[0].status, method: invoice.payments[0].method,
              isDemo: invoice.payments[0].isDemo,
              createdAt: invoice.payments[0].createdAt.toISOString(),
            } : null}
          />

          {invoice.commitments.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Commitments</h3>
              <div className="space-y-2">
                {invoice.commitments.map((c) => (
                  <div key={c.id} className={`p-3 rounded-lg border ${c.status === 'fulfilled' ? 'bg-green-50 border-green-100' : c.status === 'broken' ? 'bg-red-50 border-red-100' : c.status === 'cancelled' ? 'bg-gray-50 border-gray-200' : 'bg-yellow-50 border-yellow-100'}`}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{formatCurrency(c.amount)}</span>
                      <span className={`badge text-[10px] ${c.status === 'fulfilled' ? 'badge-success' : c.status === 'broken' ? 'badge-danger' : c.status === 'cancelled' ? 'badge-neutral' : 'badge-warning'}`}>{c.status}</span>
                    </div>
                    <p className="text-xs text-gray-500">Due: {formatDate(c.dueDate)}</p>
                    {c.notes && <p className="text-xs text-gray-600 mt-1">{c.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer</h3>
            <Link href={`/customers/${invoice.customer.id}`} className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              <p className="text-sm font-medium text-gray-900">{invoice.customer.name}</p>
              <p className="text-xs text-gray-500">{invoice.customer.company}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-[10px] text-gray-500">Risk: {((invoice.customer.riskScore) * 100).toFixed(0)}%</span>
                <span className="text-[10px] text-gray-500">Avg: {invoice.customer.avgDaysToPay}d</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
