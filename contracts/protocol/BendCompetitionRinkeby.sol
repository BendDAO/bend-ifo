// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {BendCompetition} from "./BendCompetition.sol";

contract BendCompetitionRinkeby is BendCompetition {
    function getConfig() public pure override returns (Config memory config) {
        config.BEND_TOKEN_ADDRESS = address(
            0xe375EC95ecd0ACd4c2a04Bfb0f576f4A89097734
        );
        config.TEAM_WALLET_ADDRESS = address(
            0x844d603F22dE09F4586d2C5f3a01B5c8f42a65C9
        );
        config.AUTO_DRAW_DIVIDEND_THRESHOLD = 100 * 10**18;
        config.BEND_TOKEN_REWARD_PER_ETH = 3 * 10**18;
        config.MAX_ETH_PAYMENT_PER_ADDR = 1 * 10**18;
        config.VEBEND_ADDRESS = address(
            0x13b5d4FC8AcFD8e273C3B401F1B2D9e984C05e0A
        );
        config.VEBEND_LOCK_MIN_PERIOD = 14 days;

        return config;
    }
}
