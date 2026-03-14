import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { CheckSquare, ShoppingBasket, Calendar as CalendarIcon, ChefHat, ShoppingCart, Settings as SettingsIcon } from 'lucide-react';
import ChoresPage from './pages/ChoresPage.tsx';
import InventoryPage from './pages/InventoryPage.tsx';
import CalendarPage from './pages/CalendarPage.tsx';
import MealsPage from './pages/MealsPage.tsx';
import ShoppingListPage from './pages/ShoppingListPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';

const NavItems = () => (
  <>
    <NavLink to="/chores" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <CheckSquare size={24} />
      <span className="text-[10px]">Tâches</span>
    </NavLink>
    <NavLink to="/inventory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <ShoppingBasket size={24} />
      <span className="text-[10px]">Frigo</span>
    </NavLink>
    <NavLink to="/shopping" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <ShoppingCart size={24} />
      <span className="text-[10px]">Courses</span>
    </NavLink>
    <NavLink to="/calendar" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <CalendarIcon size={24} />
      <span className="text-[10px]">Agenda</span>
    </NavLink>
    <NavLink to="/meals" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <ChefHat size={24} />
      <span className="text-[10px]">Repas</span>
    </NavLink>
    <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <SettingsIcon size={24} />
      <span className="text-[10px]">Config</span>
    </NavLink>
  </>
);

function App() {
  return (
    <BrowserRouter>
      {/* Desktop Sidebar (Optional, visually hidden on mobile) */}
      <nav className="desktop-sidebar hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-[250px] bg-[#191c24] border-r border-white/5 p-6 z-50">
        <div className="mb-10 flex items-center gap-3">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            ColocAI
          </h1>
        </div>
        <div className="flex flex-col gap-2">
          <NavLink to="/chores" style={{ textDecoration: 'none' }} className={({ isActive }) => `flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive ? 'bg-white/10 text-indigo-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <CheckSquare size={20} />
            <span className="font-medium">Tâches & Mercato</span>
          </NavLink>
          <NavLink to="/inventory" style={{ textDecoration: 'none' }} className={({ isActive }) => `flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive ? 'bg-white/10 text-indigo-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <ShoppingBasket size={20} />
            <span className="font-medium">Inventaire Frigo</span>
          </NavLink>
          <NavLink to="/shopping" style={{ textDecoration: 'none' }} className={({ isActive }) => `flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive ? 'bg-white/10 text-indigo-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <ShoppingCart size={20} />
            <span className="font-medium">Liste de Courses</span>
          </NavLink>
          <NavLink to="/calendar" style={{ textDecoration: 'none' }} className={({ isActive }) => `flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive ? 'bg-white/10 text-indigo-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <CalendarIcon size={20} />
            <span className="font-medium">Agenda Partagé</span>
          </NavLink>
          <NavLink to="/meals" style={{ textDecoration: 'none' }} className={({ isActive }) => `flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive ? 'bg-white/10 text-indigo-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <ChefHat size={20} />
            <span className="font-medium">Le Chef I.A.</span>
          </NavLink>
          <div className="mt-8 pt-4 border-t border-white/5">
            <NavLink to="/settings" style={{ textDecoration: 'none' }} className={({ isActive }) => `flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive ? 'bg-white/10 text-indigo-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
              <SettingsIcon size={20} />
              <span className="font-medium">Paramètres</span>
            </NavLink>
          </div>
        </div>
      </nav>

      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/chores" replace />} />
          <Route path="/chores" element={<ChoresPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/shopping" element={<ShoppingListPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/meals" element={<MealsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="bottom-nav md:hidden">
        <NavItems />
      </nav>
    </BrowserRouter>
  );
}

export default App;
