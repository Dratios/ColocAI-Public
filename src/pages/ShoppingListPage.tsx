import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShoppingCart, CheckCircle, Circle, Trash2, Plus, Tag, ChevronDown, ChevronRight, Split } from 'lucide-react';
import { genAI } from '../lib/gemini';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ShoppingListPage() {
  const [items, setItems] = useState<{ id: string, product_name: string, is_bought: boolean, added_date: string, category: string | null, quantity: number, unit: string, canonical_name: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const loadList = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shopping_list')
      .select('*')
      .order('is_bought', { ascending: true })
      .order('added_date', { ascending: false });
    
    if (data) setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line
    loadList();
    const sub = supabase.channel('shopping-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list' }, loadList)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim() || loading) return;
    
    const itemName = newItem.trim();
    setNewItem('');
    setLoading(true);

    try {
      // Predict category AND canonical name with AI
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `L'utilisateur ajoute "${itemName}" à sa liste de courses. 
      1. Dans quel rayon de supermarché cela se trouve-t-il ? (ex: Fruits, Frais, Épicerie, Boissons, Hygiène).
      2. Quel est son nom simplifié/canonique unique pour le grouper avec des produits similaires ? (ex: 'Lait' pour 'Lait entier' et 'Lait demi-écrémé').
      
      Réponds UNIQUEMENT sous ce format JSON: {"category": "...", "canonical_name": "..."}`;
      
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text().trim().replace(/```json/g, '').replace(/```/g, ''));

      await supabase.from('shopping_list').insert([{
        product_name: itemName,
        canonical_name: data.canonical_name,
        category: data.category,
        is_bought: false,
        quantity: 1,
        unit: 'unité'
      }]);
    } catch (err) {
      console.error("Error adding shopping item", err);
      // Fallback
      await supabase.from('shopping_list').insert([{
        product_name: itemName,
        category: 'Divers',
        canonical_name: itemName,
        is_bought: false,
        quantity: 1,
        unit: 'unité'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const splitItem = async (id: string, currentName: string) => {
    const newCanonical = window.prompt("Entrez un nouveau groupe pour cet article (Séparez du groupe actuel) :", currentName);
    if (newCanonical) {
      await supabase.from('shopping_list').update({ canonical_name: newCanonical }).eq('id', id);
      loadList();
    }
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const toggleBought = async (id: string, current: boolean) => {
    await supabase.from('shopping_list').update({ is_bought: !current }).eq('id', id);
  };

  const deleteItem = async (id: string) => {
    await supabase.from('shopping_list').delete().eq('id', id);
  };

  const clearAllItems = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir vider TOUTE la liste de courses ?")) {
      const { error } = await supabase.from('shopping_list').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
      if (error) console.error("Erreur giga clear:", error);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="page-title flex items-center gap-2"><ShoppingCart /> Courses</h1>
          <p className="page-subtitle">Achats prévus et urgences.</p>
        </div>
        {items.length > 0 && (
          <button 
            onClick={clearAllItems}
            className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-2 rounded-xl flex items-center gap-1 hover:bg-red-500/30 transition-colors"
          >
            <Trash2 size={14} /> Vider la liste
          </button>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-8">
        <input 
          type="text" 
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder="Ajouter un article..."
          className="input-base flex-1"
        />
        <button type="submit" className="btn-primary bg-indigo-500 p-3" disabled={!newItem.trim()}>
          <Plus size={20} />
        </button>
      </form>

      <div className="flex flex-col gap-6">
        {loading && items.length === 0 && <p className="text-gray-500 text-center">Chargement...</p>}
        {!loading && items.length === 0 && (
          <div className="glass-card text-center text-gray-500 py-8">
            La liste de courses est vide.
          </div>
        )}
        
        {Object.entries(
          items.reduce((acc, item) => {
            const category = item.category || 'Divers';
            if (!acc[category]) acc[category] = [];
            acc[category].push(item);
            return acc;
          }, {} as Record<string, typeof items>)
        ).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryItems]) => (
          <div key={category} className="flex flex-col gap-2">
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
              const allBought = groupedItems.every(i => i.is_bought);

              return (
                <div key={canonName} className="flex flex-col gap-1">
                  {/* Summary Row */}
                  <div 
                    onClick={() => toggleGroup(`${category}-${canonName}`)}
                    className={`glass-card !p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all ${allBought ? 'opacity-50 grayscale' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-gray-500">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <div>
                        <h3 className={`font-semibold capitalize ${allBought ? 'line-through text-gray-500' : 'text-white'}`}>
                          {canonName}
                        </h3>
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
                      {groupedItems.map(item => (
                        <div key={item.id} className={`bg-white/5 !p-3 rounded-xl flex items-center justify-between group transition-all ${item.is_bought ? 'opacity-50' : ''}`}>
                          <div className="flex items-center gap-3 flex-1" onClick={() => toggleBought(item.id, !!item.is_bought)}>
                            <div className="text-indigo-400 cursor-pointer">
                              {item.is_bought ? <CheckCircle className="text-green-500" size={18} /> : <Circle size={18} />}
                            </div>
                            <div>
                              <div className={`text-sm ${item.is_bought ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                                {item.product_name}
                              </div>
                              {item.added_date && (
                                <div className="text-[10px] text-gray-500">
                                  {format(new Date(item.added_date), "dd MMM", { locale: fr })}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="text-xs font-mono text-gray-400">
                              {item.quantity} {item.unit !== 'unité' ? item.unit : ''}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
