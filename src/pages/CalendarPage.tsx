import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Event, User } from '../types';
import { Plus, Users } from 'lucide-react';

export default function CalendarPage() {
  const [events, setEvents] = useState<(Event & { user: User })[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Custom Event Form State
  const [showForm, setShowForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '12:00' });

  const loadData = async () => {
    const { data: usersData } = await supabase.from('users').select('*');
    if (usersData) {
      setUsers(usersData);
      if (!currentUser) setCurrentUser(usersData[0]);
    }

    const { data: eventsData } = await supabase
      .from('events')
      .select('*, user:users(*)')
      .gte('start_time', startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString())
      .order('start_time', { ascending: true });
    
    if (eventsData) setEvents(eventsData as unknown as (Event & { user: User })[]);
  };

  useEffect(() => {
    // eslint-disable-next-line
    loadData();
    const sub = supabase.channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const start_time = new Date(`${newEvent.date}T${newEvent.time}:00`);
    const end_time = new Date(start_time.getTime() + (2 * 60 * 60 * 1000)); // Default 2 hours

    const { error } = await supabase.from('events').insert({
      title: newEvent.title,
      start_time: start_time.toISOString(),
      end_time: end_time.toISOString(),
      user_id: currentUser.id
    });

    if (!error) {
      setShowForm(false);
      setNewEvent({ title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '12:00' });
    }
  };

  const deleteEvent = async (id: string) => {
    await supabase.from('events').delete().eq('id', id);
  };

  // Generate week days
  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));

  // Determine Presence Logic (Inverse of generic events: if no event, user is present for meals)
  const calculatePresentUsersForDay = (date: Date) => {
    // For simplicity: if a user has an event that day, assume they are busy/absent for meals.
    // A robust version would check specific meal hours.
    const busyUsers = events
      .filter(e => isSameDay(new Date(e.start_time), date))
      .map(e => e.user.id);
    
    return users.filter(u => !busyUsers.includes(u.id));
  };

  return (
    <div className="page-container">
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="page-title">Agenda Partagé</h1>
          <p className="page-subtitle">Synchronisez vos emplois du temps</p>
        </div>
        
        {users.length > 0 && (
          <select 
            className="input-base w-auto py-1 px-3 text-sm bg-white/10"
            value={currentUser?.id}
            onChange={(e) => setCurrentUser(users.find(u => u.id === e.target.value) || null)}
          >
            {users.map(u => <option key={u.id} value={u.id}>📅 {u.pseudo}</option>)}
          </select>
        )}
      </div>

      <button 
        onClick={() => setShowForm(!showForm)}
        className="btn-primary w-full mb-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500"
      >
        <Plus size={20} /> Signaler une absence / contrainte
      </button>

      {showForm && (
        <form onSubmit={handleAddEvent} className="glass-card mb-8 animate-enter flex flex-col gap-4">
          <input 
            type="text" 
            placeholder="Ex: Entraînement M1" 
            required 
            className="input-base"
            value={newEvent.title}
            onChange={e => setNewEvent({...newEvent, title: e.target.value})}
          />
          <div className="flex gap-4">
            <input 
              type="date" 
              required 
              className="input-base flex-1"
              value={newEvent.date}
              onChange={e => setNewEvent({...newEvent, date: e.target.value})}
            />
            <input 
              type="time" 
              required 
              className="input-base flex-1"
              value={newEvent.time}
              onChange={e => setNewEvent({...newEvent, time: e.target.value})}
            />
          </div>
          <button type="submit" className="btn-primary bg-indigo-500 rounded-lg py-2 mt-2">
            Ajouter à l'agenda
          </button>
        </form>
      )}

      {/* Week View */}
      <div className="flex flex-col gap-4">
        {weekDays.map(day => {
          const dayEvents = events.filter(e => isSameDay(new Date(e.start_time), day));
          const presentUsers = calculatePresentUsersForDay(day);
          const isToday = isSameDay(day, new Date());

          return (
            <div key={day.toISOString()} className={`glass-card !p-0 overflow-hidden ${isToday ? 'border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : ''}`}>
              {/* Day Header */}
              <div className={`p-3 flex justify-between items-center ${isToday ? 'bg-indigo-500/20' : 'bg-white/5'}`}>
                <div className="font-bold capitalize text-lg">
                  {format(day, 'EEEE dd MMM', { locale: fr })}
                  {isToday && <span className="ml-2 text-xs bg-indigo-500 text-white px-2 py-1 rounded-full uppercase tracking-wider">Aujourd'hui</span>}
                </div>
                
                {/* Presence Indicator Badge */}
                <div className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-black/30 text-gray-300">
                  <Users size={12} className={presentUsers.length === 3 ? "text-green-400" : presentUsers.length > 0 ? "text-orange-400" : "text-red-400"} />
                  <span>{presentUsers.length}/3 présents</span>
                </div>
              </div>

              {/* Day Events */}
              <div className="p-3">
                {dayEvents.length === 0 ? (
                  <p className="text-sm text-gray-500 italic text-center">Aucune contrainte, tout le monde est dispo !</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dayEvents.map(evt => (
                      <div key={evt.id} className="flex items-center justify-between text-sm bg-white/5 p-2 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded">
                            {format(new Date(evt.start_time), 'HH:mm')}
                          </span>
                          <span className="font-bold">{evt.user.pseudo}</span>
                          <span className="text-gray-400">- {evt.title}</span>
                        </div>
                        {currentUser?.id === evt.user.id && (
                           <button onClick={() => deleteEvent(evt.id)} className="text-red-400/50 hover:text-red-400"><Plus size={16} className="rotate-45" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
