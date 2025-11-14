import { ethers } from "ethers";
import auctionAbi from "./abi-auction.json";
import registryAbi from "./abi-registry.json";

declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider;
  }
}

export const REGISTRY_ADDRESS = "0x31D92593d3F7800fcdEf03E6D47902dE28236C53";

export const AUCTION_ABI = auctionAbi as ethers.InterfaceAbi;
export const REGISTRY_ABI = registryAbi as ethers.InterfaceAbi;
export const AUCTION_TYPE_LABELS = ["Item off-chain", "NFT (ERC721)"];

export const normalizeAddress = (value?: string | null): string | null => {
  if (!value?.trim()) {
    return null;
  }

  try {
    const normalized = ethers.getAddress(value.trim());
    return normalized === ethers.ZeroAddress ? null : normalized;
  } catch {
    return null;
  }
};

export const configuredRegistryAddress = normalizeAddress(REGISTRY_ADDRESS);

export const formatAddress = (value: string): string => {
  if (!value || value === ethers.ZeroAddress) {
    return "-";
  }
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
};

export const safeContractCall = async <T>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await fn();
  } catch (error) {
    console.warn(`Falha ao ler ${label}`, error);
    return undefined;
  }
};

export const callOptionalStringGetter = async (
  instance: ethers.Contract,
  methodName: string
): Promise<string | undefined> => {
  const candidate = instance[methodName as keyof typeof instance];
  if (typeof candidate !== "function") {
    return undefined;
  }

  const value = await safeContractCall(`${methodName}()`, () =>
    (candidate as () => Promise<unknown>).call(instance)
  );

  return typeof value === "string" ? value : undefined;
};
