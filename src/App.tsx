import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2,
  FileSignature,
  Folder,
  Settings2,
  LogOut,
  AlertCircle,
  X,
  Sun,
  Moon,
  ShieldAlert,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Scale
} from 'lucide-react';
import UploadForm from './components/UploadForm';
import History from './components/History';
import PendingDocs from './components/PendingDocs';
import FolderSetupModal from './components/FolderSetupModal';
import { initAuth, googleSignIn, logout } from './lib/auth';
import { FolderConfig } from './types';

const FOLDER_CONFIG_KEY = 'legalflow_folder_config';
const THEME_KEY = 'legalflow_theme';

export default function App() {
  const [needsAuth, setNeedsAuth] = useState<boolean | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showOauthGuide, setShowOauthGuide] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Theme state: dark vs light
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved ? saved === 'dark' : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Folder configuration state
  const [folderConfig, setFolderConfig] = useState<FolderConfig | null>(() => {
    try {
      const saved = localStorage.getItem(FOLDER_CONFIG_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (_user, _token) => {
        setNeedsAuth(false);
      },
      () => setNeedsAuth(true)
    );
    return () => unsubscribe();
  }, []);

  // Open folder modal if logged in but no folder config exists
  useEffect(() => {
    if (needsAuth === false && !folderConfig) {
      setIsFolderModalOpen(true);
    }
  }, [needsAuth, folderConfig]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setNeedsAuth(false);
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('Login failed:', err);
      }
      const msg = err.message || '';
      if (err.code === 'auth/access-blocked-by-client' || msg.includes('blocked') || msg.includes('400')) {
        setLoginError(
          'Google ha restringido el acceso temporalmente. Debes autorizar el acceso en la consola de Google Cloud OAuth.'
        );
        setShowOauthGuide(true);
      } else if (err.code === 'auth/popup-closed-by-user') {
        setLoginError('Inicio de sesión cancelado. Haz clic abajo para volver a intentarlo cuando desees.');
      } else if (err.code === 'auth/popup-blocked') {
        setLoginError('Tu navegador bloqueó la ventana emergente. Por favor habilita los popups.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setLoginError('Dominio no autorizado en Firebase Authentication.');
      } else {
        setLoginError(`Error de autenticación (${err.code || 'Google OAuth'}): ${err.message || 'Ocurrió un error inesperado.'}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogoutConfirm = async () => {
    try {
      await logout();
      setIsLogoutModalOpen(false);
      setNeedsAuth(true);
    } catch (err) {
      console.error('Error logging out', err);
    }
  };

  const handleSaveFolderConfig = (config: FolderConfig) => {
    setFolderConfig(config);
    localStorage.setItem(FOLDER_CONFIG_KEY, JSON.stringify(config));
    setRefreshTrigger((prev) => prev + 1);
  };

  if (needsAuth === null) {
    return (
      <div className="flex flex-col h-screen w-full bg-[#f6f4ee] dark:bg-[#091122] text-[#1c2430] dark:text-[#f1f5f9] font-sans items-center justify-center">
        <div className="flex flex-col items-center gap-3 p-6 border border-[#ded8cb] dark:border-[#1c2e52] bg-[#ffffff] dark:bg-[#0e1930] shadow-sm">
          <img src="/logo.svg" alt="LegalFlow Logo" className="w-12 h-12 object-contain" />
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#5e6a7d] dark:text-[#93a2b7]">
            <Loader2 className="w-4 h-4 animate-spin text-[#2c3e50] dark:text-[#93c5fd]" />
            <span>Iniciando LegalFlow...</span>
          </div>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN (Sober, classic, sharp)
  if (needsAuth) {
    return (
      <div className="min-h-screen w-full bg-[#f6f4ee] dark:bg-[#091122] text-[#1c2430] dark:text-[#f1f5f9] font-sans flex flex-col items-center justify-center p-4 sm:p-6 relative">
        {/* Theme toggle top-right */}
        <div className="absolute top-5 right-5 z-20">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 bg-[#ffffff] dark:bg-[#0e1930] hover:bg-[#faf8f3] dark:hover:bg-[#132244] text-[#2c3e50] dark:text-[#e2e8f0] border border-[#ded8cb] dark:border-[#1c2e52] px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-colors cursor-pointer"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Modo Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#1e293b]" />
                <span>Modo Oscuro</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-col items-center max-w-md w-full relative z-10 space-y-4">
          {/* Main Login Box */}
          <div className="w-full bg-[#ffffff] dark:bg-[#0e1930] border border-[#ded8cb] dark:border-[#1c2e52] p-8 text-center space-y-6 shadow-xs">
            {/* Header Icon */}
            <div className="mx-auto w-16 h-16 bg-[#f0ece1] dark:bg-[#152342] border border-[#ded8cb] dark:border-[#1c2e52] p-2 flex items-center justify-center shadow-2xs">
              <img src="/logo.svg" alt="LegalFlow Logo" className="w-full h-full object-contain" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#788596] dark:text-[#94a3b8]">
                Sistema Profesional de Validación
              </span>
              <h1 className="text-xl font-bold tracking-tight text-[#17202a] dark:text-[#f8fafc]">
                Automatizador de Documentos
              </h1>
              <p className="text-xs text-[#5e6a7d] dark:text-[#93a2b7] max-w-xs mx-auto leading-relaxed pt-1">
                Extracción estructurada con IA Gemini y sincronización directa con Google Workspace.
              </p>
            </div>

            {loginError && (
              <div className="bg-[#fff8eb] dark:bg-[#201c10] border border-[#fed7aa] dark:border-[#7c2d12] p-3 text-left space-y-1">
                <div className="flex items-center gap-2 text-[#9a3412] dark:text-[#fdba74] font-bold text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Aviso de Acceso</span>
                </div>
                <p className="text-[11px] text-[#7c2d12] dark:text-[#fed7aa] leading-relaxed">
                  {loginError}
                </p>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2.5 bg-[#1e293b] hover:bg-[#0f172a] dark:bg-[#2563eb] dark:hover:bg-[#1d4ed8] text-white py-3 px-6 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer border border-[#0f172a] dark:border-[#1d4ed8]"
              >
                {isLoggingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M12.01 1.485c-2.08 0-4.06.74-5.61 2.08L2.4 8.795l5.22 9.04 4.39-7.6h8.79c-.83-5.07-5.18-8.75-10.8-8.75zm-6.9 8.28l-3.62 6.27c1.55 4.32 5.67 7.48 10.52 7.48 1.83 0 3.59-.45 5.15-1.28l-3.63-6.28-8.42-6.19zm15.11-.8h-7.25l8.42 14.58c1.61-1.63 2.61-3.87 2.61-6.33 0-3.32-1.46-6.3-3.78-8.25z"/>
                  </svg>
                )}
                Conectar con Google Drive
              </button>
            </div>
          </div>

          {/* OAUTH VERIFICATION ACCORDION */}
          <div className="w-full bg-[#ffffff] dark:bg-[#0e1930] border border-[#ded8cb] dark:border-[#1c2e52] p-4 text-left">
            <button
              onClick={() => setShowOauthGuide((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-bold text-[#334155] dark:text-[#cbd5e1] hover:text-[#0f172a] dark:hover:text-white cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#b45309] dark:text-amber-400 shrink-0" />
                <span>¿Aparece advertencia al conectar con Google?</span>
              </div>
              {showOauthGuide ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </button>

            {showOauthGuide && (
              <div className="mt-3 pt-3 border-t border-[#ded8cb] dark:border-[#1c2e52] space-y-2 text-[11px] text-[#475569] dark:text-[#94a3b8]">
                <p>
                  Si Google muestra el mensaje <strong className="font-bold text-[#0f172a] dark:text-white">"Google no ha verificado esta app"</strong>:
                </p>
                <div className="bg-[#faf8f3] dark:bg-[#132244] border border-[#ded8cb] dark:border-[#1c2e52] p-3 space-y-1 text-[#334155] dark:text-[#cbd5e1]">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-[#b45309] dark:text-amber-400">1.</span>
                    <span>Haz clic en <strong className="underline text-[#0f172a] dark:text-white">Configuración avanzada</strong> (abajo a la izquierda).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-[#b45309] dark:text-amber-400">2.</span>
                    <span>Haz clic en <strong className="underline text-[#0f172a] dark:text-white">Ir a automatizadorDocumentos app (no seguro)</strong> para continuar.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // MAIN DASHBOARD (Classic, sharp, elegant)
  return (
    <div className="flex flex-col h-screen w-full bg-[#f6f4ee] dark:bg-[#091122] text-[#1c2430] dark:text-[#f1f5f9] font-sans overflow-hidden">
      {/* Top Classic Header */}
      <header className="bg-[#ffffff] dark:bg-[#0e1930] border-b border-[#ded8cb] dark:border-[#1c2e52] px-6 py-2.5 flex justify-between items-center shrink-0 z-20">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#f0ece1] dark:bg-[#152342] border border-[#ded8cb] dark:border-[#1c2e52] p-1 flex items-center justify-center shrink-0 shadow-2xs">
            <img src="/logo.svg" alt="LegalFlow Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[#17202a] dark:text-white uppercase flex items-center gap-2">
              LegalFlow
              <span className="text-[11px] font-normal lowercase tracking-normal text-[#5e6a7d] dark:text-[#93a2b7] hidden sm:inline">
                • procesador & validación
              </span>
            </h1>
          </div>
        </div>

        {/* Right Section: Folder Badge, Theme Toggle & Logout */}
        <div className="flex items-center gap-3">
          {/* Active Folder & Sheet Configuration Badge */}
          <div className="bg-[#faf8f3] dark:bg-[#132244] text-[#1e293b] dark:text-[#f1f5f9] px-3 py-1.5 flex items-center gap-2 text-xs font-medium border border-[#ded8cb] dark:border-[#1c2e52]">
            <Folder className="w-3.5 h-3.5 text-[#5e6a7d] dark:text-[#93a2b7] shrink-0" />
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              {folderConfig ? (
                <>
                  <span className="font-bold text-[#1e293b] dark:text-[#f1f5f9] max-w-[110px] truncate" title={folderConfig.parentName}>
                    {folderConfig.parentName}
                  </span>
                  <span className="text-[#94a3b8]">/</span>
                  <span className="font-bold text-[#92400e] dark:text-[#fcd34d] bg-[#fef3c7] dark:bg-[#451a03] border border-[#fde68a] dark:border-[#78350f] px-1.5 py-0.5 text-[11px] flex items-center gap-1">
                    📥 {folderConfig.origenName}
                  </span>
                  <ArrowRight className="w-3 h-3 text-[#94a3b8]" />
                  <span className="font-bold text-[#166534] dark:text-[#86efac] bg-[#dcfce7] dark:bg-[#052e16] border border-[#bbf7d0] dark:border-[#14532d] px-1.5 py-0.5 text-[11px] flex items-center gap-1">
                    📤 {folderConfig.destinoName}
                  </span>
                  {folderConfig.sheetName && (
                    <>
                      <span className="text-[#94a3b8]">|</span>
                      <span className="font-bold text-[#1d4ed8] dark:text-[#93c5fd] bg-[#eff6ff] dark:bg-[#172554] border border-[#bfdbfe] dark:border-[#1e3a8a] px-1.5 py-0.5 text-[11px] flex items-center gap-1 max-w-[120px] truncate" title={folderConfig.sheetName}>
                        📊 {folderConfig.sheetName}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-[#b45309] dark:text-amber-400 font-bold">Sin carpetas configuradas</span>
              )}
            </div>
            <button
              onClick={() => setIsFolderModalOpen(true)}
              className="ml-1 text-[11px] font-bold text-[#1e293b] dark:text-[#93c5fd] hover:underline bg-[#ffffff] dark:bg-[#0e1930] px-2 py-0.5 border border-[#ded8cb] dark:border-[#1c2e52] cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Settings2 className="w-3 h-3" />
              Configurar
            </button>
          </div>

          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            className="px-2.5 py-1.5 bg-[#faf8f3] dark:bg-[#132244] hover:bg-[#f0ece1] dark:hover:bg-[#182c58] text-[#2c3e50] dark:text-[#e2e8f0] border border-[#ded8cb] dark:border-[#1c2e52] transition-colors cursor-pointer"
            title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-[#1e293b]" />}
          </button>

          {/* Logout Button */}
          <button
            onClick={() => setIsLogoutModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold bg-[#faf8f3] dark:bg-[#132244] hover:bg-[#f0ece1] dark:hover:bg-[#182c58] text-[#2c3e50] dark:text-[#e2e8f0] border border-[#ded8cb] dark:border-[#1c2e52] px-3 py-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-[#5e6a7d] dark:text-[#93a2b7]" />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 p-4 sm:p-5 grid grid-cols-12 gap-4 sm:gap-5 overflow-hidden">
        {/* Left Column: Upload & Scanner Form */}
        <section className="col-span-12 lg:col-span-7 flex flex-col overflow-hidden h-full">
          <div className="flex-1 overflow-hidden h-full">
            <UploadForm
              onUploadSuccess={() => setRefreshTrigger((prev) => prev + 1)}
              folderConfig={folderConfig}
              onOpenFolderModal={() => setIsFolderModalOpen(true)}
            />
          </div>
        </section>

        {/* Right Column: Pending Documents & History Feed */}
        <aside className="col-span-12 lg:col-span-5 flex flex-col gap-4 overflow-hidden h-full">
          <PendingDocs refreshTrigger={refreshTrigger} folderConfig={folderConfig} />
          <History refreshTrigger={refreshTrigger} folderConfig={folderConfig} />
        </aside>
      </main>

      {/* Classic Footer */}
      <footer className="bg-[#ffffff] dark:bg-[#0e1930] border-t border-[#ded8cb] dark:border-[#1c2e52] px-6 py-2 flex justify-between items-center shrink-0 text-[11px] text-[#5e6a7d] dark:text-[#93a2b7]">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="LegalFlow" className="w-3.5 h-3.5 object-contain" />
          <span className="font-bold text-[#1e293b] dark:text-[#f1f5f9]">LEGALFLOW</span>
          <span>•</span>
          <span>Extracción Multimodal con IA Gemini</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-600 dark:bg-emerald-400" />
          <span>Google Drive & Sheets Conectados</span>
        </div>
      </footer>

      {/* Folder Setup Modal */}
      <FolderSetupModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        currentConfig={folderConfig}
        onSaveConfig={handleSaveFolderConfig}
        isInitialSetup={!folderConfig}
      />

      {/* Logout Confirmation Modal (Sharp classic) */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-[#ffffff] dark:bg-[#0e1930] max-w-sm w-full p-6 border border-[#ded8cb] dark:border-[#1c2e52] relative text-left space-y-4 shadow-lg">
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="absolute top-4 right-4 text-[#5e6a7d] hover:text-[#1e293b] dark:hover:text-white p-1 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#17202a] dark:text-white uppercase tracking-wide">
                    ¿Cerrar sesión?
                  </h3>
                  <p className="text-xs text-[#5e6a7d] dark:text-[#93a2b7]">Confirmación de salida</p>
                </div>
              </div>

              <p className="text-xs text-[#475569] dark:text-[#cbd5e1] leading-relaxed">
                Tendrás que volver a autenticarte con tu cuenta de Google para acceder a los documentos y sincronización.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#ded8cb] dark:border-[#1c2e52]">
                <button
                  type="button"
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#334155] dark:text-[#cbd5e1] bg-[#faf8f3] dark:bg-[#132244] hover:bg-[#f0ece1] dark:hover:bg-[#182c58] border border-[#ded8cb] dark:border-[#1c2e52] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleLogoutConfirm}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


