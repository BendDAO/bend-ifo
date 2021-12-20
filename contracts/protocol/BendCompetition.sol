// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ICryptoPunks} from "../interfaces/ICryptoPunks.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

contract BendCompetition is Ownable, ReentrancyGuard, Pausable {
    uint256 public constant TARGET_ETH_PAYMENT = 5000 * 10**18;
    uint256[2] public ETH_PAYMENT_RATIO = [100 * 10**18, 10 * 10**18];

    uint256 public START_BLOCK;
    uint256 public END_BLOCK;
    address public immutable BEND_TOKEN_ADDRESS;
    uint256 public immutable BEND_TOKEN_REWARD_PER_ETH;
    address public immutable CRYPTO_PUNKS_ADDRESS;
    address[] public ERC721_NFT_WHITELIST;
    uint256 public immutable BEND_TOKEN_REWARD_PER_ETH_PER_NFT;
    uint256 public immutable MAX_ETH_PAYMENT_PER_NFT;

    // nft colelction address => token id => eth payment
    mapping(address => mapping(uint256 => uint256)) public ethPaymentRecord;
    mapping(address => uint256) public claimedCount;

    uint256 ethPaymentForNFT;
    uint256 ethPaymentForETH;

    event Activate(
        address indexed operator,
        uint256 startBlock,
        uint256 endBlock
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
        uint256 endBlock,
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

        activate(startBlock, endBlock);
    }

    modifier whenClaimable() {
        require(
            block.number >= START_BLOCK,
            "too early to claim, please wait until the competition starts"
        );

        require(block.number <= END_BLOCK, "too late to claim");

        require(
            ethPaymentForETH + ethPaymentForNFT <= TARGET_ETH_PAYMENT,
            "too late, enough eth paid"
        );

        _;
    }

    function claimWithERC721()
        external
        payable
        whenNotPaused
        whenClaimable
        nonReentrant
    {
        uint256 bendBalance = IERC20(BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        require(bendBalance > 0, "insufficient bend balance");

        uint256 maxETHPaymentForNFT = MAX_ETH_PAYMENT_FOR_NFT();
        require(maxETHPaymentForNFT > 0, "no more quote available");

        uint256 bendReward = 0;
        uint256 ethBalance = msg.value;

        if (ethBalance > maxETHPaymentForNFT) {
            ethBalance = maxETHPaymentForNFT;
        }

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

        ethPaymentForNFT += msg.value - ethBalance;
        _claimBendWithETH(msg.value - ethBalance, bendReward);
    }

    function claimWithCryptoPunks(uint256[] calldata punkIndexes)
        external
        payable
        whenNotPaused
        whenClaimable
        nonReentrant
    {
        uint256 bendBalance = IERC20(BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        require(bendBalance > 0, "insufficient bend balance");

        uint256 maxETHPaymentForNFT = MAX_ETH_PAYMENT_FOR_NFT();
        require(maxETHPaymentForNFT > 0, "no more quote available");

        uint256 bendReward = 0;
        uint256 ethBalance = msg.value;

        if (ethBalance > maxETHPaymentForNFT) {
            ethBalance = maxETHPaymentForNFT;
        }

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

        ethPaymentForNFT += msg.value - ethBalance;
        _claimBendWithETH(msg.value - ethBalance, bendReward);
    }

    function claimWithETH()
        external
        payable
        whenNotPaused
        whenClaimable
        nonReentrant
    {
        uint256 bendBalance = IERC20(BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        require(bendBalance > 0, "insufficient bend balance");

        uint256 maxETHPaymentForETH = MAX_ETH_PAYMENT_FOR_ETH();
        require(maxETHPaymentForETH > 0, "too late, enough eth paid");

        uint256 ethBalance = msg.value;
        if (ethBalance > maxETHPaymentForETH) {
            ethBalance = maxETHPaymentForETH;
        }

        uint256 bendReward = (ethBalance * BEND_TOKEN_REWARD_PER_ETH) / 10**18;
        if (bendReward > bendBalance) {
            bendReward = bendBalance;
            ethBalance = (bendReward * 10**18) / BEND_TOKEN_REWARD_PER_ETH;
        }

        emit Claimed(address(0), 0, msg.sender, ethBalance, bendReward);

        ethPaymentForETH += ethBalance;
        _claimBendWithETH(ethBalance, bendReward);
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

    function MAX_ETH_PAYMENT_FOR_NFT() public view returns (uint256) {
        return TARGET_ETH_PAYMENT - ethPaymentForNFT - ethPaymentForETH;
    }

    function MAX_ETH_PAYMENT_FOR_ETH() public view returns (uint256) {
        uint256 payment = (ethPaymentForNFT / ETH_PAYMENT_RATIO[0]) *
            ETH_PAYMENT_RATIO[1] -
            ethPaymentForETH;

        uint256 remain = TARGET_ETH_PAYMENT -
            ethPaymentForNFT -
            ethPaymentForETH;

        return payment > remain ? remain : payment;
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
