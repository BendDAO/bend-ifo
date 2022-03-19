// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {BendCompetition} from "./BendCompetition.sol";

contract BendCompetitionRinkeby is BendCompetition {
    function getConfig() public pure override returns (Config memory config) {
        config.BEND_TOKEN_ADDRESS = address(
            0x0791A14d100bc773446adEf6570b71406A18fAA8
        );
        config.WETH_GATEWAY_ADDRESS = address(
            0x0f8DDEC5835c67C68c4A02dDe2236D20bEEA889d
        );
        config.TREASURY_ADDRESS = address(
            0x3Ef03697a005203589653d80AD885E3b85256D18
        );
        config.AUTO_DRAW_DIVIDEND_THRESHOLD = 100 * 10**18;
        config.LEND_POOL_SHARE = 8000;
        config.BEND_TOKEN_REWARD_PER_ETH = 1 * 10**18;
        config.MAX_ETH_PAYMENT_PER_ADDR = 1 * 10**18;
        config.VEBEND_ADDRESS = address(
            0x52163eedA5Ab66aeaCe49C6cbEaa062540962660
        );
        config.VEBEND_LOCK_PERIOD = 7 days;

        return config;
    }
}
