import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-bg px-6 text-center">
      <div className="w-14 h-14 bg-gradient-to-br from-accent to-emerald-700 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-xl">⚡</div>
      <h1 className="text-4xl font-extrabold mb-3 animate-shimmer">QuickAI Platform</h1>
      <p className="text-textsecond text-lg mb-10 max-w-md">AI-powered enterprise commerce platform. Personalized. Fast. Embeddable.</p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/admin"
          className="bg-gradient-to-r from-accent to-emerald-700 text-bg font-bold px-8 py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity">
          Owner Admin Panel
        </Link>
        <Link href="/dashboard"
          className="bg-surface border border-border text-textprimary font-bold px-8 py-3.5 rounded-xl text-sm hover:border-textsecond transition-colors">
          Enterprise Dashboard
        </Link>
      </div>
      <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl">
        {[
          { icon:'🧠', label:'Orchestration Brain' },
          { icon:'💬', label:'Built-in AI Chat' },
          { icon:'📦', label:'Daily Catalog Upload' },
          { icon:'🔌', label:'1-Line JS Embed' },
        ].map(f => (
          <div key={f.label} className="bg-surface border border-border rounded-xl p-4 text-center">
            <div className="text-2xl mb-2">{f.icon}</div>
            <div className="text-xs font-semibold text-textsecond">{f.label}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
