"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
  signTransaction,
  getNetwork,
} from "@stellar/freighter-api";

export function useFreighter() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [isFreighterInstalled, setIsFreighterInstalled] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const { isConnected: installed, error } = await isConnected();
      if (error || !installed) {
        setIsFreighterInstalled(false);
        return;
      }
      setIsFreighterInstalled(true);

      const { address: addr, error: addressError } = await getAddress();
      if (addressError || !addr) return;

      const { network: net, error: networkError } = await getNetwork();
      if (networkError) return;

      setConnected(true);
      setAddress(addr);
      setNetwork(net);
    } catch {
      setIsFreighterInstalled(false);
    }
  };

  const connect = useCallback(async () => {
    const { isConnected: installed, error } = await isConnected();
    if (error || !installed) {
      throw new Error("Freighter extension not installed");
    }

    const { address: addr, error: accessError } = await requestAccess();
    if (accessError) throw new Error(accessError.message);

    const { network: net, error: networkError } = await getNetwork();
    if (networkError) throw new Error(networkError.message);

    setConnected(true);
    setAddress(addr || null);
    setNetwork(net || null);

    return addr;
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setAddress(null);
    setNetwork(null);
  }, []);

  const sign = useCallback(
    async (xdr: string, networkPassphrase: string) => {
      if (!connected) throw new Error("Wallet not connected");
      const { signedTxXdr, error } = await signTransaction(xdr, {
        networkPassphrase,
      });
      if (error) throw new Error(error.message);
      return signedTxXdr;
    },
    [connected]
  );

  return {
    connected,
    address,
    network,
    isFreighterInstalled,
    connect,
    disconnect,
    sign,
  };
}
