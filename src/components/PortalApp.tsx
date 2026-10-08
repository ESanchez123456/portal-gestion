'use client';
import { useEffect, useState } from 'react';
import { usePortal, type TabName } from '@/store/portal';
import { getBackend } from '@/lib/backend';
import { PORTAL_USERS } from '@/lib/constants';
import { esAdmin, esUploaderAutorizado } from '@/lib/audit';
import { cargarDatosExcelDesdeKV } from '@/lib/excel/publish';
import { sincronizarJuzgadosConRT } from '@/lib/juzgados';
import ModalHost from '@/components/ModalHost';
import ReporteView from '@/views/ReporteView';
import AudienciasView from '@/views/AudienciasView';
import GestionView from '@/views/GestionView';
import ParalegalView from '@/views/ParalegalView';
import JuzgadosView from '@/views/JuzgadosView';
import AdminView from '@/views/AdminView';

export default function PortalApp() {
  const user = usePortal((s) => s.user);
  const kvReady = usePortal((s) => s.kvReady);
  const activeTab = usePortal((s) => s.activeTab);
  const setActiveTab = usePortal((s) => s.setActiveTab);
  const toast = usePortal((s) => s.toast);
  const dataLabel = usePortal((s) => s.dataLabel);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Carga inicial (sin login: el usuario lo da el backend; en modo local es fijo)
  useEffect(() => {
    const be = getBackend();
    let unKV: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const st = usePortal.getState();
      setLoading(true);
      try {
        const u = await be.getUser();
        const email = (u.email || '').toLowerCase();
        st.setUser({ email, name: u.name || PORTAL_USERS[email] || u.email || 'Usuario' });
        st.setKVAll(await be.loadAllKV());
        if (cancelled) return;
        unKV = be.listenKV((changes) => {
          usePortal.getState().applyKVChanges(changes);
          if (!esUploaderAutorizado() && changes.some((c) => c.key.indexOf('xdata_') === 0)) {
            try { cargarDatosExcelDesdeKV(); sincronizarJuzgadosConRT(); } catch (e) { console.error(e); }
          }
        });
        try { cargarDatosExcelDesdeKV(); sincronizarJuzgadosConRT(); } catch (e) { console.error('Error cargando datos guardados', e); }
      } catch (e) {
        console.error('Error iniciando', e);
        usePortal.setState({ kvReady: true });
      } finally { setLoading(false); setAuthChecked(true); }
    })();
    return () => { cancelled = true; unKV?.(); };
  }, []);

  const admin = user ? esAdmin() : false;
  const uploader = user ? esUploaderAutorizado() : false;
  const initials = (user?.name || '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const nav: { id: TabName; label: string; show: boolean }[] = [
    { id: 'reporte', label: 'Reporte total', show: true },
    { id: 'audiencias', label: 'Próximas audiencias', show: true },
    { id: 'gestion', label: 'Tareas de Gestión', show: true },
    { id: 'paralegal', label: 'Panel Paralegal', show: admin },
    { id: 'juzgados', label: '⚖ Juzgados', show: true },
    { id: 'admin', label: '⚙ Admin', show: admin },
  ];

  if (!authChecked) return <div id="kvLoading" className="show">Cargando…</div>;
  const ready = !!user && kvReady;
  return (
    <>
      <div id="kvLoading" className={loading ? 'show' : ''}>Sincronizando datos del equipo…</div>
      <div id="appRoot" className={ready ? 'ready' : ''}>
        <div className="topbar">
          <div className="tb-brand">
            <div className="tb-logo">VT</div>
            <div><div className="tb-title">Portal Gestión <span className="tb-crumb">› Vinatea &amp; Toyama · CID</span></div></div>
          </div>
          <nav className="tb-nav">
            {nav.filter((n) => n.show).map((n) => (
              <div key={n.id} className={'tnav' + (activeTab === n.id ? ' active' : '')} onClick={() => setActiveTab(n.id)}>{n.label}</div>
            ))}
          </nav>
          <div className="tb-right">
            {dataLabel && <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginRight: 10 }}>{dataLabel}</span>}
            {user && (
              <div className="tb-user" style={{ display: 'flex' }}>
                <div className="tb-user-av">{initials}</div>
                <div><div>{user.name}</div><div className="tb-user-out" style={{ cursor: 'default', textDecoration: 'none' }}>Modo pruebas (local)</div></div>
              </div>
            )}
            {uploader && (
              <button className="tbtn-upload" style={{ display: 'flex' }} onClick={() => usePortal.getState().openModal('carga')}>
                <span style={{ fontSize: 13 }}>↑</span> Cargar Excel
              </button>
            )}
          </div>
        </div>
        {/* Todas las vistas permanecen montadas (conservan filtros/paginación) y solo se muestra la activa */}
        <div className={'tab-content' + (activeTab === 'reporte' ? ' active' : '')} id="tab-reporte"><ReporteView /></div>
        <div className={'tab-content' + (activeTab === 'audiencias' ? ' active' : '')} id="tab-audiencias"><AudienciasView /></div>
        <div className={'tab-content' + (activeTab === 'gestion' ? ' active' : '')} id="tab-gestion"><GestionView /></div>
        {admin && <div className={'tab-content' + (activeTab === 'paralegal' ? ' active' : '')} id="tab-paralegal"><ParalegalView /></div>}
        <div className={'tab-content' + (activeTab === 'juzgados' ? ' active' : '')} id="tab-juzgados"><JuzgadosView /></div>
        {admin && <div className={'tab-content' + (activeTab === 'admin' ? ' active' : '')} id="tab-admin"><AdminView /></div>}
        <ModalHost />
        <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', background: 'var(--dark)', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 12, fontWeight: 500, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,.25)', opacity: toast ? 1 : 0, transition: 'opacity .3s', pointerEvents: 'none' }}>{toast}</div>
      </div>
    </>
  );
}
