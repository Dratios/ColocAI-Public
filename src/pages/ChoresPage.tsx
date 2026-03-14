import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { differenceInDays } from 'date-fns';
import type { User, TaskWithPoints } from '../types';
import { Trash2, TrendingUp, Handshake, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ChoresPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<TaskWithPoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null); // Simulate logged in user

  const validateChore = async (taskId: string, points: number) => {
    if (!currentUser) return;
    
    try {
      // 1. Add to history
      const { error: historyError } = await supabase
        .from('chore_history')
        .insert({ task_id: taskId, user_id: currentUser.id });
      
      if (historyError) throw historyError;

      // 2. Update user score
      const { error: scoreError } = await supabase
        .from('users')
        .update({ score: currentUser.score! + Math.floor(points) })
        .eq('id', currentUser.id);

      if (scoreError) throw scoreError;

      await loadData();
    } catch (err) {
      console.error('Error validating chore', err);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    
    // Fetch users
    const { data: usersData } = await supabase.from('users').select('*').order('score', { ascending: false });
    if (usersData) {
      setUsers(usersData);
      if (!currentUser) setCurrentUser(usersData[0]); // Default to first user
    }

    // Fetch tasks
    const { data: tasksData } = await supabase.from('tasks').select('*');
    
    if (tasksData) {
      // For each task, get the last time it was completed
      const tasksWithPoints: TaskWithPoints[] = await Promise.all(
        tasksData.map(async (task) => {
          const { data: historyData } = await supabase
            .from('chore_history')
            .select(`
              completed_at,
              users (
                pseudo
              )
            `)
            .eq('task_id', task.id)
            .order('completed_at', { ascending: false })
            .limit(2);

          let daysLate = 0;
          let currentPoints = task.base_points;
          let lastPerformers: string[] = [];

          if (historyData && historyData.length > 0) {
            lastPerformers = historyData.map((h: any) => h.users?.pseudo).filter(Boolean);
            
            if (historyData[0].completed_at) {
              const lastDone = new Date(historyData[0].completed_at);
              const today = new Date();
              const daysSince = differenceInDays(today, lastDone);
              
              daysLate = Math.max(0, daysSince - task.frequency_days);
              currentPoints = task.base_points + (daysLate * task.urgency_multiplier);
            }
          }

          return {
            ...task,
            currentPoints,
            daysLate,
            lastPerformers
          };
        })
      );

      // Sort by points descending
      setTasks(tasksWithPoints.sort((a, b) => b.currentPoints - a.currentPoints));
    }
    
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    loadData();

    // Set up realtime subscriptions
    const usersSub = supabase.channel('users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, loadData)
      .subscribe();

    const historySub = supabase.channel('history-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_history' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(usersSub);
      supabase.removeChannel(historySub);
    };
  }, [loadData]);

  const triggerTrashSOS = async () => {
    // Find user with lowest score
    if (users.length === 0) return;
    const lowestUser = [...users].sort((a, b) => (a.score || 0) - (b.score || 0))[0];
    alert(`🔴 ALERTE POUBELLE ! Assignée prioritairement à ${lowestUser.pseudo} (Score le plus bas: ${lowestUser.score})`);
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="page-title">Tâches & Mercato</h1>
          <p className="page-subtitle">Qui va gagner des points aujourd'hui ?</p>
        </div>
        
        {/* User Selector (Simulation) */}
        {currentUser && (
          <select 
            className="input-base w-auto py-1 px-3 text-sm bg-white/10"
            value={currentUser.id}
            onChange={(e) => setCurrentUser(users.find(u => u.id === e.target.value) || null)}
          >
            {users.map(u => (
              <option key={u.id} value={u.id} className="bg-gray-800 text-white">👤 {u.pseudo}</option>
            ))}
          </select>
        )}
      </div>

      {/* Leaderboard */}
      <div className="glass-card mb-6 mb-8 flex gap-4 overflow-x-auto pb-2 snap-x">
        {users.map((user, idx) => (
          <div key={user.id} className="snap-center shrink-0 min-w-[120px] bg-white/5 rounded-xl p-4 flex flex-col items-center justify-center relative">
            {idx === 0 && <span className="absolute -top-3 text-2xl">👑</span>}
            <span className="font-bold text-lg">{user.pseudo}</span>
            <div className="text-xl font-black text-indigo-400 mt-1">{user.score} <span className="text-sm font-normal text-gray-500">pts</span></div>
            <div className="text-xs text-orange-300 mt-2 flex items-center gap-1">
              <Handshake size={12} /> {user.mercato_balance}
            </div>
          </div>
        ))}
      </div>

      {/* Trigger Poubelle */}
      <button onClick={triggerTrashSOS} className="w-full glass-card mb-8 !bg-red-500/10 !border-red-500/30 hover:!bg-red-500/20 flex items-center justify-center gap-3 text-red-400 font-bold py-4">
        <Trash2 /> POUBELLE PLEINE (Assignation Auto)
      </button>

      {/* Tâches */}
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <TrendingUp className="text-indigo-400" /> Tâches à faire
      </h2>
      
      <div className="flex flex-col gap-4">
        {tasks.map(task => (
          <div key={task.id} className="glass-card flex items-center justify-between !p-4">
            <div className="flex-1">
              <h3 className="font-bold text-lg">{task.name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-gray-400">Base: {task.base_points}</span>
                  {task.daysLate > 0 ? (
                    <span className="text-red-400 flex items-center gap-1">
                      <AlertCircle size={14} /> +{task.daysLate} jours
                    </span>
                  ) : (
                    <span className="text-green-400">À jour</span>
                  )}
                  {task.lastPerformers && task.lastPerformers.length > 0 && (
                    <div className="flex items-center gap-1 ml-2 text-[10px] uppercase tracking-wider text-indigo-400/70 font-bold bg-indigo-500/5 px-2 py-0.5 rounded-full border border-indigo-500/10">
                      <span>Derniers :</span>
                      <span>{task.lastPerformers.join(', ')}</span>
                    </div>
                  )}
                </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-black text-indigo-300">
                  {task.currentPoints.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500">points</div>
              </div>
              
              <button 
                onClick={() => validateChore(task.id, task.currentPoints)}
                className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all"
              >
                <CheckCircle2 size={24} />
              </button>
            </div>
          </div>
        ))}
        {tasks.length === 0 && !loading && (
          <p className="text-center text-gray-500 my-8">Aucune tâche trouvée dans la base.</p>
        )}
      </div>
    </div>
  );
}
