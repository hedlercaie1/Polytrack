export default async function handler(req, res) {
  // 1. Libera o CORS para o seu front-end conseguir acessar essa API
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');

  // Responde rápido a requisições de preflight do navegador
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 2. Busca o Top 10 Leaderboard da semana (para não dar timeout no Vercel)
    const leadUrl = 'https://data-api.polymarket.com/leaderboard?limit=10&window=1w';
    const leadRes = await fetch(leadUrl);
    const leadData = await leadRes.json();
    
    const insiders = [];

    // 3. Varre as atividades dessas carteiras para calcular o Win Rate
    for (const user of leadData) {
      const addr = user.address;
      
      // Puxa as últimas 100 atividades da carteira
      const actRes = await fetch(`https://data-api.polymarket.com/activity?user=${addr}&limit=100`);
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
      
      // 4. Filtro Mágico: Pelo menos 5 apostas resolvidas e mais de 80% de acerto
      if (totalResolved >= 5) { 
        const winRate = (wins / totalResolved) * 100;
        
        if (winRate >= 80) { 
           insiders.push({
              address: addr,
              winRate: winRate.toFixed(2) + '%',
              wins: wins,
              losses: losses,
              profitToken: user.amount
           });
        }
      }
    }

    // Retorna o JSON limpo com os insiders encontrados
    res.status(200).json({ success: true, insidersEncontrados: insiders });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao processar as APIs da Polymarket' });
  }
}
