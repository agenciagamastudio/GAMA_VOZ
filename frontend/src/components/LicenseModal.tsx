import React, { useState, useEffect } from 'react';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onValidate: (tier: string) => void;
  currentTier: string;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  onClose,
  onValidate,
  currentTier
}) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setLicenseKey('');
      setError('');
      setSuccess(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/license/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ license_key: licenseKey })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Erro ao validar chave de licença');
        return;
      }

      setSuccess(true);
      setLicenseKey('');

      // Callback to update tier in parent component
      onValidate(data.tier);

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError('Erro de conexão ao validar chave');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          Inserir Chave de Licença
        </h2>

        <p className="text-gray-600 mb-4">
          Você está usando o tier <strong>{currentTier}</strong>. Digite sua chave de licença para ativar recursos PRO.
        </p>

        {success && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 rounded text-green-800">
            ✓ Licença validada com sucesso!
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 rounded text-red-800">
            {error}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="gm_xxx_yyy"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />

            <p className="text-sm text-gray-500 mb-4">
              Sua chave de licença foi enviada por email após a compra.
            </p>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!licenseKey || loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Validando...' : 'Validar Chave'}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded hover:bg-gray-400 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              Não tem uma chave? <a href="https://lemonsqueezy.com/gama-voz/checkout" className="text-blue-600 hover:underline">Compre aqui</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
