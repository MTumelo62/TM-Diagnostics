
import React from 'react';
import { WrenchIcon, DashboardIcon, CodeIcon, HistoryIcon } from './Icons';

type View = 'dashboard' | 'codes' | 'history';

interface SidebarProps {
  activeView: View;
  setActiveView: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
        { id: 'codes', label: 'Code Meanings', icon: CodeIcon },
        { id: 'history', label: 'History', icon: HistoryIcon },
    ];

    const NavLink: React.FC<{item: typeof navItems[0]}> = ({ item }) => {
        const isActive = activeView === item.id;
        return (
             <button
                onClick={() => setActiveView(item.id as View)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center w-full px-4 py-3 text-left rounded-lg transition-colors duration-200 ${
                    isActive
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                }`}
            >
                <item.icon className="w-6 h-6 mr-3" />
                <span className="font-medium">{item.label}</span>
            </button>
        )
    }

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 p-4 flex-col fixed h-full hidden sm:flex">
             <div className="flex items-center gap-2 mb-8 px-2">
                 <WrenchIcon className="w-8 h-8 text-cyan-400"/>
                 <h1 className="text-xl font-bold text-slate-200">
                    TM Car Diagnostics
                </h1>
            </div>
            <nav className="flex flex-col gap-2">
               {navItems.map(item => <NavLink key={item.id} item={item} />)}
            </nav>
        </aside>
    );
};

export default Sidebar;
