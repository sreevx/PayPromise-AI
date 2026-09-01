// Formatting utilities for PayPromise AI

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return formatDate(d);
}

export function getDaysOverdue(dueAt: Date | string): number {
  const due = typeof dueAt === 'string' ? new Date(dueAt) : dueAt;
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function getRecoveryProbabilityLabel(probability: number): string {
  if (probability >= 0.8) return 'Very High';
  if (probability >= 0.6) return 'High';
  if (probability >= 0.4) return 'Medium';
  if (probability >= 0.2) return 'Low';
  return 'Very Low';
}

export function getRecoveryProbabilityColor(probability: number): string {
  if (probability >= 0.8) return 'text-green-600';
  if (probability >= 0.6) return 'text-blue-600';
  if (probability >= 0.4) return 'text-yellow-600';
  if (probability >= 0.2) return 'text-orange-600';
  return 'text-red-600';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending': return 'badge-warning';
    case 'overdue': return 'badge-danger';
    case 'paid': return 'badge-success';
    case 'partially_paid': return 'badge-info';
    case 'written_off': return 'badge-neutral';
    default: return 'badge-neutral';
  }
}

export function getRecoveryStatusColor(status: string): string {
  switch (status) {
    case 'none': return 'badge-neutral';
    case 'ai_analyzing': return 'badge-info';
    case 'message_sent': return 'badge-info';
    case 'follow_up': return 'badge-warning';
    case 'escalated': return 'badge-danger';
    case 'promise_to_pay': return 'badge-warning';
    case 'payment_initiated': return 'badge-info';
    case 'recovered': return 'badge-success';
    default: return 'badge-neutral';
  }
}

export function formatRecoveryStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
