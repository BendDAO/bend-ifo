// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ICryptoPunks} from "../interfaces/ICryptoPunks.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

contract BendCompetition is Ownable, ReentrancyGuard, Pausable {
    uint256 public START_BLOCK;
    uint256 public END_BLOCK;
    address public immutable BEND_TOKEN_ADDRESS;
    uint256 public immutable BEND_TOKEN_REWARD_PER_ETH;
    address public immutable CRYPTO_PUNKS_ADDRESS;
    uint256 public immutable CRYPTO_PUNKS_REWARD;
    address[] public ERC721_NFT_WHITELIST;
    uint256[] public ERC721_NFT_BEND_REWARD;

    // nft colelction address => token id => owner address
    mapping(address => mapping(uint256 => address)) public claimedRecord;
    mapping(address => uint256) public claimedCount;

    event Activate(
        address indexed operator,
        uint256 startBlock,
        uint256 endBlock
    );

    event Claimed(
        address indexed addr, // address(0) if eth
        uint256 indexed tokenId,
        address indexed owner,
        uint256 reward
    );

    event Burned(address indexed operator);

    constructor(
        uint256 startBlock,
        uint256 endBlock,
        address bendTokenAddress,
        uint256 bendTokenRewardPerETH,
        address cryptoPunksAddress,
        uint256 cryptoPunksReward,
        address[] memory erc721NFTCollections,
        uint256[] memory erc721NFTBendRewards
    ) {
        activate(startBlock, endBlock);

        BEND_TOKEN_ADDRESS = bendTokenAddress;
        BEND_TOKEN_REWARD_PER_ETH = bendTokenRewardPerETH;
        CRYPTO_PUNKS_ADDRESS = cryptoPunksAddress;
        CRYPTO_PUNKS_REWARD = cryptoPunksReward;

        require(
            erc721NFTCollections.length == erc721NFTBendRewards.length,
            "should assign bend reward to each nft collection"
        );
        ERC721_NFT_WHITELIST = erc721NFTCollections;
        ERC721_NFT_BEND_REWARD = erc721NFTBendRewards;
    }

    modifier whenClaimAvailable() {
        require(
            block.number >= START_BLOCK,
            "too early to claim, please wait until the competition starts"
        );
        require(block.number <= END_BLOCK, "too late to claim");

        _;
    }

    function claimWithERC721()
        external
        whenNotPaused
        whenClaimAvailable
        nonReentrant
    {
        uint256 bendBalance = IERC20(BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        require(bendBalance > 0, "insufficient bend balance");

        uint256 amountToClaimed = 0;

        for (
            uint256 collectionIndex = 0;
            collectionIndex < ERC721_NFT_WHITELIST.length && bendBalance > 0;
            collectionIndex++
        ) {
            address nft = ERC721_NFT_WHITELIST[collectionIndex];
            uint256 reward = ERC721_NFT_BEND_REWARD[collectionIndex];

            uint256 balance = IERC721Enumerable(nft).balanceOf(msg.sender);
            for (uint256 i = 0; i < balance && bendBalance > 0; i++) {
                uint256 tokenId = IERC721Enumerable(nft).tokenOfOwnerByIndex(
                    msg.sender,
                    i
                );

                if (claimedRecord[nft][tokenId] == address(0)) {
                    claimedRecord[nft][tokenId] = msg.sender;
                    claimedCount[nft]++;

                    if (reward > bendBalance) {
                        reward = bendBalance;
                    }

                    amountToClaimed += reward;
                    bendBalance -= reward;
                    emit Claimed(nft, tokenId, msg.sender, reward);
                }
            }
        }

        IERC20(BEND_TOKEN_ADDRESS).transfer(msg.sender, amountToClaimed);
    }

    function claimWithCryptoPunks(uint256[] calldata punkIndexes)
        external
        whenNotPaused
        whenClaimAvailable
        nonReentrant
    {
        uint256 bendBalance = IERC20(BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        require(bendBalance > 0, "insufficient bend balance");

        uint256 amountToClaimed = 0;
        uint256 reward = CRYPTO_PUNKS_REWARD;

        for (uint256 i = 0; i < punkIndexes.length && bendBalance > 0; i++) {
            uint256 punkIndex = punkIndexes[i];
            address owner = ICryptoPunks(CRYPTO_PUNKS_ADDRESS)
                .punkIndexToAddress(punkIndex);

            require(owner == msg.sender, "you are not the owner of punk");

            if (claimedRecord[CRYPTO_PUNKS_ADDRESS][i] == address(0)) {
                claimedRecord[CRYPTO_PUNKS_ADDRESS][i] = msg.sender;
                claimedCount[CRYPTO_PUNKS_ADDRESS]++;

                if (reward > bendBalance) {
                    reward = bendBalance;
                }

                amountToClaimed += reward;
                bendBalance -= reward;
                emit Claimed(
                    CRYPTO_PUNKS_ADDRESS,
                    punkIndex,
                    msg.sender,
                    reward
                );
            }
        }

        IERC20(BEND_TOKEN_ADDRESS).transfer(msg.sender, amountToClaimed);
    }

    function claimWithETH()
        external
        payable
        whenNotPaused
        whenClaimAvailable
        nonReentrant
    {
        uint256 bendBalance = IERC20(BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        require(bendBalance > 0, "insufficient bend balance");
        uint256 amountToClaimed = (msg.value * BEND_TOKEN_REWARD_PER_ETH) /
            10**18;

        if (amountToClaimed > bendBalance) {
            amountToClaimed = bendBalance;
        }

        emit Claimed(address(0), 0, msg.sender, amountToClaimed);

        IERC20(BEND_TOKEN_ADDRESS).transfer(msg.sender, amountToClaimed);
    }

    function burn() external onlyOwner {
        uint256 bendBalance = IERC20(BEND_TOKEN_ADDRESS).balanceOf(msg.sender);
        IERC20(BEND_TOKEN_ADDRESS).transfer(address(0), bendBalance);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function activate(uint256 startBlock, uint256 endBlock) public onlyOwner {
        require(
            startBlock < endBlock,
            "start block should be less than end block"
        );
        require(
            endBlock > block.number,
            "end block should be greater than current block"
        );

        START_BLOCK = startBlock;
        END_BLOCK = endBlock;

        emit Activate(msg.sender, START_BLOCK, END_BLOCK);
    }

    function emergencyTokenTransfer(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }

    function emergencyEtherTransfer(address to, uint256 amount)
        external
        onlyOwner
    {
        _safeTransferETH(to, amount);
    }

    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, "ETH_TRANSFER_FAILED");
    }
}
