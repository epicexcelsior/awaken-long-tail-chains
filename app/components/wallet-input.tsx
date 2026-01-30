import { useState } from 'react';
import { Search, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WalletInputProps {
  onSubmit: (address: string) => void;
  isLoading: boolean;
}

export function WalletInput({ onSubmit, isLoading }: WalletInputProps) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!address.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    // Validate Osmosis address format
    if (!isValidOsmosisAddress(address.trim())) {
      setError('Invalid Osmosis address. Address should start with "osmo" followed by 39 characters');
      return;
    }

    onSubmit(address.trim());
  };

  const isValidOsmosisAddress = (addr: string): boolean => {
    return /^osmo[a-z0-9]{39}$/i.test(addr);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Osmosis Transaction Viewer
        </CardTitle>
        <CardDescription className="text-center">
          Enter your Osmosis wallet address to view transactions and export to Awaken Tax CSV format
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              placeholder="osmo1..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="pr-12 h-14 text-lg"
              disabled={isLoading}
            />
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-lg font-semibold"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                Fetching Transactions...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                View Transactions
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-sm text-muted-foreground text-center">
          <p>Example: osmo1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3aq6l09</p>
          <p className="mt-2">
            Data source: Osmosis LCD API (free) or Mintscan API (optional API key)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
