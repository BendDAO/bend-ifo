// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {BendCompetition} from "./BendCompetition.sol";

contract BendCompetitionRinkeby is BendCompetition {
    function initialize() external initializer {
        BendCompetition oldContract = BendCompetition(
            0xe2540F7CF4681D4d971e71BBD92daD3feC5b7D48
        );

        CONTRACT_CREATE_TIMESTAMP = oldContract.CONTRACT_CREATE_TIMESTAMP();
        ethPaymentTotal = oldContract.ethPaymentTotal();
        bendClaimedTotal = oldContract.bendClaimedTotal();
        remainDivident = oldContract.remainDivident();
    }

    function getConfig() public pure override returns (Config memory config) {
        config.TREASURY_ADDRESS = address(
            0x844d603F22dE09F4586d2C5f3a01B5c8f42a65C9
        );
        config.BEND_TOKEN_ADDRESS = address(
            0xe375EC95ecd0ACd4c2a04Bfb0f576f4A89097734
        );
        config.TEAM_WALLET_ADDRESS = address(
            0x844d603F22dE09F4586d2C5f3a01B5c8f42a65C9
        );
        config.AUTO_DRAW_DIVIDEND_THRESHOLD = 100 * 10**18;
        config.BEND_TOKEN_REWARD_PER_ETH = 333333 * 10**18;
        config.MAX_ETH_PAYMENT_PER_ADDR = 10000 * 10**18;
        config.VEBEND_ADDRESS = address(
            0x13b5d4FC8AcFD8e273C3B401F1B2D9e984C05e0A
        );
        config.VEBEND_LOCK_MIN_WEEK = 0;

        return config;
    }
}
