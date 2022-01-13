// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ICryptoPunks} from "../interfaces/ICryptoPunks.sol";
import {IWETHGateway} from "../interfaces/IWETHGateway.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

abstract contract BendCompetition is Ownable, ReentrancyGuard, Pausable {
    struct Config {
        address BEND_TOKEN_ADDRESS;
        address WETH_GATEWAY_ADDRESS;
        address TREASURY_ADDRESS;
        address CRYPTO_PUNKS_ADDRESS;
        address[] ERC721_NFT_ADDRESSES;
        uint256 START_TIMESTAMP;
        uint256 END_TIMESTAMP;
        uint256 AUTO_DRAW_DIVIDEND_THRESHOLD;
        uint256 LEND_POOL_SHARE;
        uint256 BEND_TOKEN_REWARD_PER_ETH_PER_NFT;
        uint256 MAX_ETH_PAYMENT_PER_NFT;
    }

    struct ClaimData {
        address addr;
        uint256 tokenId;
        uint256 ethPayment;
        uint256 bendReward;
    }

    struct UIData {
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 remainDivident;
        uint256 bendClaimed;
        uint256 bendBalance;
        uint256 bendPrice;
        uint256 maxETHPayment;
        uint256 maxBendReward;
        ClaimData[] claimData;
    }

    // nft colelction address => token id => eth payment
    mapping(address => mapping(uint256 => uint256)) public ethPaymentRecord;
    uint256 public ethPaymentTotal;
    uint256 public dividend;
    uint256 public bendClaimed;

    event Claimed(
        address indexed addr, // address(0) if eth
        uint256 indexed tokenId,
        address indexed owner,
        uint256 ethPayment,
        uint256 bendReward
    );

    event Burned(address indexed operator);

    event DrawDividend(
        address indexed operator,
        uint256 amountToPool,
        uint256 amountToTreasury
    );

    function getConfig() public view virtual returns (Config memory config) {}

    function claim(uint256[] calldata punkIndexes)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        Config memory CONFIG = getConfig();
        require(
            block.timestamp >= CONFIG.START_TIMESTAMP,
            "too early to claim, please wait until the competition starts"
        );

        require(block.timestamp <= CONFIG.END_TIMESTAMP, "too late to claim");

        uint256 bendBalance = IERC20(CONFIG.BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        require(bendBalance > 0, "insufficient bend balance");

        ClaimData[] memory datas = _getClaimData(msg.value, punkIndexes);

        uint256 ethPayment = 0;
        uint256 bendReward = 0;

        for (uint256 i = 0; i < datas.length; i++) {
            ClaimData memory data = datas[i];

            ethPayment += data.ethPayment;
            bendReward += data.bendReward;

            ethPaymentRecord[data.addr][data.tokenId] += data.ethPayment;

            emit Claimed(
                data.addr,
                data.tokenId,
                msg.sender,
                data.ethPayment,
                data.bendReward
            );
        }

        _claimBendWithETH(ethPayment, bendReward);
    }

    function drawDividend() public {
        Config memory CONFIG = getConfig();
        if (
            CONFIG.WETH_GATEWAY_ADDRESS == address(0) ||
            CONFIG.TREASURY_ADDRESS == address(0)
        ) {
            return;
        }

        uint256 amountToPool = (dividend * CONFIG.LEND_POOL_SHARE) / 10000;
        uint256 amountToTreasury = dividend - amountToPool;
        dividend = 0;

        IWETHGateway(CONFIG.WETH_GATEWAY_ADDRESS).depositETH{
            value: amountToPool
        }(owner(), 0);
        _safeTransferETH(CONFIG.TREASURY_ADDRESS, amountToTreasury);

        emit DrawDividend(msg.sender, amountToPool, amountToTreasury);
    }

    function burn() external onlyOwner {
        Config memory CONFIG = getConfig();
        uint256 bendBalance = IERC20(CONFIG.BEND_TOKEN_ADDRESS).balanceOf(
            msg.sender
        );
        IERC20(IERC20(CONFIG.BEND_TOKEN_ADDRESS)).transfer(
            address(0),
            bendBalance
        );

        emit Burned(msg.sender);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
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

    function uiData(uint256[] calldata punkIndexes)
        external
        view
        returns (UIData memory data)
    {
        Config memory CONFIG = getConfig();
        data.startTimestamp = CONFIG.START_TIMESTAMP;
        data.endTimestamp = CONFIG.END_TIMESTAMP;
        data.remainDivident = dividend;
        data.bendClaimed = bendClaimed;
        data.bendBalance = IERC20(CONFIG.BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        data.bendPrice =
            ((1 * 10**18) / CONFIG.BEND_TOKEN_REWARD_PER_ETH_PER_NFT) *
            10**18;

        ClaimData[] memory datas = _getClaimData(
            type(uint256).max,
            punkIndexes
        );
        data.claimData = datas;

        uint256 ethPayment = 0;
        uint256 bendReward = 0;

        for (uint256 i = 0; i < datas.length; i++) {
            ethPayment += datas[i].ethPayment;
            bendReward += datas[i].bendReward;
        }

        data.maxETHPayment = ethPayment;
        data.maxBendReward = bendReward;

        return data;
    }

    function _getNFTBalance(
        Config memory CONFIG,
        uint256[] calldata punkIndexes
    ) private view returns (uint256 balance) {
        balance = punkIndexes.length;

        for (
            uint256 collectionIndex = 0;
            collectionIndex < CONFIG.ERC721_NFT_ADDRESSES.length;
            collectionIndex++
        ) {
            address nft = CONFIG.ERC721_NFT_ADDRESSES[collectionIndex];

            balance += IERC721Enumerable(nft).balanceOf(msg.sender);
        }

        return balance;
    }

    function _getClaimData(uint256 ethBalance, uint256[] calldata punkIndexes)
        internal
        view
        returns (ClaimData[] memory data)
    {
        Config memory CONFIG = getConfig();
        if (
            block.timestamp < CONFIG.START_TIMESTAMP ||
            block.timestamp > CONFIG.END_TIMESTAMP
        ) {
            return data;
        }

        uint256 bendBalance = IERC20(CONFIG.BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        if (bendBalance <= 0) {
            return data;
        }

        uint256 arrayIndex = 0;
        ClaimData[] memory array = new ClaimData[](
            _getNFTBalance(CONFIG, punkIndexes)
        );

        for (
            uint256 collectionIndex = 0;
            collectionIndex < CONFIG.ERC721_NFT_ADDRESSES.length &&
                bendBalance > 0 &&
                ethBalance > 0;
            collectionIndex++
        ) {
            address nft = CONFIG.ERC721_NFT_ADDRESSES[collectionIndex];

            uint256 balance = IERC721Enumerable(nft).balanceOf(msg.sender);
            for (uint256 i = 0; i < balance && bendBalance > 0; i++) {
                uint256 tokenId = IERC721Enumerable(nft).tokenOfOwnerByIndex(
                    msg.sender,
                    i
                );

                if (
                    ethPaymentRecord[nft][tokenId] <
                    CONFIG.MAX_ETH_PAYMENT_PER_NFT
                ) {
                    uint256 payment = CONFIG.MAX_ETH_PAYMENT_PER_NFT -
                        ethPaymentRecord[nft][tokenId];
                    if (payment > ethBalance) {
                        payment = ethBalance;
                    }

                    uint256 reward = (payment *
                        CONFIG.BEND_TOKEN_REWARD_PER_ETH_PER_NFT) / 10**18;

                    if (reward > bendBalance) {
                        reward = bendBalance;
                    }

                    ethBalance -= payment;
                    bendBalance -= reward;

                    array[arrayIndex++] = ClaimData(
                        nft,
                        tokenId,
                        payment,
                        reward
                    );
                }
            }
        }

        for (uint256 i = 0; i < punkIndexes.length && bendBalance > 0; i++) {
            uint256 punkIndex = punkIndexes[i];
            address owner = ICryptoPunks(CONFIG.CRYPTO_PUNKS_ADDRESS)
                .punkIndexToAddress(punkIndex);

            require(owner == msg.sender, "you are not the owner of punk");

            if (
                ethPaymentRecord[CONFIG.CRYPTO_PUNKS_ADDRESS][punkIndex] <
                CONFIG.MAX_ETH_PAYMENT_PER_NFT
            ) {
                uint256 payment = CONFIG.MAX_ETH_PAYMENT_PER_NFT -
                    ethPaymentRecord[CONFIG.CRYPTO_PUNKS_ADDRESS][punkIndex];
                if (payment > ethBalance) {
                    payment = ethBalance;
                }

                uint256 reward = (payment *
                    CONFIG.BEND_TOKEN_REWARD_PER_ETH_PER_NFT) / 10**18;

                if (reward > bendBalance) {
                    reward = bendBalance;
                }

                ethBalance -= payment;
                bendBalance -= reward;

                array[arrayIndex++] = ClaimData(
                    CONFIG.CRYPTO_PUNKS_ADDRESS,
                    punkIndex,
                    payment,
                    reward
                );
            }
        }

        data = new ClaimData[](arrayIndex);
        for (uint256 i = 0; i < arrayIndex; i++) {
            data[i] = array[i];
        }
        return data;
    }

    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, "ETH_TRANSFER_FAILED");
    }

    function _claimBendWithETH(uint256 payment, uint256 reward) internal {
        Config memory CONFIG = getConfig();
        IERC20(CONFIG.BEND_TOKEN_ADDRESS).transfer(msg.sender, reward);

        uint256 ethRemain = msg.value - payment;
        if (ethRemain > 0) {
            _safeTransferETH(msg.sender, ethRemain);
        }

        ethPaymentTotal += payment;
        dividend += payment;
        bendClaimed += reward;
        if (dividend > CONFIG.AUTO_DRAW_DIVIDEND_THRESHOLD) {
            drawDividend();
        }
    }
}
