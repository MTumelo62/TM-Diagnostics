import React from 'react';
import { DashboardIcon, CodeIcon, HistoryIcon } from './Icons';

type View = 'dashboard' | 'codes' | 'history';

interface BottomNavProps {
  activeView: View;
  setActiveView: (view: View) => void;
}

const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
    { id: 'codes', label: 'Code Meanings', icon: CodeIcon },
    { id: 'history', label: 'History', icon: HistoryIcon },
];

const BottomNav: React.FC<BottomNavProps> = ({ activeView, setActiveView }) => {
    return (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700 flex justify-around items-center p-2 z-50">
            {navItems.map(item => {
                const isActive = activeView === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => setActiveView(item.id as View)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex flex-col items-center justify-center gap-1 w-full rounded-md p-2 transition-colors duration-200 ${
                            isActive
                                ? 'text-cyan-400'
                                : 'text-slate-400 hover:bg-slate-800/60'
                        }`}
                    >
                        <item.icon className="w-6 h-6" />
                        <span className="text-xs font-medium">{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
};

export default BottomNav;
