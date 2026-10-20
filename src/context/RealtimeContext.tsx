import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { POI, CommunityReport, OperationalMetrics, FamilyPlan, WsMessage } from '../types';
import { INITIAL_POIS, INITIAL_REPORTS, INITIAL_METRICS, INITIAL_FAMILY_PLAN } from '../data/mockData';
import { API_BASE, WS_URL } from '../config';
import { useAuth } from './AuthContext';

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
}

interface RealtimeContextType {
  pois: POI[];
  reports: CommunityReport[];
  metrics: OperationalMetrics;
  familyPlan: FamilyPlan;
  connectedUsers: number;
  isWsConnected: boolean;
  toasts: ToastNotification[];
  removeToast: (id: string) => void;
  verifyPoi: (poiId: string) => Promise<void>;
  updatePoi: (poi: POI) => Promise<void>;
  createPoi: (poi: Partial<POI>) => Promise<void>;
  deletePoi: (poiId: string) => Promise<void>;
  submitReport: (
    report: Partial<CommunityReport> & { photo?: string; photoProofUrl?: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  resolveReport: (reportId: string, applyToPoi?: boolean) => Promise<void>;
  approveReport: (reportId: string) => Promise<{ ok: boolean; error?: string }>;
  togglePlanB: () => Promise<void>;
  changeCity: (city: string) => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoggedIn } = useAuth();
  const [pois, setPois] = useState<POI[]>(INITIAL_POIS);
  const [reports, setReports] = useState<CommunityReport[]>(INITIAL_REPORTS);
  const [metrics, setMetrics] = useState<OperationalMetrics>(INITIAL_METRICS);
  const [familyPlan, setFamilyPlan] = useState<FamilyPlan>(INITIAL_FAMILY_PLAN);
  const [connectedUsers, setConnectedUsers] = useState<number>(1);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  const addToast = useCallback((title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast = { id, title, message, timestamp: new Date().toLocaleTimeString('pt-PT') };
    setToasts((prev) => [newToast, ...prev].slice(0, 4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    let socket: WebSocket | undefined;
    let reconnectTimer: NodeJS.Timeout;
    let stopped = false;

    async function connect() {
      if (stopped) return;
      // Sem sessão não há handshake possível (o Durable Object exige bilhete ou
      // cookie). Não abrir socket evita um ciclo de reconexões a receber 401.
      if (!isLoggedIn) {
        setIsWsConnected(false);
        return;
      }
      // Autenticação do WebSocket: em produção o cookie de sessão vive no
      // domínio Vercel e o browser não o envia ao Worker (cross-site). Obtém-se
      // então um bilhete efémero same-origin (o cookie segue via rewrite) e
      // apresenta-se em `?ticket=`. Se o bilhete falhar, tenta-se o caminho
      // antigo por cookie (dev local / mesmo domínio).
      let wsUrl = WS_URL;
      try {
        const res = await fetch(`${API_BASE}/api/auth/ws-ticket`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const data = (await res.json()) as { ticket?: string };
          if (data?.ticket) {
            wsUrl += `${wsUrl.includes('?') ? '&' : '?'}ticket=${encodeURIComponent(data.ticket)}`;
          }
        }
      } catch {
        // Sem bilhete → segue com cookie
      }
      if (stopped) return;

      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setIsWsConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const message: WsMessage = JSON.parse(event.data);
            switch (message.type) {
              case 'init':
                setPois(message.data.pois);
                setReports(message.data.reports);
                setMetrics(message.data.metrics);
                setConnectedUsers(message.data.connectedUsers);
                break;
              case 'presence':
                setConnectedUsers(message.data.connectedUsers);
                break;
              case 'poi:update':
                setPois((prev) => prev.map((p) => (p.id === message.data.id ? message.data : p)));
                break;
              case 'poi:create':
                setPois((prev) => [message.data, ...prev.filter((p) => p.id !== message.data.id)]);
                break;
              case 'poi:delete':
                setPois((prev) => prev.filter((p) => p.id !== message.data.id));
                break;
              case 'report:create':
                setReports((prev) => [message.data, ...prev]);
                break;
              case 'report:update':
                setReports((prev) => prev.map((r) => (r.id === message.data.id ? message.data : r)));
                break;
              case 'plan:update':
                setFamilyPlan(message.data);
                break;
              case 'notification':
                addToast(message.data.title, message.data.message);
                break;
            }
          } catch {
            // Error parsing message
          }
        };

        socket.onclose = () => {
          setIsWsConnected(false);
          if (!stopped) reconnectTimer = setTimeout(connect, 3000);
        };

        socket.onerror = () => {
          socket?.close();
        };
      } catch {
        if (!stopped) reconnectTimer = setTimeout(connect, 4000);
      }
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [addToast, isLoggedIn]);

  const verifyPoi = async (poiId: string) => {
    // Send via WebSocket for instant server-authoritative broadcast
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'poi:verify', data: { id: poiId } }));
    }
    // Optimistic local update
    setPois((prev) =>
      prev.map((p) =>
        p.id === poiId
          ? {
              ...p,
              status: 'verified',
              verifiedAgoDays: 0,
              dataQualityScore: Math.min(100, p.dataQualityScore + 5),
            }
          : p
      )
    );
    addToast('POI Verificado', 'Os dados do espaço foram auditados e propagados em tempo real!');
  };

  const updatePoi = async (updated: POI) => {
    setPois((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    try {
      await fetch(`${API_BASE}/api/pois/${updated.id}`, { credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      addToast('Alteração Guardada', `Ficha de "${updated.name}" atualizada com sucesso.`);
    } catch {
      // Handled optimistically
    }
  };

  const createPoi = async (newPoiData: Partial<POI>) => {
    try {
      const res = await fetch(`${API_BASE}/api/pois`, { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPoiData),
      });
      if (res.ok) {
        const created: POI = await res.json();
        setPois((prev) => [created, ...prev]);
        addToast('POI Criado', `"${created.name}" publicado no diretório.`);
      }
    } catch {
      // Ignored
    }
  };

  const deletePoi = async (poiId: string) => {
    setPois((prev) => prev.filter((p) => p.id !== poiId));
    try {
      await fetch(`${API_BASE}/api/pois/${poiId}`, { method: 'DELETE', credentials: 'include' });
      addToast('POI Arquivado', 'O ponto de interesse foi removido do catálogo público.');
    } catch {
      // Ignored
    }
  };

  const submitReport = async (
    reportData: Partial<CommunityReport> & { photo?: string; photoProofUrl?: string }
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/api/reports`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });
      if (res.ok) {
        const created = (await res.json()) as CommunityReport;
        setReports((prev) => [created, ...prev]);
        addToast('Obrigado!', 'O teu alerta foi enviado à equipa curatorial.');
        return { ok: true };
      }
      // Devolve a mensagem do servidor (400 validação, 413 foto grande, 500…)
      // para o modal a poder mostrar em vez de fechar silenciosamente.
      let message = 'Não foi possível enviar a contribuição. Tente novamente.';
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // resposta sem corpo JSON
      }
      return { ok: false, error: message };
    } catch {
      return { ok: false, error: 'Falha de rede. Verifica a ligação e tenta novamente.' };
    }
  };

  const resolveReport = async (reportId: string, applyToPoi = true) => {
    try {
      const res = await fetch(`${API_BASE}/api/reports/${reportId}`, { credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', applyToPoi }),
      });
      if (res.ok) {
        const updated = (await res.json()) as CommunityReport;
        setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
        addToast('Reporte Aprovado', 'Alterações propagadas de imediato na app mobile dos pais.');
      }
    } catch {
      // Ignored
    }
  };

  // RF-PROPOSE-05: aprova uma proposta de espaço novo. Cria o POI (em revisão),
  // resolve o reporte e liga-os. Só admin/curador (a API valida o papel).
  const approveReport = async (reportId: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/api/reports/${reportId}/approve`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const body = (await res.json()) as { poi: POI; report: CommunityReport };
        setPois((prev) => (prev.some((p) => p.id === body.poi.id) ? prev : [body.poi, ...prev]));
        setReports((prev) => prev.map((r) => (r.id === reportId ? body.report : r)));
        addToast('Proposta Aprovada', `"${body.poi.name}" criado no diretório (em revisão editorial).`);
        return { ok: true };
      }
      let message = 'Não foi possível aprovar a proposta.';
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // resposta sem corpo JSON
      }
      return { ok: false, error: message };
    } catch {
      return { ok: false, error: 'Falha de rede. Verifica a ligação e tenta novamente.' };
    }
  };

  const togglePlanB = async () => {
    const nextState = !familyPlan.isPlanBActive;
    setFamilyPlan((prev) => ({
      ...prev,
      isPlanBActive: nextState,
      budgetCalculated: nextState ? 40.0 : 38.0,
    }));
    try {
      await fetch(`${API_BASE}/api/plan/regenerate`, { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPlanB: nextState }),
      });
    } catch {
      // Ignored
    }
  };

  const changeCity = async (city: string) => {
    setFamilyPlan((prev) => ({ ...prev, city }));
    try {
      await fetch(`${API_BASE}/api/plan/regenerate`, { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city }),
      });
      addToast('Localização Alterada', `Roteiro e atividades atualizados para ${city}.`);
    } catch {
      // Ignored
    }
  };

  return (
    <RealtimeContext.Provider
      value={{
        pois,
        reports,
        metrics,
        familyPlan,
        connectedUsers,
        isWsConnected,
        toasts,
        removeToast,
        verifyPoi,
        updatePoi,
        createPoi,
        deletePoi,
        submitReport,
        resolveReport,
        approveReport,
        togglePlanB,
        changeCity,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used within a RealtimeProvider');
  return context;
};
