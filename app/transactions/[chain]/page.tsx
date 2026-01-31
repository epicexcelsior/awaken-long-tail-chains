import { Metadata } from 'next';
import TransactionsClient from './TransactionsClient';

// Chain configurations - must match CHAIN_CONFIGS
const chains = [
  { id: 'osmosis', name: 'Osmosis', description: 'Cosmos DEX and DeFi hub', color: '#9D4EDD' },
  { id: 'babylon', name: 'Babylon', description: 'Bitcoin staking protocol on Cosmos', color: '#CE6533' },
  { id: 'near', name: 'NEAR Protocol', description: 'Scalable L1 blockchain', color: '#00C08B' },
  { id: 'celo', name: 'Celo', description: 'Mobile-first blockchain for DeFi', color: '#FCFF52' },
  { id: 'fantom', name: 'Fantom', description: 'High-performance EVM chain', color: '#1969FF' },
  { id: 'ronin', name: 'Ronin', description: 'Gaming-focused EVM chain', color: '#1273EA' },
  { id: 'celestia', name: 'Celestia', description: 'Data availability layer', color: '#0074E4' },
];

export function generateStaticParams() {
  return chains.map((chain) => ({
    chain: chain.id,
  }));
}

export function generateMetadata({ params }: { params: { chain: string } }): Metadata {
  const chain = chains.find(c => c.id === params.chain);
  return {
    title: chain ? `${chain.name} Transactions | Multi-Chain Dashboard` : 'Chain Not Found',
    description: chain ? `View ${chain.name} blockchain transactions and export to CSV` : 'Chain not found',
  };
}

export default function TransactionsPage({ params }: { params: { chain: string } }) {
  return <TransactionsClient chainId={params.chain} />;
}
