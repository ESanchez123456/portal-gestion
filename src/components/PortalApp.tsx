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

function LoginGate() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(''); setOk('');
    if (!email.trim() || !pass) { setErr('Ingresa tu correo y contraseña.'); return; }
    setBusy(true);
    try { await getBackend().signIn(email.trim(), pass); }
    catch (e) {
      const code = (e as { code?: string })?.code || '';
      let msg = 'No se pudo iniciar sesión.';
      if (/invalid-credential|wrong-password|user-not-found/.test(code)) msg = 'Correo o contraseña incorrectos.';
      else if (/too-many-requests/.test(code)) msg = 'Demasiados intentos. Intenta más tarde o restablece tu contraseña.';
      else if (/invalid-email/.test(code)) msg = 'El correo ingresado no es válido.';
      setErr(msg);
    } finally { setBusy(false); }
  };
  const forgot = async () => {
    setErr(''); setOk('');
    if (!email.trim()) { setErr('Ingresa tu correo arriba y luego toca "¿Olvidaste tu contraseña?" para recibir el enlace de restablecimiento.'); return; }
    try { await getBackend().resetPassword(email.trim()); } catch { /* no revelar si existe */ }
    setOk('Si el correo está registrado, te llegará un enlace para restablecer tu contraseña.');
  };
  return (
    <div id="loginGate">
      <div className="login-box">
        <div className="login-logo">
          <div className="tb-logo">VT</div>
          <div><div className="login-title">Portal Gestión</div><div className="login-sub">Vinatea &amp; Toyama · CID</div></div>
        </div>
        <div className="login-err" style={{ display: err ? 'block' : 'none' }}>{err}</div>
        <div className="login-ok" style={{ display: ok ? 'block' : 'none' }}>{ok}</div>
        <div className="login-field"><label>Correo corporativo</label>
          <input type="email" value={email} placeholder="nombre@vinateatoyama.com" autoComplete="username" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></div>
        <div className="login-field"><label>Contraseña</label>
          <input type="password" value={pass} placeholder="••••••••" autoComplete="current-password" onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></div>
        <button className="login-btn" disabled={busy} onClick={submit}>{busy ? 'Ingresando…' : 'Iniciar sesión'}</button>
        <span className="login-forgot" onClick={forgot}>¿Olvidaste tu contraseña?</span>
      </div>
    </div>
  );
}

export default function PortalApp() {
  const user = usePortal((s) => s.user);
  const kvReady = usePortal((s) => s.kvReady);
  const activeTab = usePortal((s) => s.activeTab);
  const setActiveTab = usePortal((s) => s.setActiveTab);
  const toast = usePortal((s) => s.toast);
  const dataLabel = usePortal((s) => s.dataLabel);
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Sesión + carga inicial + escucha en vivo
  useEffect(() => {
    const be = getBackend();
    let unKV: (() => void) | null = null;
    const unAuth = be.onAuthChanged(async (u) => {
      const st = usePortal.getState();
      setAuthChecked(true);
      if (!u) { unKV?.(); unKV = null; st.setUser(null); usePortal.setState({ kvReady: false, kv: {} }); return; }
      const email = u.email.toLowerCase();
      st.setUser({ email, name: PORTAL_USERS[email] || u.email || 'Usuario' });
      setLoading(true);
      try {
        st.setKVAll(await be.loadAllKV());
        unKV?.();
        unKV = be.listenKV((changes) => {
          usePortal.getState().applyKVChanges(changes);
          // Si el uploader publicó datos nuevos y no soy quien los subió, los recibo
          if (!esUploaderAutorizado() && changes.some((c) => c.key.indexOf('xdata_') === 0)) {
            try { cargarDatosExcelDesdeKV(); sincronizarJuzgadosConRT(); } catch (e) { console.error(e); }
          }
        });
        try { cargarDatosExcelDesdeKV(); sincronizarJuzgadosConRT(); } catch (e) { console.error('Error recibiendo datos del equipo', e); }
      } catch (e) {
        console.error('Error cargando datos', e);
        usePortal.setState({ kvReady: true });
      } finally { setLoading(false); }
    });
    return () => { unAuth(); unKV?.(); };
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
      {!ready && !loading && <LoginGate />}
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
                <div><div>{user.name}</div><div className="tb-user-out" onClick={() => getBackend().signOut()}>Cerrar sesión</div></div>
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
