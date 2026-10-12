// ===== CONFIGURAÇÃO =====
const API_KEY = 'b4eea7e0c6374d0bb589bb2db30d1adf';
const API_BASE = 'https://api.football-data.org/v4';

const $ = (id) => document.getElementById(id);
const competition = $('competition');
const dateFrom = $('dateFrom');
const dateTo = $('dateTo');
const loadBtn = $('loadBtn');
const message = $('message');
const matchesEl = $('matches');
const standingsEl = $('standings');
const reportEl = $('report');

function localISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const earlier = new Date(2026, 8, 28);
const later = new Date(2026, 9, 11);
dateFrom.value = localISO(earlier);
dateTo.value = localISO(later);

async function api(url) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  
  try {
    const res = await fetch(fullUrl, {
      headers: { 'X-Auth-Token': API_KEY },
      mode: 'cors'
    });
    
    if (!res.ok) {
      if (res.status === 429) throw new Error('Muitas requisições. Espere 1 minuto e tente de novo.');
      if (res.status === 403) throw new Error('Chave API inválida ou bloqueada.');
      throw new Error(`Erro: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('CORS')) {
      throw new Error('Bloqueio de segurança detectado. Teste usando Live Server no VS Code ou navegador diferente.');
    }
    throw err;
  }
}

function safe(text) {
  return String(text ?? '—').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function dateLabel(value) {
  if (!value) return 'Data não disponível';
  return new Intl.DateTimeFormat('pt-BR', { 
    dateStyle:'medium', timeStyle:'short' 
  }).format(new Date(value));
}

function statusLabel(status) {
  const labels = { 
    FINISHED:'Encerrado', IN_PLAY:'Em andamento', PAUSED:'Pausado',
    SCHEDULED:'Agendado', TIMED:'Agendado', POSTPONED:'Adiado',
    CANCELLED:'Cancelado', SUSPENDED:'Suspenso'
  };
  return labels[status] || status || 'Status indisponível';
}

function crest(url, name) {
  return url ? `<img src="${safe(url)}" alt="${safe(name)}" loading="lazy" onerror="this.style.display='none'">` : '';
}

function renderMatches(matches) {
  if (!matches.length) {
    matchesEl.innerHTML = `<div class="match-card empty">Nenhuma partida encontrada neste período.</div>`;
    return;
  }
  matchesEl.innerHTML = matches.map(m => {
    const finished = m.status === 'FINISHED';
    const hasScore = m.score.fullTime?.home !== null && m.score.fullTime?.home !== undefined;
    const score = hasScore 
      ? `${m.score.fullTime.home} – ${m.score.fullTime.away}` 
      : 'vs';
    return `<article class="match-card">
      <div class="match-meta"><span>${safe(competition.options[competition.selectedIndex]?.text || 'Competição')}</span><span class="status">${safe(statusLabel(m.status))}</span></div>
      <div class="teams">
        <div class="team">${crest(m.homeTeam.crest,m.homeTeam.name)}<span class="team-name">${safe(m.homeTeam.name)}</span></div>
        <div class="score">${safe(score)}</div>
        <div class="team">${crest(m.awayTeam.crest,m.awayTeam.name)}<span class="team-name">${safe(m.awayTeam.name)}</span></div>
      </div>
      <div class="match-meta" style="margin:14px 0 0"><span>${safe(dateLabel(m.utcDate))}</span><span>${finished ? 'Placar final' : 'Horário sujeito a atualização'}</span></div>
    </article>`;
  }).join('');
}

function renderStandings(rows) {
  if (!rows || !rows.length) {
    standingsEl.innerHTML = `<tr><td colspan="10" class="empty">Classificação indisponível.</td></tr>`;
    return;
  }
  standingsEl.innerHTML = rows.map(t => `<tr>
    <td class="rank">${safe(t.position)}</td>
    <td><span class="team-cell">${crest(t.team.crest,t.team.name)}${safe(t.team.name)}</span></td>
    <td>${safe(t.playedGames)}</td><td>${safe(t.won)}</td><td>${safe(t.draw)}</td><td>${safe(t.lost)}</td>
    <td>${safe(t.goalsFor)}</td><td>${safe(t.goalsAgainst)}</td><td>${safe(t.goalDifference)}</td><td><strong>${safe(t.points)}</strong></td>
  </tr>`).join('');
}

function renderReport(matches, standings) {
  const finished = matches.filter(m => 
    m.status === 'FINISHED' && m.score.fullTime?.home !== null
  );
  if (!finished.length) {
    reportEl.innerHTML = `<div class="report-icon">i</div><div><h3>Aguardando dados</h3><p>Não há partidas encerradas no período selecionado.</p></div>`;
    return;
  }
  let goals = 0, homeWins = 0, draws = 0, awayWins = 0;
  let homeGoals = 0, awayGoals = 0;
  for (const m of finished) {
    const h = m.score.fullTime.home;
    const a = m.score.fullTime.away;
    goals += h + a; homeGoals += h; awayGoals += a;
    if (h > a) homeWins++;
    else if (h < a) awayWins++;
    else draws++;
  }
  const avg = (goals / finished.length).toFixed(2);
  const top = standings?.length ? standings.slice().sort((a,b)=>b.points-a.points)[0] : null;
  
  reportEl.innerHTML = `<div class="report-icon">↗</div><div>
    <h3>Resumo do Período</h3>
    <p>${finished.length} partidas, ${goals} gols — média de ${avg} gols/jogo. Mandantes venceram ${homeWins}x, ${draws} empates, visitantes ${awayWins} vitórias. Gols casa: ${homeGoals} — Gols fora: ${awayGoals}.${top ? ` Líder: ${safe(top.team.name)} com ${safe(top.points)} pts.` : ''}</p>
  </div>`;
}

async function loadCompetitions() {
  message.textContent = 'Carregando competições...';
  try {
    const data = await api('/competitions');
    competition.innerHTML = '<option value="">Selecione uma competição…</option>';
    data.competitions
      .filter(c => c.code)
      .sort((a,b) => a.name.localeCompare(b.name))
      .forEach(c => {
        competition.innerHTML += `<option value="${c.code}">${c.name}</option>`;
      });
    message.textContent = '✅ Selecione uma competição e clique em Atualizar Dados';
    message.className = 'message';
  } catch (e) {
    message.textContent = '❌ ' + e.message;
    message.className = 'message error';
  }
}

async function loadAll() {
  const from = dateFrom.value, to = dateTo.value, comp = competition.value;
  if (!from || !to || from > to) {
    message.textContent = 'Escolha um intervalo de datas válido.';
    message.className = 'message error';
    return;
  }
  if (!comp) {
    message.textContent = 'Selecione uma competição primeiro.';
    message.className = 'message error';
    return;
  }
  
  loadBtn.disabled = true;
  loadBtn.textContent = 'Carregando…';
  message.className = 'message';
  message.textContent = 'Buscando dados…';
  matchesEl.innerHTML = '<div class="skeleton"></div>';
  standingsEl.innerHTML = '<tr><td colspan="10" class="empty">Carregando…</td></tr>';

  try {
    const [matchData, tableData] = await Promise.all([
      api(`/competitions/${comp}/matches?dateFrom=${from}&dateTo=${to}`),
      api(`/competitions/${comp}/standings`)
    ]);
    
    renderMatches(matchData.matches || []);
    renderStandings(tableData.standings?.[0]?.table || []);
    renderReport(matchData.matches || [], tableData.standings?.[0]?.table || []);
    
    message.textContent = `✅ ${matchData.matches?.length || 0} partida(s) carregada(s)`;
    message.className = 'message success';
  } catch (e) {
    message.textContent = '❌ ' + e.message;
    message.className = 'message error';
    matchesEl.innerHTML = `<div class="match-card empty">${e.message}</div>`;
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = 'Atualizar Dados';
  }
}

loadBtn.addEventListener('click', loadAll);
competition.addEventListener('change', loadAll);
loadCompetitions();
