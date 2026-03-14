import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { genAI } from '../lib/gemini';
import { differenceInDays } from 'date-fns';
import { ChefHat, Sparkles, Clock, Users, Flame, Send, Check, CalendarDays, ShoppingCart, Loader2, Save, History, Trash2 } from 'lucide-react';
import type { InventoryItem, PlannedMeal } from '../types';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isRecipeProposal?: boolean;
}

interface WeeklyPlan {
  meals: { title: string; description: string }[];
  missing_ingredients: { name: string; quantity: number; unit: string; category?: string; canonical_name: string }[];
  estimated_price_eur: { spar: number; other: number };
  estimated_price_huf: { spar: number; other: number };
}

export default function MealsPage() {
  const [activeTab, setActiveTab] = useState<'tonight' | 'week'>('tonight');
  const [loading, setLoading] = useState(false);
  const [deducting, setDeducting] = useState(false);
  
  // Tonight Chat State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Week Plan State
  const [mealsCount, setMealsCount] = useState(3);
  const [weekChatHistory, setWeekChatHistory] = useState<ChatMessage[]>([]);
  const [weekInputText, setWeekInputText] = useState('');
  const weekChatEndRef = useRef<HTMLDivElement>(null);
  
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [pastMeals, setPastMeals] = useState<PlannedMeal[]>([]);

  // Context Data
  const [presentUsers, setPresentUsers] = useState<number>(3);
  const [redItems, setRedItems] = useState<InventoryItem[]>([]);
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
  const [hasTimeConstraint, setHasTimeConstraint] = useState(false);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [deductionInput, setDeductionInput] = useState('');

  useEffect(() => {
    gatherContext();
    loadPastMeals();
  }, []);

  useEffect(() => {
    if (activeTab === 'tonight') {
       chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (activeTab === 'week') {
       weekChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, weekChatHistory, loading, activeTab]);

  const gatherContext = async () => {
    try {
      const { data: inventory } = await supabase.from('inventory').select('*');
      if (inventory) {
        setAllInventory(inventory);
        const expiring = inventory.filter(item => {
          if (!item.expiry_date) return false;
          if (item.status === 'red' || item.category === 'S.O.S (Urgence)') return true;
          const daysLeft = differenceInDays(new Date(item.expiry_date), new Date());
          return daysLeft <= 1;
        });
        setRedItems(expiring);
      }

      const today = new Date();
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .gte('start_time', new Date(today.setHours(0,0,0,0)).toISOString())
        .lte('start_time', new Date(today.setHours(23,59,59,999)).toISOString());

      if (events) {
        if (events.length > 0) setHasTimeConstraint(true);
        const uniqueBusyUsers = new Set(events.map(e => e.user_id)).size;
        setPresentUsers(Math.max(1, 3 - uniqueBusyUsers));
      }

      const { data: d } = await supabase.from('disliked_foods').select('name');
      if (d) setDislikes(d.map(item => item.name));
    } catch (err) {
      console.error("Error gathering meal context", err);
    }
  };

  const loadPastMeals = async () => {
    const { data } = await supabase.from('planned_meals').select('*').order('created_at', { ascending: false }).limit(10);
    if (data) setPastMeals(data);
  };

  const buildSystemPrompt = () => {
    const inventoryString = allInventory.map(i => `- ${i.product_name} (${i.quantity || 1} ${i.unit || 'unité'})`).join('\n');
    const redItemsString = redItems.map(i => i.product_name).join(', ');
    const dislikedString = dislikes.length > 0 ? dislikes.join(', ') : 'Aucun';

    return `
      Tu es un chef cuisinier de colocation enthousiaste et expert en anti-gaspi.
      Contexte actuel :
      - Mangeurs prévus : ${presentUsers}
      - Temps disponible : ${hasTimeConstraint ? 'Moins de 20 minutes (Urgent !)' : 'Flexible'}
      - Ingrédients "Rouges" à sauver d'urgence : ${redItemsString || 'Aucun, tout va bien.'}
      - Aliments BANNIS (NE JAMAIS PROPOSER) : ${dislikedString}
      - Inventaire total disponible :
      ${inventoryString}

      Règles strictes :
      1. Ne propose JAMAIS les aliments bannis.
      2. Propose toujours UNE seule recette claire à la fois.
      3. Adapte tes quantités au nombre de mangeurs (${presentUsers}).
      4. Sois concis, agréable et va droit au but dans le chat.
      5. Demande si cela leur convient ou s'ils veulent changer un ingrédient.
      6. À LA TOUTE FIN DE TA DERNIÈRE PHRASE, si tu proposes bien une recette, ajoute TOUJOURS le tag exact "[RECIPE_PROPOSAL]".
    `;
  };

  const startChat = async () => {
    if (chatHistory.length > 0) return;
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: buildSystemPrompt()
      });
      
      const chat = model.startChat({ history: [] });
      const result = await chat.sendMessage("Salut Chef ! Qu'est-ce qu'on mange ce soir vu ce qu'on a dans le frigo ?");
      
      let text = result.response.text();
      const isProposal = text.includes("[RECIPE_PROPOSAL]");
      text = text.replace("[RECIPE_PROPOSAL]", "").trim();

      setChatHistory([
        { role: 'user', text: "Salut Chef ! Qu'est-ce qu'on mange ce soir vu ce qu'on a dans le frigo ?" },
        { role: 'model', text, isRecipeProposal: isProposal }
      ]);
    } catch (err: any) {
      console.error(err);
      alert('Erreur: ' + (err.message || 'Impossible de se connecter à Gemini. Vérifiez votre clé API.'));
    } finally {
      setLoading(false);
    }
  };

  const cookPastMeal = async (meal: PlannedMeal) => {
    // Supprimer le repas de l'historique car on va le cuisiner
    await deletePastMeal(meal.id);

    setActiveTab('tonight');
    if (chatHistory.length === 0) {
      setLoading(true);
      try {
        const model = genAI.getGenerativeModel({ 
          model: "gemini-2.5-flash",
          systemInstruction: buildSystemPrompt()
        });
        
        const chat = model.startChat({ history: [] });
        const initialPrompt = `Salut Chef ! Guide-moi étape par étape pour préparer la recette : ${meal.title}. \n(Description exacte : ${meal.description || ''})`;
        
        const result = await chat.sendMessage(initialPrompt);
        
        let text = result.response.text();
        const isProposal = text.includes("[RECIPE_PROPOSAL]");
        text = text.replace("[RECIPE_PROPOSAL]", "").trim();

        setChatHistory([
          { role: 'user', text: initialPrompt },
          { role: 'model', text, isRecipeProposal: isProposal }
        ]);
      } catch (err: any) {
        console.error(err);
        alert('Erreur: ' + (err.message || 'Impossible de se connecter à Gemini. Vérifiez votre clé API.'));
      } finally {
        setLoading(false);
      }
    } else {
       // If chat already exists, just append to it
       setInputText(`Salut Chef ! Finies les anciennes idées, guide-moi plutôt étape par étape pour préparer la recette : ${meal.title}. \n(Description exacte : ${meal.description || ''})`);
    }
  };

  const deletePastMeal = async (id: string) => {
    const { error } = await supabase.from('planned_meals').delete().eq('id', id);
    if (!error) {
      setPastMeals(prev => prev.filter(m => m.id !== id));
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userText = inputText.trim();
    setInputText('');
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: userText }];
    setChatHistory(newHistory);
    setLoading(true);

    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: buildSystemPrompt()
      });
      
      const historyFormatted = newHistory.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const chat = model.startChat({ history: historyFormatted });
      const result = await chat.sendMessage(userText);
      
      let responseText = result.response.text();
      const isProposal = responseText.includes("[RECIPE_PROPOSAL]");
      responseText = responseText.replace("[RECIPE_PROPOSAL]", "").trim();

      setChatHistory([...newHistory, { role: 'model', text: responseText, isRecipeProposal: isProposal }]);
    } catch (err: any) {
      console.error(err);
      alert('Erreur: ' + (err.message || 'La conversation a rencontré un problème.'));
    } finally {
      setLoading(false);
    }
  };

  const acceptRecipe = async (recipeContext: string) => {
    await runDeductionProcess(`La recette suivante a été cuisinée par l'utilisateur: "${recipeContext}"`);
  };

  const handleFreeformDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deductionInput.trim() || deducting) return;
    const text = deductionInput.trim();
    setDeductionInput('');
    setShowDeductionForm(false);
    await runDeductionProcess(`L'utilisateur signale avoir cuisiné/consommé ceci : "${text}"`);
  };

  const runDeductionProcess = async (context: string) => {
    setDeducting(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const inventoryList = allInventory.map(i => `{"id": "${i.id}", "name": "${i.product_name}", "canon": "${i.canonical_name}", "qty": ${i.quantity || 1}, "unit": "${i.unit || 'unité'}"}`).join(',\n');
      
      const prompt = `
        ${context}.
        Voici l'inventaire complet avec les IDs de la base de données :
        [${inventoryList}]
        
        Ta mission: Analyser ce qui a été consommé et retourner UNIQUEMENT un JSON array contenant les articles DE L'INVENTAIRE (utiliser leur ID exact) dont la quantité doit être réduite.
        - Si un article est totalement consommé, "deduct_amount" doit être égal à sa quantité actuelle ("qty").
        - Sois intelligent sur les unités (si on consomme 200g de "Lardons 500g", déduis 200).
        - Si plusieurs articles correspondent (ex: 2 briques de lait), déduis de la plus ancienne ou répartis.
        
        Ne renvoie que le JSON Array sous ce format strict:
        [
          { "id": "uuid-here", "deduct_amount": 0.5 }
        ]
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const deductions: { id: string, deduct_amount: number }[] = JSON.parse(cleanJson);
      
      let count = 0;
      for (const d of deductions) {
        const item = allInventory.find(i => i.id === d.id);
        if (item) {
          const newQty = (item.quantity || 1) - d.deduct_amount;
          if (newQty <= 0) {
            await supabase.from('inventory').delete().eq('id', item.id);
          } else {
            await supabase.from('inventory').update({ quantity: newQty }).eq('id', item.id);
          }
          count++;
        }
      }

      if (count > 0) {
        setChatHistory(prev => [...prev, { role: 'model', text: `✅ C'est noté ! J'ai mis à jour les stocks (${count} articles impactés).` }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'model', text: "Oups, je n'ai pas trouvé d'articles correspondants dans l'inventaire pour déduire ces quantités." }]);
      }
      gatherContext();

    } catch (err: any) {
      console.error(err);
      alert('Erreur lors de la déduction des stocks: ' + (err.message || ''));
    } finally {
      setDeducting(false);
    }
  };

  const generateWeeklyPlan = async () => {
    setLoading(true);
    setWeekChatHistory([]);
    setWeeklyPlan(null);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const inventoryList = allInventory.map(i => `- ${i.product_name} (${i.quantity || 0} ${i.unit || 'unité'})`).join('\n');
      const pastMealsList = pastMeals.map(m => `- ${m.title}`).join('\n');

      const systemPrompt = `
        Tu es l'assistant de colocation "ColocAI". Ta mission est d'aider à planifier les repas de la semaine en étant un expert de l'anti-gaspi.
        Mangeurs par repas: 3.
        Aliments BANNIS (NE JAMAIS PROPOSER ces ingrédients) : ${dislikes.length > 0 ? dislikes.join(', ') : 'Aucun.'}
        
        INVENTAIRE ACTUEL (Quantités et Unités) :
        ${inventoryList || "Rien."}
        
        Repas récemment planifiés :
        ${pastMealsList || "Aucun."}
        
        Règles d'or de planification :
        1. PRIORITÉ ABSOLUE : Regarde d'abord ce qu'il y a dans l'inventaire. Propose des repas qui utilisent les ingrédients déjà présents, surtout s'ils sont en grande quantité ou approchent de la péremption.
        2. Propose un menu de ${mealsCount} repas en texte clair.
        3. Ne propose JAMAIS les aliments bannis.
        4. Fais des phrases agréables et pose une question à la fin.
        5. NE GÉNÈRE PAS DE JSON POUR L'INSTANT.
      `;

      const chat = model.startChat({ 
        history: [],
        systemInstruction: { parts: [{ text: systemPrompt }], role: "model" }
      });
      const result = await chat.sendMessage(`Salut, propose-moi ${mealsCount} repas pour la semaine en tenant compte de mon frigo !`);
      
      setWeekChatHistory([
        { role: 'user', text: `Salut, propose-moi ${mealsCount} repas pour la semaine en tenant compte de mon frigo !` },
        { role: 'model', text: result.response.text() }
      ]);
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de la génération du plan : " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const sendWeekMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weekInputText.trim() || loading) return;

    const userText = weekInputText.trim();
    setWeekInputText('');
    setLoading(true);

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const inventoryList = allInventory.map(i => `- ${i.product_name} (${i.quantity || 0} ${i.unit || 'unité'})`).join('\n');
      const pastMealsList = pastMeals.map(m => `- ${m.title}`).join('\n');

      const systemPrompt = `
        Tu es l'assistant de colocation "ColocAI" spécialisé en gestion de stock et planification.
        Mangeurs par repas: 3.
        Aliments BANNIS : ${dislikes.length > 0 ? dislikes.join(', ') : 'Aucun.'}
        
        INVENTAIRE ACTUEL :
        ${inventoryList || "Rien."}
        
        REPAS RÉCENTS (Éviter les doublons) :
        ${pastMealsList || "Aucun."}
        
        Règles :
        1. Modifie le menu selon les requêtes.
        2. Garde toujours un œil sur l'inventaire pour suggérer des alternatives qui utilisent ce qu'on a déjà.
        3. Fais des phrases agréables.
        4. NE GÉNÈRE PAS DE JSON.
      `;

      const historyFormatted = weekChatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));

      const chat = model.startChat({ 
        history: historyFormatted,
        systemInstruction: { parts: [{ text: systemPrompt }], role: "model" }
      });
      
      const newHistory: ChatMessage[] = [...weekChatHistory, { role: 'user', text: userText }];
      setWeekChatHistory(newHistory);
      
      const result = await chat.sendMessage(userText);
      
      setWeekChatHistory([...newHistory, { role: 'model', text: result.response.text() }]);
    } catch (err: any) {
      console.error(err);
      alert('Erreur: ' + (err.message || 'La conversation a rencontré un problème.'));
    } finally {
      setLoading(false);
    }
  };

  const confirmWeeklyPlan = async () => {
    setLoading(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const inventoryList = allInventory.map(i => `- ${i.product_name}`).join('\n');
      
      // Combine the chat history into a single string to understand the final agreed menu
      const fullConversation = weekChatHistory.map(m => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.text}`).join('\n');

      const prompt = `
        Voici la conversation que nous venons d'avoir concernant notre menu de ${mealsCount} repas de la semaine :
        """
        ${fullConversation}
        """
        
        Voici notre inventaire actuel (Quantités réelles) :
        ${inventoryList || "Rien."}
        
        Ta mission: Extraire le menu FINAL décidé dans cette conversation et générer la liste de courses PRÉCISE.
        
        LOGIQUE DE CALCUL STRICTE :
        1. Identifie chaque ingrédient nécessaire pour les ${mealsCount} repas VALIDÉS.
        2. Calcule la QUANTITÉ TOTALE nécessaire pour toute la semaine (ex: 3 plats utilisant de la crème = 800ml au total).
        3. Compare systématiquement avec notre inventaire actuel.
        4. La liste "missing_ingredients" doit contenir EXCLUSIVEMENT le reliquat (Besoin Total - Inventaire). Si on a assez, n'affiche RIEN pour cet ingrédient.
        
        Exemple critique : 
        - Besoin semaine : 1kg de poulet. Inventaire : 500g. -> "missing_ingredients": "500g de poulet".
        - Besoin semaine : 400ml de crème. Inventaire : Rien. -> "missing_ingredients": "400ml de crème liquide".
        
        Autres instructions :
        - Inclus TOUJOURS la quantité et l'unité dans le nom de l'ingrédient manquant.
        - Identifie exactement les ${mealsCount} repas finaux.
        - Estime les prix Spar vs Aldi/Lidl en HUF et EUR (1 EUR = 400 HUF).
        
        IMPORTANT: Renvoyez uniquement un objet JSON valide :
        {
          "meals": [ { "title": "Nom", "description": "Détails" } ],
          "missing_ingredients": [ 
            { 
              "name": "Nom de l'ingrédient uniquement",
              "canonical_name": "Nom simplifié (ex: Lait)",
              "quantity": 1.5,
              "unit": "kg",
              "category": "Rayon (ex: Fruits, Frais, Épicerie, Boissons)" 
            } 
          ],
          "estimated_price_eur": { "spar": 25, "other": 18 },
          "estimated_price_huf": { "spar": 10000, "other": 7200 }
        }
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const plan = JSON.parse(cleanJson) as WeeklyPlan;
      setWeeklyPlan(plan);
    } catch (err: any) {
      console.error(err);
      alert("Erreur lors de la validation du plan final : " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const saveWeeklyPlan = async () => {
    if (!weeklyPlan) return;
    setSavingPlan(true);
    try {
      // 1. Ajouter les manquants à la liste de courses avec smart consolidation
      for (const ingredient of weeklyPlan.missing_ingredients) {
        // Double check if EXACT SAME item already in shopping list (unbought)
        const { data: existing } = await supabase
          .from('shopping_list')
          .select('*')
          .eq('product_name', ingredient.name)
          .eq('unit', ingredient.unit)
          .eq('is_bought', false)
          .maybeSingle();

        if (existing) {
          const newQty = (existing.quantity || 1) + ingredient.quantity;
          await supabase
            .from('shopping_list')
            .update({ quantity: newQty })
            .eq('id', existing.id);
        } else {
          // New item
          await supabase.from('shopping_list').insert([{
            product_name: ingredient.name,
            canonical_name: ingredient.canonical_name || ingredient.name,
            category: ingredient.category || 'Épicerie',
            is_bought: false,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            added_date: new Date().toISOString()
          }]);
        }
      }

      // 2. Sauvegarder les repas dans l'historique
      const mealsToSave = weeklyPlan.meals.map(m => ({
        title: m.title,
        description: m.description,
        ingredients_json: weeklyPlan.missing_ingredients // Simplify by just attaching what was needed
      }));
      if (mealsToSave.length > 0) {
         await supabase.from('planned_meals').insert(mealsToSave);
      }

      alert("🎉 Énorme ! Les ingrédients ont été ajoutés à la Liste de Courses et les repas ont été sauvegardés.");
      setWeeklyPlan(null); // Reset
      loadPastMeals();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <div className="page-container flex flex-col h-screen max-h-screen pb-20 md:pb-6">
      <div className="page-header shrink-0 mb-4">
        <h1 className="page-title flex items-center gap-2"><ChefHat /> Le Chef I.A.</h1>
        <p className="page-subtitle">Discutez pour ce soir ou planifiez vos courses.</p>
        
        {/* Tab Switcher */}
        <div className="flex gap-2 mt-4 bg-white/5 p-1 rounded-2xl w-full max-w-sm">
          <button 
            onClick={() => setActiveTab('tonight')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === 'tonight' ? 'bg-indigo-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            Ce Soir
          </button>
          <button 
            onClick={() => setActiveTab('week')}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'week' ? 'bg-pink-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <CalendarDays size={16}/> Planifier
          </button>
        </div>
      </div>

      {activeTab === 'tonight' && (
        <>
          {/* Context Summary Cards */}
          <h2 className="text-xs text-center text-gray-500 mb-2 uppercase tracking-widest font-semibold">Ce que l'I.A. sait de vous ce soir</h2>
          <div className="grid grid-cols-3 gap-2 mb-4 shrink-0 px-2">
            <div className="glass-card !p-2 flex flex-col items-center justify-center text-center opacity-80 cursor-default">
              <Flame className="text-red-400 mb-1" size={18} />
              <span className="text-sm font-bold text-white">{redItems.length} Urgent{redItems.length > 1 ? 's' : ''}</span>
              <span className="text-[10px] text-gray-400 leading-tight mt-0.5">Frigo</span>
            </div>
            <div className="glass-card !p-2 flex flex-col items-center justify-center text-center opacity-80 cursor-default">
              <Clock className={hasTimeConstraint ? "text-orange-400 mb-1" : "text-green-400 mb-1"} size={18} />
              <span className="text-sm font-bold text-white">{hasTimeConstraint ? "< 20m" : "Flexible"}</span>
              <span className="text-[10px] text-gray-400 leading-tight mt-0.5">Temps repéré</span>
            </div>
            <div className="glass-card !p-2 flex flex-col items-center justify-center text-center opacity-80 cursor-default">
              <Users className="text-indigo-400 mb-1" size={18} />
              <span className="text-sm font-bold text-white">{presentUsers} Portion{presentUsers > 1 ? 's' : ''}</span>
              <span className="text-[10px] text-gray-400 leading-tight mt-0.5">Colocs présents</span>
            </div>
          </div>

          <div className="px-2 mb-4">
             <button 
                onClick={() => setShowDeductionForm(!showDeductionForm)}
                className="w-full py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={14} className="text-red-400" /> J'ai cuisiné autre chose (Hors plan)
              </button>
              
              {showDeductionForm && (
                <form onSubmit={handleFreeformDeduction} className="mt-2 flex gap-2 animate-enter">
                  <input 
                    type="text"
                    value={deductionInput}
                    onChange={e => setDeductionInput(e.target.value)}
                    placeholder="Ex: 200g de lardons et 1 œuf"
                    className="input-base flex-1 text-sm !py-2"
                    autoFocus
                  />
                  <button type="submit" className="btn-primary !px-4 !py-2 bg-indigo-500 text-sm">OK</button>
                </form>
              )}
          </div>

          {chatHistory.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <button 
                onClick={startChat}
                disabled={loading}
                className="btn-primary py-4 px-8 text-lg bg-gradient-to-r from-orange-500 to-pink-500 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] transition-all flex items-center gap-3"
              >
                {loading ? <div className="w-5 h-5 animate-spin border-2 border-white/30 border-t-white rounded-full" /> : <Sparkles size={24} />}
                Démarrer le Chat Cuisine
              </button>
            </div>
          ) : (
            <>
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto glass-card flex flex-col gap-4 mb-4 !p-4">
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-indigo-500 text-white rounded-br-sm' 
                        : 'bg-white/10 text-gray-200 rounded-bl-sm border border-white/5'
                    }`}>
                      {msg.text.split('\n').map((line, j) => <p key={j} className={j > 0 ? "mt-2" : ""}>{line}</p>)}
                    </div>

                    {msg.isRecipeProposal && msg.role === 'model' && i === chatHistory.length - 1 && (
                      <button 
                        onClick={() => acceptRecipe(msg.text)}
                        disabled={deducting}
                        className="mt-2 text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-green-500/30 transition-colors"
                      >
                        {deducting ? <span className="animate-pulse">Calcul & Déduction en cours...</span> : <><Check size={14} /> On cuisine ça ! (Déduire du frigo)</>}
                      </button>
                    )}
                  </div>
                ))}
                
                {loading && (
                  <div className="self-start bg-white/5 border border-white/5 p-3 rounded-2xl rounded-bl-sm flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={sendMessage} className="shrink-0 flex gap-2">
                <input 
                  type="text" 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="Ex: Refais mais sans poivrons..."
                  className="input-base flex-1 !rounded-full !px-6"
                  disabled={loading || deducting}
                />
                <button 
                  type="submit" 
                  disabled={loading || deducting || !inputText.trim()}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  <Send size={20} className="ml-1" />
                </button>
              </form>
            </>
          )}
        </>
      )}

      {activeTab === 'week' && (
        <div className="flex-1 overflow-y-auto animate-enter">
          {!weeklyPlan ? (
            weekChatHistory.length === 0 ? (
              <div className="glass-card p-6 flex flex-col items-center justify-center text-center min-h-[300px]">
                <CalendarDays className="text-pink-400 mb-4" size={48} />
                <h3 className="text-xl font-bold mb-2">Prévoir les Courses</h3>
                <p className="text-gray-400 text-sm mb-6 max-w-sm">
                  L'I.A. va analyser votre frigo et vos anciennes recettes pour vous proposer un menu et la liste de courses exacte.
                </p>
                
                <div className="flex items-center gap-4 mb-8">
                  <span className="text-gray-300 font-semibold">Nombre de repas :</span>
                  <input 
                    type="range" 
                    min="1" max="21" 
                    value={mealsCount}  
                    onChange={(e) => setMealsCount(parseInt(e.target.value))}
                    className="w-32 accent-pink-500"
                  />
                  <span className="text-xl font-bold text-pink-400 w-6">{mealsCount}</span>
                </div>

                <button 
                  onClick={generateWeeklyPlan}
                  disabled={loading}
                  className="btn-primary w-full max-w-xs bg-gradient-to-r from-pink-500 to-rose-500 shadow-[0_0_20px_rgba(236,72,153,0.3)] flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                  Générer le Menu
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full mb-4">
                <div className="flex justify-between items-center bg-white/5 p-3 rounded-2xl mb-4 shadow-lg sticky top-0 z-10 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <CalendarDays className="text-pink-400" size={16} />
                    Planification de <b>{mealsCount} repas</b>
                  </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setWeekChatHistory([]); setWeeklyPlan(null); }}
                    className="text-gray-400 hover:text-red-400 p-2 transition-colors"
                    title="Annuler et recommencer"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button 
                    onClick={confirmWeeklyPlan}
                    disabled={loading || weekChatHistory.length < 2}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-1.5 px-4 rounded-xl text-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Valider le Menu
                  </button>
                </div>
                </div>

                <div className="flex-1 overflow-y-auto glass-card flex flex-col gap-4 mb-4 !p-4 min-h-[300px]">
                  {weekChatHistory.slice(1).map((msg, i) => ( // Skip hidden initial prompt
                    <div key={i} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                      <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-pink-500 text-white rounded-br-sm' 
                          : 'bg-white/10 text-gray-200 rounded-bl-sm border border-white/5'
                      }`}>
                        {msg.text.split('\n').map((line, j) => <p key={j} className={j > 0 ? "mt-2" : ""}>{line}</p>)}
                      </div>
                    </div>
                  ))}
                  
                  {loading && (
                    <div className="self-start bg-white/5 border border-white/5 p-3 rounded-2xl rounded-bl-sm flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  )}
                  <div ref={weekChatEndRef} />
                </div>

                <form onSubmit={sendWeekMessage} className="shrink-0 flex gap-2">
                  <input 
                    type="text" 
                    value={weekInputText}
                    onChange={e => setWeekInputText(e.target.value)}
                    placeholder="Ex: Change le repas de lundi, on veut des pâtes"
                    className="input-base flex-1 !rounded-full !px-6"
                    disabled={loading}
                  />
                  <button 
                    type="submit" 
                    disabled={loading || !weekInputText.trim()}
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    <Send size={20} className="ml-1" />
                  </button>
                </form>
              </div>
            )
          ) : (
            <div className="space-y-6">
              <div className="glass-card p-5">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><ChefHat className="text-pink-400"/> Menus Proposés</h3>
                <div className="space-y-3">
                  {weeklyPlan.meals.map((m, i) => (
                    <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <h4 className="font-bold text-gray-200">{m.title}</h4>
                      <p className="text-sm text-gray-400 mt-1">{m.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-5">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><ShoppingCart className="text-indigo-400"/> Il vous manque :</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  {weeklyPlan.missing_ingredients.map((ing, i) => (
                    <span key={i} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-sm rounded-lg border border-indigo-500/30">
                      {ing.name}
                    </span>
                  ))}
                </div>

                <div className="bg-[#1e2330] rounded-xl p-4 border border-white/5 mb-6">
                  <h4 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Estimation du prix</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-3 rounded-lg text-center">
                      <div className="text-xs text-gray-500 mb-1">Spar (Plus cher)</div>
                      <div className="font-bold text-red-400">{weeklyPlan.estimated_price_eur.spar} €</div>
                      <div className="text-sm text-gray-400">~{weeklyPlan.estimated_price_huf.spar.toLocaleString()} HUF</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-lg text-center">
                      <div className="text-xs text-gray-500 mb-1">Aldi/Lidl (Moins cher)</div>
                      <div className="font-bold text-green-400">{weeklyPlan.estimated_price_eur.other} €</div>
                      <div className="text-sm text-gray-400">~{weeklyPlan.estimated_price_huf.other.toLocaleString()} HUF</div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={saveWeeklyPlan}
                  disabled={savingPlan}
                  className="btn-primary w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
                >
                  {savingPlan ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Tout envoyer dans la Liste de Courses
                </button>
                <button 
                  onClick={() => { setWeeklyPlan(null); setWeekChatHistory([]); }}
                  className="w-full mt-3 py-3 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Annuler et recommencer le Chat
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Past Meals History - Always visible at the bottom of the page */}
      <div className="mt-8 mb-4">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <History className="text-indigo-400" /> Historique des repas
        </h3>
        
        {pastMeals.length === 0 ? (
          <div className="glass-card p-6 text-center text-gray-400">
            <p>Aucun repas prévu récemment.</p>
            <p className="text-sm mt-2 opacity-70">Générez un menu pour commencer à remplir votre historique !</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pastMeals.map(meal => (
              <div key={meal.id} className="glass-card !p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-bold text-gray-200">{meal.title}</h4>
                  <p className="text-sm text-gray-400 mt-1">{meal.description}</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                  <button 
                    onClick={() => cookPastMeal(meal)}
                    className="flex-1 sm:flex-none text-sm font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-indigo-500/40 transition-colors justify-center shadow-lg"
                  >
                    <ChefHat size={18} /> Cuisiner ça !
                  </button>
                  <button 
                    onClick={() => deletePastMeal(meal.id)}
                    className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-xl transition-colors border border-transparent hover:border-red-500/30"
                    title="Supprimer ce repas prévu"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
