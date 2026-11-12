import React, { useState } from 'react';
import { X, AlertCircle, ShieldCheck, Cloud, Sparkles, Smartphone } from 'lucide-react';
import { loginWithGoogle } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await loginWithGoogle();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('Login error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed') || msg.includes('cancelled')) {
        setErrorMsg('O login foi cancelado. Clique no botão abaixo para tentar novamente.');
      } else if (msg.includes('popup-blocked')) {
        setErrorMsg('O navegador bloqueou a janela pop-up. Por favor, permita pop-ups ou tente abrir o app diretamente no Chrome/Safari.');
      } else {
        setErrorMsg('Não foi possível conectar no momento. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-sage-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-sage-100 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="finance-gradient p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-3 mb-1">
            <img
              src="/avatar.jpg"
              alt="Nelio R$"
              className="w-12 h-12 rounded-full object-cover border-2 border-white/80 shadow-xs"
              referrerPolicy="no-referrer"
            />
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">Nelio R$</h3>
              <p className="text-xs text-pine-100">Sincronização em Tempo Real</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-center space-y-1">
            <h4 className="text-base font-bold text-sage-800">Conecte sua Conta Google</h4>
            <p className="text-xs text-sage-500 leading-relaxed">
              Salve suas finanças na nuvem de forma segura, acesse em qualquer celular ou computador e nunca perca seus lançamentos.
            </p>
          </div>

          {/* Benefits */}
          <div className="bg-sage-50 border border-sage-100 rounded-2xl p-3.5 space-y-2 text-xs text-sage-600">
            <div className="flex items-center gap-2">
              <Cloud size={15} className="text-pine-600 shrink-0" />
              <span>Backup automático em tempo real</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone size={15} className="text-pine-600 shrink-0" />
              <span>Acesso no celular, tablet e computador</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-amber-500 shrink-0" />
              <span>Segurança e privacidade Google Firebase</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-rose-700 text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {/* Google Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-white hover:bg-sage-50 active:scale-[0.98] border-2 border-sage-200 hover:border-sage-300 text-sage-800 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 shadow-xs transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-pine-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold text-sage-600">Conectando com o Google...</span>
              </div>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Entrar com a Conta Google</span>
              </>
            )}
          </button>

          <div className="text-center pt-2 border-t border-sage-100">
            <p className="text-[11px] text-sage-400 flex items-center justify-center gap-1">
              <Sparkles size={12} className="text-pine-600" />
              Acesso seguro, instantâneo e sem senhas para guardar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
