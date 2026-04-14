import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), "data.json");

app.use(express.json());

// Initialize data file if it doesn't exist
async function initData() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ tickets: [] }, null, 2));
  }
}

// API Routes
app.get("/api/tickets", async (req, res) => {
  const data = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
  res.json(data.tickets);
});

app.post("/api/tickets", async (req, res) => {
  const data = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
  const incoming = req.body;
  
  const parseIncomingWeight = (val: any) => {
    if (typeof val === 'number') return val;
    const s = String(val || "0").trim();
    if (!s) return 0;
    
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    
    if (hasComma && hasDot) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.'));
      } else {
        return parseFloat(s.replace(/,/g, ''));
      }
    }
    
    if (hasComma) {
      return parseFloat(s.replace(',', '.'));
    }
    
    return parseFloat(s);
  };

  // Se tiver OF, tentamos encontrar um existente para agrupar
  if (incoming.ofNumber) {
    const incomingOf = String(incoming.ofNumber).trim();
    const existingIndex = data.tickets.findIndex((t: any) => String(t.ofNumber).trim() === incomingOf);
    
    if (existingIndex !== -1) {
      const existing = data.tickets[existingIndex];
      
      // Agrupar cidades (evitando duplicatas)
      const existingCities = existing.cidade ? String(existing.cidade).split(", ").map((c: string) => c.trim()) : [];
      const incomingCities = incoming.cidade ? String(incoming.cidade).split(", ").map((c: string) => c.trim()) : [];
      const allCities = Array.from(new Set([...existingCities, ...incomingCities])).filter(Boolean);
      
      // Atualizar campos (exceto etapa e ID)
      data.tickets[existingIndex] = {
        ...existing,
        ...incoming, // Sobrescreve com os dados mais recentes
        id: existing.id, // Mantém o ID original
        etapa: existing.etapa, // Preserva a etapa atual do processo
        cidade: allCities.join(", "),
        pesoRemessa: parseIncomingWeight(incoming.pesoRemessa), // Substitui o peso pelo mais recente (já agrupado no front)
        ticketNumber: incoming.ticketNumber || existing.ticketNumber // Mantém o ticket se o novo for vazio
      };
      
      await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
      return res.json(data.tickets[existingIndex]);
    }
  }

  // Se não existe ou não tem OF, cria um novo
  const newTicket = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...incoming
  };
  data.tickets.push(newTicket);
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  res.status(201).json(newTicket);
});

app.patch("/api/tickets/:id", async (req, res) => {
  const data = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
  const index = data.tickets.findIndex((t: any) => t.id === req.params.id);
  if (index !== -1) {
    data.tickets[index] = { ...data.tickets[index], ...req.body };
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    res.json(data.tickets[index]);
  } else {
    res.status(404).send("Not found");
  }
});

app.delete("/api/tickets/:id", async (req, res) => {
  const data = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
  data.tickets = data.tickets.filter((t: any) => t.id !== req.params.id);
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  res.status(204).send();
});

app.post("/api/tickets/clear", async (req, res) => {
  await fs.writeFile(DATA_FILE, JSON.stringify({ tickets: [] }, null, 2));
  res.status(204).send();
});

async function startServer() {
  await initData();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
