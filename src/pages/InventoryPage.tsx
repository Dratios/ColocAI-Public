import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { genAI } from '../lib/gemini';
import { format, differenceInDays, addDays } from 'date-fns';
import type { InventoryItem } from '../types';
import { Camera, ShieldAlert, Trash2, Tag, ChevronDown, ChevronRight, Split, Edit3 } from 'lucide-react';

// Removed static SOS items, will fetch from DB

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sosItems, setSosItems] = useState<{id: string, name: string, icon: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Add State
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualItem, setManualItem] = useState({ name: '', quantity: 1, unit: 'unité', expiryDays: 7 });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({}); // Track open accordions

  const loadInventory = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .order('expiry_date', { ascending: true });
    
    if (data) setItems(data);

    const { data: sosData } = await supabase.from('sos_items').select('*');
    if (sosData) setSosItems(sosData);

    setLoading(false);
  };

  useEffect(() => {
    loadInventory();
    const inventorySub = supabase.channel('inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, loadInventory)
      .subscribe();
    return () => { supabase.removeChannel(inventorySub); };
  }, []);

  const getStatusColor = (status: string | null) => {
    switch(status) {
      case 'red': return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'orange': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case 'green': return 'bg-green-500/20 text-green-500 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // Convert image to base64 for Gemini
  const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `
        You are a highly capable AI specialized in reading Hungarian receipt images.
        Extract the food items from this receipt.
        Respond ONLY with a valid JSON array of objects.
        Do not include markdown blocks, just the raw JSON.
        Format for each item object:
        {
          "product_name": "French translation of the hungarian item name",
          "canonical_name": "Simple unique name for grouping (ex: 'Lait' for 'Lait entier 1.5%')",
          "category": "e.g., Viande, Légumes, Laitier, Épicerie",
          "quantity": number (extraire le poids/volume si présent dans le nom, ex: 500 pour 'Lardons 500g', 1 pour 'Lait 1L'),
          "unit": "string (ex: 'g', 'kg', 'ml', 'L', 'unité'). Si c'est un poids/volume, extrais l'unité correspondante.",
          "estimated_days_shelf_life": integer (estimate how many days it stays fresh)
        }`;

      const imagePart = await fileToGenerativePart(file);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await model.generateContent([prompt, imagePart as any]);
      const responseText = result.response.text();
      
      // Clean up markdown ticks if Gemini added them despite instructions
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedItems = JSON.parse(cleanJson);

      // Save to Supabase
      for (const item of parsedItems) {
        const addedDate = new Date();
        const expiryDate = addDays(addedDate, item.estimated_days_shelf_life || 7);
        await supabase.from('inventory').insert([{
          product_name: item.product_name,
          canonical_name: item.canonical_name || item.product_name,
          category: item.category,
          quantity: item.quantity || 1,
          unit: item.unit || 'unité',
          added_date: addedDate.toISOString(),
          expiry_date: expiryDate.toISOString(),
          status: 'green'
        }]);
      }
      
      alert(`✅ ${parsedItems.length} produits ajoutés ou mis à jour dans l'inventaire !`);
    } catch (err) {
      console.error('Error scanning receipt:', err);
      alert('Erreur lors de l\'analyse du ticket. Assurez-vous que l\'image est claire.');
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerSOS = async (itemName: string) => {
    try {
      // Predict category AND canonical name with AI
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `L'utilisateur ajoute l'article S.O.S "${itemName}" à sa liste de courses. 
      1. Dans quel rayon ?
      2. Quel est son nom canonique/simplifié ?
      
      Réponds UNIQUEMENT sous ce format JSON: {"category": "...", "canonical_name": "..."}`;
      
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text().trim().replace(/```json/g, '').replace(/```/g, ''));

      // Check if item already exists in shopping list (Exact name)
      const { data: existing } = await supabase
        .from('shopping_list')
        .select('*')
        .eq('product_name', itemName)
        .eq('is_bought', false)
        .maybeSingle();

      if (existing) {
        const newQty = (existing.quantity || 1) + 1;
        await supabase
          .from('shopping_list')
          .update({ quantity: newQty })
          .eq('id', existing.id);
        alert(`✅ Quantité mise à jour : ${newQty} pour ${itemName} !`);
      } else {
        const item = {
          product_name: itemName,
          canonical_name: data.canonical_name,
          category: data.category,
          added_date: new Date().toISOString(),
          is_bought: false,
          quantity: 1,
          unit: 'unité'
        };
        await supabase.from('shopping_list').insert([item]);
        alert(`${itemName} a été ajouté au rayon ${data.category} !`);
      }
    } catch (err) {
      console.error('Error adding SOS item', err);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualItem.name || scanning) return;

    setScanning(true);
    try {
      // 1. Predict Category AND Canonical Name with AI
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `L'utilisateur ajoute "${manualItem.name}" au frigo. 
      1. Quelle est la catégorie ? (ex: Laitage, Viande, Légumes, Épicerie, Boisson, Surgelé).
      2. Quel est son nom simplifié/canonique unique pour le grouper avec des produits similaires ? (ex: 'Lait' pour 'Lait entier Marin' et 'Lait demi-écrémé').
      
      Réponds UNIQUEMENT sous ce format JSON: {"category": "...", "canonical_name": "..."}`;
      
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text().trim().replace(/```json/g, '').replace(/```/g, ''));

      const addedDate = new Date();
      const expiryDate = addDays(addedDate, manualItem.expiryDays);

      const newItem = {
        product_name: manualItem.name,
        canonical_name: data.canonical_name,
        category: data.category,
        quantity: manualItem.quantity,
        unit: manualItem.unit,
        added_date: addedDate.toISOString(),
        expiry_date: expiryDate.toISOString(),
        status: 'green'
      };

      const { error } = await supabase.from('inventory').insert([newItem]);
      if (error) throw error;
      
      setShowManualForm(false);
      setManualItem({ name: '', quantity: 1, unit: 'unité', expiryDays: 7 });
    } catch (err) {
      console.error('Error adding manual item:', err);
      alert('Erreur lors de l\'ajout du produit.');
    } finally {
      setScanning(false);
    }
  };

  const splitItem = async (id: string, currentName: string) => {
    const newCanonical = window.prompt("Entrez un nouveau groupe pour cet article (Séparez du groupe actuel) :", currentName);
    if (newCanonical) {
      await supabase.from('inventory').update({ canonical_name: newCanonical }).eq('id', id);
      loadInventory();
    }
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleEditItem = async (id: string, currentQty: number | null, currentUnit: string | null) => {
    const newQtyStr = window.prompt(`Modifier la quantité (actuelle: ${currentQty}) :`, currentQty?.toString());
    if (newQtyStr === null) return;
    const newQty = parseFloat(newQtyStr);
    if (isNaN(newQty)) return;

    const newUnit = window.prompt(`Modifier l'unité (actuelle: ${currentUnit}) :`, currentUnit || 'unité');
    if (newUnit === null) return;

    await supabase.from('inventory').update({ quantity: newQty, unit: newUnit }).eq('id', id);
    loadInventory();
  };

  const deleteItem = async (id: string) => {
    await supabase.from('inventory').delete().eq('id', id);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Inventaire & Courses</h1>
        <p className="page-subtitle">Ne tombez jamais à court de rien.</p>
      </div>

      {/* S.O.S Widget */}
      <h2 className="text-sm font-bold text-gray-400 mb-3 border-b border-white/5 pb-2 uppercase tracking-wider">
        Bouton S.O.S (Ajout Liste de Courses)
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {sosItems.map((item) => (
          <button 
            key={item.name}
            onClick={() => triggerSOS(item.name)}
            className="glass-card !p-3 flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-colors"
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-xs font-semibold text-center leading-tight">{item.name}</span>
          </button>
        ))}
        {sosItems.length === 0 && (
          <p className="text-xs text-gray-400 col-span-full italic">Aucun raccourci S.O.S configuré. Allez dans Paramètres.</p>
        )}
      </div>

      <div className="flex gap-4 mb-8">
        {/* OCR Upload Card */}
        <div className="glass-card bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20 text-center p-6 flex-1">
          <ShieldAlert className="w-12 h-12 text-indigo-400 mx-auto mb-4 opacity-80" />
          <h3 className="text-lg font-bold text-white mb-2">Scanner (IA)</h3>
          
          <input 
            type="file" 
            accept="image/*" 
            capture="environment"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden" 
          />
          
          <button 
            className="btn-primary w-full max-w-xs mx-auto text-sm py-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
          >
            {scanning ? "Analyse..." : <><Camera size={16} /> Appareil Photo</>}
          </button>
        </div>

        {/* Manual Add Trigger */}
        <div className="glass-card border-white/10 text-center p-6 flex-1 flex flex-col justify-center">
          <h3 className="text-lg font-bold text-white mb-4">Saisie Manuelle</h3>
          <button 
            className="btn-primary bg-white/10 hover:bg-white/20 text-sm py-2"
            onClick={() => setShowManualForm(!showManualForm)}
          >
            Ajouter un produit
          </button>
        </div>
      </div>

      {showManualForm && (
        <form onSubmit={handleManualAdd} className="glass-card mb-8 animate-enter flex flex-col gap-4">
          <h3 className="font-bold border-b border-white/10 pb-2">Nouveau Produit</h3>
          <input 
            type="text" 
            placeholder="Nom (ex: Pâtes)" 
            required 
            className="input-base"
            value={manualItem.name}
            onChange={e => setManualItem({...manualItem, name: e.target.value})}
          />
          <div className="flex gap-4">
            <input 
              type="number" 
              step="0.1"
              required 
              className="input-base flex-1"
              placeholder="Quantité"
              value={manualItem.quantity}
              onChange={e => setManualItem({...manualItem, quantity: parseFloat(e.target.value)})}
            />
            <select 
              className="input-base w-1/3"
              value={manualItem.unit}
              onChange={e => setManualItem({...manualItem, unit: e.target.value})}
            >
              <option value="unité">Unité(s)</option>
              <option value="g">Grammes (g)</option>
              <option value="kg">Kilos (kg)</option>
              <option value="ml">ml</option>
              <option value="L">Litres (L)</option>
            </select>
          </div>
          <div className="flex gap-4 items-center">
            <label className="text-sm text-gray-400">Périme dans (jours) :</label>
            <input 
              type="number" 
              className="input-base w-24"
              value={manualItem.expiryDays}
              onChange={e => setManualItem({...manualItem, expiryDays: parseInt(e.target.value)})}
            />
          </div>
          <button type="submit" className="btn-primary bg-indigo-500 rounded-lg py-2 mt-2">
            Ajouter au Frigo
          </button>
        </form>
      )}

      {/* Inventory List */}
      <div className="flex justify-between items-end mb-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">État du Frigo & Placards</h2>
      </div>

      <div className="flex flex-col gap-6">
        {loading && items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="glass-card text-center text-gray-500">
            L'inventaire est vide. Scannez un ticket pour commencer !
          </div>
        ) : (
          Object.entries(
            items.reduce((acc, item) => {
              const category = item.category || 'Divers';
              if (!acc[category]) acc[category] = [];
              acc[category].push(item);
              return acc;
            }, {} as Record<string, typeof items>)
          ).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryItems]) => (
            <div key={category} className="flex flex-col gap-3">
              <h2 className="text-xs font-bold text-indigo-400/70 uppercase tracking-widest flex items-center gap-2 px-2">
                <Tag size={12} /> {category}
              </h2>
              
              {/* Canonical Groups */}
              {Object.entries(
                categoryItems.reduce((acc, item) => {
                  const canon = item.canonical_name || item.product_name;
                  if (!acc[canon]) acc[canon] = [];
                  acc[canon].push(item);
                  return acc;
                }, {} as Record<string, typeof items>)
              ).map(([canonName, groupedItems]) => {
                const totalQty = groupedItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
                const firstItem = groupedItems[0];
                const isExpanded = expandedGroups[`${category}-${canonName}`];
                
                return (
                  <div key={canonName} className="flex flex-col gap-1">
                    {/* Summary Row */}
                    <div 
                      onClick={() => toggleGroup(`${category}-${canonName}`)}
                      className="glass-card !p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-gray-500">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white capitalize">{canonName}</h3>
                          <div className="text-[10px] text-gray-400">{groupedItems.length} article(s)</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                         <div className="font-bold text-indigo-300">
                            {totalQty} {firstItem.unit !== 'unité' ? firstItem.unit : ''}
                         </div>
                      </div>
                    </div>

                    {/* Details (Accordion) */}
                    {isExpanded && (
                      <div className="flex flex-col gap-1 ml-4 border-l border-white/10 pl-2 mt-1 mb-2 animate-enter">
                        {groupedItems.map(item => {
                          if (item.expiry_date && item.status !== 'red' && item.category !== 'S.O.S (Urgence)') {
                            const daysLeft = differenceInDays(new Date(item.expiry_date), new Date());
                            if (daysLeft <= 1) item.status = 'red';
                            else if (daysLeft <= 3) item.status = 'orange';
                            else item.status = 'green';
                          }

                          return (
                            <div key={item.id} className="bg-white/5 !p-3 rounded-xl flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(item.status)}`} />
                                <div>
                                  <div className="text-sm text-gray-200">{item.product_name}</div>
                                  <div className="text-[10px] text-gray-500">
                                    Ajouté le {format(new Date(item.added_date!), 'dd/MM')}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <div className="text-xs font-mono text-gray-400">
                                  {item.quantity} {item.unit !== 'unité' ? item.unit : ''}
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleEditItem(item.id, item.quantity, item.unit); }}
                                    className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg"
                                    title="Modifier la quantité"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); splitItem(item.id, item.canonical_name || item.product_name); }}
                                    className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg"
                                    title="Séparer ce groupe"
                                  >
                                    <Split size={14} />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} 
                                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

    </div>
  );
}
