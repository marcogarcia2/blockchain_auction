import { ethers } from "ethers";
import {
  AUCTION_ABI,
  AUCTION_TYPE_LABELS,
  REGISTRY_ABI,
  callOptionalStringGetter,
  configuredRegistryAddress,
  formatAddress,
  normalizeAddress,
  safeContractCall
} from "../shared";

type MessageType = "info" | "success" | "error";

type AuctionSummary = {
  address: string;
  name: string;
  typeLabel: string;
  ended: boolean;
};

let provider: ethers.BrowserProvider | null = null;
let signer: ethers.Signer | null = null;
let registryContract: ethers.Contract | null = null;
let auctionSummaries: AuctionSummary[] = [];
let searchQuery = "";

const elements = {
  connectButton: document.getElementById("connect") as HTMLButtonElement | null,
  connectionStatus: document.getElementById("connectionStatus"),
  registryAddressLabel: document.getElementById("registryAddressLabel"),
  refreshRegistryButton: document.getElementById("refreshRegistry") as HTMLButtonElement | null,
  auctionSearch: document.getElementById("auctionSearch") as HTMLInputElement | null,
  auctionList: document.getElementById("auctionList"),
  explorerMessage: document.getElementById("explorerMessage") as HTMLParagraphElement | null
};

const ensureProvider = (): ethers.BrowserProvider | null => {
  if (provider) {
    return provider;
  }

  if (!window.ethereum) {
    return null;
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  if (configuredRegistryAddress) {
    registryContract = new ethers.Contract(configuredRegistryAddress, REGISTRY_ABI, provider);
  }

  return provider;
};

const ensureRegistry = (): ethers.Contract | null => {
  if (registryContract) {
    return registryContract;
  }

  if (!configuredRegistryAddress) {
    return null;
  }

  const currentProvider = ensureProvider();
  if (!currentProvider) {
    return null;
  }

  registryContract = new ethers.Contract(configuredRegistryAddress, REGISTRY_ABI, currentProvider);
  return registryContract;
};

const setExplorerMessage = (text?: string, type: MessageType = "info") => {
  if (!elements.explorerMessage) {
    return;
  }

  if (!text) {
    delete elements.explorerMessage.dataset.type;
    elements.explorerMessage.textContent = "";
    return;
  }

  elements.explorerMessage.dataset.type = type;
  elements.explorerMessage.textContent = text;
};

const updateConnectionState = (address?: string) => {
  if (!elements.connectionStatus) {
    return;
  }

  if (address) {
    elements.connectionStatus.textContent = `Conectado: ${formatAddress(address)}`;
    elements.connectionStatus.setAttribute("data-state", "connected");
  } else {
    elements.connectionStatus.textContent = "Desconectado";
    elements.connectionStatus.setAttribute("data-state", "disconnected");
  }
};

const renderAuctionList = (list: AuctionSummary[]) => {
  if (!elements.auctionList) {
    return;
  }

  elements.auctionList.innerHTML = "";

  if (!list.length) {
    if (!auctionSummaries.length) {
      setExplorerMessage("Nenhum leilão registrado no momento.", "info");
    } else if (searchQuery.trim()) {
      setExplorerMessage("Nenhum leilão corresponde ao filtro informado.", "info");
    } else {
      setExplorerMessage("Nenhum leilão encontrado.", "info");
    }
    return;
  }

  setExplorerMessage();

  const fragment = document.createDocumentFragment();
  list.forEach((auction) => {
    const card = document.createElement("article");
    card.className = "auction-card";

    const title = document.createElement("h3");
    title.textContent = auction.name;

    const meta = document.createElement("div");
    meta.className = "auction-meta";

    const typePill = document.createElement("span");
    typePill.className = "pill";
    typePill.textContent = auction.typeLabel;

    const statusPill = document.createElement("span");
    statusPill.className = "pill";
    statusPill.dataset.variant = auction.ended ? "warning" : "success";
    statusPill.textContent = auction.ended ? "Encerrado" : "Aberto";

    meta.append(typePill, statusPill);

    const addressLabel = document.createElement("p");
    addressLabel.className = "selected-auction";
    addressLabel.textContent = `Endereço: ${auction.address}`;

    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.className = "btn-primary";
    actionButton.textContent = "Ver detalhes";
    actionButton.addEventListener("click", () => {
      const params = new URLSearchParams({ address: auction.address, name: auction.name });
      window.location.href = `./detail.html?${params.toString()}`;
    });

    card.append(title, meta, addressLabel, actionButton);
    fragment.append(card);
  });

  elements.auctionList.append(fragment);
};

const applyAuctionFilter = () => {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    renderAuctionList(auctionSummaries);
    return;
  }

  const filtered = auctionSummaries.filter((auction) =>
    auction.name.toLowerCase().includes(normalizedQuery)
  );
  renderAuctionList(filtered);
};

const readAuctionSummary = async (address: string): Promise<AuctionSummary | null> => {
  const currentProvider = ensureProvider();
  if (!currentProvider) {
    return null;
  }

  try {
    const reader = new ethers.Contract(address, AUCTION_ABI, currentProvider);
    const [typeRaw, endedRaw, nameRaw, descriptionRaw] = await Promise.all([
      safeContractCall("auctionType()", () => reader.auctionType()),
      safeContractCall("ended()", () => reader.ended()),
      callOptionalStringGetter(reader, "itemName"),
      callOptionalStringGetter(reader, "itemDescription")
    ]);

    const displayName = (nameRaw ?? descriptionRaw ?? "").trim() || `Leilão ${formatAddress(address)}`;
    const typeIndex = typeRaw !== undefined ? Number(typeRaw) : Number.NaN;
    const typeLabel = Number.isNaN(typeIndex)
      ? "Tipo desconhecido"
      : AUCTION_TYPE_LABELS[typeIndex] ?? `Tipo ${typeIndex}`;
    const ended = endedRaw !== undefined ? Boolean(endedRaw) : false;

    return {
      address,
      name: displayName,
      typeLabel,
      ended
    };
  } catch (error) {
    console.warn(`Falha ao carregar leilão ${address}`, error);
    return null;
  }
};

const loadAuctions = async () => {
  const registry = ensureRegistry();
  if (!registry) {
    if (!configuredRegistryAddress) {
      setExplorerMessage("Configure o endereço do registro em src/shared.ts.", "error");
    } else if (!window.ethereum) {
      setExplorerMessage("Instale o MetaMask para carregar os leilões.", "error");
    } else {
      setExplorerMessage("Não foi possível preparar o provedor de leitura.", "error");
    }
    return;
  }

  try {
    elements.refreshRegistryButton?.setAttribute("disabled", "true");
    setExplorerMessage("Carregando lista de leilões…", "info");

    const totalRaw = await registry.getAuctionCount();
    const total = typeof totalRaw === "bigint" ? Number(totalRaw) : Number(totalRaw ?? 0);

    const items: AuctionSummary[] = [];
    for (let index = 0; index < total; index += 1) {
      const addressRaw = await registry.getAuction(index);
      const normalized = normalizeAddress(addressRaw);
      if (!normalized) {
        continue;
      }
      const summary = await readAuctionSummary(normalized);
      if (summary) {
        items.push(summary);
      }
    }

    auctionSummaries = items;
    applyAuctionFilter();
  } catch (error) {
    console.error(error);
    setExplorerMessage("Não foi possível carregar os leilões do registro.", "error");
  } finally {
    elements.refreshRegistryButton?.removeAttribute("disabled");
  }
};

const restoreConnection = async () => {
  const currentProvider = ensureProvider();
  if (!currentProvider) {
    updateConnectionState();
    return;
  }

  try {
    const accounts: string[] = await currentProvider.send("eth_accounts", []);
    if (accounts?.length) {
      signer = await currentProvider.getSigner(accounts[0]);
      updateConnectionState(accounts[0]);
    } else {
      signer = null;
      updateConnectionState();
    }
  } catch (error) {
    console.warn("Falha ao restaurar conexão com a carteira", error);
    signer = null;
    updateConnectionState();
  }
};

const connectWallet = async () => {
  const currentProvider = ensureProvider();
  if (!currentProvider || !elements.connectButton) {
    setExplorerMessage("Instale o MetaMask para continuar.", "error");
    return;
  }

  try {
    elements.connectButton.disabled = true;
    await currentProvider.send("eth_requestAccounts", []);
    signer = await currentProvider.getSigner();

    const address = await signer.getAddress();
    updateConnectionState(address);
    setExplorerMessage("Carteira conectada. Clique em 'Ver detalhes' para abrir o leilão.", "success");
  } catch (error) {
    console.error(error);
    setExplorerMessage("Não foi possível conectar a carteira.", "error");
    signer = null;
    updateConnectionState();
  } finally {
    elements.connectButton.disabled = false;
  }
};

export const initExplorerPage = () => {
  if (!document.body || document.body.dataset.page !== "explorer") {
    return;
  }

  if (elements.registryAddressLabel) {
    elements.registryAddressLabel.textContent = configuredRegistryAddress
      ? configuredRegistryAddress
      : "Atualize src/shared.ts com o endereço do registro.";
  }

  elements.connectButton?.addEventListener("click", connectWallet);
  elements.refreshRegistryButton?.addEventListener("click", () => {
    loadAuctions();
  });
  elements.auctionSearch?.addEventListener("input", (event) => {
    searchQuery = (event.target as HTMLInputElement).value;
    applyAuctionFilter();
  });

  if (!ensureProvider()) {
    setExplorerMessage("Instale o MetaMask para carregar os leilões.", "error");
    updateConnectionState();
    return;
  }

  restoreConnection();
  loadAuctions();
};
