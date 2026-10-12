const $ = (id) => document.getElementById(id);
const competition = $("competition");
const dateFrom = $("dateFrom");
const dateTo = $("dateTo");
const loadBtn = $("loadBtn");
const message = $("message");
const matchesEl = $("matches");
const standingsEl = $("standings");
const reportEl = $("report");

function localISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ✅ DATAS CORRIGIDAS: período fixo que a API aceita
// Período: 28/09/2026 até 11/10/2026
const earlier = new Date(2026, 8, 28);  // mês 8 = setembro
const later = new Date(2026, 9, 11);     // mês 9 = outubro

dateFrom.value = localISO(earlier);
dateTo.value = localISO(later);

async function api(url) {
  try {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type");
    
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Servidor não está rodando. O SPCK Editor só mostra o visual — precisa ligar o backend para carregar dados.");
    }
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar os dados.");
    return data;
  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error("Sem conexão com o servidor. Lembre-se: o site sozinho não busca dados — precisa do backend ativo.");
    }
    throw err;
  }
}

function safe(text) {
  return String(text ?? "—").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function dateLabel(value) {
  if (!value) return "Data não disponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle:"medium", timeStyle:"short" }).format(new Date(value));
}

function statusLabel(status) {
  const labels = { 
    FINISHED:"Encerrado", 
    IN_PLAY:"Em andamento", 
    PAUSED:"Pausado", 
    SCHEDULED:"Agendado", 
    TIMED:"Agendado", 
    POSTPONED:"Adiado", 
    CANCELLED:"Cancelado", 
    SUSPENDED:"Suspenso" 
  };
  return labels[status] || status || "Status indisponível";
}

function crest(url, name) {
  return url ? `<img src="${safe(url)}" alt="${safe(name)}" loading="lazy" onerror="this.style.display='none'">` : "";
}

function renderMatches(matches) {
  if (!matches.length) {
    matchesEl.innerHTML = `<div class="match-card empty">Nenhuma partida encontrada neste período. Tente outras datas ou uma competição diferente.</div>`;
    return;
  }
  matchesEl.innerHTML = matches.map(m => {
    const finished = m.status === "FINISHED";
    const hasScore = m.score.home !== null && m.score.home !== undefined && m.score.away !== null && m.score.away !== undefined;
    const score = hasScore ? `${m.score.home} – ${m.score.away}` : "vs";
    return `<article class="match-card">
      <div class="match-meta"><span>${safe(competition.options[competition.selectedIndex]?.text || "Competição")}</span><span class="status">${safe(statusLabel(m.status))}</span></div>
      <div class="teams">
        <div class="team">${crest(m.home.crest,m.home.name)}<span class="team-name">${safe(m.home.name)}</span></div>
        <div class="score">${safe(score)}</div>
        <div class="team">${crest(m.away.crest,m.away.name)}<span class="team-name">${safe(m.away.name)}</span></div>
      </div>
      <div class="match-meta" style="margin:14px 0 0"><span>${safe(dateLabel(m.utcDate))}</span><span>${finished ? "Placar final" : "Horário/data sujeitos a atualização"}</span></div>
    </article>`;
  }).join("");
}

function renderStandings(rows) {
  if (!rows.length) {
    standingsEl.innerHTML = `<tr><td colspan="10" class="empty">Classificação indisponível para esta competição.</td></tr>`;
    return;
  }
  standingsEl.innerHTML = rows.map(t => `<tr>
    <td class="rank">${safe(t.position)}</td>
    <td><span class="team-cell">${crest(t.crest,t.team)}${safe(t.team)}</span></td>
    <td>${safe(t.played)}</td><td>${safe(t.won)}</td><td>${safe(t.draw)}</td><td>${safe(t.lost)}</td>
    <td>${safe(t.goalsFor)}</td><td>${safe(t.goalsAgainst)}</td><td>${safe(t.goalDifference)}</td><td><strong>${safe(t.points)}</strong></td>
  </tr>`).join("");
}

function renderReport(matches, standings) {
  const finished = matches.filter(m => m.status === "FINISHED" && Number.isFinite(m.score.home) && Number.isFinite(m.score.away));
  if (!finished.length) {
    reportEl.innerHTML = `<div class="report-icon">i</div><div><h3>Dados insuficientes para o resumo</h3><p>Não há partidas encerradas com placares disponíveis no período selecionado. Amplie o intervalo de datas ou consulte novamente mais tarde.</p></div>`;
    return;
  }
  let goals = 0, homeGoals = 0, awayGoals = 0;
  let homeWins = 0, draws = 0, awayWins = 0;
  for (const m of finished) {
    const h = m.score.home, a = m.score.away;
    goals += h + a; homeGoals += h; awayGoals += a;
    if (h > a) homeWins++; else if (h < a) awayWins++; else draws++;
  }
  const avg = (goals / finished.length).toFixed(2);
  const top = standings.length ? standings.slice().sort((a,b)=>b.points-a.points)[0] : null;
  reportEl.innerHTML = `<div class="report-icon">↗</div><div>
    <h3>Resumo descritivo do período</h3>
    <p>Foram encontradas ${finished.length} partidas encerradas, com ${goals} gols no total e média de ${avg} gols por jogo. Os mandantes venceram ${homeWins} vez(es), houve ${draws} empate(s) e os visitantes venceram ${awayWins} vez(es). Gols de mandantes: ${homeGoals}; gols de visitantes: ${awayGoals}.${top ? ` Na tabela disponível, ${safe(top.team)} aparece em 1º lugar com ${safe(top.points)} pontos.` : ""} Estes números descrevem apenas os dados consultados; não são uma previsão do resultado de partidas futuras.</p>
  </div>`;
}

async function loadAll() {
  const from = dateFrom.value, to = dateTo.value, comp = competition.value;
  if (!from || !to || from > to) {
    message.textContent = "Escolha um intervalo de datas válido.";
    message.className = "message error";
    return;
  }
  loadBtn.disabled = true;
  loadBtn.textContent = "Atualizando…";
  message.className = "message";
  message.textContent = "Buscando partidas e classificação…";
  matchesEl.innerHTML = `<div class="skeleton"></div><div class="skeleton"></div>`;
  try {
    const [matchData, tableData] = await Promise.all([
      api(`/api/matches?competition=${encodeURIComponent(comp)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      api(`/api/standings?competition=${encodeURIComponent(comp)}`)
    ]);
    renderMatches(matchData.matches || []);
    renderStandings(tableData.standings || []);
    renderReport(matchData.matches || [], tableData.standings || []);
    message.textContent = `✅ Dados carregados. ${matchData.matches?.length || 0} partida(s) no intervalo selecionado.`;
  } catch (e) {
    matchesEl.innerHTML = `<div class="match-card empty">⚠️ ${safe(e.message)}</div>`;
    standingsEl.innerHTML = `<tr><td colspan="10" class="empty">—</td></tr>`;
    reportEl.innerHTML = `<div class="report-icon">ℹ️</div><div><h3>Ainda sem dados reais</h3><p>${safe(e.message)}</p><p style="margin-top:8px;font-size:0.9em;color:#888;">📌 Isso é normal por enquanto: o SPCK Editor só visualiza o site. Para carregar dados reais, precisamos ligar o servidor backend. Vamos resolver isso na próxima etapa!</p></div>`;
    message.textContent = e.message;
    message.className = "message error";
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = "Atualizar dados";
  }
}

loadBtn.addEventListener("click", loadAll);
competition.addEventListener("change", loadAll);
loadAll();