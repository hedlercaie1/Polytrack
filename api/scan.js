export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // O "Disfarce": Faz a Polymarket achar que somos um navegador normal
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://polymarket.com',
    'Referer': 'https://polymarket.com/'
  };

  try {
    // Busca o Top 5 (reduzido para não dar timeout no Vercel)
    const leadUrl = 'https://data-api.polymarket.com/leaderboard?limit=5&window=1w';
    const leadRes = await fetch(leadUrl, { headers });
    
    if (!leadRes.ok) throw new Error(`Block no Leaderboard: ${leadRes.status}`);
    const leadData = await leadRes.json();
    
    const insiders = [];

    // Varre as atividades
    for (const user of leadData) {
      const addr = user.address;
      
      // Puxa as últimas 50 atividades com o disfarce
      const actRes = await fetch(`https://data-api.polymarket.com/activity?user=${addr}&limit=50`, { headers });
      
      if (!actRes.ok) continue; // Se a Polymarket bloquear um usuário específico, ele pula pro próximo sem quebrar tudo
      
      const actData = await actRes.json();
      
      let wins = 0;
      let losses = 0;
      
      const activities = Array.isArray(actData) ? actData : (actData.data || []);
      
      activities.forEach(item => {
         const outcome = (item.outcome || '').toLowerCase();
         if (outcome === 'won') wins++;
         if (outcome === 'lost') losses++;
      });

      const totalResolved = wins + losses;
      
      // Filtro mais leve para garantir que retorne dados: 3 apostas e 70% de acerto
      if (totalResolved >= 3) { 
        const winRate = (wins / totalResolved) * 100;
        
        if (winRate >= 70) { 
           insiders.push({
              address: addr,
              winRate: winRate.toFixed(2) + '%',
              wins: wins,
              losses: losses
           });
        }
      }
    }

    res.status(200).json({ success: true, insidersEncontrados: insiders });

  } catch (error) {
    // Agora o erro vai mostrar exatamente onde quebrou para a gente saber
    res.status(500).json({ error: 'Erro na API', detalhe: error.message });
  }
}
