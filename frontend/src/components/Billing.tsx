import React, { useState, useEffect } from 'react';
import { CreditCard, Zap, Crown, Check, X, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../utils/config';

export default function Billing() {
  const [plans, setPlans] = useState([]);
  const [sub, setSub] = useState(null);
  const [usage, setUsage] = useState({});
  const [quota, setQuota] = useState({});
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [isPro, setIsPro] = useState(false);

  const token = localStorage.getItem('gama_voz_token');

  const headers = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/billing/plans`)
      .then(r => r.json())
      .then(d => setPlans(d.plans || []))
      .catch(() => setPlans([]));

    if (token) {
      fetch(`${API_BASE_URL}/api/billing/status`, { headers: headers() })
        .then(r => r.json())
        .then(d => {
          setSub(d.subscription);
          setUsage(d.usage || {});
          setQuota(d.quota || {});
          setIsPro(d.is_pro);
        })
        .catch(() => {});
    }
  }, []);

  const activate = async () => {
    setLoading(true); setMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/activate`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ license_key: licenseKey }),
      });
      const d = await res.json();
      setMsg(d.success ? '✅ Ativação confirmada!' : `❌ ${d.error || 'Erro'}`);
      if (d.success) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e) {
      setMsg('❌ Erro de rede');
    } finally { setLoading(false); }
  };

  const cancel = async () => {
    if (!confirm('Cancelar assinatura? Acesso mantido até fim do período.')) return;
    try {
      await fetch(`${API_BASE_URL}/api/billing/cancel`, { method: 'POST', headers: headers() });
      setMsg('✅ Cancelado (acesso até fim do período)');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { setMsg('❌ Erro ao cancelar'); }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-[#88ce11]">Planos & Assinatura</h1>

      {/* Status atual */}
      <div className="rounded-xl bg-[#272727] border border-[#333] p-5">
        <h2 className="font-semibold mb-2">Seu plano</h2>
        <div className="flex items-center gap-3 text-sm">
          <span className={`px-3 py-1 rounded-full font-medium ${isPro ? 'bg-[#88ce11]/20 text-[#88ce11]' : 'bg-neutral-700 text-neutral-300'}`}>
            {isPro ? 'PRO' : 'FREE'}
          </span>
          <span className="text-neutral-400">{sub?.plan || 'free'}</span>
          {sub?.status === 'active' && (
            <span className="text-xs text-neutral-500">Vence em: {sub?.expires_at ? new Date(sub.expires_at).toLocaleDateString('pt-BR') : '-'}</span>
          )}
        </div>

        {/* Quota */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-neutral-300">
          {Object.entries(quota).map(([k, v]) => (
            <div key={k} className="bg-[#161616] rounded-lg p-2 border border-[#333]">
              <div className="font-medium text-neutral-400 uppercase">{k}</div>
              <div className="text-[#88ce11]">{v.current || 0}{v.limit ? ` / ${v.limit}` : ' ∞'}</div>
              {v.limit !== null && <div className="text-[10px] text-neutral-500">Resta: {Math.max(0, v.limit - (v.current || 0))}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Planos */}
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map(p => (
          <div key={p.id} className={`rounded-2xl border p-5 ${p.id === 'free' ? 'bg-[#161616] border-[#333]' : 'bg-gradient-to-b from-[#272727] to-[#161616] border-[#88ce11]/40 shadow-[0_0_30px_rgba(136,206,17,0.15)]'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${p.id === 'free' ? 'bg-neutral-700' : 'bg-[#88ce11]/10'}`}>
                {p.id === 'free' ? <Zap size={18} className="text-[#88ce11]" /> : <Crown size={18} className="text-[#88ce11]" />}
              </div>
              <h3 className="font-bold">{p.name}</h3>
            </div>
            <div className="text-2xl font-bold mb-2">{p.price_display}</div>
            <div className="text-xs text-neutral-400 mb-3">{p.period ? `por ${p.period}` : 'Grátis'}</div>
            <ul className="text-sm space-y-1.5 text-neutral-300 mb-4">
              {p.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2"><Check size={14} className="text-[#88ce11] shrink-0" /> {f}</li>
              ))}
            </ul>
            {p.id !== 'free' && !isPro && (
              <button onClick={() => { setLicenseKey(''); setMsg(''); }} className="w-full py-2 rounded-lg bg-[#88ce11] text-[#161616] font-semibold hover:bg-[#a3d500] transition" disabled={loading}>Ativar Pro</button>
            )}
          </div>
        ))}
      </div>

      {/* Ativação por chave */}
      {plans.some(p => p.id !== 'free') && (
        <div className="rounded-xl bg-[#161616] border border-[#333] p-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2"><CreditCard size={18} /> Ativar chave de licença</h3>
          <p className="text-sm text-neutral-400 mb-3">Cole a chave do Lemon Squeezy abaixo (comprada via site). A assinatura será ativada imediatamente.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value)}
              placeholder="LS-key-xxxx..."
              className="flex-1 px-4 py-2 rounded-lg bg-[#272727] border border-[#333] text-white focus:outline-none focus:border-[#88ce11]"
            />
            <button onClick={activate} disabled={loading || !licenseKey} className="px-4 py-2 rounded-lg bg-[#88ce11] text-[#161616] font-semibold hover:bg-[#a3d500] disabled:opacity-50 transition flex items-center gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
            </button>
          </div>
          {msg && <div className={`mt-3 text-sm ${msg.includes('✅') ? 'text-[#88ce11]' : 'text-red-400'}`}>{msg}</div>}
        </div>
      )}

      {/* Cancelar */}
      {isPro && (
        <div className="rounded-xl bg-[#161616] border border-red-900/30 p-6">
          <h3 className="font-semibold mb-2 text-red-400">Cancelar assinatura</h3>
          <p className="text-sm text-neutral-400 mb-3">O cancelamento é imediato: a assinatura não renova, mas você mantém acesso até o fim do período pago.</p>
          <button onClick={cancel} className="px-4 py-2 rounded-lg bg-red-900/40 text-red-300 border border-red-800 hover:bg-red-900/60 transition">Cancelar assinatura</button>
        </div>
      )}
    </div>
  );
}
