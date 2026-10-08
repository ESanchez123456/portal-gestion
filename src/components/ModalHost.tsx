'use client';
import { usePortal, type ModalName } from '@/store/portal';
import CargaModal from '@/modals/CargaModal';
import AgendarModal from '@/modals/AgendarModal';
import BulkAgendarModal from '@/modals/BulkAgendarModal';
import ObsProcModal from '@/modals/ObsProcModal';
import GestionarTareaModal from '@/modals/GestionarTareaModal';
import NuevaTareaModal from '@/modals/NuevaTareaModal';
import RedirigirModal from '@/modals/RedirigirModal';
import DevolverTareaModal from '@/modals/DevolverTareaModal';
import ComentariosTareaModal from '@/modals/ComentariosTareaModal';
import FavUserModal from '@/modals/FavUserModal';
import DiligenciaModal from '@/modals/DiligenciaModal';
import PlannerTareaModal from '@/modals/PlannerTareaModal';
import JuzgadoModal from '@/modals/JuzgadoModal';

type MC = React.ComponentType<{ payload: unknown; onClose: () => void }>;
const REG: Record<ModalName, MC> = {
  carga: CargaModal, agendar: AgendarModal, bulkAgendar: BulkAgendarModal, obsProc: ObsProcModal,
  gestionarTarea: GestionarTareaModal, nuevaTarea: NuevaTareaModal, redirigir: RedirigirModal,
  devolverTarea: DevolverTareaModal, comentariosTarea: ComentariosTareaModal, favUser: FavUserModal,
  diligencia: DiligenciaModal, plannerTarea: PlannerTareaModal, juzgado: JuzgadoModal,
};

/** Renderiza los modales abiertos. Abrir: usePortal.getState().openModal('agendar', {procId: 123}) */
export default function ModalHost() {
  const modals = usePortal((s) => s.modals);
  const closeModal = usePortal((s) => s.closeModal);
  const errorMsg = usePortal((s) => s.errorMsg);
  const showError = usePortal((s) => s.showError);
  return (
    <>
      {(Object.keys(modals) as ModalName[]).map((name) => {
        const C = REG[name];
        return C ? <C key={name} payload={modals[name]} onClose={() => closeModal(name)} /> : null;
      })}
      {errorMsg && (
        <div className="overlay show" onClick={(e) => { if (e.target === e.currentTarget) showError(''); }}>
          <div className="modal" style={{ padding: 24, maxWidth: 420 }}>
            <div style={{ whiteSpace: 'pre-wrap', marginBottom: 16 }}>{errorMsg}</div>
            <button className="btn-sm" onClick={() => showError('')}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}
