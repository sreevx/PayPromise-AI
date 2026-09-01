'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: '📊' },
      { name: 'Revenue Tracker', href: '/revenue', icon: '💰' },
    ],
  },
  {
    label: 'Recovery',
    items: [
      { name: 'Invoices', href: '/invoices', icon: '📄' },
      { name: 'Customers', href: '/customers', icon: '👥' },
      { name: 'Follow-ups', href: '/follow-ups', icon: '🔔' },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Audit Log', href: '/audit', icon: '📋' },
      { name: 'Settings', href: '/settings', icon: '⚙️' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white text-lg font-bold">⚡</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">PayPromise</h1>
            <p className="text-[10px] font-medium text-blue-600 tracking-wider uppercase">AI Recovery</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {navigation.map((group) => (
          <div key={group.label}>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span>{item.name}</span>
                    {item.name === 'Invoices' && (
                      <span className="ml-auto bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">14</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-gray-100">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-sm">🤖</div>
            <div>
              <p className="text-xs font-semibold text-gray-900">AI Engine</p>
              <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Active
              </p>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Synthetic AI analysis for demo. Ready for Razorpay API integration.
          </p>
        </div>
      </div>
    </aside>
  );
}
