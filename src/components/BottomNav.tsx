import React from 'react';
import { MessageSquare, Star, Network, Settings } from 'lucide-react';

export type TabType = 'chat' | 'favorites' | 'graph' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  pendingCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, pendingCount = 0 }) => {
  const navItems = [
    { id: 'chat' as TabType, label: 'Chat', icon: MessageSquare, badge: pendingCount },
    { id: 'favorites' as TabType, label: 'Destacados', icon: Star },
    { id: 'graph' as TabType, label: 'Grafo', icon: Network },
    { id: 'settings' as TabType, label: 'Ajustes', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-amber-200/80 px-3 py-2 max-w-md mx-auto shadow-lg">
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-amber-800 bg-amber-100/80 font-semibold scale-105'
                  : 'text-stone-500 hover:text-amber-700 hover:bg-amber-50/50'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
