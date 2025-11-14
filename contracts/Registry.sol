// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Auction Registry - Mantém um registro de todos os leilões criados
contract Registry {
    
    // Lista de endereços de todos os leilões criados
    address[] public auctions;

    // Evento disparado quando um leilão é registrado
    event AuctionRegistered(address indexed auctionAddress, address indexed creator);

    /// @notice Registra um novo leilão
    /// @dev Pode ser chamado apenas pelo próprio leilão
    function registerAuction(address auctionAddress) external {
        require(auctionAddress != address(0), "Invalid address");
        
        auctions.push(auctionAddress);
        emit AuctionRegistered(auctionAddress, msg.sender);
    }

    /// @notice Retorna a quantidade total de leilões
    function getAuctionCount() external view returns (uint) {
        return auctions.length;
    }

    /// @notice Retorna o endereço do leilão no índice especificado
    function getAuction(uint index) external view returns (address) {
        require(index < auctions.length, "Index out of bounds");
        return auctions[index];
    }
}
