import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, CheckSquare, ShieldAlert, Plus, Trash2, AlertTriangle } from 'lucide-react';
import type { Task } from '../types';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'tasks' | 'sos' | 'dislikes'>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sosItems, setSosItems] = useState<{id: string, name: string, icon: string}[]>([]);
  
  // Forms
  const [newTask, setNewTask] = useState({ name: '', base_points: 10, frequency_days: 7, urgency_multiplier: 1.5 });
  const [newSos, setNewSos] = useState({ name: '', icon: '🛒' });
  const [newDislike, setNewDislike] = useState('');
  const [dislikes, setDislikes] = useState<{id: string, name: string}[]>([]);

  const loadData = async () => {
    const { data: t } = await supabase.from('tasks').select('*').order('name');
    if (t) setTasks(t);

    const { data: s } = await supabase.from('sos_items').select('*').order('name');
    if (s) setSosItems(s);

    const { data: d } = await supabase.from('disliked_foods').select('*').order('name');
    if (d) setDislikes(d);
  };

  useEffect(() => {
    // eslint-disable-next-line
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.name) return;
    await supabase.from('tasks').insert([newTask]);
    setNewTask({ name: '', base_points: 10, frequency_days: 7, urgency_multiplier: 1.5 });
    loadData();
  };

  const removeTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    loadData();
  };

  const resetScores = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir remettre tous les scores et soldes Mercato à zéro pour tous les colocataires ? Cette action est irréversible.")) return;
    
    // In Supabase, to update all rows without filtering by id, we can use a filter like .neq('id', '00000000-0000-0000-0000-000000000000') or similar if needed.
    // Wait, updating all rows is tricky without a match in PostgREST unless we use a catch-all filter. Let's filter by score >= 0 or score < 0 (effectively all).
    await supabase.from('users').update({ score: 0, mercato_balance: 0 }).gte('score', -99999);
    
    // Also clear the chore_history to start a fresh month? Optional, but let's stick to user scores as requested.
    alert("Tous les scores ont été réinitialisés à zéro !");
  };

  const addSos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSos.name) return;
    await supabase.from('sos_items').insert([newSos]);
    setNewSos({ name: '', icon: '🛒' });
    loadData();
  };

  const removeSos = async (id: string) => {
    await supabase.from('sos_items').delete().eq('id', id);
    loadData();
  };

  const addDislike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDislike.trim()) return;
    await supabase.from('disliked_foods').insert([{ name: newDislike.trim() }]);
    setNewDislike('');
    loadData();
  };

  const removeDislike = async (id: string) => {
    await supabase.from('disliked_foods').delete().eq('id', id);
    loadData();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><Settings /> Paramètres</h1>
        <p className="page-subtitle">Configurez les corvées et les raccourcis SOS.</p>
      </div>

      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold ${activeTab === 'tasks' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          <CheckSquare size={18} /> Tâches Ménagères
        </button>
        <button 
          onClick={() => setActiveTab('sos')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold ${activeTab === 'sos' ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          <ShieldAlert size={18} /> Raccourcis S.O.S
        </button>
        <button 
          onClick={() => setActiveTab('dislikes')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-bold ${activeTab === 'dislikes' ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          <AlertTriangle size={18} /> Aversions
        </button>
      </div>

      {activeTab === 'tasks' && (
        <div className="animate-enter">
          <form onSubmit={addTask} className="glass-card mb-6 flex flex-col gap-3">
            <h3 className="font-bold border-b border-white/10 pb-2">Nouvelle Tâche</h3>
            <input type="text" placeholder="Nom (ex: Sortir poubelles)" className="input-base" value={newTask.name} onChange={e => setNewTask({...newTask, name: e.target.value})} required />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400">Points de base</label>
                <input type="number" className="input-base" value={newTask.base_points} onChange={e => setNewTask({...newTask, base_points: parseInt(e.target.value)})} required />
              </div>
              <div>
                <label className="text-xs text-gray-400">Fréquence (Jours)</label>
                <input type="number" className="input-base" value={newTask.frequency_days} onChange={e => setNewTask({...newTask, frequency_days: parseInt(e.target.value)})} required />
              </div>
              <div>
                <label className="text-xs text-gray-400">Multiplicateur urgence</label>
                <input type="number" step="0.1" className="input-base" value={newTask.urgency_multiplier} onChange={e => setNewTask({...newTask, urgency_multiplier: parseFloat(e.target.value)})} required />
              </div>
            </div>
            <button type="submit" className="btn-primary mt-2 flex justify-center"><Plus size={20} /></button>
          </form>

          <div className="space-y-2">
            {tasks.map(t => (
              <div key={t.id} className="glass-card !p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-bold">{t.name}</h4>
                  <div className="text-xs text-gray-400 space-x-3">
                    <span>{t.base_points} pts</span>
                    <span>Tous les {t.frequency_days}j</span>
                    <span>x{t.urgency_multiplier} / retard</span>
                  </div>
                </div>
                <button onClick={() => removeTask(t.id)} className="text-gray-500 hover:text-red-400 p-2"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-6 border-t border-red-500/20">
            <h3 className="text-red-400 font-bold mb-4 flex items-center gap-2">
              <AlertTriangle size={20} /> Zone de Danger (Nouveau Mois)
            </h3>
            <div className="glass-card border-red-500/30 bg-red-500/5 p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div>
                <h4 className="font-bold text-white mb-1">Réinitialiser les scores</h4>
                <p className="text-xs text-gray-400">Remet à zéro tous les points de tâches et soldes Mercato de l'ensemble des colocataires.</p>
              </div>
              <button onClick={resetScores} className="btn-primary bg-red-500 hover:bg-red-600 shadow-red-500/20 whitespace-nowrap">
                Tout remettre à zéro
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sos' && (
        <div className="animate-enter">
          <form onSubmit={addSos} className="glass-card mb-6 flex gap-3">
            <input type="text" placeholder="Emoji (ex: 🍎)" className="input-base w-20 text-center text-xl" maxLength={2} value={newSos.icon} onChange={e => setNewSos({...newSos, icon: e.target.value})} required />
            <input type="text" placeholder="Nom du raccourci" className="input-base flex-1" value={newSos.name} onChange={e => setNewSos({...newSos, name: e.target.value})} required />
            <button type="submit" className="btn-primary bg-orange-500 px-4"><Plus size={20} /></button>
          </form>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sosItems.map(s => (
              <div key={s.id} className="glass-card !p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-sm font-semibold truncate max-w-[80px]">{s.name}</span>
                </div>
                <button onClick={() => removeSos(s.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'dislikes' && (
        <div className="animate-enter">
          <form onSubmit={addDislike} className="glass-card mb-6 flex gap-3">
            <input 
              type="text" 
              placeholder="Nom (ex: Champignons, Coriandre...)" 
              className="input-base flex-1" 
              value={newDislike} 
              onChange={e => setNewDislike(e.target.value)} 
              required 
            />
            <button type="submit" className="btn-primary bg-red-500 px-4 py-2" disabled={!newDislike.trim()}>
              <Plus size={20} />
            </button>
          </form>

          <div className="glass-card">
            <h3 className="font-bold border-b border-white/10 pb-4 mb-4 text-sm uppercase tracking-wider text-gray-400 flex justify-between">
              <span>Aliments Bannis</span>
              <span className="text-white bg-white/10 px-2 py-0.5 rounded-full text-xs">{dislikes.length}</span>
            </h3>
            <p className="text-sm text-gray-400 mb-4">Ces aliments ne seront jamais proposés par l'I.A. lors de la génération des recettes.</p>
            <div className="space-y-2">
              {dislikes.map((item) => (
                <div key={item.id} className="flex justify-between items-center p-3 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-all group">
                  <div className="font-bold text-gray-200 capitalize">{item.name}</div>
                  <button onClick={() => removeDislike(item.id)} className="text-gray-500 hover:text-red-400 p-2">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {dislikes.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <p>Aucun aliment banni.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
