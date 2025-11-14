import { ethers } from "ethers";
import {
  AUCTION_ABI,
  AUCTION_TYPE_LABELS,
  callOptionalStringGetter,
  formatAddress,
  normalizeAddress,
  safeContractCall
} from "../shared";

type MessageType = "success" | "error" | "info";

let readProvider: ethers.BrowserProvider | null = null;
let signer: ethers.Signer | null = null;
let readContract: ethers.Contract | null = null;
let writeContract: ethers.Contract | null = null;
let countdownInterval: number | null = null;
let activeAuctionAddress: string | null = null;
let activeAuctionName = "Leilão selecionado";

const elements = {
  connectButton: document.getElementById("connect") as HTMLButtonElement | null,
  connectionStatus: document.getElementById("connectionStatus"),
  selectedAuctionInfo: document.getElementById("selectedAuctionInfo"),
  detailTitle: document.getElementById("detailTitle"),
  selectedAuctionAddress: document.getElementById("selectedAuctionAddress"),
  auctionType: document.getElementById("auctionType"),
  beneficiary: document.getElementById("beneficiary"),
  endTime: document.getElementById("endTime"),
  countdown: document.getElementById("countdown"),
  auctionStatus: document.getElementById("auctionStatus"),
  itemDescription: document.getElementById("itemDescription"),
  highestBid: document.getElementById("highestBid"),
  highestBidder: document.getElementById("highestBidder"),
  bidForm: document.getElementById("bidForm") as HTMLFormElement | null,
  bidInput: document.getElementById("bidValue") as HTMLInputElement | null,
  bidButton: document.getElementById("bidButton") as HTMLButtonElement | null,
  withdrawButton: document.getElementById("withdrawButton") as HTMLButtonElement | null,
  endButton: document.getElementById("endAuction") as HTMLButtonElement | null,
  refreshButton: document.getElementById("refreshButton") as HTMLButtonElement | null,
  message: document.getElementById("message") as HTMLParagraphElement | null,
  backToExplorer: document.getElementById("backToExplorer") as HTMLButtonElement | null
};

const ensureReadableContract = (): ethers.Contract => {
  if (!readContract) {
    throw new Error("Não foi possível preparar o contrato para leitura.");
  }
  return readContract;
};

const ensureWritableContract = (): ethers.Contract => {
  if (!writeContract) {
    throw new Error("Conecte a carteira para interagir com o leilão.");
  }
  return writeContract;
};

const showMessage = (text: string, type: MessageType = "info") => {
  if (!elements.message) {
    return;
  }

  elements.message.textContent = text;
  elements.message.dataset.type = type;
};

const clearMessage = () => {
  if (!elements.message) {
    return;
  }

  delete elements.message.dataset.type;
  elements.message.textContent = "";
};

const setInfoMessage = (text?: string) => {
  if (!elements.message) {
    return;
  }

  if (text) {
    showMessage(text, "info");
    return;
  }

  if (elements.message.dataset.type === "info") {
    clearMessage();
  }
};

const handleError = (error: unknown, fallback: string) => {
  console.error(error);
  const message = error instanceof Error ? error.message : fallback;
  showMessage(message || fallback, "error");
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

const clearCountdown = () => {
  if (countdownInterval) {
    window.clearInterval(countdownInterval);
    countdownInterval = null;
  }
};

const startCountdown = (endTimestamp: number, ended: boolean) => {
  clearCountdown();

  if (!elements.countdown) {
    return;
  }

  const updateCountdown = () => {
    if (ended) {
      elements.countdown!.textContent = "Encerrado";
      return;
    }

    const diff = endTimestamp - Math.floor(Date.now() / 1000);
    if (diff <= 0) {
      elements.countdown!.textContent = "Encerrando…";
      return;
    }

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    elements.countdown!.textContent = `${hours}h ${minutes}m ${seconds}s`;
  };

  updateCountdown();
  if (!ended) {
    countdownInterval = window.setInterval(updateCountdown, 1000);
  }
};

const updateSelectedAuctionInfo = () => {
  const label = activeAuctionName || "Leilão selecionado";
  if (elements.detailTitle) {
    elements.detailTitle.textContent = label;
  }
};

const setInitialViewState = () => {
  updateSelectedAuctionInfo();
  if (elements.selectedAuctionAddress) {
    elements.selectedAuctionAddress.textContent = activeAuctionAddress ?? "Nenhum endereço selecionado.";
  }

  elements.auctionType && (elements.auctionType.textContent = "-");
  elements.beneficiary && (elements.beneficiary.textContent = "-");
  elements.endTime && (elements.endTime.textContent = "-");
  elements.countdown && (elements.countdown.textContent = "-");
  elements.auctionStatus && (elements.auctionStatus.textContent = "-");
  elements.itemDescription &&
    (elements.itemDescription.textContent = "Conecte a carteira ou utilize um provedor compatível para carregar os dados do leilão.");
  elements.highestBid && (elements.highestBid.textContent = "-");
  elements.highestBidder && (elements.highestBidder.textContent = "-");
  elements.bidInput && (elements.bidInput.value = "");

  elements.bidInput && (elements.bidInput.disabled = true);
  elements.bidButton && (elements.bidButton.disabled = true);
  elements.withdrawButton && (elements.withdrawButton.disabled = true);
  elements.endButton && (elements.endButton.disabled = true);
  elements.refreshButton && (elements.refreshButton.disabled = true);
};

const ensureReadProvider = (): ethers.BrowserProvider | null => {
  if (readProvider) {
    return readProvider;
  }

  if (!window.ethereum) {
    return null;
  }

  readProvider = new ethers.BrowserProvider(window.ethereum);
  return readProvider;
};

const prepareReadContract = () => {
  if (!activeAuctionAddress) {
    return;
  }

  const provider = ensureReadProvider();
  if (!provider) {
    showMessage("Instale o MetaMask ou configure um provedor de leitura compatível.", "error");
    return;
  }

  readContract = new ethers.Contract(activeAuctionAddress, AUCTION_ABI, provider);
};

const loadData = async () => {
  try {
    const currentContract = ensureReadableContract();

    const [
      highestBidRaw,
      highestBidderRaw,
      auctionEndTimeRaw,
      beneficiaryRaw,
      endedRaw,
      auctionTypeRaw
    ] = await Promise.all([
      safeContractCall("highestBid()", () => currentContract.highestBid()),
      safeContractCall("highestBidder()", () => currentContract.highestBidder()),
      safeContractCall("auctionEndTime()", () => currentContract.auctionEndTime()),
      safeContractCall("beneficiary()", () => currentContract.beneficiary()),
      safeContractCall("ended()", () => currentContract.ended()),
      safeContractCall("auctionType()", () => currentContract.auctionType())
    ]);

    const [descriptionRaw, itemNameRaw] = await Promise.all([
      callOptionalStringGetter(currentContract, "itemDescription"),
      callOptionalStringGetter(currentContract, "itemName")
    ]);

    const normalizedName = (itemNameRaw ?? descriptionRaw ?? activeAuctionName ?? "").trim() ||
      "Leilão selecionado";
    activeAuctionName = normalizedName;
    updateSelectedAuctionInfo();

    if (elements.itemDescription) {
      elements.itemDescription.textContent = "Carregando dados do leilão…";
    }

    const highestBidValue = highestBidRaw !== undefined ? ethers.formatEther(highestBidRaw) : "-";
    elements.highestBid && (elements.highestBid.textContent = highestBidValue);

    const highestBidderValue = typeof highestBidderRaw === "string" ? highestBidderRaw : "";
    elements.highestBidder && (elements.highestBidder.textContent = formatAddress(highestBidderValue));

    const beneficiaryValue = typeof beneficiaryRaw === "string" ? beneficiaryRaw : "";
    elements.beneficiary && (elements.beneficiary.textContent = formatAddress(beneficiaryValue));

    const typeIndex = auctionTypeRaw !== undefined ? Number(auctionTypeRaw) : Number.NaN;
    const typeLabel = Number.isNaN(typeIndex)
      ? "Tipo desconhecido"
      : AUCTION_TYPE_LABELS[typeIndex] ?? `Tipo ${typeIndex}`;
    elements.auctionType && (elements.auctionType.textContent = typeLabel);

    const endTimestamp = auctionEndTimeRaw !== undefined ? Number(auctionEndTimeRaw) : 0;
    elements.endTime &&
      (elements.endTime.textContent = endTimestamp
        ? new Date(endTimestamp * 1000).toLocaleString()
        : "-");

    const hasEnded = endedRaw !== undefined ? Boolean(endedRaw) : false;
    const hasWallet = Boolean(writeContract);
    elements.auctionStatus && (elements.auctionStatus.textContent = hasEnded ? "Encerrado" : "Aberto");
    elements.bidInput && (elements.bidInput.disabled = !hasWallet || hasEnded);
    elements.bidButton && (elements.bidButton.disabled = !hasWallet || hasEnded);
    elements.withdrawButton && (elements.withdrawButton.disabled = !hasWallet);
    elements.endButton && (elements.endButton.disabled = !hasWallet || hasEnded);
    elements.refreshButton && (elements.refreshButton.disabled = false);

    const descriptionText = descriptionRaw?.trim() ?? "";
    const isOffChainAuction = typeIndex === 0;
    if (elements.itemDescription) {
      if (isOffChainAuction) {
        elements.itemDescription.textContent =
          descriptionText || "Nenhuma descrição cadastrada para este leilão.";
      } else {
        elements.itemDescription.textContent = "Este leilão referencia um NFT (ERC721).";
      }
    }

    if (!descriptionText && isOffChainAuction) {
      setInfoMessage("Nenhuma descrição cadastrada para este leilão.");
    } else {
      setInfoMessage();
    }

    startCountdown(endTimestamp, hasEnded);
  } catch (error) {
    handleError(error, "Erro ao carregar os dados do leilão.");
  }
};

const subscribeToEvents = () => {
  if (!readContract) {
    return;
  }

  readContract.removeAllListeners();

  readContract.on("BidPlaced", (bidder: string, amount: bigint) => {
    showMessage(
      `Novo lance de ${formatAddress(bidder)} (${ethers.formatEther(amount)} ETH).`,
      "info"
    );
    loadData();
  });

  readContract.on("Withdrawn", (bidder: string, amount: bigint) => {
    showMessage(
      `${formatAddress(bidder)} retirou ${ethers.formatEther(amount)} ETH de saldo pendente.`,
      "info"
    );
  });

  readContract.on("AuctionEnded", (winner: string, amount: bigint) => {
    showMessage(
      `Leilão encerrado. Vencedor: ${formatAddress(winner)} (${ethers.formatEther(amount)} ETH).`,
      "info"
    );
    loadData();
  });
};

const connectWallet = async () => {
  if (!elements.connectButton) {
    return;
  }

  if (!activeAuctionAddress) {
    showMessage("Endereço do leilão inválido.", "error");
    return;
  }

  const provider = ensureReadProvider();
  if (!provider) {
    showMessage("Instale o MetaMask para continuar.", "error");
    return;
  }

  try {
    elements.connectButton.disabled = true;
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();

    if (!readContract) {
      readContract = new ethers.Contract(activeAuctionAddress, AUCTION_ABI, provider);
    }
    writeContract = readContract.connect(signer) as ethers.Contract;

    const address = await signer.getAddress();
    updateConnectionState(address);
    showMessage("Carteira conectada com sucesso.", "success");

    await loadData();
  } catch (error) {
    handleError(error, "Não foi possível conectar a carteira.");
    signer = null;
    writeContract = null;
    updateConnectionState();
    setInitialViewState();
    prepareReadContract();
    subscribeToEvents();
    loadData();
  } finally {
    elements.connectButton.disabled = false;
  }
};

const restoreConnection = async () => {
  const provider = ensureReadProvider();
  if (!provider || !activeAuctionAddress) {
    updateConnectionState();
    return;
  }

  try {
    const accounts: string[] = await provider.send("eth_accounts", []);
    if (accounts?.length) {
      signer = await provider.getSigner(accounts[0]);
      if (!readContract) {
        readContract = new ethers.Contract(activeAuctionAddress, AUCTION_ABI, provider);
      }
      writeContract = readContract.connect(signer) as ethers.Contract;
      updateConnectionState(accounts[0]);
      await loadData();
    } else {
      signer = null;
      writeContract = null;
      updateConnectionState();
      await loadData();
    }
  } catch (error) {
    console.warn("Falha ao restaurar conexão com a carteira", error);
    signer = null;
    writeContract = null;
    updateConnectionState();
    await loadData();
  }
};

const handleBidSubmit = async (event: SubmitEvent) => {
  event.preventDefault();

  if (!elements.bidInput || !elements.bidButton) {
    return;
  }

  try {
    const contract = ensureWritableContract();
    const valueEth = elements.bidInput.value.trim();
    if (!valueEth) {
      showMessage("Digite um valor em ETH.", "error");
      return;
    }

    elements.bidButton.disabled = true;
    const tx = await contract.bid({ value: ethers.parseEther(valueEth) });
    showMessage("Lance enviado. Aguardando confirmação…", "info");
    await tx.wait();
    elements.bidInput.value = "";
    showMessage("Lance confirmado!", "success");
    await loadData();
  } catch (error) {
    handleError(error, "Erro ao enviar o lance.");
  } finally {
    elements.bidButton && (elements.bidButton.disabled = false);
  }
};

const handleWithdraw = async () => {
  if (!elements.withdrawButton) {
    return;
  }

  try {
    const contract = ensureWritableContract();
    elements.withdrawButton.disabled = true;
    const tx = await contract.withdraw();
    showMessage("Solicitando retirada…", "info");
    await tx.wait();
    showMessage("Valor retirado com sucesso!", "success");
  } catch (error) {
    handleError(error, "Erro ao retirar valores.");
  } finally {
    elements.withdrawButton.disabled = false;
  }
};

const handleEndAuction = async () => {
  if (!elements.endButton) {
    return;
  }

  try {
    const contract = ensureWritableContract();
    elements.endButton.disabled = true;
    const tx = await contract.endAuction();
    showMessage("Encerrando leilão…", "info");
    await tx.wait();
    showMessage("Leilão encerrado!", "success");
    await loadData();
  } catch (error) {
    handleError(error, "Erro ao encerrar o leilão.");
    elements.endButton.disabled = false;
  }
};

const initDetailContract = () => {
  if (!activeAuctionAddress) {
    return;
  }

  prepareReadContract();
  if (!readContract) {
    return;
  }

  setInitialViewState();
  loadData();
  subscribeToEvents();
};

export const initDetailPage = () => {
  if (!document.body || document.body.dataset.page !== "detail") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const addressFromQuery = params.get("address") ?? "";
  const providedName = params.get("name") ?? "";

  activeAuctionAddress = normalizeAddress(addressFromQuery);
  if (providedName.trim()) {
    activeAuctionName = providedName.trim();
  }

  if (elements.selectedAuctionAddress) {
    elements.selectedAuctionAddress.textContent = activeAuctionAddress ?? "Nenhum endereço selecionado.";
  }
  updateSelectedAuctionInfo();

  if (!activeAuctionAddress) {
    showMessage("Informe o endereço do leilão pela URL (parâmetro address).", "error");
    elements.connectButton && (elements.connectButton.disabled = true);
    return;
  }

  setInitialViewState();
  initDetailContract();

  if (!readContract) {
    showMessage("Instale o MetaMask para visualizar os dados do leilão.", "error");
  } else {
    restoreConnection();
  }

  elements.connectButton?.addEventListener("click", connectWallet);
  elements.backToExplorer?.addEventListener("click", () => {
    window.location.href = "./index.html";
  });

  elements.bidForm?.addEventListener("submit", handleBidSubmit);
  elements.withdrawButton?.addEventListener("click", handleWithdraw);
  elements.endButton?.addEventListener("click", handleEndAuction);
  elements.refreshButton?.addEventListener("click", async () => {
    if (!readContract) {
      showMessage("Não foi possível atualizar o leilão selecionado.", "error");
      return;
    }
    showMessage("Atualizando dados…", "info");
    await loadData();
  });
};
