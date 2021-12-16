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
    uint256 public PHRASE_ONE_END_BLOCK;
    uint256 public PHRASE_TWO_END_BLOCK;
    address public immutable BEND_TOKEN_ADDRESS;
    uint256 public immutable BEND_TOKEN_REWARD_PER_ETH;
    address public immutable CRYPTO_PUNKS_ADDRESS;
    address[] public ERC721_NFT_WHITELIST;
    uint256 public immutable BEND_TOKEN_REWARD_PER_ETH_PER_NFT;
    uint256 public immutable MAX_ETH_PAYMENT_PER_NFT;

    // nft colelction address => token id => eth payment
    mapping(address => mapping(uint256 => uint256)) public ethPaymentRecord;
    mapping(address => uint256) public claimedCount;

    event Activate(
        address indexed operator,
        uint256 startBlock,
        uint256 phraseOneEndBlock,
        uint256 phraseTwoEndBlock
    );

    event Claimed(
        address indexed addr, // address(0) if eth
        uint256 indexed tokenId,
        address indexed owner,
        uint256 eth,
        uint256 bend
    );

    event Burned(address indexed operator);

    constructor(
        uint256 startBlock,
        uint256 phraseOneEndBlock,
        uint256 phraseTwoEndBlock,
        address bendTokenAddress,
        uint256 bendTokenRewardPerETH,
        address cryptoPunksAddress,
        address[] memory erc721NFTCollections,
        uint256 bendTokenRewardPerETHPerNFT,
        uint256 maxETHPaymentPerNFT
    ) {
        BEND_TOKEN_ADDRESS = bendTokenAddress;
        BEND_TOKEN_REWARD_PER_ETH = bendTokenRewardPerETH;
        CRYPTO_PUNKS_ADDRESS = cryptoPunksAddress;
        ERC721_NFT_WHITELIST = erc721NFTCollections;
        BEND_TOKEN_REWARD_PER_ETH_PER_NFT = bendTokenRewardPerETHPerNFT;
        MAX_ETH_PAYMENT_PER_NFT = maxETHPaymentPerNFT;

        activate(startBlock, phraseOneEndBlock, phraseTwoEndBlock);
    }

    modifier whenPhraseOneAvailable() {
        require(
            block.number >= START_BLOCK,
            "too early to claim, please wait until the competition starts"
        );
        require(
            block.number < PHRASE_ONE_END_BLOCK,
            "too late to claim for phrase one"
        );

        _;
    }

    modifier whenPhraseTwoAvailable() {
        require(
            block.number >= PHRASE_ONE_END_BLOCK,
            "too early to claim, please wait until the competition starts"
        );
        require(
            block.number < PHRASE_TWO_END_BLOCK,
            "too late to claim for phrase two"
        );

        _;
    }

    function claimWithERC721()
        external
        payable
        whenNotPaused
        whenPhraseOneAvailable
        nonReentrant
    {
        uint256 bendBalance = IERC20(BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        require(bendBalance > 0, "insufficient bend balance");

        uint256 bendReward = 0;
        uint256 ethBalance = msg.value;

        for (
            uint256 collectionIndex = 0;
            collectionIndex < ERC721_NFT_WHITELIST.length &&
                bendBalance > 0 &&
                ethBalance > 0;
            collectionIndex++
        ) {
            address nft = ERC721_NFT_WHITELIST[collectionIndex];

            uint256 balance = IERC721Enumerable(nft).balanceOf(msg.sender);
            for (uint256 i = 0; i < balance && bendBalance > 0; i++) {
                uint256 tokenId = IERC721Enumerable(nft).tokenOfOwnerByIndex(
                    msg.sender,
                    i
                );

                if (ethPaymentRecord[nft][tokenId] < MAX_ETH_PAYMENT_PER_NFT) {
                    uint256 payment = MAX_ETH_PAYMENT_PER_NFT -
                        ethPaymentRecord[nft][tokenId];
                    if (payment > ethBalance) {
                        payment = ethBalance;
                    }

                    uint256 reward = (payment *
                        BEND_TOKEN_REWARD_PER_ETH_PER_NFT) / 10**18;

                    if (reward > bendBalance) {
                        reward = bendBalance;
                    }

                    ethBalance -= payment;
                    bendReward += reward;
                    bendBalance -= reward;
                    claimedCount[nft]++;
                    ethPaymentRecord[nft][tokenId] += payment;
                    emit Claimed(nft, tokenId, msg.sender, payment, reward);
                }
            }
        }

        _claimBendWithETH(msg.value - ethBalance, bendReward);
    }

    function claimWithCryptoPunks(uint256[] calldata punkIndexes)
        external
        payable
        whenNotPaused
        whenPhraseOneAvailable
        nonReentrant
    {
        uint256 bendBalance = IERC20(BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        require(bendBalance > 0, "insufficient bend balance");

        uint256 bendReward = 0;
        uint256 ethBalance = msg.value;

        for (uint256 i = 0; i < punkIndexes.length && bendBalance > 0; i++) {
            uint256 punkIndex = punkIndexes[i];
            address owner = ICryptoPunks(CRYPTO_PUNKS_ADDRESS)
                .punkIndexToAddress(punkIndex);

            require(owner == msg.sender, "you are not the owner of punk");

            if (
                ethPaymentRecord[CRYPTO_PUNKS_ADDRESS][punkIndex] <
                MAX_ETH_PAYMENT_PER_NFT
            ) {
                uint256 payment = MAX_ETH_PAYMENT_PER_NFT -
                    ethPaymentRecord[CRYPTO_PUNKS_ADDRESS][punkIndex];
                if (payment > ethBalance) {
                    payment = ethBalance;
                }

                uint256 reward = (payment * BEND_TOKEN_REWARD_PER_ETH_PER_NFT) /
                    10**18;

                if (reward > bendBalance) {
                    reward = bendBalance;
                }

                ethBalance -= payment;
                bendReward += reward;
                bendBalance -= reward;
                claimedCount[CRYPTO_PUNKS_ADDRESS]++;
                ethPaymentRecord[CRYPTO_PUNKS_ADDRESS][punkIndex] += payment;

                emit Claimed(
                    CRYPTO_PUNKS_ADDRESS,
                    punkIndex,
                    msg.sender,
                    payment,
                    reward
                );
            }
        }

        _claimBendWithETH(msg.value - ethBalance, bendReward);
    }

    function claimWithETH()
        external
        payable
        whenNotPaused
        whenPhraseTwoAvailable
        nonReentrant
    {
        uint256 bendBalance = IERC20(BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        require(bendBalance > 0, "insufficient bend balance");
        uint256 bendReward = (msg.value * BEND_TOKEN_REWARD_PER_ETH) / 10**18;

        if (bendReward > bendBalance) {
            bendReward = bendBalance;
        }

        emit Claimed(address(0), 0, msg.sender, msg.value, bendReward);

        _claimBendWithETH(msg.value, bendReward);
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

    function activate(
        uint256 startBlock,
        uint256 phraseOneEndBlock,
        uint256 phraseTwoEndBlock
    ) public onlyOwner {
        require(
            startBlock < phraseOneEndBlock,
            "start block should be less than end block"
        );
        require(
            phraseOneEndBlock < phraseTwoEndBlock,
            "phrase two end block should be greater than phrase one end block"
        );

        START_BLOCK = startBlock;
        PHRASE_ONE_END_BLOCK = phraseOneEndBlock;
        PHRASE_TWO_END_BLOCK = phraseTwoEndBlock;

        emit Activate(
            msg.sender,
            START_BLOCK,
            PHRASE_ONE_END_BLOCK,
            PHRASE_TWO_END_BLOCK
        );
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

    function _claimBendWithETH(uint256 payment, uint256 reward) internal {
        IERC20(BEND_TOKEN_ADDRESS).transfer(msg.sender, reward);
        uint256 ethRemain = msg.value - payment;
        if (ethRemain > 0) {
            _safeTransferETH(msg.sender, ethRemain);
        }
    }
}
