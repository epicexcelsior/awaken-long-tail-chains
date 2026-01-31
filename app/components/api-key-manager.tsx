"use client";

import React, { useState } from "react";
import { Key, ChevronDown, Trash2, Check } from "lucide-react";
import { ApiKeyService, getAllCustomKeys, setApiKey, removeApiKey } from "../utils/apiKeys";

const API_KEY_SERVICES: Array<{
  key: ApiKeyService;
  label: string;
  provider: string;
}> = [
  { key: "celo", label: "Celo", provider: "Etherscan" },
  { key: "ronin", label: "Ronin", provider: "Covalent (GoldRush)" },
  { key: "babylon", label: "Babylon", provider: "AllThatNode" },
  { key: "near", label: "NEAR", provider: "Pikespeak" },
  { key: "fantom", label: "Fantom", provider: "Tatum" },
  { key: "flow", label: "Flow", provider: "AllThatNode" },
  { key: "polkadot", label: "Polkadot", provider: "AllThatNode" },
  { key: "mintscan", label: "Osmosis/Mintscan", provider: "Mintscan" },
];

export function ApiKeyManager() {
  const [apiKeys, setApiKeysState] = useState<Partial<Record<ApiKeyService, string>>>(() => getAllCustomKeys());
  const [isOpen, setIsOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ApiKeyService | "">("");
  const [inputKey, setInputKey] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    if (selectedService && inputKey.trim()) {
      setApiKey(selectedService, inputKey.trim());
      setApiKeysState(getAllCustomKeys());
      setInputKey("");
      setSelectedService("");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    }
  };

  const handleRemove = (service: ApiKeyService) => {
    removeApiKey(service);
    setApiKeysState(getAllCustomKeys());
  };

  const configuredCount = Object.keys(apiKeys).length;

  return (
    <div className="bg-[#2a2a2a] rounded-lg p-4 border border-gray-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-orange-500" />
          <span className="font-medium text-gray-300">Custom API Keys</span>
          {configuredCount > 0 && (
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
              {configuredCount} configured
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-400">
            Add your own API keys for higher rate limits. Leave empty to use default keys.
          </p>

          {/* Add New Key */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300">Select Service</label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value as ApiKeyService)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Choose a service...</option>
              {API_KEY_SERVICES.map((service) => (
                <option key={service.key} value={service.key}>
                  {service.label} ({service.provider})
                </option>
              ))}
            </select>

            {selectedService && (
              <div className="flex gap-2">
                <input
                  type="password"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder={`Enter your ${API_KEY_SERVICES.find((s) => s.key === selectedService)?.provider} API key`}
                  className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  onClick={handleSave}
                  disabled={!inputKey.trim()}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  Save
                </button>
              </div>
            )}

            {showSuccess && (
              <div className="flex items-center gap-1 text-sm text-green-400">
                <Check className="w-4 h-4" />
                API key saved successfully
              </div>
            )}
          </div>

          {/* Configured Keys List */}
          {configuredCount > 0 && (
            <div className="space-y-2">
              <label className="text-sm text-gray-300">Configured Keys</label>
              <div className="space-y-1">
                {Object.entries(apiKeys).map(([service, key]) => {
                  const serviceConfig = API_KEY_SERVICES.find((s) => s.key === service);
                  if (!serviceConfig) return null;

                  return (
                    <div
                      key={service}
                      className="flex items-center justify-between bg-[#1a1a1a] rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-300">
                          {serviceConfig.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {serviceConfig.provider}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono">
                          {key?.slice(0, 8)}...{key?.slice(-4)}
                        </span>
                        <button
                          onClick={() => handleRemove(service as ApiKeyService)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                          title="Remove API key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
