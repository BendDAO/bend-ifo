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
    enum Stage {
        Prepare,
        PrivateSale,
        PublicSale,
        Finish
    }

    struct Config {
        address BEND_TOKEN_ADDRESS;
        address WETH_GATEWAY_ADDRESS;
        address TREASURY_ADDRESS;
        uint256 AUTO_DRAW_DIVIDEND_THRESHOLD;
        uint256 LEND_POOL_SHARE;
        uint256 BEND_TOKEN_REWARD_PER_ETH;
        uint256 MAX_ETH_PAYMENT_PER_ADDR;
    }

    struct UIData {
        // for all
        uint256 remainDivident;
        uint256 bendClaimedTotal;
        uint256 bendPrice;
        uint256 remainBendBalance;
        Stage stage;
        // for current address
        uint256 bendBalance;
        uint256 maxETHPayment;
        uint256 maxBendReward;
    }

    Stage public stage;
    mapping(address => uint256) public ethPaymentRecord;
    uint256 public ethPaymentTotal;
    uint256 public bendClaimedTotal;
    uint256 public remainDivident;

    event Claimed(
        address indexed owner,
        uint256 ethPayment,
        uint256 bendReward
    );

    event DrawDividend(
        address indexed operator,
        uint256 amountToPool,
        uint256 amountToTreasury
    );

    function getConfig() public view virtual returns (Config memory config) {}

    function isInPrivateSaleWhitelist(address addr)
        public
        view
        virtual
        returns (bool)
    {}

    function nextStage() public onlyOwner {
        if (stage == Stage.Prepare) {
            stage = Stage.PrivateSale;
        } else if (stage == Stage.PrivateSale) {
            stage = Stage.PublicSale;
        } else if (stage == Stage.PublicSale) {
            stage = Stage.Finish;
        } else {
            revert();
        }
    }

    function claim() external payable whenNotPaused nonReentrant {
        Config memory CONFIG = getConfig();
        require(
            ((stage == Stage.PublicSale) ||
                (stage == Stage.PrivateSale &&
                    isInPrivateSaleWhitelist(msg.sender))),
            "not in the right stage or not in the whitelist"
        );

        (uint256 ethPayment, uint256 bendReward) = _getClaimData(msg.value);

        ethPaymentRecord[msg.sender] += ethPayment;
        ethPaymentTotal += ethPayment;
        remainDivident += ethPayment;
        bendClaimedTotal += bendReward;

        IERC20(CONFIG.BEND_TOKEN_ADDRESS).transfer(msg.sender, bendReward);

        uint256 ethRemain = msg.value - ethPayment;
        if (ethRemain > 0) {
            _safeTransferETH(msg.sender, ethRemain);
        }

        if (remainDivident >= CONFIG.AUTO_DRAW_DIVIDEND_THRESHOLD) {
            drawDividend();
        }

        emit Claimed(msg.sender, ethPayment, bendReward);
    }

    function drawDividend() public {
        Config memory CONFIG = getConfig();
        if (
            CONFIG.WETH_GATEWAY_ADDRESS == address(0) ||
            CONFIG.TREASURY_ADDRESS == address(0)
        ) {
            return;
        }

        uint256 amountToPool = (remainDivident * CONFIG.LEND_POOL_SHARE) /
            10000;
        uint256 amountToTreasury = remainDivident - amountToPool;
        remainDivident = 0;

        IWETHGateway(CONFIG.WETH_GATEWAY_ADDRESS).depositETH{
            value: amountToPool
        }(owner(), 0);
        _safeTransferETH(CONFIG.TREASURY_ADDRESS, amountToTreasury);

        emit DrawDividend(msg.sender, amountToPool, amountToTreasury);
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

    function uiData() external view returns (UIData memory data) {
        Config memory CONFIG = getConfig();

        data.remainDivident = remainDivident;
        data.bendClaimedTotal = bendClaimedTotal;
        data.bendPrice =
            ((1 * 10**18) / CONFIG.BEND_TOKEN_REWARD_PER_ETH) *
            10**18;
        data.remainBendBalance = IERC20(CONFIG.BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        data.stage = stage;

        if (msg.sender == address(0)) {
            return data;
        }

        data.bendBalance = IERC20(CONFIG.BEND_TOKEN_ADDRESS).balanceOf(
            msg.sender
        );
        (data.maxETHPayment, data.maxBendReward) = _getClaimData(
            type(uint256).max
        );

        return data;
    }

    function _getClaimData(uint256 ethBalance)
        internal
        view
        returns (uint256 ethPayment, uint256 bendReward)
    {
        if (msg.sender == address(0)) {
            return (0, 0);
        }

        Config memory CONFIG = getConfig();
        uint256 bendBalance = IERC20(CONFIG.BEND_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        if (bendBalance <= 0) {
            return (ethPayment, bendReward);
        }

        ethPayment =
            CONFIG.MAX_ETH_PAYMENT_PER_ADDR -
            ethPaymentRecord[msg.sender];

        if (ethPayment > ethBalance) {
            ethPayment = ethBalance;
        }

        bendReward = (ethPayment * CONFIG.BEND_TOKEN_REWARD_PER_ETH) / 10**18;

        if (bendReward > bendBalance) {
            bendReward = bendBalance;
            ethPayment =
                (bendReward * 10**18) /
                CONFIG.BEND_TOKEN_REWARD_PER_ETH;
        }

        return (ethPayment, bendReward);
    }

    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, "ETH_TRANSFER_FAILED");
    }
}
