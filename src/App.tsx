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
  Scale
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
import { Ticket, ETAPAS } from "./types";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [selectedTicketForMove, setSelectedTicketForMove] = useState<{id: string, nextEtapa: Ticket["etapa"]} | null>(null);
  const [moveInfo, setMoveInfo] = useState({ solicitante: "", responsaveis: "" });
  
  const [newTicket, setNewTicket] = useState<Partial<Ticket>>({
    ticketNumber: "",
    ofNumber: "",
    etapa: "contratacao"
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTickets();
  }, []);

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
          const of = row["Ordem de Frete"]?.toString().trim();
          // Se não tiver OF, tratamos como registro único usando um ID temporário
          const key = of || `temp-${Math.random()}`;
          
          if (!groupedMap.has(key)) {
            groupedMap.set(key, {
              ...row,
              "Ordem de Frete": of, // Garantir que está trimado
              cidades: row["Cidade"] ? [row["Cidade"].trim()] : [],
              pesoTotal: parseFloat(row["Peso Remessa"]?.toString().replace(/\./g, '').replace(',', '.') || "0")
            });
          } else {
            const existing = groupedMap.get(key);
            if (row["Cidade"] && !existing.cidades.includes(row["Cidade"].trim())) {
              existing.cidades.push(row["Cidade"].trim());
            }
            const currentWeight = parseFloat(row["Peso Remessa"]?.toString().replace(/\./g, '').replace(',', '.') || "0");
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
        toast.success(`Importação concluída: ${importedCount} tickets adicionados.`);
        if (errorCount > 0) {
          toast.error(`${errorCount} registros falharam na importação.`);
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

  const updateTicketStatus = async (id: string, newEtapa: Ticket["etapa"], solicitante?: string, responsaveis?: string) => {
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
        turno
      };

      const historicoAtual = ticket.historico || [];
      const novoHistorico = [novaMovimentacao, ...historicoAtual];

      const response = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          etapa: newEtapa,
          historico: novoHistorico
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
    setMoveInfo({ solicitante: "", responsaveis: "" });
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
      updateTicketStatus(selectedTicketForMove.id, selectedTicketForMove.nextEtapa, moveInfo.solicitante, moveInfo.responsaveis);
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

  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);

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

  const getTicketsByEtapa = (etapaId: string) => {
    return filteredTickets.filter(t => t.etapa === etapaId);
  };

  const getWeightByEtapa = (etapaId: string) => {
    const stageTickets = getTicketsByEtapa(etapaId);
    const totalKg = stageTickets.reduce((sum, t) => sum + (Number(t.pesoRemessa) || 0), 0);
    return (totalKg / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
              <Upload className="w-4 h-4" /> Importar SAP
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

      {/* Kanban Board */}
      <main className="max-w-[1600px] mx-auto p-6">
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
                  {getWeightByEtapa(etapa.id)} TON
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
