import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { User, Phone, Hash } from 'lucide-react';
import { dbOperations } from '@/lib/database';

interface MemberBalance {
  id?: number;
  member_id: string;
  name: string;
  phone: string;
  group_name: string;
  meeting_date: string;
  balances: {
    savings_balance: number;
    loan_balance: number;
    advance_loan_balance: number;
    unallocated_funds: number;
    total_outstanding: number;
  };
  last_updated: string;
}

interface MemberSearchProps {
  onMemberSelect: (member: MemberBalance) => void;
  selectedMember?: MemberBalance | null;
  placeholder?: string;
}

export function MemberSearch({ onMemberSelect, selectedMember, placeholder = "Search by Member ID, Name, or Phone" }: MemberSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MemberBalance[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const searchMembers = async () => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await dbOperations.searchMembers(query);
        setSuggestions(results);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Error searching members:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchMembers, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleMemberSelect = (member: MemberBalance) => {
    onMemberSelect(member);
    setQuery(`${member.name} (${member.member_id})`);
    setShowSuggestions(false);
  };

  const clearSelection = () => {
    setQuery('');
    onMemberSelect(null as any);
    setShowSuggestions(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="relative w-full">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            className="w-full"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>
        
        {selectedMember && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={clearSelection}
            className="shrink-0"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-96 overflow-y-auto bg-background border shadow-lg">
          {suggestions.map((member) => (
            <div
              key={member.id}
              className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
              onClick={() => handleMemberSelect(member)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{member.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      <span>{member.member_id}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <span>{member.phone}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {member.group_name}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-green-600">
                    Savings: {formatCurrency(member.balances.savings_balance)}
                  </div>
                  <div className="text-orange-600">
                    Loan: {formatCurrency(member.balances.loan_balance)}
                  </div>
                  <div className="text-blue-600">
                    Advance: {formatCurrency(member.balances.advance_loan_balance)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* No results message */}
      {showSuggestions && suggestions.length === 0 && query.length >= 2 && !isLoading && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 p-3 bg-background border shadow-lg">
          <p className="text-sm text-muted-foreground text-center">
            No members found matching "{query}"
          </p>
        </Card>
      )}
    </div>
  );
}