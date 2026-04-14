/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Search, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2, 
  Truck, 
  Package, 
  ClipboardList, 
  FileText, 
  MoreHorizontal,
  XCircle,
  Clock,
  LayoutDashboard,
  Upload,
  Scale,
  Download,
  Mail,
  FileSpreadsheet
} from "lucide-react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { Ticket, ETAPAS, Movimentacao } from "./types";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = ['#ef4444', '#f97316', '#facc15', '#4ade80', '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6'];

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentView, setCurrentView] = useState<"kanban" | "dashboard">("kanban");
  const [selectedAnalysisEtapa, setSelectedAnalysisEtapa] = useState<string>("carregada");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [selectedTicketForMove, setSelectedTicketForMove] = useState<{id: string, nextEtapa: Ticket["etapa"]} | null>(null);
  const [moveInfo, setMoveInfo] = useState({ solicitante: "", responsaveis: "", comentario: "" });
  
  const [newTicket, setNewTicket] = useState<Partial<Ticket>>({
    ticketNumber: "",
    ofNumber: "",
    etapa: "contratacao"
  });
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const parseWeight = (val: any) => {
    if (typeof val === 'number') return val;
    const s = String(val || "0").trim();
    if (!s) return 0;
    
    // Detectar formato: se tiver vírgula e ponto, ou só vírgula como decimal
    // Formato BR: 1.234,56 ou 1234,56
    // Formato US: 1,234.56 ou 1234.56
    
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    
    if (hasComma && hasDot) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        // BR: 1.234,56
        return parseFloat(s.replace(/\./g, '').replace(',', '.'));
      } else {
        // US: 1,234.56
        return parseFloat(s.replace(/,/g, ''));
      }
    }
    
    if (hasComma) {
      // Pode ser 1234,56 (BR) ou 1,234 (US milhares)
      // Se tiver 3 dígitos após a vírgula, é ambíguo, mas geralmente vírgula é decimal em PT-BR
      return parseFloat(s.replace(',', '.'));
    }
    
    return parseFloat(s);
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const sapData = results.data as any[];
        
        // Agrupamento por OF
        const groupedMap = new Map<string, any>();

        sapData.forEach(row => {
          const statusOF = row["Status OF"]?.toString() || "";
          if (statusOF.includes("Partiu")) return;

          const of = row["Ordem de Frete"]?.toString().trim();
          // Se não tiver OF, tratamos como registro único usando um ID temporário
          const key = of || `temp-${Math.random()}`;
          
          if (!groupedMap.has(key)) {
            groupedMap.set(key, {
              ...row,
              "Ordem de Frete": of, // Garantir que está trimado
              cidades: row["Cidade"] ? [row["Cidade"].trim()] : [],
              pesoTotal: parseWeight(row["Peso Remessa"])
            });
          } else {
            const existing = groupedMap.get(key);
            if (row["Cidade"] && !existing.cidades.includes(row["Cidade"].trim())) {
              existing.cidades.push(row["Cidade"].trim());
            }
            const currentWeight = parseWeight(row["Peso Remessa"]);
            if (!isNaN(currentWeight)) {
              existing.pesoTotal += currentWeight;
            }
            // Se o registro existente não tiver ticket mas este tiver, atualiza
            if (!existing["Ticket/Protocolo"] && row["Ticket/Protocolo"]) {
              existing["Ticket/Protocolo"] = row["Ticket/Protocolo"];
            }
          }
        });

        const finalToImport = Array.from(groupedMap.values());
        let importedCount = 0;
        let errorCount = 0;

        toast.info(`Processando ${finalToImport.length} ordens de frete agrupadas...`);

        for (const row of finalToImport) {
          try {
            const ticketData: Partial<Ticket> = {
              ticketNumber: row["Ticket/Protocolo"] || "",
              ofNumber: row["Ordem de Frete"] || "",
              remessa: row["Remessa"],
              ordemVenda: row["Ordem Venda"],
              cidade: row.cidades.join(", "),
              statusOF: row["Status OF"],
              tipoVeiculo: row["Tipo Veiculo"],
              placaVeiculo: row["Placa Veiculo"],
              transportadora: row["Transportadora"],
              pedidoCompras: row["Pedido de Compras"],
              capacidadeMaxima: row["Capacidade Maxima"],
              utilizacao: row["Utilização"],
              dataCriacao: row["Data Criação"],
              pesoRemessa: row.pesoTotal,
              unidadeMedida: row["Unidade Medida"] || "KG",
              incoterms: row["Incoterms"],
              cliente: row["Cliente"],
              refCliente: row["Ref Cliente"],
              faturaFrete: row["Fatura do Frete"],
              tipoDocumento: row["Tipo Documento"],
              criadoPor: row["Criado Por"],
              contrato: row["Contrato"],
              etapa: "contratacao"
            };

            if (ticketData.ofNumber || ticketData.ticketNumber) {
              const response = await fetch("/api/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ticketData),
              });
              
              if (response.ok) {
                importedCount++;
              } else {
                errorCount++;
              }
            }
          } catch (err) {
            errorCount++;
          }
        }

        fetchTickets();
        toast.success(`Sincronização SAP concluída: ${importedCount} ordens atualizadas ou adicionadas.`);
        if (errorCount > 0) {
          toast.error(`${errorCount} registros falharam na sincronização.`);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      error: (error) => {
        toast.error("Erro ao ler o arquivo CSV: " + error.message);
      }
    });
  };

  const fetchTickets = async () => {
    try {
      const response = await fetch("/api/tickets");
      const data = await response.json();
      setTickets(data);
    } catch (error) {
      toast.error("Erro ao carregar tickets");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTicket = async () => {
    if (!newTicket.ticketNumber && !newTicket.ofNumber) {
      toast.error("Número do Ticket ou OF é obrigatório");
      return;
    }

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTicket),
      });
      const data = await response.json();
      setTickets([...tickets, data]);
      setIsAddDialogOpen(false);
      setNewTicket({ ticketNumber: "", ofNumber: "", etapa: "contratacao" });
      toast.success("Ticket adicionado com sucesso");
    } catch (error) {
      toast.error("Erro ao adicionar ticket");
    }
  };

  const updateTicketStatus = async (id: string, newEtapa: Ticket["etapa"], solicitante?: string, responsaveis?: string, comentario?: string) => {
    try {
      const ticket = tickets.find(t => t.id === id);
      if (!ticket) return;

      const now = new Date();
      const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
      
      let turno = "N/A";
      // Turno 1: 05:30 as 14:58
      // Turno 2: 13:50 as 23:08
      // Turno 3: 21:15 as 05:49
      
      const minutes = now.getHours() * 60 + now.getMinutes();
      const t1Start = 5 * 60 + 30;
      const t1End = 14 * 60 + 58;
      const t2Start = 13 * 60 + 50;
      const t2End = 23 * 60 + 8;
      const t3Start = 21 * 60 + 15;
      const t3End = 5 * 60 + 49;

      if (minutes >= t1Start && minutes <= t1End) turno = "Turno 1";
      else if (minutes >= t2Start && minutes <= t2End) turno = "Turno 2";
      else if (minutes >= t3Start || minutes <= t3End) turno = "Turno 3";

      const novaMovimentacao = {
        id: crypto.randomUUID(),
        etapaAnterior: ticket.etapa,
        etapaNova: newEtapa,
        solicitante: solicitante || "N/A",
        responsaveis: responsaveis || "N/A",
        dataHora: now.toISOString(),
        turno,
        comentario: comentario || ""
      };

      const historicoAtual = ticket.historico || [];
      const novoHistorico = [novaMovimentacao, ...historicoAtual];

      const response = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          etapa: newEtapa,
          historico: novoHistorico,
          comentario: comentario || ticket.comentario
        }),
      });
      const updated = await response.json();
      setTickets(tickets.map(t => t.id === id ? updated : t));
      toast.success(`Status atualizado para: ${ETAPAS.find(e => e.id === newEtapa)?.label}`);
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleMoveClick = (id: string, nextEtapa: Ticket["etapa"]) => {
    setSelectedTicketForMove({ id, nextEtapa });
    setMoveInfo({ solicitante: "", responsaveis: "", comentario: "" });
    setIsMoveDialogOpen(true);
  };

  const confirmMove = () => {
    const ticket = tickets.find(t => t.id === selectedTicketForMove?.id);
    const isOptionalResponsible = ticket && ["contratacao", "separada", "carregada"].includes(ticket.etapa);

    if (!moveInfo.solicitante) {
      toast.error("O campo Solicitante é obrigatório");
      return;
    }

    if (!isOptionalResponsible && !moveInfo.responsaveis) {
      toast.error("O campo Responsáveis é obrigatório para esta etapa");
      return;
    }

    if (selectedTicketForMove) {
      updateTicketStatus(selectedTicketForMove.id, selectedTicketForMove.nextEtapa, moveInfo.solicitante, moveInfo.responsaveis, moveInfo.comentario);
      setIsMoveDialogOpen(false);
      setSelectedTicketForMove(null);
    }
  };

  const deleteTicket = async (id: string) => {
    try {
      await fetch(`/api/tickets/${id}`, { method: "DELETE" });
      setTickets(tickets.filter(t => t.id !== id));
      toast.success("Ticket removido");
    } catch (error) {
      toast.error("Erro ao remover ticket");
    }
  };

  const exportBacklog = () => {
    const allMovements: any[] = [];
    
    tickets.forEach(ticket => {
      if (ticket.historico && ticket.historico.length > 0) {
        ticket.historico.forEach(mov => {
          allMovements.push({
            "Ticket": ticket.ticketNumber || "N/A",
            "OF": ticket.ofNumber || "N/A",
            "Cliente": ticket.cliente || "N/A",
            "Etapa Anterior": ETAPAS.find(e => e.id === mov.etapaAnterior)?.label || mov.etapaAnterior,
            "Etapa Nova": ETAPAS.find(e => e.id === mov.etapaNova)?.label || mov.etapaNova,
            "Solicitante": mov.solicitante,
            "Responsáveis": mov.responsaveis,
            "Data": new Date(mov.dataHora).toLocaleDateString('pt-BR'),
            "Hora": new Date(mov.dataHora).toLocaleTimeString('pt-BR'),
            "Turno": mov.turno,
            "Comentário": mov.comentario || ""
          });
        });
      }
    });

    if (allMovements.length === 0) {
      toast.error("Nenhum movimento registrado para exportar");
      return;
    }

    const csv = Papa.unparse(allMovements);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `backlog_movimentacoes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Backlog exportado com sucesso");
  };

  const sendShiftReport = () => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    
    let currentTurno = "N/A";
    if (minutes >= (5 * 60 + 30) && minutes <= (14 * 60 + 58)) currentTurno = "Turno 1";
    else if (minutes >= (13 * 60 + 50) && minutes <= (23 * 60 + 8)) currentTurno = "Turno 2";
    else if (minutes >= (21 * 60 + 15) || minutes <= (5 * 60 + 49)) currentTurno = "Turno 3";

    // Pegar a última movimentação de cada OF no turno atual
    const shiftMovements = new Map<string, any>();
    
    tickets.forEach(ticket => {
      if (ticket.historico) {
        const lastMoveInShift = [...ticket.historico]
          .filter(mov => mov.turno === currentTurno)
          .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())[0];
          
        if (lastMoveInShift) {
          shiftMovements.set(ticket.ofNumber, {
            ticket: ticket.ticketNumber,
            of: ticket.ofNumber,
            cliente: ticket.cliente,
            etapa: ETAPAS.find(e => e.id === lastMoveInShift.etapaNova)?.label,
            solicitante: lastMoveInShift.solicitante,
            hora: new Date(lastMoveInShift.dataHora).toLocaleTimeString('pt-BR'),
            comentario: lastMoveInShift.comentario || ""
          });
        }
      }
    });

    if (shiftMovements.size === 0) {
      toast.error(`Nenhuma movimentação encontrada no ${currentTurno}`);
      return;
    }

    let emailBody = `Relatório de Movimentações - ${currentTurno}\n`;
    emailBody += `Data: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    emailBody += `OF | Ticket | Cliente | Etapa Atual | Solicitante | Hora | Comentário\n`;
    emailBody += `-`.repeat(80) + `\n`;

    shiftMovements.forEach(m => {
      emailBody += `${m.of} | ${m.ticket || 'N/A'} | ${m.cliente || 'N/A'} | ${m.etapa} | ${m.solicitante} | ${m.hora} | ${m.comentario}\n`;
    });

    const mailtoLink = `mailto:?subject=Relatorio de Movimentacoes - ${currentTurno}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoLink;
    toast.success("Relatório preparado no seu cliente de e-mail");
  };

  const clearAllTickets = async () => {
    try {
      const response = await fetch("/api/tickets/clear", { method: "POST" });
      if (response.ok) {
        setTickets([]);
        toast.success("Todos os tickets foram removidos");
        setIsClearDialogOpen(false);
      }
    } catch (error) {
      toast.error("Erro ao limpar dados");
    }
  };

  const filteredTickets = tickets.filter(t => 
    (t.ticketNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     t.ofNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     t.cliente?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    t.etapa !== "concluido"
  );

  const getTicketsByEtapa = (etapaId: string, all = false) => {
    const base = all ? tickets : filteredTickets;
    return base.filter(t => t.etapa === etapaId);
  };

  const getWeightByEtapa = (etapaId: string, all = false) => {
    const stageTickets = getTicketsByEtapa(etapaId, all);
    const total = stageTickets.reduce((sum, t) => {
      const weight = Number(t.pesoRemessa) || 0;
      // Se a unidade for TON, não divide por 1000. Se for KG (ou vazio), divide.
      const isTon = t.unidadeMedida?.toUpperCase().includes('TON') || t.unidadeMedida?.toUpperCase().includes('TN');
      return sum + (isTon ? weight : weight / 1000);
    }, 0);
    return total;
  };

  const formatWeight = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getAverageTimeByEtapa = (etapaId: string) => {
    const stageTickets = tickets.filter(t => t.etapa === etapaId);
    if (stageTickets.length === 0) return 0;

    const totalMs = stageTickets.reduce((sum, t) => {
      const start = new Date(t.createdAt).getTime();
      const end = t.etapa === 'concluido' && t.historico?.length 
        ? new Date(t.historico[0].dataHora).getTime() 
        : Date.now();
      return sum + (end - start);
    }, 0);

    return totalMs / stageTickets.length / (1000 * 60 * 60); // Retorna em horas
  };

  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const getMovementsByDayAndShift = (etapaId: string) => {
    const dataMap: Record<string, any> = {};
    
    tickets.forEach(ticket => {
      ticket.historico?.forEach(mov => {
        if (mov.etapaNova === etapaId) {
          const date = new Date(mov.dataHora).toLocaleDateString('pt-BR');
          const turno = mov.turno;
          
          if (!dataMap[date]) {
            dataMap[date] = { date, "Turno 1": 0, "Turno 2": 0, "Turno 3": 0 };
          }
          if (turno === "Turno 1" || turno === "Turno 2" || turno === "Turno 3") {
            dataMap[date][turno] = (dataMap[date][turno] || 0) + 1;
          }
        }
      });
    });
    
    return Object.values(dataMap).sort((a, b) => {
      const dateA = a.date.split('/').reverse().join('-');
      const dateB = b.date.split('/').reverse().join('-');
      return dateA.localeCompare(dateB);
    }).slice(-7); // Últimos 7 dias
  };

  const getOFsGrouped = () => {
    const grouped: Record<string, Record<string, Ticket[]>> = {};
    
    // Filtrar tickets que batem com a busca
    const filtered = tickets.filter(t => 
      t.ticketNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.ofNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.cliente?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.forEach(ticket => {
      const lastMov = ticket.historico?.[0];
      const date = lastMov 
        ? new Date(lastMov.dataHora).toLocaleDateString('pt-BR')
        : new Date(ticket.createdAt).toLocaleDateString('pt-BR');
      
      const turno = lastMov ? lastMov.turno : "N/A";
      
      if (!grouped[date]) grouped[date] = {};
      if (!grouped[date][turno]) grouped[date][turno] = [];
      grouped[date][turno].push(ticket);
    });
    
    return grouped;
  };

  const getIconForEtapa = (etapaId: string) => {
    switch (etapaId) {
      case "contratacao": return <Truck className="w-4 h-4" />;
      case "separar": return <ClipboardList className="w-4 h-4" />;
      case "separada": return <Package className="w-4 h-4" />;
      case "carregar": return <Truck className="w-4 h-4" />;
      case "carregada": return <CheckCircle2 className="w-4 h-4" />;
      case "pos_carregamento": return <Clock className="w-4 h-4" />;
      case "aguardando_nf": return <FileText className="w-4 h-4" />;
      default: return <LayoutDashboard className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-red-100">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
              <svg viewBox="0 0 100 100" className="w-8 h-8 text-white stroke-[6]">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" />
                <path d="M20 20 L80 80 M20 80 L80 20 M50 10 L50 90 M10 50 L90 50" stroke="currentColor" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Controle de Carregamento</h1>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Gerenciador de Rotina Operacional</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleImportCSV}
            />
            <Button 
              variant="outline" 
              className="border-gray-200 gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" /> Sincronizar SAP
            </Button>

            <Button 
              variant="outline" 
              className="border-gray-200 gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={exportBacklog}
            >
              <FileSpreadsheet className="w-4 h-4" /> Exportar Backlog
            </Button>

            <Button 
              variant="outline" 
              className="border-gray-200 gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={sendShiftReport}
            >
              <Mail className="w-4 h-4" /> Relatório Turno
            </Button>

            <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
              <DialogTrigger render={<Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-2" />}>
                <XCircle className="w-4 h-4" /> Limpar Tudo
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Limpar todos os dados?</DialogTitle>
                </DialogHeader>
                <div className="py-4 text-sm text-gray-500">
                  Esta ação irá apagar permanentemente todos os tickets e demandas do sistema. Esta ação não pode ser desfeita.
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsClearDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={clearAllTickets} className="bg-red-600 hover:bg-red-700 text-white">Sim, Apagar Tudo</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Buscar Ticket, OF ou Cliente..." 
                className="pl-10 bg-gray-50 border-gray-200 focus:ring-red-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
              <Button 
                variant={currentView === "kanban" ? "secondary" : "ghost"} 
                size="sm"
                className={`h-8 text-xs gap-2 ${currentView === "kanban" ? "bg-white shadow-sm" : ""}`}
                onClick={() => setCurrentView("kanban")}
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> Quadro
              </Button>
              <Button 
                variant={currentView === "dashboard" ? "secondary" : "ghost"} 
                size="sm"
                className={`h-8 text-xs gap-2 ${currentView === "dashboard" ? "bg-white shadow-sm" : ""}`}
                onClick={() => setCurrentView("dashboard")}
              >
                <Scale className="w-3.5 h-3.5" /> Resumo
              </Button>
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger render={<Button className="bg-red-600 hover:bg-red-700 text-white gap-2" />}>
                <Plus className="w-4 h-4" /> Novo Ticket
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Adicionar Nova Demanda</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Ticket / Protocolo (Guardian)</label>
                    <Input 
                      value={newTicket.ticketNumber} 
                      onChange={e => setNewTicket({...newTicket, ticketNumber: e.target.value})}
                      placeholder="Ex: 123456"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Ordem de Frete (SAP)</label>
                    <Input 
                      value={newTicket.ofNumber} 
                      onChange={e => setNewTicket({...newTicket, ofNumber: e.target.value})}
                      placeholder="Ex: 80001234"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Cliente</label>
                      <Input 
                        value={newTicket.cliente} 
                        onChange={e => setNewTicket({...newTicket, cliente: e.target.value})}
                        placeholder="Nome do Cliente"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Cidade</label>
                      <Input 
                        value={newTicket.cidade} 
                        onChange={e => setNewTicket({...newTicket, cidade: e.target.value})}
                        placeholder="Destino"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleAddTicket} className="bg-red-600 hover:bg-red-700">Salvar Demanda</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Kanban Board or Dashboard */}
      <main className="max-w-[1600px] mx-auto p-6">
        {currentView === "kanban" ? (
          <div className="flex gap-4 overflow-x-auto pb-6 min-h-[calc(100vh-140px)]">
            {ETAPAS.filter(e => e.id !== "concluido").map((etapa) => (
              <div key={etapa.id} className="flex-shrink-0 w-[280px] flex flex-col gap-4">
                <div className="flex flex-col gap-2 px-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{getIconForEtapa(etapa.id)}</span>
                      <h2 className="font-semibold text-sm uppercase tracking-wider text-gray-600">{etapa.label}</h2>
                    </div>
                    <Badge variant="secondary" className="bg-gray-200 text-gray-700 font-mono">
                      {getTicketsByEtapa(etapa.id).length}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full w-fit border border-red-100">
                    <Scale className="w-3 h-3" />
                    {formatWeight(getWeightByEtapa(etapa.id))} TON
                  </div>
                </div>

                <ScrollArea className="flex-1 bg-gray-100/50 rounded-xl p-2 border border-gray-200/50">
                  <div className="flex flex-col gap-3">
                    <AnimatePresence mode="popLayout">
                      {getTicketsByEtapa(etapa.id).map((ticket) => (
                        <motion.div
                          key={ticket.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Card className="shadow-sm border-gray-200 hover:border-red-300 transition-colors group cursor-default">
                            <CardContent className="p-4 flex flex-col gap-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="text-xs font-mono text-gray-400 mb-1">TICKET: {ticket.ticketNumber || "N/A"}</div>
                                  <div className="font-bold text-sm text-gray-900">OF: {ticket.ofNumber || "N/A"}</div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => deleteTicket(ticket.id)}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1">
                                {ticket.cliente && (
                                  <div className="text-xs font-bold text-gray-700 line-clamp-1">
                                    {ticket.cliente}
                                  </div>
                                )}
                                {ticket.cidade && (
                                  <div className="text-[10px] font-medium text-gray-500 flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1 text-gray-400 uppercase text-[9px] font-bold">
                                      <LayoutDashboard className="w-3 h-3" /> Destinos
                                    </div>
                                    <span className="line-clamp-3 leading-tight">{ticket.cidade}</span>
                                  </div>
                                )}
                                {ticket.comentario && (
                                  <div className="mt-1 p-2 bg-gray-50 rounded border border-gray-100 text-[10px] text-gray-600 italic">
                                    "{ticket.comentario}"
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <div className="flex flex-col gap-1">
                                  <div className="text-[10px] text-gray-400 font-mono">
                                    {new Date(ticket.createdAt).toLocaleDateString()}
                                  </div>
                                  {ticket.pesoRemessa !== undefined && (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-mono text-[10px] py-0 h-5">
                                      {Number(ticket.pesoRemessa).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {ticket.unidadeMedida || 'KG'}
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="flex gap-1.5">
                                    {etapa.id !== "contratacao" && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 text-[10px] px-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                        title="Voltar Etapa"
                                        onClick={() => {
                                          const currentIndex = ETAPAS.findIndex(e => e.id === etapa.id);
                                          if (currentIndex > 0) {
                                            handleMoveClick(ticket.id, ETAPAS[currentIndex - 1].id);
                                          }
                                        }}
                                      >
                                        <ArrowLeft className="w-3 h-3" />
                                      </Button>
                                    )}
                                    {etapa.id === "aguardando_nf" ? (
                                      <Button 
                                        size="sm" 
                                        className="h-7 bg-green-600 hover:bg-green-700 text-white text-[10px] px-2"
                                        onClick={() => handleMoveClick(ticket.id, "concluido")}
                                      >
                                        Encerrar
                                      </Button>
                                    ) : (
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-7 text-[10px] px-2 gap-1 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                                        onClick={() => {
                                          const currentIndex = ETAPAS.findIndex(e => e.id === etapa.id);
                                          if (currentIndex < ETAPAS.length - 1) {
                                            handleMoveClick(ticket.id, ETAPAS[currentIndex + 1].id);
                                          }
                                        }}
                                      >
                                        Próximo <ArrowRight className="w-3 h-3" />
                                      </Button>
                                    )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cards de Resumo */}
            <Card className="lg:col-span-3 border-gray-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Resumo Geral Operacional</CardTitle>
                <CardDescription>Métricas consolidadas baseadas nos filtros aplicados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="text-xs text-gray-500 uppercase font-bold mb-1">Total OFs</div>
                    <div className="text-2xl font-bold text-gray-900">{filteredTickets.length}</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                    <div className="text-xs text-red-600 uppercase font-bold mb-1">Peso Total (TON)</div>
                    <div className="text-2xl font-bold text-red-700">
                      {formatWeight(ETAPAS.reduce((acc, e) => acc + getWeightByEtapa(e.id), 0))}
                    </div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <div className="text-xs text-blue-600 uppercase font-bold mb-1">Tempo Médio Ciclo</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {formatDuration(tickets.length > 0 ? tickets.reduce((acc, t) => {
                        const start = new Date(t.createdAt).getTime();
                        const end = t.etapa === 'concluido' && t.historico?.length 
                          ? new Date(t.historico[0].dataHora).getTime() 
                          : Date.now();
                        return acc + (end - start);
                      }, 0) / tickets.length / (1000 * 60 * 60) : 0)}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                    <div className="text-xs text-green-600 uppercase font-bold mb-1">Concluídos (Turno)</div>
                    <div className="text-2xl font-bold text-green-700">
                      {tickets.filter(t => t.etapa === "concluido").length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gráfico de Pesos por Etapa */}
            <Card className="lg:col-span-2 border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="w-4 h-4 text-red-600" /> Distribuição de Pesos por Etapa (TON)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ETAPAS.filter(e => e.id !== "concluido").map(e => ({
                      name: e.label,
                      peso: getWeightByEtapa(e.id)
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f9fafb' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="peso" radius={[4, 4, 0, 0]}>
                      {ETAPAS.filter(e => e.id !== "concluido").map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tempo Médio por Etapa */}
            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" /> Tempo Médio de Permanência
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ETAPAS.filter(e => e.id !== "concluido").map((etapa, idx) => {
                    const avgTime = getAverageTimeByEtapa(etapa.id);
                    return (
                      <div key={etapa.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-sm text-gray-600">{etapa.label}</span>
                        </div>
                        <div className="text-sm font-mono font-bold text-gray-900">
                          {formatDuration(avgTime)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Produtividade por Turno */}
            <Card className="lg:col-span-3 border-gray-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="w-4 h-4 text-red-600" /> Produtividade: Carros por Dia e Turno
                  </CardTitle>
                  <CardDescription>Quantidade de tickets que entraram na etapa selecionada</CardDescription>
                </div>
                <div className="w-[200px]">
                  <Select value={selectedAnalysisEtapa} onValueChange={setSelectedAnalysisEtapa}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {ETAPAS.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getMovementsByDayAndShift(selectedAnalysisEtapa)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Bar dataKey="Turno 1" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Turno 2" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Turno 3" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Detalhamento de OFs por Turno */}
            <Card className="lg:col-span-3 border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" /> Detalhamento de OFs por Dia e Turno
                </CardTitle>
                <CardDescription>Lista completa de ordens movimentadas ou criadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(getOFsGrouped()).sort((a, b) => b[0].split('/').reverse().join('-').localeCompare(a[0].split('/').reverse().join('-'))).map(([date, turnos]) => (
                    <div key={date} className="space-y-3">
                      <h3 className="text-sm font-bold text-gray-900 border-b pb-1 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" /> {date}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {["Turno 1", "Turno 2", "Turno 3", "N/A"].map(turno => (
                          turnos[turno] && turnos[turno].length > 0 && (
                            <div key={turno} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                              <div className="text-[10px] font-bold uppercase text-gray-400 mb-2 flex justify-between items-center">
                                {turno}
                                <Badge variant="secondary" className="text-[9px] h-4">{turnos[turno].length} OFs</Badge>
                              </div>
                              <div className="space-y-2">
                                {turnos[turno].map(t => (
                                  <div key={t.id} className="bg-white p-2 rounded border border-gray-200 text-xs shadow-sm">
                                    <div className="font-bold text-gray-900">OF: {t.ofNumber}</div>
                                    <div className="text-gray-500 truncate">{t.cliente}</div>
                                    <div className="flex justify-between items-center mt-1">
                                      <Badge variant="outline" className="text-[9px] py-0 h-4 bg-red-50 text-red-700 border-red-100">
                                        {ETAPAS.find(e => e.id === t.etapa)?.label}
                                      </Badge>
                                      <span className="text-[9px] text-gray-400 font-mono">
                                        {formatWeight(Number(t.pesoRemessa) / (t.unidadeMedida?.toUpperCase().includes('TON') ? 1 : 1000))} TON
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  ))}
                  {Object.keys(getOFsGrouped()).length === 0 && (
                    <div className="text-center py-12 text-gray-400 italic text-sm">
                      Nenhum registro encontrado para os filtros aplicados.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Modal de Movimentação e Histórico */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Movimentar Ticket</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Solicitante:</label>
                <Input 
                  value={moveInfo.solicitante}
                  onChange={e => setMoveInfo({...moveInfo, solicitante: e.target.value})}
                  placeholder="Nome do solicitante"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Responsáveis: 
                  {selectedTicketForMove && ["contratacao", "separada", "carregada"].includes(tickets.find(t => t.id === selectedTicketForMove.id)?.etapa || "") && (
                    <span className="text-[10px] text-gray-400 font-normal ml-1">(Opcional)</span>
                  )}
                </label>
                <Input 
                  value={moveInfo.responsaveis}
                  onChange={e => setMoveInfo({...moveInfo, responsaveis: e.target.value})}
                  placeholder="Nomes dos responsáveis"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Comentários:</label>
              <textarea 
                className="flex min-h-[80px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={moveInfo.comentario}
                onChange={e => setMoveInfo({...moveInfo, comentario: e.target.value})}
                placeholder="Observações sobre esta movimentação..."
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-600" /> Histórico de Movimentações
              </h3>
              
              <div className="space-y-3">
                {selectedTicketForMove && tickets.find(t => t.id === selectedTicketForMove.id)?.historico?.length ? (
                  tickets.find(t => t.id === selectedTicketForMove.id)?.historico?.map((mov) => (
                    <div key={mov.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] uppercase">{ETAPAS.find(e => e.id === mov.etapaAnterior)?.label}</Badge>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <Badge className="text-[9px] uppercase bg-red-100 text-red-700 hover:bg-red-100 border-none">{ETAPAS.find(e => e.id === mov.etapaNova)?.label}</Badge>
                        </div>
                        <span className="text-gray-400 font-mono">{mov.turno}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-gray-600">
                        <div><span className="font-semibold">Solicitante:</span> {mov.solicitante}</div>
                        <div><span className="font-semibold">Responsáveis:</span> {mov.responsaveis}</div>
                        {mov.comentario && (
                          <div className="col-span-2 mt-1 p-1.5 bg-white rounded border border-gray-100 italic">
                            "{mov.comentario}"
                          </div>
                        )}
                        <div className="col-span-2 text-gray-400 mt-1">
                          {new Date(mov.dataHora).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400 text-sm italic">
                    Nenhuma movimentação registrada anteriormente.
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-auto pt-4 border-t">
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmMove} className="bg-red-600 hover:bg-red-700">Confirmar Avanço</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
