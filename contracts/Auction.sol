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

contract Auction {

    enum AuctionType { OffChainItem, ERC721Item }

    AuctionType public auctionType;

    address payable public beneficiary;
    uint public auctionEndTime;

    address public highestBidder;
    uint public highestBid;

    mapping(address => uint) public pendingReturns;
    bool public ended;

    // Item off-chain
    string public itemDescription;

    // Item NFT
    IERC721 public nft;
    uint public nftTokenId;

    // Registry
    IRegistry public registry;

    event BidPlaced(address indexed bidder, uint amount);
    event Withdrawn(address indexed bidder, uint amount);
    event AuctionEnded(address indexed winner, uint amount);

    constructor(
        uint _biddingTime,
        address payable _beneficiary,
        AuctionType _type,
        string memory _itemDescription,
        address _nftAddress,      // poderá ser address(0) se for OffChainItem
        uint _tokenId,            // poderá ser 0 se for OffChainItem
        address registryAddress
    ) {
        require(registryAddress != address(0), "Registry required");

        registry = IRegistry(registryAddress);
        beneficiary = _beneficiary;
        auctionEndTime = block.timestamp + _biddingTime;
        auctionType = _type;

        if (_type == AuctionType.OffChainItem) {
            itemDescription = _itemDescription;
        }
        else if (_type == AuctionType.ERC721Item) {
            require(_nftAddress != address(0), "NFT address required");
            nft = IERC721(_nftAddress);
            nftTokenId = _tokenId;
        }

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
