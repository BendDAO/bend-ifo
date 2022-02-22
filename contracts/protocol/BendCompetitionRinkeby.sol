// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {BendCompetition} from "./BendCompetition.sol";

contract BendCompetitionRinkeby is BendCompetition {
    mapping(address => bool) public PRIVATE_SALE_WHITELIST;

    constructor() {
        // TODO: replace with real whitelist address
        PRIVATE_SALE_WHITELIST[
            address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
        ] = true;
    }

    function getConfig() public pure override returns (Config memory config) {
        config.BEND_TOKEN_ADDRESS = address(
            0x0791A14d100bc773446adEf6570b71406A18fAA8
        );
        config.WETH_GATEWAY_ADDRESS = address(
            0x1aDF8093E66d8A48F97bCf1bA174845Ec013bBE3
        );
        config.TREASURY_ADDRESS = address(
            0x3Ef03697a005203589653d80AD885E3b85256D18
        );
        config.AUTO_DRAW_DIVIDEND_THRESHOLD = 100 * 10**18;
        config.LEND_POOL_SHARE = 8000;
        config.BEND_TOKEN_REWARD_PER_ETH = 1 * 10**18;
        config.MAX_ETH_PAYMENT_PER_ADDR = 1 * 10**18;

        return config;
    }

    function isInPrivateSaleWhitelist(address addr)
        public
        view
        override
        returns (bool)
    {
        return PRIVATE_SALE_WHITELIST[addr];
    }

    function addToWhitelist(address[] calldata addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            PRIVATE_SALE_WHITELIST[addresses[i]] = true;
        }
    }

    function removeFromWhitelist(address[] calldata addresses)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < addresses.length; i++) {
            PRIVATE_SALE_WHITELIST[addresses[i]] = false;
        }
    }
}
