// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────
// Interfaces ERC721 e Registry
// ─────────────────────────────────────────────────────────────

interface IERC721 {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

interface IRegistry {
    function registerAuction(address auctionAddress) external;
}

// ─────────────────────────────────────────────────────────────
// Contrato de Leilão (Off-chain item ou NFT)
// ─────────────────────────────────────────────────────────────

/// @title Auction - Contrato de leilão de itens off-chain ou de NFTs
contract Auction {

    // Tipo de leilão - 0: item off chain, 1: NFT
    enum AuctionType { OffChainItem, ERC721Item }
    AuctionType public auctionType;         

    // Endereço do Leiloeiro
    address payable public beneficiary;     

    // Tempo do término do leilão
    uint public auctionEndTime;             

    // Endereço do maior licitante
    address public highestBidder; 

    // Valor do maior lance
    uint public highestBid;
    
    // Valores a serem sacados (superados pelo maior lance)
    mapping(address => uint) public pendingReturns; 

    // Booleano: leilão terminou ou não
    bool public ended;                              

    // Nome do item a ser leiloado
    string public itemName;                 

    // Item NFT on-chain
    IERC721 public nft;
    uint public nftTokenId;

    // Registry (Hardcoded, centralizado), para encontrar os leilões disponíveis
    address constant REGISTRY_ADDRESS = 0x31D92593d3F7800fcdEf03E6D47902dE28236C53;
    IRegistry public registry = IRegistry(REGISTRY_ADDRESS);

    event BidPlaced(address indexed bidder, uint amount);
    event Withdrawn(address indexed bidder, uint amount);
    event AuctionEnded(address indexed winner, uint amount);

    // Construtor do contrato
    constructor(
        uint _biddingTime,              // duração do leilão
        address payable _beneficiary,
        AuctionType _type,
        string memory _itemName,
        address _nftAddress,            // address(0) se for OffChainItem
        uint _tokenId                   // 0 se for OffChainItem
    ) {
        beneficiary = _beneficiary;
        auctionEndTime = block.timestamp + _biddingTime;    // calculo do tempo
        auctionType = _type;
        itemName = _itemName;

        if (_type == AuctionType.ERC721Item) {
            require(_nftAddress != address(0), "NFT address required");
            nft = IERC721(_nftAddress);
            nftTokenId = _tokenId;
        }

        // Adicionando o leilão ao Registry
        registry.registerAuction(address(this));
    }

    // Lances
    function bid() public payable {
        require(block.timestamp < auctionEndTime, "Auction already ended.");
        require(msg.value > highestBid, "Bid not high enough.");

        if (highestBid != 0) {
            pendingReturns[highestBidder] += highestBid;
        }

        highestBidder = msg.sender;
        highestBid = msg.value;

        emit BidPlaced(msg.sender, msg.value);
    }

    // Retirada de lances superados
    function withdraw() public returns (bool) {
        uint amount = pendingReturns[msg.sender];

        if (amount > 0) {
            pendingReturns[msg.sender] = 0;

            if (!payable(msg.sender).send(amount)) {
                pendingReturns[msg.sender] = amount;
                return false;
            }

            emit Withdrawn(msg.sender, amount);
        }

        return true;
    }

    // Finalizar o leilão
    function endAuction() public {
        require(block.timestamp >= auctionEndTime, "Auction not yet ended.");
        require(!ended, "Auction already ended.");

        ended = true;
        emit AuctionEnded(highestBidder, highestBid);

        // Pagamento ao beneficiário
        if (highestBid > 0) {
            beneficiary.transfer(highestBid);
        }

        // Se ninguém deu lance, nada a transferir
        if (highestBidder == address(0)) {
            return;
        }

        // Transferir NFT para o vencedor
        if (auctionType == AuctionType.ERC721Item) {
            nft.safeTransferFrom(beneficiary, highestBidder, nftTokenId);
        }
    }
}
