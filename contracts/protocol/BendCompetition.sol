// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ICryptoPunks} from "../interfaces/ICryptoPunks.sol";
import {IWETHGateway} from "../interfaces/IWETHGateway.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

contract BendCompetition is Ownable, ReentrancyGuard, Pausable {
    struct SystemParameter {
        uint256 TARGET_ETH_PAYMENT;
        uint256 AUTO_DRAW_DIVIDEND_THRESHOLD;
        uint256 LEND_POOL_SHARE;
        uint256[2] TIMESTAMP_RANGE;
        uint256 BEND_TOKEN_REWARD_PER_ETH_PER_NFT;
        uint256 MAX_ETH_PAYMENT_PER_NFT;
    }

    struct AddressConfig {
        address WETH_GATEWAY;
        address TREASURY;
        address BEND_TOKEN;
        address CRYPTO_PUNKS;
        address[] ERC721_NFT;
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

    SystemParameter public SYSTEM_PARAMETER;
    AddressConfig public ADDRESS_CONFIG;

    // nft colelction address => token id => eth payment
    mapping(address => mapping(uint256 => uint256)) public ethPaymentRecord;
    uint256 public ethPaymentTotal;
    uint256 public dividend;
    uint256 public bendClaimed;

    event Activate(
        address indexed operator,
        uint256 startTimestamp,
        uint256 endTimestamp
    );

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

    constructor(
        SystemParameter memory systemParameter,
        AddressConfig memory addressConfig
    ) {
        SYSTEM_PARAMETER = systemParameter;
        ADDRESS_CONFIG = addressConfig;

        activate();
    }

    function claim(uint256[] calldata punkIndexes)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        require(
            block.timestamp >= SYSTEM_PARAMETER.TIMESTAMP_RANGE[0],
            "too early to claim, please wait until the competition starts"
        );

        require(
            block.timestamp <= SYSTEM_PARAMETER.TIMESTAMP_RANGE[1],
            "too late to claim"
        );

        require(
            ethPaymentTotal < SYSTEM_PARAMETER.TARGET_ETH_PAYMENT,
            "too late to claim, enough eth payment has been made"
        );

        uint256 bendBalance = IERC20(ADDRESS_CONFIG.BEND_TOKEN).balanceOf(
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
        if (
            ADDRESS_CONFIG.WETH_GATEWAY == address(0) ||
            ADDRESS_CONFIG.TREASURY == address(0)
        ) {
            return;
        }

        uint256 amountToPool = (dividend * SYSTEM_PARAMETER.LEND_POOL_SHARE) /
            100;
        uint256 amountToTreasury = dividend - amountToPool;
        dividend = 0;

        IWETHGateway(ADDRESS_CONFIG.WETH_GATEWAY).depositETH{
            value: amountToPool
        }(owner(), 0);
        _safeTransferETH(ADDRESS_CONFIG.TREASURY, amountToTreasury);

        emit DrawDividend(msg.sender, amountToPool, amountToTreasury);
    }

    function burn() external onlyOwner {
        uint256 bendBalance = IERC20(ADDRESS_CONFIG.BEND_TOKEN).balanceOf(
            msg.sender
        );
        IERC20(IERC20(ADDRESS_CONFIG.BEND_TOKEN)).transfer(
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

    function activate() public onlyOwner {
        require(
            SYSTEM_PARAMETER.TIMESTAMP_RANGE[0] <
                SYSTEM_PARAMETER.TIMESTAMP_RANGE[1],
            "start timestamp should be less than end timestamp"
        );

        emit Activate(
            msg.sender,
            SYSTEM_PARAMETER.TIMESTAMP_RANGE[0],
            SYSTEM_PARAMETER.TIMESTAMP_RANGE[1]
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

    function uiData(uint256[] calldata punkIndexes)
        external
        view
        returns (UIData memory data)
    {
        data.startTimestamp = SYSTEM_PARAMETER.TIMESTAMP_RANGE[0];
        data.endTimestamp = SYSTEM_PARAMETER.TIMESTAMP_RANGE[1];
        data.remainDivident = dividend;
        data.bendClaimed = bendClaimed;
        data.bendBalance = IERC20(ADDRESS_CONFIG.BEND_TOKEN).balanceOf(
            address(this)
        );
        data.bendPrice =
            ((1 * 10**18) /
                SYSTEM_PARAMETER.BEND_TOKEN_REWARD_PER_ETH_PER_NFT) *
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

    function _getClaimData(uint256 ethBalance, uint256[] calldata punkIndexes)
        internal
        view
        returns (ClaimData[] memory data)
    {
        if (
            block.timestamp < SYSTEM_PARAMETER.TIMESTAMP_RANGE[0] ||
            block.timestamp > SYSTEM_PARAMETER.TIMESTAMP_RANGE[1] ||
            ethPaymentTotal >= SYSTEM_PARAMETER.TARGET_ETH_PAYMENT
        ) {
            return data;
        }

        uint256 bendBalance = IERC20(ADDRESS_CONFIG.BEND_TOKEN).balanceOf(
            address(this)
        );
        if (bendBalance <= 0) {
            return data;
        }

        if (
            ethBalance > SYSTEM_PARAMETER.TARGET_ETH_PAYMENT - ethPaymentTotal
        ) {
            ethBalance = SYSTEM_PARAMETER.TARGET_ETH_PAYMENT - ethPaymentTotal;
        }

        uint256 nftBalance = punkIndexes.length;

        for (
            uint256 collectionIndex = 0;
            collectionIndex < ADDRESS_CONFIG.ERC721_NFT.length &&
                bendBalance > 0 &&
                ethBalance > 0;
            collectionIndex++
        ) {
            address nft = ADDRESS_CONFIG.ERC721_NFT[collectionIndex];

            uint256 balance = IERC721Enumerable(nft).balanceOf(msg.sender);
            nftBalance += balance;
        }

        uint256 arrayIndex = 0;
        ClaimData[] memory array = new ClaimData[](nftBalance);

        for (
            uint256 collectionIndex = 0;
            collectionIndex < ADDRESS_CONFIG.ERC721_NFT.length &&
                bendBalance > 0 &&
                ethBalance > 0;
            collectionIndex++
        ) {
            address nft = ADDRESS_CONFIG.ERC721_NFT[collectionIndex];

            uint256 balance = IERC721Enumerable(nft).balanceOf(msg.sender);
            for (uint256 i = 0; i < balance && bendBalance > 0; i++) {
                uint256 tokenId = IERC721Enumerable(nft).tokenOfOwnerByIndex(
                    msg.sender,
                    i
                );

                if (
                    ethPaymentRecord[nft][tokenId] <
                    SYSTEM_PARAMETER.MAX_ETH_PAYMENT_PER_NFT
                ) {
                    uint256 payment = SYSTEM_PARAMETER.MAX_ETH_PAYMENT_PER_NFT -
                        ethPaymentRecord[nft][tokenId];
                    if (payment > ethBalance) {
                        payment = ethBalance;
                    }

                    uint256 reward = (payment *
                        SYSTEM_PARAMETER.BEND_TOKEN_REWARD_PER_ETH_PER_NFT) /
                        10**18;

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
            address owner = ICryptoPunks(ADDRESS_CONFIG.CRYPTO_PUNKS)
                .punkIndexToAddress(punkIndex);

            require(owner == msg.sender, "you are not the owner of punk");

            if (
                ethPaymentRecord[ADDRESS_CONFIG.CRYPTO_PUNKS][punkIndex] <
                SYSTEM_PARAMETER.MAX_ETH_PAYMENT_PER_NFT
            ) {
                uint256 payment = SYSTEM_PARAMETER.MAX_ETH_PAYMENT_PER_NFT -
                    ethPaymentRecord[ADDRESS_CONFIG.CRYPTO_PUNKS][punkIndex];
                if (payment > ethBalance) {
                    payment = ethBalance;
                }

                uint256 reward = (payment *
                    SYSTEM_PARAMETER.BEND_TOKEN_REWARD_PER_ETH_PER_NFT) /
                    10**18;

                if (reward > bendBalance) {
                    reward = bendBalance;
                }

                ethBalance -= payment;
                bendBalance -= reward;

                array[arrayIndex++] = ClaimData(
                    ADDRESS_CONFIG.CRYPTO_PUNKS,
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
        IERC20(ADDRESS_CONFIG.BEND_TOKEN).transfer(msg.sender, reward);

        uint256 ethRemain = msg.value - payment;
        if (ethRemain > 0) {
            _safeTransferETH(msg.sender, ethRemain);
        }

        ethPaymentTotal += payment;
        dividend += payment;
        bendClaimed += reward;
        if (dividend > SYSTEM_PARAMETER.AUTO_DRAW_DIVIDEND_THRESHOLD) {
            drawDividend();
        }
    }
}
