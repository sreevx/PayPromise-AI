import Link from 'next/link';
import { getRazorpayStatus } from '@/lib/razorpay';

export default function SettingsPage() {
  const razorpay = getRazorpayStatus();
  const aiConfigured = Boolean(process.env.AI_PROVIDER_API_KEY);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Platform configuration and integration status</p>
      </div>

      {/* Platform Info */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Platform Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Platform</p>
            <p className="text-sm font-semibold text-gray-900">PayPromise AI</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Version</p>
            <p className="text-sm font-semibold text-gray-900">0.2.0 (Milestone 4)</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Hackathon Track</p>
            <p className="text-sm font-semibold text-gray-900">Razorpay AI Revenue Recovery</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase">Data Mode</p>
            <p className="badge badge-warning">Synthetic Demo Data</p>
          </div>
        </div>
      </div>

      {/* Integration Status */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Integrations</h2>
        <div className="space-y-3">
          {/* Razorpay - Dynamic Status */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-lg">💳</span>
              <div>
                <p className="text-sm font-medium text-gray-900">Razorpay Test Mode</p>
                <p className="text-xs text-gray-500">
                  {razorpay.configured
                    ? `Key ID: ${razorpay.keyIdMasked}`
                    : 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {razorpay.testMode && (
                <span className="badge badge-info text-[10px]">Test Mode</span>
              )}
              <span className={`badge ${razorpay.configured ? 'badge-success' : 'badge-neutral'}`}>
                {razorpay.configured ? (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                    Not Configured
                  </span>
                )}
              </span>
            </div>
          </div>

          {[
            { name: 'AI Engine (LLM)', status: aiConfigured ? 'LLM Connected' : 'Deterministic Fallback', icon: '🤖', note: aiConfigured ? 'Using configured LLM provider for reasoning' : 'Using deterministic rule-based analysis' },
            { name: 'PostgreSQL', status: 'SQLite (Demo)', icon: '🗄️', note: 'Schema ready for PostgreSQL migration' },
            { name: 'Email (SMTP)', status: 'Not Connected', icon: '📧', note: 'Messages generated but not sent' },
            { name: 'WhatsApp Business', status: 'Not Connected', icon: '💬', note: 'API structure ready' },
            { name: 'SMS Gateway', status: 'Not Connected', icon: '📱', note: 'Template system ready' },
          ].map((integration) => (
            <div key={integration.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-lg">{integration.icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{integration.name}</p>
                  <p className="text-xs text-gray-500">{integration.note}</p>
                </div>
              </div>
              <span className="badge badge-neutral">{integration.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Environment Variables Info */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Environment Variables</h2>
        <div className="p-4 bg-gray-50 rounded-lg font-mono text-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">RAZORPAY_KEY_ID=</span>
            <span className={razorpay.configured ? 'text-green-600' : 'text-red-400'}>
              {razorpay.configured ? razorpay.keyIdMasked : '(not set)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">RAZORPAY_KEY_SECRET=</span>
            <span className={razorpay.configured ? 'text-green-600' : 'text-red-400'}>
              {razorpay.configured ? '••••••••••••••••' : '(not set)'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">RAZORPAY_WEBHOOK_SECRET=</span>
            <span className="text-gray-400">(optional)</span>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-3">
          Never expose secret keys to the browser. Server-side only.
        </p>
      </div>

      {/* Tech Stack */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Tech Stack</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'Next.js 14', icon: '⚡' },
            { name: 'TypeScript', icon: '🔷' },
            { name: 'React 18', icon: '⚛️' },
            { name: 'Tailwind CSS', icon: '🎨' },
            { name: 'Prisma ORM', icon: '◆' },
            { name: 'SQLite', icon: '🗄️' },
            { name: 'Razorpay SDK', icon: '💳' },
            { name: 'Shadcn-inspired', icon: '✨' },
          ].map((tech) => (
            <div key={tech.name} className="p-3 bg-gray-50 rounded-lg text-center">
              <span className="text-xl block mb-1">{tech.icon}</span>
              <p className="text-xs font-medium text-gray-700">{tech.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
