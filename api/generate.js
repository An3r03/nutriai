export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sesso, tdee, kcal, proteine, carboidrati, grassi, dieta, pasti, budget, allergie } = req.body;

  if (!kcal || !pasti) return res.status(400).json({ error: 'Parametri mancanti' });

  const mealWeights = { colazione: 0.2, pranzo: 0.35, spuntino: 0.1, cena: 0.35 };
  const totalW = pasti.reduce((s, m) => s + (mealWeights[m] || 0.2), 0);
  const mkcal = {};
  pasti.forEach(m => { mkcal[m] = Math.round(kcal * (mealWeights[m] || 0.2) / totalW); });

  const prompt = `Sei un nutrizionista esperto italiano. Genera un piano pasti per una persona con questi parametri:
- Sesso: ${sesso === 'M' ? 'uomo' : 'donna'}, TDEE: ${tdee} kcal
- Dieta: ${dieta}
- Calorie target: ${kcal} kcal/giorno
- Macro: Proteine ${proteine}g, Carboidrati ${carboidrati}g, Grassi ${grassi}g
- Budget: ${budget}€/giorno
- Allergie/intolleranze: ${allergie || 'nessuna'}

Pasti richiesti: ${pasti.join(', ')}
Calorie per pasto: ${pasti.map(m => `${m} ~${mkcal[m]}kcal`).join(', ')}

Per ogni pasto proponi ESATTAMENTE 3 ricette italiane con ingredienti semplici e comuni.
Rispondi SOLO con JSON valido, senza markdown, senza testo extra:
{
  "pasti": {
    ${pasti.map(m => `"${m}": [
      {"nome":"","kcal":0,"p":0,"c":0,"f":0,"ingredienti":"","preparazione":"","min":0},
      {"nome":"","kcal":0,"p":0,"c":0,"f":0,"ingredienti":"","preparazione":"","min":0},
      {"nome":"","kcal":0,"p":0,"c":0,"f":0,"ingredienti":"","preparazione":"","min":0}
    ]`).join(',\n    ')}
  }
}`;

  if (!process.env.GROQ_API_KEY) {
  return res.status(500).json({ error: 'GROQ_API_KEY non configurata' });
}try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      return res.status(500).json({ error: 'Groq error', detail: err });
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    return res.status(200).json(parsed);

  } catch (e) {
    return res.status(500).json({ error: 'Errore generazione', detail: e.message });
  }
}
