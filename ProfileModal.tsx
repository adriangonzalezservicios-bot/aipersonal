import React from 'react';
import { X, UserCheck, ShieldCheck, Briefcase, BookOpen, Sliders, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../types/consensus';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onToggleActive: () => void;
  onUpdateDirectives: (directives: string) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onToggleActive,
  onUpdateDirectives,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white">Perfil Activo: {profile.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {profile.isActive ? 'Socio Activo' : 'Pausado'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Socio estratégico y asistente de proyectos (42 años, Castelar/BsAs)
              </p>
            </div>
          </div>

          <button
            onClick={onToggleActive}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              profile.isActive
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {profile.isActive ? 'Perfil Inyectado en IAs' : 'Inyectar Perfil'}
          </button>
        </div>

        {/* Profile Details */}
        <div className="space-y-4 text-xs text-slate-300">
          {/* Rules and communication */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <span className="font-bold text-slate-200 block text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              Preferencias de Comunicación y Juicio:
            </span>
            <ul className="space-y-1 text-slate-300 pl-1">
              <li>• <strong>Idioma y Tono:</strong> Español rioplatense (voseo: fijate, hacé, considerá), directo, claro, profesional.</li>
              <li>• <strong>Sin emojis:</strong> Salvo que los solicites expresamente.</li>
              <li>• <strong>Cero complacencia:</strong> No halagar ni buscar agradar; marcar riesgos, errores y costos ocultos.</li>
              <li>• <strong>Preservación funcional:</strong> Mejoras incrementales antes de proponer reconstruir desde cero.</li>
              <li>• <strong>Cadena de valor:</strong> IDEA → TECNOLOGÍA → NEGOCIO → EJECUCIÓN → CRECIMIENTO.</li>
            </ul>
          </div>

          {/* Current businesses */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <span className="font-bold text-slate-200 block text-xs flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-amber-400" />
              Negocios & Contexto Operativo:
            </span>
            <ul className="space-y-1 text-slate-300 pl-1">
              {profile.businesses.map((b, i) => (
                <li key={i}>• {b}</li>
              ))}
            </ul>
          </div>

          {/* Literary Project */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <span className="font-bold text-slate-200 block text-xs flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-purple-400" />
              Libro Autobiográfico (Manuscrito en proceso):
            </span>
            <p className="text-slate-300 leading-relaxed">
              {profile.bookProject}
            </p>
          </div>

          {/* System Directives Editor */}
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-sky-400" />
              Directivas Maestras del Perfil (Inyectadas en cada IA y en el Árbitro):
            </label>
            <textarea
              rows={5}
              value={profile.systemDirectives}
              onChange={(e) => onUpdateDirectives(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Podés ajustar estas directivas en cualquier momento. Se guardan localmente en tu navegador.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
