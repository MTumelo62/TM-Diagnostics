
import React from 'react';

interface DiagnosticCardProps {
  title: string;
  tagText: string;
  tagColor: string;
}

const DiagnosticCard: React.FC<DiagnosticCardProps> = ({ title, tagText, tagColor }) => {
  return (
    <div className="bg-slate-800 rounded-lg p-4 shadow-lg flex justify-between items-start gap-3 transform transition-transform duration-300 hover:scale-105 hover:shadow-cyan-500/20">
      <p className="text-slate-200 flex-1">{title}</p>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tagColor}`}>
        {tagText}
      </span>
    </div>
  );
};

export default DiagnosticCard;
