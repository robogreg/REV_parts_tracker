'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Team } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TeamSearchProps {
  teams: Team[];
  value: string;
  onSelect: (team: Team | null, freeText: string) => void;
  error?: string;
}

export function TeamSearch({ teams, value, onSelect, error }: TeamSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = teams.filter((t) => {
    const q = query.toLowerCase();
    return (
      String(t.teamNumber).startsWith(query) ||
      t.teamName.toLowerCase().includes(q)
    );
  }).slice(0, 20);

  function handleSelect(team: Team) {
    setQuery(`${team.teamNumber} – ${team.teamName}`);
    onSelect(team, String(team.teamNumber));
    setOpen(false);
  }

  function handleInputChange(val: string) {
    setQuery(val);
    onSelect(null, val);
    setOpen(true);
  }

  if (teams.length === 0) {
    return (
      <div>
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Team number or name"
          className={cn(
            'w-full bg-[#242424] border rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#FF6B00] transition-colors',
            error ? 'border-red-600' : 'border-[#2E2E2E]'
          )}
        />
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search team number or name..."
          className={cn(
            'w-full bg-[#242424] border rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#9CA3AF] outline-none focus:border-[#FF6B00] transition-colors',
            error ? 'border-red-600' : 'border-[#2E2E2E]'
          )}
        />
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}

      {open && filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#1A1A1A] border border-[#2E2E2E] rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filtered.map((team) => (
            <button
              key={team.id}
              onClick={() => handleSelect(team)}
              className="w-full text-left px-4 py-2.5 hover:bg-[#2E2E2E] transition-colors flex items-center justify-between min-h-0"
            >
              <span className="text-sm text-white">
                <span className="font-mono text-[#FF6B00]">{team.teamNumber}</span>
                {' – '}
                {team.teamName}
              </span>
              <span className="text-xs text-[#9CA3AF] ml-2">
                {[team.city, team.state].filter(Boolean).join(', ')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
